import {createHash} from 'node:crypto';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import sharp from 'sharp';
import {playerDynamicTemplatePayloadSchema,syncDynamicConfigurationSchema,syncDomDescriptorMimeType,syncSlideAssets,syncSlidePosterTimeMs,type PlayerDynamicTemplateAsset,type SyncSlidePresentation} from '@veyocast/contracts';
import {createSyncStudioDocument} from '@veyocast/studio';
import {projectSyncDynamicSnapshot} from '@veyocast/content-templates/sync-dynamic-projector';
import {DynamicRenderBackendError,type ClaimedDynamicRenderJob} from './dynamic-render-backend';
import {loadVerifiedDynamicCaptureAssets} from './dynamic-capture-assets';
import {createSyncSlideCapture} from './sync-dom-capture';
import {encodeStudioMp4,probeAndValidateStudioMp4} from './studio-render-video';
import type {StudioExternalRenderer} from './studio-render-image';

export type SyncDynamicRenderArtifact={bytes:Uint8Array;byteLength:number;checksumSha256:string;width:number;height:number;mimeType:'image/png'|'video/mp4';durationMs:number;presentation:SyncSlidePresentation;poster:{bytes:Uint8Array;checksumSha256:string;byteLength:number}};
const uuid=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
function rejected(){return new DynamicRenderBackendError('sync_dynamic_configuration_invalid',false,'Dit gekoppelde ontwerp kon niet veilig worden samengesteld. De laatste goede uitzending blijft behouden.');}
function imageUnavailable(){return new DynamicRenderBackendError('sync_dynamic_asset_unavailable',true,'Een gecontroleerd bronbeeld is niet beschikbaar. De laatste goede uitzending blijft behouden.');}

export function prepareSyncDynamicPresentation({job,assets,now}:{job:ClaimedDynamicRenderJob;assets:Record<string,PlayerDynamicTemplateAsset>;now?:Date}){
 const data=job.snapshotData&&typeof job.snapshotData==='object'&&!Array.isArray(job.snapshotData)?job.snapshotData as Record<string,unknown>:null;
 const parsed=syncDynamicConfigurationSchema.safeParse(data?.syncConfiguration);
 if(!parsed.success||!job.templateVersionId||!uuid.test(job.templateVersionId)||!job.templateSlug||!job.snapshotHash||! /^[a-f0-9]{64}$/.test(job.snapshotHash)||parsed.data.slideType!==job.manifest.slideType||parsed.data.seed.orientation!==job.orientation)throw rejected();
 const cfg=parsed.data;
 const payload=playerDynamicTemplatePayloadSchema.safeParse({schemaVersion:1,data,assets,orientation:job.orientation,slideType:cfg.slideType,snapshotHash:job.snapshotHash,snapshotId:job.snapshotId,templateVersionId:job.templateVersionId,templateSlug:job.templateSlug});
 if(!payload.success)throw rejected();
 const generatedAt=typeof data?.generatedAt==='string'?new Date(data.generatedAt):null;
 if(!now&&(!generatedAt||!Number.isFinite(generatedAt.valueOf())))throw rejected();
 const projected=projectSyncDynamicSnapshot(payload.data,cfg.seed,now??generatedAt!);
 if(!projected.ok)throw new DynamicRenderBackendError(projected.code.toLowerCase(),false,'De volledige bronselectie past niet binnen dit ontwerp of kon niet veilig worden gelezen. Pas de selectie aan of verdeel de inhoud over een reeks. De laatste goede uitzending blijft behouden.');
 let document;try{document=createSyncStudioDocument(projected.presentation,cfg.secondsPerPage);}catch{throw rejected();}
 if(document.artboard.width!==job.manifest.canvas.width||document.artboard.height!==job.manifest.canvas.height)throw rejected();
 return {configuration:cfg,presentation:projected.presentation,document};
}

export function prepareSyncDynamicDescriptor(input:{job:ClaimedDynamicRenderJob;assets:Record<string,PlayerDynamicTemplateAsset>;now?:Date}){
 const prepared=prepareSyncDynamicPresentation(input);
 const refs=syncSlideAssets(prepared.presentation).filter(ref=>ref.kind==='tenant');
 const assets=Object.fromEntries([...new Set(refs.map(ref=>ref.mediaAssetId))].sort().map(id=>{
  const asset=input.assets[id];
  if(!asset||!asset.mimeType.startsWith('image/')||refs.some(ref=>ref.mediaAssetId===id&&ref.checksumSha256!==asset.checksumSha256))throw imageUnavailable();
  return [id,{checksumSha256:asset.checksumSha256,bytes:asset.bytes,mimeType:asset.mimeType}];
 }));
 const bytes=new TextEncoder().encode(JSON.stringify({schemaVersion:2,snapshotId:input.job.snapshotId,templateVersionId:input.job.templateVersionId,configuration:prepared.configuration,presentation:prepared.presentation,assets}));
 if(bytes.byteLength>550000)throw rejected();
 return {bytes,byteLength:bytes.byteLength,checksumSha256:createHash('sha256').update(bytes).digest('hex'),width:prepared.document.artboard.width,height:prepared.document.artboard.height,dom:{schemaVersion:2 as const,mimeType:syncDomDescriptorMimeType as typeof syncDomDescriptorMimeType,durationMs:prepared.document.motion.durationMs,presentation:prepared.presentation}};
}

/** The complete canonical snapshot is rendered, including every page. The
 * caller owns lease renewal and publication; this function cannot activate it. */
export async function renderSyncDynamicArtifact({job,assets,storageOrigin,renderer,signal,now,captureFactory=createSyncSlideCapture,encode=encodeStudioMp4,validateMp4=probeAndValidateStudioMp4}:{
 job:ClaimedDynamicRenderJob;assets:Record<string,PlayerDynamicTemplateAsset>;storageOrigin:string|undefined;renderer:StudioExternalRenderer;signal?:AbortSignal;now?:Date;
 captureFactory?:typeof createSyncSlideCapture;encode?:typeof encodeStudioMp4;validateMp4?:typeof probeAndValidateStudioMp4;
}):Promise<SyncDynamicRenderArtifact>{
 const {presentation,document}=prepareSyncDynamicPresentation({job,assets,now});
 const assetSources=await loadVerifiedDynamicCaptureAssets(syncSlideAssets(presentation).filter(asset=>asset.kind==='tenant'),assets,storageOrigin,imageUnavailable,signal);
 const capture=await captureFactory({presentation:presentation,durationMs:document.motion.durationMs,assetSources,signal});
 let directory:string|undefined;
 try{
  const poster=new Uint8Array(await capture.renderPng(syncSlidePosterTimeMs(presentation,document.motion.durationMs))),metadata=await sharp(poster).metadata();
  if(metadata.format!=='png'||metadata.width!==document.artboard.width||metadata.height!==document.artboard.height)throw rejected();
  let bytes=poster;
  if(document.motion.enabled){
   directory=await mkdtemp(join(tmpdir(),'veyocast-studio-render-sync-dynamic-'));const outputPath=join(directory,'complete-source.mp4');
   await encode({document,renderer,assetSources,renderFrame:time=>capture.renderRgba(time),outputPath,signal,timeoutMs:300000});
   await validateMp4({inputPath:outputPath,durationMs:document.motion.durationMs,expectedWidth:document.artboard.width,expectedHeight:document.artboard.height});
   bytes=new Uint8Array(await readFile(outputPath));
  }
  if(!bytes.byteLength||bytes.byteLength>524288000)throw rejected();
  return {bytes,byteLength:bytes.byteLength,checksumSha256:createHash('sha256').update(bytes).digest('hex'),width:document.artboard.width,height:document.artboard.height,mimeType:document.motion.enabled?'video/mp4':'image/png',durationMs:document.motion.durationMs,presentation:presentation,poster:{bytes:poster,byteLength:poster.byteLength,checksumSha256:createHash('sha256').update(poster).digest('hex')}};
 }finally{await capture.close().catch(()=>{});if(directory)await rm(directory,{recursive:true,force:true});}
}
