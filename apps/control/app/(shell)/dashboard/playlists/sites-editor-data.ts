import "server-only";
import { playerDynamicTemplatePayloadSchema, sitesDynamicConfigurationSchema, sitesPresentationSchema, sitesPresentationSourceRevision, sitesPresentationVersion } from "@veyocast/contracts";
import { buildSitesPresentationFromDynamicPayload } from "@veyocast/content-templates/sites-dynamic-projector";
import { resolveSitesStudioSlide } from "@veyocast/content-templates/sites-presentation-model";
import { createControlSupabaseClient } from "../../../../lib/supabase/server";
import type { PlaylistStudioData } from "./data";
import { loadMediaFramePlacements, loadPublisherLibrary, loadSitesAssetUrls, loadCanonicalSnapshotAssets,loadBoundPublisherDynamicDefinitions,collectCanonicalSnapshotAssetIds,type PublisherLibraryPage } from "./library";
import type { DynamicDesign, Group, Media, Playlist, Screen, Slide, StudioSlide } from "./_components/sites/model";
import { chunkPlaylistStudioIds } from "./playlist-studio-query-scope";
import {readPublisherSyncDynamic,type PublisherSyncMedia} from "./sync-dynamic-library";
import { playlistPlacementPages } from "./_components/sites/playlist-command-plan";
import {safeParseStudioDocument} from '@veyocast/studio';

export async function loadSitesPlaylistEditor(tenantId: string, data: PlaylistStudioData, access: { media: boolean; studio: boolean; dynamic: boolean }) {
  const supabase = await createControlSupabaseClient();
  if (!supabase || !data.playlist) throw new Error("De beveiligde playlistgegevens ontbreken.");
  const pages = await Promise.allSettled((['media','studio','dynamic'] as const).map(tab => access[tab] ? loadPublisherLibrary(tenantId,{tab}) : Promise.resolve(null)));
  const libraries: Partial<Record<'media'|'studio'|'dynamic',PublisherLibraryPage>> = {};
  const warnings:string[]=[];
  pages.forEach((result,index)=>{if(result.status==='fulfilled'&&result.value)libraries[(['media','studio','dynamic']as const)[index]!]=result.value;else if(result.status==='rejected')warnings.push("Een bibliotheek kon niet worden geladen. Open de inhoudkiezer en probeer opnieuw.");});
  const exportResults = await Promise.all(chunkPlaylistStudioIds(data.items.map(item=>item.mediaAssetId),40).map(ids=>supabase.from("studio_exports").select("id,project_id,revision_id,media_asset_id,output_kind").eq("tenant_id",tenantId).in("media_asset_id",ids)));
  if(exportResults.some(result=>result.error))throw new Error("De vaste Studio-versies konden niet worden geladen.");
  const exports=exportResults.flatMap(result=>result.data??[]);
  const snapshotResults=await Promise.all(chunkPlaylistStudioIds(data.items.map(item=>item.dynamicSnapshotId),40).map(ids=>supabase.from("dynamic_slide_snapshots").select("id,dynamic_slide_id,dynamic_slide_version_id,template_version_id,source_revision_hash,snapshot_data_json,status,output_media_asset_id,sync_render_result_json").eq("tenant_id",tenantId).in("id",ids)));
  const revisionResults=await Promise.all(chunkPlaylistStudioIds(exports.map(item=>item.revision_id),40).map(ids=>supabase.from("studio_revisions").select("id,draft_revision,document_json").eq("tenant_id",tenantId).in("id",ids)));
  if([...snapshotResults,...revisionResults].some(result=>result.error))throw new Error("De onveranderlijke ontwerpinhoud kon niet worden geladen.");
  const snapshots=snapshotResults.flatMap(result=>result.data??[]),revisions=revisionResults.flatMap(result=>result.data??[]);
  const boundDefinitions=await loadBoundPublisherDynamicDefinitions(tenantId,data.items.map(item=>item.dynamicSlideId));
  const snapshotAssets=await loadCanonicalSnapshotAssets(tenantId,snapshots.flatMap(snapshot=>[snapshot.snapshot_data_json,snapshot.sync_render_result_json]));
  const assetUrls=await loadSitesAssetUrls(tenantId,revisions.map(revision=>revision.document_json));
  const framePlacements = data.items.some(item => item.mediaFrameId || item.mediaFrameVersionId)
    ? await loadMediaFramePlacements(supabase, tenantId, data.items)
    : new Map<string, NonNullable<Slide["mediaFrame"]>>();
  const slides:Slide[]=data.items.map(item=>{
    const slide:Slide={mediaChecksumSha256:item.asset?.variant?.checksumSha256,id:item.id,name:item.displayTitle||item.asset?.title||"Playlistitem",image:item.asset?.variant?.previewUrl??"",seconds:item.durationSeconds,mediaId:item.mediaAssetId,kind:item.asset?.kind,sourceKind:item.youtubeSourceId?"youtube":item.engageCampaignId?"engage":undefined,sourceId:item.youtubeSourceId??item.engageCampaignId??undefined,fallbackAssetId:item.mediaAssetId};
    const mediaFrame = framePlacements.get(item.id);
    if (mediaFrame) {
      // A pinned frame is rawmedia, even when another historical export shares its asset.
      return { ...slide, mediaFrame, image: mediaFrame.selected.image, mediaChecksumSha256: mediaFrame.selected.checksumSha256, kind: mediaFrame.selected.kind, orientation: mediaFrame.selected.settings.orientation };
    }
    const exported=exports.find(value=>value.media_asset_id===item.mediaAssetId);
    const revision=exported?revisions.find(value=>value.id===exported.revision_id):null;
    const document=revision?.document_json;
    if(exported&&(document as {syncPresentation?:unknown}|null)?.syncPresentation){
      const parsedSource=safeParseStudioDocument(document);
      if(!parsedSource.success||!parsedSource.data.syncPresentation||!item.asset?.variant?.checksumSha256||exported.output_kind!==(parsedSource.data.motion.enabled?'mp4':'png'))throw new Error('De vaste Studio-uitvoer kon niet volledig worden gecontroleerd. Open het bronontwerp en selecteer een gereedstaande versie.');
      const source=parsedSource.data;
      slide.syncStudio={id:exported.project_id,name:source.syncPresentation!.name,draftRevision:Number(revision!.draft_revision),presentation:source.syncPresentation!,assetUrls,durationSeconds:Math.ceil(source.motion.durationMs/1000),exportKind:source.motion.enabled?'video':'image',exportId:exported.id,exportAssetId:exported.media_asset_id,checksumSha256:item.asset.variant.checksumSha256};
      slide.orientation=source.syncPresentation!.orientation;
    }
    const parsed=sitesPresentationSchema.safeParse((document as{sitesPresentation?:unknown}|null)?.sitesPresentation);
    if(exported&&parsed.success&&parsed.data.kind==='studio'){
      const presentation=parsed.data;
      const studio:StudioSlide={...resolveSitesStudioSlide(presentation.slide,asset=>asset.kind==='system'?asset.path:assetUrls[asset.mediaAssetId]),presentation,assetUrls,exportId:exported.id,exportAssetId:exported.media_asset_id,exportKind:exported.output_kind==='mp4'?'video':'image'};
      slide.studioSlide=studio;slide.studioSlideId=presentation.slide.id;
      slide.frozenStudioSlide=presentation.slide;
    }
    const snapshot=snapshots.find(value=>value.id===item.dynamicSnapshotId);
    const definition=boundDefinitions.find(value=>value.id===item.dynamicSlideId);
    if(item.dynamicSlideId&&(!snapshot||!definition||snapshot.dynamic_slide_id!==item.dynamicSlideId))throw new Error("De vaste broninhoud hoort niet bij deze plaatsing of is niet meer toegankelijk.");
    if(snapshot&&definition&&Object.hasOwn(snapshot.snapshot_data_json as object,'syncConfiguration')){
      if(item.sitesConfiguration!=null)throw Error('Deze Source-plaatsing bevat een ander presentatiecontract. De opgeslagen afspeelbron blijft behouden; selecteer de volledige Source-versie opnieuw.');
      const asset=item.asset,variant=asset?.variant;
      const media:PublisherSyncMedia|undefined=asset&&variant?{id:asset.id,status:asset.status,kind:asset.kind,mime_type:variant.mimeType,checksum_sha256:variant.checksumSha256,file_size_bytes:variant.fileSizeBytes,duration_seconds:variant.durationSeconds,width:variant.width,height:variant.height}:undefined;
      slide.syncDynamic=readPublisherSyncDynamic({snapshot,definition,assets:snapshotAssets,media});slide.designId=definition.id;slide.orientation=slide.syncDynamic.presentation.orientation;
    }else if(snapshot&&definition){
      const payload=playerDynamicTemplatePayloadSchema.safeParse({schemaVersion:1,slideType:definition.slideType,orientation:definition.orientation,snapshotHash:snapshot.source_revision_hash,snapshotId:snapshot.id,templateVersionId:snapshot.template_version_id,templateSlug:definition.slideType.replaceAll('_','-'),data:snapshot.snapshot_data_json,assets:Object.fromEntries(collectCanonicalSnapshotAssetIds(snapshot.snapshot_data_json).flatMap(id=>snapshotAssets[id]?[[id,snapshotAssets[id]]]:[]))});
      const provider=definition.slideType==='ledscores_live_match'?'led-scores':['menu','price_list'].includes(definition.slideType)?'menu':'sportlink';
      const cfg=sitesDynamicConfigurationSchema.safeParse(item.sitesConfiguration??(snapshot.snapshot_data_json as Record<string,unknown>)?.sitesConfiguration??{schemaVersion:1,rendererVersion:sitesPresentationVersion,sourceRevision:sitesPresentationSourceRevision,themeId:'fieldflow',provider,orientation:definition.orientation,title:definition.name});
      if(payload.success&&cfg.success){const presentation=buildSitesPresentationFromDynamicPayload(payload.data,cfg.data);
        const design:DynamicDesign={...cfg.data,id:definition.id,name:definition.name,kind:presentation?.kind==='dynamic'?presentation.content.kind:'generic',background:cfg.data.background?.kind==='system'?cfg.data.background.path:'',rows:presentation?.kind==='dynamic'?presentation.content.rows:[],config:cfg.data,snapshotId:snapshot.id,payload:payload.data,sitesConfiguration:cfg.data,screenIds:[],groupNames:[]};
        slide.design=design;slide.designId=definition.id;
      }
    }
    slide.seconds=item.durationSeconds/playlistPlacementPages(slide);
    if(slide.design)slide.design.seconds=slide.seconds;
    if(slide.studioSlide)slide.studioSlide.duration=slide.seconds;
    return slide;
  });
  const playlist:Playlist={id:data.playlist.id,name:data.playlist.name,description:data.playlist.description??'',status:data.playlist.status==='published'?'Gepubliceerd':'Concept',slides,updated:data.playlist.updatedAt,archived:data.playlist.status==='archived'};
  const inventory:Screen[]=data.screens.map(screen=>({id:screen.id,name:screen.name,group:'',orientation:screen.orientation,status:screen.lastSeenAt?Date.now()-Date.parse(screen.lastSeenAt)<=300_000?'online':'offline':'unknown',playlist:screen.assignedPlaylistId===playlist.id?playlist.name:undefined}));
  const [groupRows,memberPages]=await Promise.all([supabase.from('screen_groups').select('id,name').eq('tenant_id',tenantId).eq('is_internal',false).eq('status','active').order('name').limit(200),Promise.all(chunkPlaylistStudioIds(data.screens.map(screen=>screen.id),40).map(ids=>supabase.from('screen_group_memberships').select('screen_group_id,screen_id').eq('tenant_id',tenantId).in('screen_id',ids)))]);
  const memberships=memberPages.flatMap(page=>page.data??[])as Array<{screen_group_id:string;screen_id:string}>;
  const groups:Group[]=groupRows.error||memberPages.some(page=>page.error)?[]:(groupRows.data??[]).map(group=>({name:group.name,members:memberships.filter(member=>member.screen_group_id===group.id).map(member=>member.screen_id)}));
  if(groupRows.error||memberPages.some(page=>page.error))warnings.push('De schermgroepen konden niet volledig worden geladen. Individuele schermkeuzes blijven beschikbaar.');
  inventory.forEach(screen=>{screen.group=groups.filter(group=>group.members.includes(screen.id)).map(group=>group.name).join(', ');});
  const media:Media[]=[...(libraries.media?.media??[]),...data.youtubeSources.map(source=>({id:source.id,name:source.title,checksumSha256:source.fallbackAsset.variant?.checksumSha256,image:source.fallbackAsset.variant?.previewUrl??'',kind:'image' as const,folder:'YouTube',size:'',sourceKind:'youtube' as const,sourceId:source.id,fallbackAssetId:source.fallbackAsset.id})),...data.engageCampaigns.filter(campaign=>['scheduled','live','closed'].includes(campaign.status)).map(campaign=>({id:campaign.id,name:campaign.title,image:'',kind:'image'as const,folder:'Engage',size:'',sourceKind:'engage'as const,sourceId:campaign.id}))];
  return{playlist,inventory,groups,media,designs:libraries.dynamic?.designs??[],syncDesigns:libraries.dynamic?.syncDesigns??[],projects:libraries.studio?.projects??[],warnings,revision:data.playlist.revision};
}
