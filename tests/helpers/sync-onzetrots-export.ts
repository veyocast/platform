import {createServer} from 'node:http';
import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {syncSlideMinimumDurationMs,syncSlidePresentationSchema,type PlayerDynamicTemplateAsset} from '../../packages/contracts/src/index';
import {createSyncTemplatePreview} from '../../apps/control/app/(shell)/dashboard/studio/sync-template-preview';
import {createSyncSlideCapture} from '../../apps/media-worker/src/sync-dom-capture';
import {renderSyncDynamicArtifact} from '../../apps/media-worker/src/sync-dynamic-render';
import type {ClaimedDynamicRenderJob} from '../../apps/media-worker/src/dynamic-render-backend';

/** Real canonical projector, verified image loader, native Chromium, all 1,140
 * frames, FFmpeg and ffprobe. Only the source facts and signed-image transport
 * are fixtures; no encoder, capture, checksum or publication check is mocked. */
export async function renderSyncOnzeTrotsAcceptance(directory:string,executablePath:string,profile:'sync-onzetrots-v1'|'sync-onzetrots-v9'='sync-onzetrots-v1'){
 await mkdir(directory,{recursive:true});
 const preview=createSyncTemplatePreview('standings',profile);
 if(preview.rendererVersion!==profile)throw Error('Approved renderer unavailable');
 const assets:Record<string,PlayerDynamicTemplateAsset>={},images=new Map<string,Buffer>(),files=new Map<string,Buffer>();
 const server=createServer((request,response)=>{const bytes=files.get(request.url??'');if(!bytes){response.writeHead(404).end();return;}response.writeHead(200,{'Content-Type':'image/png','Content-Length':bytes.length}).end(bytes);});
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
 const origin=`http://127.0.0.1:${(server.address()as {port:number}).port}`;
 try{
  const rows=await Promise.all(preview.rich!.standings!.rows.map(async(row,index)=>{
   let logoMediaAssetId:string|undefined;
   if(row.logo?.kind==='system'){
    const bytes=await readFile(join(process.cwd(),'apps/player/public',row.logo.path)),id=`28500000-0000-4000-8000-${String(index+1).padStart(12,'0')}`,path=`/storage/v1/object/sign/provider-assets/${id}.png`;
    logoMediaAssetId=id;files.set(path,bytes);images.set(id,bytes);
    assets[id]={url:origin+path,checksumSha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length,mimeType:'image/png'};
   }
   const{logo,...facts}=row;void logo;return{...facts,logoMediaAssetId};
  }));
  const{rich:exampleFacts,...base}=preview;void exampleFacts;
  const seed=syncSlidePresentationSchema.parse({...base,rows:[],news:[],ownRowIndexes:[],style:{...base.style,motion:'rustig'}}),now=new Date('2026-10-22T12:00:00Z');
  const scope={schemaVersion:1,tenantId:'10000000-0000-4000-8000-000000000285',sourceId:'20000000-0000-4000-8000-000000000285',sourceConnectionId:'30000000-0000-4000-8000-000000000285',ownClubId:preview.rich!.teamSelection!.ownClubId,ownTeamIds:preview.rich!.teamSelection!.ownTeamIds,context:{teamId:preview.rich!.standings!.ownTeamId,competitionId:'approved-example',poolId:'approved-pool',seasonId:'2026'}};
  const job:ClaimedDynamicRenderJob={jobId:'40000000-0000-4000-8000-000000000285',snapshotId:'50000000-0000-4000-8000-000000000285',tenantId:scope.tenantId,outputMediaAssetId:'60000000-0000-4000-8000-000000000285',templateVersionId:'70000000-0000-4000-8000-000000000285',templateSlug:'controlled-onzetrots-motion',snapshotHash:'a'.repeat(64),orientation:'landscape',slideName:'Goedgekeurde beweging',markup:'canonical',css:'',manifest:{engine:'veyocast-safe-template-v1',schemaVersion:1,canvas:{width:1920,height:1080},slideType:'sport_standing',allowedFields:[{path:'sport.title',type:'string',required:false}],maxCollectionItems:200},snapshotData:{type:'sport_standing',generatedAt:now.toISOString(),syncScope:scope,brand:{clubName:preview.club.name},syncConfiguration:{schemaVersion:1,kind:'dynamic',rendererVersion:seed.rendererVersion,sourceRevision:seed.sourceRevision,slideType:'sport_standing',seed,secondsPerPage:12},sport:{items:rows}}};
  const start=Date.now(),artifact=await renderSyncDynamicArtifact({job,assets,storageOrigin:origin,now,captureFactory:options=>createSyncSlideCapture({...options,executablePath}),renderer:{renderPng:async()=>{throw Error('Unexpected alternative renderer');},renderRgba:async()=>{throw Error('Unexpected alternative renderer');}}});
  if(artifact.mimeType!=='video/mp4'||artifact.durationMs!==syncSlideMinimumDurationMs(artifact.presentation))throw Error('Incomplete approved motion export');
  await writeFile(join(directory,'standings-full.mp4'),artifact.bytes);await writeFile(join(directory,'standings-poster.png'),artifact.poster.bytes);
  await writeFile(join(directory,'presentation.json'),JSON.stringify(artifact.presentation,null,2));
  await writeFile(join(directory,'artifact.json'),JSON.stringify({rendererVersion:artifact.presentation.rendererVersion,sourceRevision:artifact.presentation.sourceRevision,mimeType:artifact.mimeType,width:artifact.width,height:artifact.height,durationMs:artifact.durationMs,byteLength:artifact.byteLength,checksumSha256:artifact.checksumSha256,poster:{byteLength:artifact.poster.byteLength,checksumSha256:artifact.poster.checksumSha256},elapsedWallMs:Date.now()-start},null,2));
  await writeFile(join(directory,'assets.json'),JSON.stringify(assets,null,2));
  for(const[id,bytes]of images)await writeFile(join(directory,`${id}.png`),bytes);
  return{artifact,assets,images};
 }finally{await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}
}

if(process.argv[1]&&resolve(process.argv[1])===resolve('tests/helpers/sync-onzetrots-export.ts')){
 const[directory,executablePath,profile]=process.argv.slice(2);
 if(!directory||!executablePath)throw Error('Explicit owned output directory and Chromium executable required');
 void renderSyncOnzeTrotsAcceptance(directory,executablePath,profile==='sync-onzetrots-v9'?'sync-onzetrots-v9':'sync-onzetrots-v1').then(()=>process.stdout.write('Complete canonical OnzeTrots MP4 and verified nested images produced.\n')).catch(error=>{console.error(error);process.exitCode=1;});
}
