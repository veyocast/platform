import "server-only";
import { mediaFrameExpectedSourcesSchema,mediaFrameFocusCoordinates,mediaFrameSettingsSchema,playerDynamicTemplateAssetSchema,playerDynamicTemplatePayloadSchema,sitesDynamicConfigurationSchema,sitesPresentationSchema,sitesPresentationSourceRevision,sitesPresentationVersion,type PlayerDynamicTemplateAsset }from"@veyocast/contracts";
import {resolveSitesStudioSlide}from"@veyocast/content-templates/sites-presentation-model";
import {buildSitesPresentationFromDynamicPayload}from"@veyocast/content-templates/sites-dynamic-projector";
import {createControlSupabaseClient}from"../../../../lib/supabase/server";
import {createControlAdminClient}from"../../../../lib/supabase/admin";
import type {DynamicDesign,Media,MediaFramePlacement,MediaFramePlacementVersion,StudioProject,StudioSlide,SyncDynamicLibraryDesign}from"./_components/sites/model";
import {chunkPlaylistStudioIds} from "./playlist-studio-query-scope";
import {safeParseStudioDocument} from '@veyocast/studio';
import {readPublisherSyncDynamic,type PublisherSyncMedia} from "./sync-dynamic-library";
import type {SyncStudioLibraryProject} from './_components/sites/model';

export type PublisherLibraryFilter={tab:"media"|"slides"|"studio"|"dynamic";source?:"all"|"studio"|"sportlink"|"led-scores"|"menu"|"news";query?:string;folderId?:string;collectionId?:string;favorites?:boolean;offset?:number;assetId?:string};
export type PublisherLibraryPage={media:Media[];projects:StudioProject[];syncProjects?:SyncStudioLibraryProject[];syncDesigns?:SyncDynamicLibraryDesign[];designs:DynamicDesign[];total:number;hasMore:boolean;folders:Array<{id:string;name:string}>;collections:Array<{id:string;name:string}>;unavailableDesigns?:Array<{id:string;name:string;status:string;processing:boolean;href:string}>;unavailableMedia?:Array<{id:string;name:string;status:"uploading"|"processing"|"validation_failed";message:string}>};
const empty:PublisherLibraryPage={media:[],projects:[],designs:[],total:0,hasMore:false,folders:[],collections:[]};
const pageSize=48;

export async function loadPublisherLibrary(tenantId:string,filter:PublisherLibraryFilter,access={studio:true,dynamic:true}):Promise<PublisherLibraryPage>{
 if(filter.tab==="slides"){
  const pages=await Promise.all([access.studio&&(!filter.source||["all","studio"].includes(filter.source))?loadPublisherLibrary(tenantId,{...filter,tab:"studio"}):Promise.resolve(empty),access.dynamic&&filter.source!=="studio"?loadPublisherLibrary(tenantId,{...filter,tab:"dynamic"}):Promise.resolve(empty)]);
  return {...empty,projects:pages[0]!.projects,syncProjects:pages[0]!.syncProjects,syncDesigns:pages[1]!.syncDesigns,designs:pages[1]!.designs,total:pages.reduce((sum,page)=>sum+page.total,0),hasMore:pages.some(page=>page.hasMore),unavailableDesigns:pages[1]!.unavailableDesigns};
 }
 const supabase=await createControlSupabaseClient();if(!supabase)throw new Error("De beveiligde datasessie ontbreekt.");
 const offset=filter.offset??0;
 if(filter.tab==="media"){
  const[assets,folders,collections,unavailable]=await Promise.all([
   filter.assetId?supabase.from("media_assets").select("id,title,kind,file_size_bytes,status,deleted_at").eq("tenant_id",tenantId).eq("id",filter.assetId).limit(1)
    :supabase.rpc("list_publisher_media_frame_library_v1",{p_tenant_id:tenantId,p_page_size:pageSize,p_offset:offset,p_search:filter.query||null,p_folder_id:filter.folderId||null,p_collection_id:filter.collectionId||null,p_favorites_only:filter.favorites??false}),
   supabase.from("media_folders").select("id,name").eq("tenant_id",tenantId).order("name").limit(200),
   supabase.from("media_collections").select("id,name").eq("tenant_id",tenantId).order("name").limit(200),
   filter.assetId?Promise.resolve({data:[],error:null}):supabase.from("media_assets").select("id,title,status,validation_error").eq("tenant_id",tenantId).eq("source_kind","user").is("deleted_at",null).in("status",["uploading","processing","validation_failed"]).order("created_at",{ascending:false}).limit(12)
  ]);
  if(assets.error||folders.error||collections.error)throw new Error("De beeldbank kon niet volledig worden geladen. Probeer opnieuw.");
  const rows=(assets.data??[])as Array<{id?:string;asset_id?:string;source_asset_id?:string;media_frame_id?:string|null;media_frame_version_id?:string|null;title:string;kind:"image"|"video";file_size_bytes:number;folder_id?:string;is_favorite?:boolean;tags?:Array<{name:string}>;collections?:Array<{name:string}>;total_count?:number;status?:string;deleted_at?:string|null}>;
  const frameInputs:MediaFramePlacementInput[]=rows.filter(row=>row.media_frame_id||row.media_frame_version_id).map(row=>({id:row.asset_id??row.id!,mediaAssetId:row.source_asset_id??'',mediaFrameId:row.media_frame_id,mediaFrameVersionId:row.media_frame_version_id}));
  const frames=await loadMediaFramePlacements(supabase,tenantId,frameInputs,true);
  const ids=rows.filter(row=>!row.media_frame_id).map(row=>row.asset_id??row.id!);
  const variants=ids.length?await supabase.from("media_variants").select("asset_id,variant_type,storage_path,checksum_sha256,file_size_bytes,duration_seconds").eq("tenant_id",tenantId).in("asset_id",ids).in("variant_type",["original","player_1080p"]):{data:[],error:null};
  if(variants.error)throw new Error("De geverifieerde afspeelvarianten ontbreken. Probeer opnieuw.");
  const media=await Promise.all(rows.filter(row=>row.status==="ready"&&!row.deleted_at).map(async(row):Promise<Media|null>=>{
   const binding=frames.get(row.asset_id??row.id!);
   if(binding){const selected=binding.selected;return{id:row.asset_id??row.id!,name:selected.settings.name,image:selected.image,kind:selected.kind,mediaFrame:binding,durationSeconds:selected.settings.durationSeconds,checksumSha256:selected.checksumSha256,folder:folders.data?.find(folder=>folder.id===row.folder_id)?.name??"Media",size:`${(Number(row.file_size_bytes)/1048576).toLocaleString("nl-NL",{maximumFractionDigits:1})} MB`,favorite:row.is_favorite,tags:row.tags?.map(tag=>tag.name),collections:row.collections?.map(collection=>collection.name)};}
   const id=row.asset_id??row.id!;const variant=variants.data?.find(item=>item.asset_id===id&&item.variant_type===(row.kind==="video"?"player_1080p":"original"));if(!variant||Number(variant.file_size_bytes)<=0||! /^[a-f0-9]{64}$/.test(variant.checksum_sha256))return null;
   const durationSeconds=row.kind==="video"?Number(variant.duration_seconds):undefined;
   if(row.kind==="video"&&(!Number.isFinite(durationSeconds)||durationSeconds!<=0))return null;
   const signed=await supabase.storage.from("tenant-media").createSignedUrl(variant.storage_path,600);if(signed.error||!signed.data?.signedUrl)return null;
   return{durationSeconds,checksumSha256:variant.checksum_sha256,id,name:row.title,image:signed.data.signedUrl,kind:row.kind,folder:folders.data?.find(folder=>folder.id===row.folder_id)?.name??"Media",size:`${(Number(row.file_size_bytes)/1048576).toLocaleString("nl-NL",{maximumFractionDigits:1})} MB`,favorite:row.is_favorite,tags:row.tags?.map(tag=>tag.name),collections:row.collections?.map(collection=>collection.name)};
  }));
  const total=Number(rows[0]?.total_count??rows.length);
  if(rows.some(row=>row.status==="ready")&&media.every(item=>item===null))throw new Error("De gereedstaande media kon niet veilig worden ontsloten. Vernieuw de beeldbank.");
  if(unavailable.error)throw new Error("De verwerkingsstatus van je uploads kon niet worden geladen.");
  const unavailableMedia=(unavailable.data??[]).map(asset=>({id:asset.id,name:asset.title,status:asset.status as "uploading"|"processing"|"validation_failed",message:asset.status==="validation_failed"?asset.validation_error==="processing_timeout"?"De video overschreed de verwerkingslimiet. Het bronbestand is opgeslagen; start de verwerking opnieuw via de beeldbank.":"De upload kon niet veilig worden verwerkt. Controleer de fout in de beeldbank en probeer opnieuw.":asset.status==="uploading"?"De overdracht is nog niet afgerond. Hervat de upload via de beeldbank.":"De upload wordt verwerkt. Hij verschijnt hier automatisch zodra de afspeelvariant is geverifieerd."}));
  return{...empty,media:media.filter((item):item is Media=>item!==null),unavailableMedia,total,hasMore:offset+pageSize<total,folders:folders.data??[],collections:collections.data??[]};
 }
 if(filter.tab==="dynamic"){
  const dynamicPageSize=8;
  let query=supabase.from("dynamic_slides").select("id,name:library_sort_name,slide_type,orientation,current_snapshot_id",{count:"exact"}).eq("tenant_id",tenantId).eq("status","ready").order("updated_at",{ascending:false}).range(offset,offset+dynamicPageSize-1);
  if(filter.source==="menu")query=query.in("slide_type",["menu","price_list"]);
  else if(filter.source==="news")query=query.eq("slide_type","news");
  else if(filter.source==="led-scores")query=query.eq("slide_type","ledscores_live_match");
  else if(filter.source==="sportlink")query=query.not("slide_type","in","(menu,price_list,ledscores_live_match,news)");
  if(filter.query)query=query.ilike("library_sort_name",`%${filter.query.replace(/[%_]/g,"")}%`);
  let unavailableQuery=supabase.from("dynamic_slides").select("id,name:library_sort_name,slide_type,status,configuration_json").eq("tenant_id",tenantId).not("status","in","(ready,archived)").is("archived_at",null).order("updated_at",{ascending:false}).limit(12);
  if(filter.source==="menu")unavailableQuery=unavailableQuery.in("slide_type",["menu","price_list"]);else if(filter.source==="news")unavailableQuery=unavailableQuery.eq("slide_type","news");else if(filter.source==="led-scores")unavailableQuery=unavailableQuery.eq("slide_type","ledscores_live_match");else if(filter.source==="sportlink")unavailableQuery=unavailableQuery.not("slide_type","in","(menu,price_list,ledscores_live_match,news)");
  if(filter.query)unavailableQuery=unavailableQuery.ilike("library_sort_name",`%${filter.query.replace(/[%_]/g,"")}%`);
  const unavailable=await unavailableQuery;if(unavailable.error)throw new Error("De ontwerpstatus kon niet worden gecontroleerd. Probeer opnieuw.");

  const slides=await query;if(slides.error)throw new Error("De opgeslagen ontwerpen konden niet worden geladen.");
  const ids=(slides.data??[]).flatMap(slide=>slide.current_snapshot_id?[slide.current_snapshot_id]:[]);
  const snapshots=ids.length?await supabase.from("dynamic_slide_snapshots").select("id,dynamic_slide_id,dynamic_slide_version_id,template_version_id,source_revision_hash,snapshot_data_json,output_media_asset_id,status,sync_render_result_json").eq("tenant_id",tenantId).in("id",ids).eq("status","ready"):{data:[],error:null};
  if(snapshots.error)throw new Error("De vaste ontwerpinhoud kon niet worden geladen.");
  const sourceSnapshots=(snapshots.data??[]).filter(snapshot=>Object.hasOwn(snapshot.snapshot_data_json as object,'syncConfiguration'));
  const sourceMediaIds=sourceSnapshots.flatMap(snapshot=>snapshot.output_media_asset_id?[snapshot.output_media_asset_id]:[]);
  const sourceMedia=sourceMediaIds.length?await supabase.from('media_assets').select('id,status,kind,mime_type,checksum_sha256,file_size_bytes,duration_seconds,width,height').eq('tenant_id',tenantId).in('id',sourceMediaIds).is('deleted_at',null):{data:[],error:null};
  if(sourceMedia.error)throw Error('De volledige Source-afspeeluitvoer kon niet worden gecontroleerd. Vernieuw de bibliotheek.');
  const snapshotAssets=await loadCanonicalSnapshotAssets(tenantId,(snapshots.data??[]).flatMap(snapshot=>[snapshot.snapshot_data_json,snapshot.sync_render_result_json]));
  const syncDesigns:SyncDynamicLibraryDesign[]=[];
  const designs=(slides.data??[]).flatMap((slide):DynamicDesign[]=>{
   const snapshot=snapshots.data?.find(item=>item.id===slide.current_snapshot_id);if(!snapshot)return[];if(snapshot.dynamic_slide_id!==slide.id)throw new Error("De opgeslagen broninhoud hoort niet bij het gekozen ontwerp.");
   if(Object.hasOwn(snapshot.snapshot_data_json as object,'syncConfiguration')){syncDesigns.push(readPublisherSyncDynamic({snapshot,definition:slide,assets:snapshotAssets,media:sourceMedia.data?.find(media=>media.id===snapshot.output_media_asset_id)as PublisherSyncMedia|undefined}));return[];}
   const payload=playerDynamicTemplatePayloadSchema.safeParse({schemaVersion:1,slideType:slide.slide_type,orientation:slide.orientation,snapshotHash:snapshot.source_revision_hash,snapshotId:snapshot.id,templateVersionId:snapshot.template_version_id,templateSlug:slide.slide_type.replaceAll("_","-"),data:snapshot.snapshot_data_json,assets:Object.fromEntries(collectCanonicalSnapshotAssetIds(snapshot.snapshot_data_json).flatMap(id=>snapshotAssets[id]?[[id,snapshotAssets[id]]]:[]))});
   if(!payload.success)throw new Error("De opgeslagen slide-inhoud is ongeldig. Open het bronontwerp om dit te herstellen.");
   const provider=slide.slide_type==="ledscores_live_match"?"led-scores":["menu","price_list"].includes(slide.slide_type)?"menu":"sportlink";
   const configuration=sitesDynamicConfigurationSchema.safeParse(payload.data.data.sitesConfiguration??{schemaVersion:1,rendererVersion:sitesPresentationVersion,sourceRevision:sitesPresentationSourceRevision,themeId:"fieldflow",orientation:slide.orientation,provider,title:slide.name});
   if(!configuration.success)throw new Error("De vormgeving van een opgeslagen slide kon niet worden gelezen.");const cfg=configuration.data;const presentation=buildSitesPresentationFromDynamicPayload(payload.data,cfg);
   return[{...cfg,id:slide.id,name:slide.name,kind:presentation?.kind==="dynamic"?presentation.content.kind:"generic",background:cfg.background?.kind==="system"?cfg.background.path:"",rows:presentation?.kind==="dynamic"?presentation.content.rows:[],config:cfg,screenIds:[],groupNames:[],snapshotId:snapshot.id,payload:payload.data,sitesConfiguration:cfg}];
  });
  return{...empty,designs,syncDesigns,unavailableDesigns:(unavailable.data??[]).map(slide=>({id:slide.id,name:slide.name,status:slide.status,processing:slide.status==="rendering",href:slide.configuration_json&&Object.hasOwn(slide.configuration_json as object,'syncConfiguration')?`/dashboard/slides/${slide.id}`:["menu","price_list"].includes(slide.slide_type)?`/dashboard/slides/menu-studio/${slide.id}`:`/dashboard/slides/${slide.id}`})),total:slides.count??designs.length+syncDesigns.length,hasMore:offset+dynamicPageSize<(slides.count??0)};
 }
 const [series,syncSeries]=await Promise.all([
  supabase.rpc("list_publisher_studio_series_v2",{p_tenant_id:tenantId,p_offset:offset,p_search:filter.query||null}),
  supabase.rpc('list_publisher_sync_studio_v1',{p_tenant_id:tenantId,p_offset:offset,p_search:filter.query||null})
 ]);
 if(series.error)throw new Error("De actuele Studio-reeksen konden niet worden geladen. Probeer opnieuw.");
 if(syncSeries.error)throw new Error('De actuele Source-ontwerpen konden niet worden geladen. Probeer opnieuw.');
 const response=series.data as {total:number;series:Array<{id:string;name:string;revision:number;members:Array<{projectId:string;name:string;document:unknown;draftRevision:number;exportId:string|null;mediaAssetId:string|null;outputKind:string|null}>}>};
 const presentations=response.series.flatMap(row=>row.members.flatMap(member=>{const parsed=sitesPresentationSchema.safeParse((member.document as {sitesPresentation?:unknown})?.sitesPresentation);return parsed.success?[parsed.data]:[];}));
 const assetUrls=await loadSitesAssetUrls(tenantId,presentations);
 const result:StudioProject[]=[];
 for(const row of response.series){
  const slides:StudioSlide[]=[];
  for(const member of row.members){
   const parsed=sitesPresentationSchema.safeParse((member.document as {sitesPresentation?:unknown})?.sitesPresentation);
   if(!parsed.success||parsed.data.kind!=="studio")break;
   const slide=parsed.data.slide;
   const resolve=(asset:{kind:string;path?:string;mediaAssetId?:string}|undefined)=>asset?.kind==="system"?asset.path:asset?.mediaAssetId?assetUrls[asset.mediaAssetId]:undefined;
   const resolved:StudioSlide={...resolveSitesStudioSlide(slide,asset=>resolve(asset)),id:member.projectId,name:member.name,presentation:parsed.data,assetUrls,draftRevision:Number(member.draftRevision),exportId:member.exportId??undefined,exportAssetId:member.mediaAssetId??undefined,exportKind:member.outputKind==="mp4"||!member.outputKind&&(member.document as {motion?:{enabled?:boolean}})?.motion?.enabled?"video":"image"};
   slides.push(resolved);
  }
  if(slides.length===row.members.length&&slides.length)result.push({id:row.id,name:row.name,revision:Number(row.revision),slides});
 }
 const rawSync=syncSeries.data as {total:number;projects:Array<{id:string;name:string;revision:number;kind:'project'|'series';members:Array<{projectId:string;name:string;document:unknown;draftRevision:number;exportId:string|null;mediaAssetId:string|null;outputKind:string|null;checksumSha256:string|null;bytes:number|null}>}>};
 if(!rawSync||!Number.isSafeInteger(rawSync.total)||rawSync.total<0||!Array.isArray(rawSync.projects)||rawSync.projects.length>8)throw new Error('De Source-bibliotheek gaf een onbruikbaar antwoord. Probeer opnieuw.');
 const sourceDocuments=rawSync.projects.flatMap(group=>group.members.map(member=>{
  const parsed=safeParseStudioDocument(member.document);if(!parsed.success||!parsed.data.syncPresentation)throw new Error('Een Source-ontwerp kon niet veilig worden gelezen. Open het ontwerp om dit te herstellen.');return parsed.data.syncPresentation;
 }));
 const sourceAssetUrls=await loadSitesAssetUrls(tenantId,sourceDocuments);
 const publicCampaignIds=[...new Set(sourceDocuments.flatMap(source=>source.family==='engage'&&source.poll?[source.poll.id]:[]))];
 const campaignPages=await Promise.all(chunkPlaylistStudioIds(publicCampaignIds,40).map(ids=>supabase.from('engage_campaigns').select('id,public_id').eq('tenant_id',tenantId).in('public_id',ids).in('status',['scheduled','live','closed'])));
 if(campaignPages.some(page=>page.error))throw Error('De Source-campagnebinding kon niet worden bevestigd. Je huidige playlist blijft behouden; controleer Engage en je rechten.');
 const campaigns=campaignPages.flatMap(page=>page.data??[]);
 const youtubeUrls=[...new Set(sourceDocuments.flatMap(source=>source.family==='youtube'&&source.youtubeUrl?[source.youtubeUrl]:[]))];
 const youtubePages=await Promise.all(chunkPlaylistStudioIds(youtubeUrls,40).map(urls=>{
  const ids=urls.map(url=>new URL(url).searchParams.get('v')).filter((value):value is string=>Boolean(value));
  const playlists=urls.map(url=>new URL(url).searchParams.get('list')).filter((value):value is string=>Boolean(value));
  const query=supabase.from('youtube_sources').select('id,video_id,playlist_id').eq('tenant_id',tenantId).eq('status','active').eq('validation_status','verified').eq('embeddable',true);
  // Exact canonical URLs are admitted at save/render. Values are still checked
  // before entering PostgREST's filter grammar.
  if(ids.some(id=>!/^[A-Za-z0-9_-]{11}$/.test(id))||playlists.some(id=>!/^[A-Za-z0-9_-]{12,160}$/.test(id)))throw Error('De Source-videobinding is ongeldig. Controleer het bronontwerp.');
  const clauses=[...(ids.length?['video_id.in.('+ids.join(',')+')']:[]),...(playlists.length?['playlist_id.in.('+playlists.join(',')+')']:[])];
  if(!clauses.length)throw Error('De Source-videobinding is niet bevestigd. Kies een gecontroleerde bron.');
  return query.or(clauses.join(','));
 }));
 if(youtubePages.some(page=>page.error))throw Error('De Source-videobinding kon niet worden gelezen. Je playlist blijft behouden; probeer opnieuw.');
 const youtubeSources=youtubePages.flatMap(page=>page.data??[]),youtubeUrl=(source:{video_id:string;playlist_id:string|null})=>source.playlist_id?'https://www.youtube.com/playlist?list='+source.playlist_id:'https://www.youtube.com/watch?v='+source.video_id;
 if(youtubeUrls.some(url=>!youtubeSources.some(source=>youtubeUrl(source)===url)))throw Error('Een Source-video is niet meer beschikbaar binnen deze vereniging. Controleer het bronontwerp.');
 if(publicCampaignIds.some(id=>!campaigns.some(campaign=>campaign.public_id===id)))throw Error('Een Source-campagne is niet meer beschikbaar binnen deze vereniging. Open het bronontwerp om de keuze te controleren.');
 const syncProjects:SyncStudioLibraryProject[]=rawSync.projects.map(group=>{
  if(!['project','series'].includes(group.kind)||!group.members.length||group.members.length>20)throw new Error('De Source-selectie is onvolledig. Vernieuw de bibliotheek.');
  return {id:group.id,name:group.name,revision:Number(group.revision),kind:group.kind,members:group.members.map(member=>{
   const parsed=safeParseStudioDocument(member.document);if(!parsed.success||!parsed.data.syncPresentation)throw new Error('Een Source-ontwerp kon niet veilig worden gelezen. Open het ontwerp om dit te herstellen.');
   const document=parsed.data,kind=document.motion.enabled?'video':'image';
   const ready=!!member.exportId;
   if(ready&&(!member.mediaAssetId||member.outputKind!==(kind==='video'?'mp4':'png')||!member.checksumSha256||! /^[a-f0-9]{64}$/.test(member.checksumSha256)||!(Number(member.bytes)>0)))throw new Error('De Source-uitvoer kon niet volledig worden gecontroleerd. Vernieuw de bibliotheek.');
   const source=document.syncPresentation!,campaign=source.family==='engage'&&source.poll?campaigns.find(campaign=>campaign.public_id===source.poll!.id):null;
   const youtube=source.family==='youtube'&&source.youtubeUrl?youtubeSources.find(video=>youtubeUrl(video)===source.youtubeUrl):null;
   return {id:member.projectId,name:member.name,draftRevision:Number(member.draftRevision),presentation:parsed.data.syncPresentation,assetUrls:sourceAssetUrls,durationSeconds:Math.ceil(document.motion.durationMs/1000),exportKind:kind,exportId:member.exportId??undefined,exportAssetId:member.mediaAssetId??undefined,checksumSha256:member.checksumSha256??undefined,...(campaign?{onlineSource:{kind:'engage' as const,id:campaign.id}}:youtube?{onlineSource:{kind:'youtube' as const,id:youtube.id}}:{})};
  })};
 });
 return{...empty,projects:result,syncProjects,total:Number(response.total)+rawSync.total,hasMore:offset+8<Number(response.total)||offset+8<rawSync.total};
}

/** Existing placements retain their exact snapshot, including archived definitions. */
export async function loadBoundPublisherDynamicDefinitions(tenantId:string,values:readonly(string|null|undefined)[]){
 const client=await createControlSupabaseClient();if(!client)throw new Error("De beveiligde datasessie ontbreekt.");const ids=[...new Set(values.filter((value):value is string=>Boolean(value)))];if(ids.length>1000)throw new Error("De playlist bevat te veel bronverwijzingen.");
 const definitions:Array<{id:string;name:string;slideType:string;orientation:"landscape"|"portrait"}>=[];
 for(const page of chunkPlaylistStudioIds(ids,40)){const result=await client.from("dynamic_slides").select("id,name:library_sort_name,slide_type,orientation").eq("tenant_id",tenantId).in("id",page);if(result.error)throw new Error("De bestaande bronontwerpen konden niet veilig worden geladen.");for(const row of result.data??[]){if(!page.includes(row.id)||!["landscape","portrait"].includes(row.orientation))throw new Error("De bestaande bronidentiteit is ongeldig.");definitions.push({id:row.id,name:row.name,slideType:row.slide_type,orientation:row.orientation as "landscape"|"portrait"});}}
 return definitions;
}

/** Signed paths are produced only after matching the immutable asset checksum in this tenant. */
export async function loadSitesAssetUrls(tenantId:string,values:unknown[]):Promise<Record<string,string>>{
 const supabase=await createControlSupabaseClient();if(!supabase)throw new Error("De beveiligde datasessie ontbreekt.");
 const references=new Map<string,string>();
 function visit(value:unknown){if(!value||typeof value!=="object")return;if(Array.isArray(value)){value.forEach(visit);return;}const node=value as Record<string,unknown>;if(node.kind==="tenant"&&typeof node.mediaAssetId==="string"&&typeof node.checksumSha256==="string"){const previous=references.get(node.mediaAssetId);if(previous&&previous!==node.checksumSha256)throw new Error("Tegenstrijdige media-identiteit.");references.set(node.mediaAssetId,node.checksumSha256);return;}Object.values(node).forEach(visit);}
 values.forEach(visit);if(references.size>800)throw new Error("Dit voorbeeld bevat te veel mediaverwijzingen.");
 const urls:Record<string,string>={};const ids=[...references.keys()];
 for(let offset=0;offset<ids.length;offset+=40){const page=ids.slice(offset,offset+40);
  const[assets,variants]=await Promise.all([supabase.from("media_assets").select("id,status,deleted_at").eq("tenant_id",tenantId).in("id",page).eq("status","ready").is("deleted_at",null),supabase.from("media_variants").select("asset_id,storage_path,checksum_sha256").eq("tenant_id",tenantId).in("asset_id",page).eq("variant_type","original")]);
  if(assets.error||variants.error)throw new Error("De privébeelden konden niet veilig worden geladen.");
  await Promise.all((variants.data??[]).map(async variant=>{if(!assets.data?.some(asset=>asset.id===variant.asset_id)||references.get(variant.asset_id)!==variant.checksum_sha256)return;const signed=await supabase.storage.from("tenant-media").createSignedUrl(variant.storage_path,600);if(signed.data?.signedUrl)urls[variant.asset_id]=signed.data.signedUrl;}));
 }
 return urls;
}

/** Inputs are tenant-scoped canonical database snapshots, never browser-authored URLs. */
export function collectCanonicalSnapshotAssetIds(value:unknown):string[]{
 const ids=new Set<string>();let visited=0;
 function visit(node:unknown,depth=0){if(++visited>100000||depth>17)throw new Error('De voorbeeldinhoud overschrijdt de veilige grenzen.');if(!node||typeof node!=='object')return;if(Array.isArray(node)){node.forEach(child=>visit(child,depth+1));return;}for(const[key,child]of Object.entries(node)){if(/(?:MediaAssetId|mediaAssetId|assetId)$/.test(key)&&typeof child==='string'&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(child))ids.add(child);else visit(child,depth+1);}}
 visit(value);if(ids.size>201)throw new Error('Het voorbeeld bevat te veel mediaverwijzingen.');return[...ids];
}
export async function loadCanonicalSnapshotAssets(tenantId:string,values:unknown[]):Promise<Record<string,PlayerDynamicTemplateAsset>>{
 const client=await createControlSupabaseClient();if(!client)throw new Error('De beveiligde datasessie ontbreekt.');
 const ids=[...new Set(values.flatMap(collectCanonicalSnapshotAssetIds))];if(ids.length>800)throw new Error('Deze selectie bevat te veel beelden. Verfijn je zoekopdracht.');
 const result:Record<string,PlayerDynamicTemplateAsset>={};
 for(let start=0;start<ids.length;start+=40){const page=ids.slice(start,start+40);
  const assets=await client.from('media_assets').select('id').eq('tenant_id',tenantId).in('id',page).eq('kind','image').eq('status','ready').is('deleted_at',null);if(assets.error)throw new Error('De opgeslagen beelden konden niet veilig worden geladen.');
  const variants=assets.data?.length?await client.from('media_variants').select('asset_id,storage_path,mime_type,file_size_bytes,checksum_sha256').eq('tenant_id',tenantId).in('asset_id',assets.data.map(asset=>asset.id)).eq('variant_type','original'):{data:[],error:null};if(variants.error)throw new Error('De afspeelvarianten konden niet veilig worden geladen.');
  await Promise.all((variants.data??[]).map(async variant=>{const signed=await client.storage.from('tenant-media').createSignedUrl(variant.storage_path,600);const parsed=playerDynamicTemplateAssetSchema.safeParse({url:signed.data?.signedUrl,mimeType:variant.mime_type,bytes:Number(variant.file_size_bytes),checksumSha256:variant.checksum_sha256});if(!signed.error&&parsed.success)result[variant.asset_id]=parsed.data;}));
  const providerIds=page.filter(id=>!assets.data?.some(asset=>asset.id===id));if(!providerIds.length)continue;
  const admin=createControlAdminClient();const providers=await admin.from('provider_asset_versions').select('id,storage_path,mime_type,file_size_bytes,checksum_sha256').eq('storage_bucket','provider-assets').in('id',providerIds);if(providers.error)continue;
  await Promise.all((providers.data??[]).map(async provider=>{const signed=await admin.storage.from('provider-assets').createSignedUrl(provider.storage_path,600);const parsed=playerDynamicTemplateAssetSchema.safeParse({url:signed.data?.signedUrl,mimeType:provider.mime_type,bytes:Number(provider.file_size_bytes),checksumSha256:provider.checksum_sha256});if(!signed.error&&parsed.success)result[provider.id]=parsed.data;}));
 }
 return result;
}

type FrameClient = NonNullable<Awaited<ReturnType<typeof createControlSupabaseClient>>>;
type FrameRow = Record<string, unknown>;
const frameUuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;

export type MediaFramePlacementInput = { id:string; mediaAssetId:string; mediaFrameId?:string|null; mediaFrameVersionId?:string|null; mediaFrameOverrides?:Record<string,unknown>; fitMode?:"contain"|"cover"; cropFocusX?:number; cropFocusY?:number; backgroundColor?:string|null };

/** Only pinned identities determine current playback; newest versions are separate choices. */
export async function loadMediaFramePlacements(client: FrameClient, tenantId: string, items: MediaFramePlacementInput[], requireCurrent = false) {
  const bound = items.filter(item => item.mediaFrameId || item.mediaFrameVersionId);
  const placements = new Map<string, MediaFramePlacement>();
  if (!bound.length) return placements;
  if (bound.some(item => !frameUuid.test(item.mediaFrameId ?? "") || !frameUuid.test(item.mediaFrameVersionId ?? ""))) throw Error("De vastgezette media-ontwerpversie is onvolledig. Je playlist is niet gewijzigd.");
  async function rows(table: string, selection: string, field: string, ids: string[]): Promise<FrameRow[]> {
    const results = await Promise.all(chunkPlaylistStudioIds(ids, 40).map(chunk => client.from(table).select(selection).eq("tenant_id", tenantId).in(field, chunk)));
    if (results.some(result => result.error)) throw Error("De vastgezette media-ontwerpen konden niet veilig worden gelezen.");
    return results.flatMap(result => result.data ?? []) as unknown as FrameRow[];
  }
  const frames = await rows("media_frames", "id,source_asset_id,status,current_version_id", "id", bound.map(item => item.mediaFrameId!));
  const frameById = new Map(frames.map(frame => [String(frame.id), frame]));
  const versionIds = [...new Set([...bound.map(item => item.mediaFrameVersionId!), ...frames.map(frame => String(frame.current_version_id))])];
  if (versionIds.some(id => !frameUuid.test(id))) throw Error("De media-ontwerpidentiteit kon niet worden bevestigd.");
  const versions = await rows("media_frame_versions", "id,frame_id,version_number,settings_json", "id", versionIds);
  const refs = await rows("media_frame_version_assets", "version_id,role,media_asset_id,variant_id,checksum_sha256,byte_size,storage_bucket,storage_path,mime_type", "version_id", versionIds);
  const assets = await rows("media_assets", "id,kind,status,deleted_at", "id", [...new Set(refs.map(ref => String(ref.media_asset_id)))]);
  const variants = await rows("media_variants", "id,asset_id,checksum_sha256,file_size_bytes,storage_bucket,storage_path,mime_type", "id", [...new Set(refs.map(ref => String(ref.variant_id)))]);
  const assetById = new Map(assets.map(asset => [String(asset.id), asset])), variantById = new Map(variants.map(variant => [String(variant.id), variant]));
  const signed = new Map<string, Promise<string | null>>();
  async function version(frame: FrameRow, versionId: string, requireAvailable: boolean): Promise<MediaFramePlacementVersion | null> {
    const row = versions.find(version => version.id === versionId && version.frame_id === frame.id);
    if (!row || !Number.isSafeInteger(row.version_number) || Number(row.version_number) < 1) return null;
    const settings = mediaFrameSettingsSchema.safeParse(row.settings_json);
    if (!settings.success) return null;
    const references = refs.filter(ref => ref.version_id === versionId);
    const parsed = mediaFrameExpectedSourcesSchema.safeParse(references.map(ref => ({ role: ref.role, mediaAssetId: ref.media_asset_id, variantId: ref.variant_id, checksumSha256: ref.checksum_sha256, byteSize: Number(ref.byte_size) })));
    if (!parsed.success) return null;
    const main = references.find(ref => ref.role === "media"), background = references.find(ref => ref.role === "background"), choice = settings.data.appearance.background;
    if (!main || main.media_asset_id !== frame.source_asset_id || (choice.kind === "image" ? background?.media_asset_id !== choice.mediaAssetId : Boolean(background))) return null;
    for (const ref of references) {
      const asset = assetById.get(String(ref.media_asset_id)), variant = variantById.get(String(ref.variant_id)), path = ref.storage_path;
      if (!asset || !variant || !["image", "video"].includes(String(asset.kind)) || ref.role === "background" && asset.kind !== "image" || requireAvailable && (asset.status !== "ready" || asset.deleted_at != null) || variant.asset_id !== ref.media_asset_id || variant.checksum_sha256 !== ref.checksum_sha256 || Number(variant.file_size_bytes) !== Number(ref.byte_size) || variant.storage_bucket !== ref.storage_bucket || variant.storage_path !== path || variant.mime_type !== ref.mime_type || ref.storage_bucket !== "tenant-media" || typeof path !== "string" || !path.startsWith(`tenants/${tenantId}/assets/${ref.media_asset_id}/`) || path.split("/").some(part => part === "." || part === "..") || (/[\\?#]/.test(path) || Array.from(path).some(character => character.charCodeAt(0) < 32))) return null;
    }
    // Validate every frozen source before any signing request is started.
    for (const ref of references) {
      const path = String(ref.storage_path);
      if (!signed.has(path)) signed.set(path, client.storage.from("tenant-media").createSignedUrl(path, 900).then(result => result.error ? null : result.data?.signedUrl ?? null).catch(() => null));
    }
    const image = await signed.get(String(main.storage_path))!;
    const backgroundImage = background ? await signed.get(String(background.storage_path))! : undefined;
    if (!image || background && !backgroundImage) return null;
    return { id: versionId, number: Number(row.version_number), settings: settings.data, mediaAssetId: String(main.media_asset_id), checksumSha256: String(main.checksum_sha256), byteSize: Number(main.byte_size), image, kind: assetById.get(String(main.media_asset_id))!.kind as "image" | "video", ...(background ? { backgroundImage: backgroundImage!, backgroundChecksumSha256: String(background.checksum_sha256), backgroundByteSize: Number(background.byte_size) } : {}) };
  }
  for (const item of bound) {
    const frame = frameById.get(item.mediaFrameId!);
    if (!frame || frame.source_asset_id !== item.mediaAssetId || !["active", "archived"].includes(String(frame.status))) throw Error("De media-ontwerpplaatsing hoort niet bij deze bron of vereniging.");
    if (requireCurrent && (frame.status !== "active" || frame.current_version_id !== item.mediaFrameVersionId)) throw Error("De gekozen media-ontwerpversie is intussen gewijzigd. Vernieuw de bibliotheek.");
    const selected = await version(frame, item.mediaFrameVersionId!, requireCurrent);
    if (!selected) throw Error("De oorspronkelijke media-ontwerpversie of bronhash kon niet worden bevestigd. De opgeslagen plaatsing blijft behouden.");
    const overrides = item.mediaFrameOverrides ?? {};
    const allowed = ["durationSeconds", "fitMode", "cropFocusX", "cropFocusY", "displayTitle", "accessibilityName", "backgroundColor"];
    if (Object.entries(overrides).some(([key, value]) => !allowed.includes(key) || value !== true)) throw Error("De plaatsingsvoorkeuren van het media-ontwerp zijn niet geldig.");
    const current = frame.status === "active" ? await version(frame, String(frame.current_version_id), true) : null;
    const focus = mediaFrameFocusCoordinates(selected.settings.focus);
    placements.set(item.id, { frameId: item.mediaFrameId!, pinnedVersionId: selected.id, pinnedVersionNumber: selected.number, selected, current, overrides: overrides as Record<string,true>, fitMode: item.fitMode ?? selected.settings.fitMode, cropFocusX: item.cropFocusX ?? focus.x, cropFocusY: item.cropFocusY ?? focus.y, backgroundColor: item.backgroundColor ?? null });
  }
  return placements;
}
