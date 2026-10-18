"use client";
import {useEffect,useMemo,useRef,useState,type CSSProperties,type SetStateAction}from"react";
import {useRouter}from"next/navigation";
import Link from"next/link";
import Image from"next/image";
import {resolveSitesStudioSlide}from"@veyocast/content-templates/sites-presentation-model";
import {mediaFrameBackgroundStyle}from"../../../../../../../../packages/content-templates/src/media-frame-background";
import {syncSystemAssets,type MediaFramePlaybackBackground,type PlaylistBatchCommand}from"@veyocast/contracts";
import {savePlaylistBatch}from"../../sites-batch-actions";
import {prepareStudioPlacementThemeAction,prepareMediaPlacementThemeAction,readStudioPlacementThemeRenderAction,type StudioPlacementThemeResult}from"../../../studio/sites-placement-theme-actions";
import {prepareSyncDynamicPlacementAction,readSyncDynamicPlacementAction}from'../../sync-dynamic-placement-actions';
import {PlaylistEditor}from"./playlist-editor";
import {PlaylistPlacementPreview}from"./placement-preview";
import {parsePlaylistBatchJournal,playlistBatchJournalKey,preparePlaylistBatchJournal,validatePlaylistBatchScope,planPlaylistChanges,validatePlaylistPlan,playlistPlacementPages}from"./playlist-command-plan";
import type {DynamicDesign,Group,Media,Playlist,Screen,Slide,StudioProject,SyncDynamicLibraryDesign}from"./model";

type Props={tenantId:string;actorScope:string;tenantName:string;initial:Playlist;revision:number;inventory:Screen[];groups:Group[];media:Media[];designs:DynamicDesign[];syncDesigns?:SyncDynamicLibraryDesign[];projects:StudioProject[];canWrite:boolean;canPublish:boolean;startAdding?:boolean;videoUploadConfig?:{anonKey:string;supabaseUrl:string}};
export function SitesPlaylistWorkspace(props:Props){return <PlaylistWorkspaceSession key={`${props.actorScope}:${props.tenantId}:${props.initial.id}`} {...props}/>;}
function PlaylistWorkspaceSession({tenantId,actorScope,tenantName,initial,revision,inventory,groups,media:initialMedia,designs,syncDesigns=[],projects,canWrite,canPublish,startAdding,videoUploadConfig}:Props){
 const router=useRouter();const[playlist,setPlaylist]=useState(initial);const[media,setMedia]=useState(initialMedia);const[notice,setNotice]=useState('');const[saving,setSaving]=useState(false);
 const scope=useMemo(()=>({tenantId,actorScope,playlistId:initial.id}),[tenantId,actorScope,initial.id]);
 const[ready,setReady]=useState(false),[recoveryBlocked,setRecoveryBlocked]=useState(false),[hasPending,setHasPending]=useState(false),[awaitingServer,setAwaitingServer]=useState(false);
 const alive=useRef(true),pendingCommand=useRef<PlaylistBatchCommand|null>(null),pendingNormalized=useRef<Playlist|null>(null),awaitingRevision=useRef<number|null>(null),currentPlaylist=useRef(playlist);currentPlaylist.current=playlist;
 const original=useRef(initial),currentRevision=useRef(revision),additions=useRef(new Map<string,Slide>()),themeKeys=useRef(new Map<string,string>()),savePending=useRef(false),attempt=useRef<{fingerprint:string;key:string}|null>(null),prepared=useRef(new Map<string,Slide>());
 useEffect(()=>{alive.current=true;try{const raw=sessionStorage.getItem(playlistBatchJournalKey(scope));if(raw){pendingCommand.current=parsePlaylistBatchJournal(raw,scope).command;setHasPending(true);setNotice('Een oorspronkelijke opslag mist een bevestiging. Bevestig eerst precies dezelfde opdracht; er wordt geen nieuwe opdracht samengesteld.');}else{validatePlaylistBatchScope(scope);}}catch{setRecoveryBlocked(true);setNotice('De oorspronkelijke playlistopdracht kan niet veilig worden gelezen. De herstelgegevens blijven behouden; controleer gebruiker, vereniging en browseropslag.');}setReady(true);return()=>{alive.current=false;};},[]);
 useEffect(()=>{
  if(!ready||pendingCommand.current||savePending.current)return;
  const waiting=awaitingRevision.current;
  if(waiting!==null&&revision<waiting||revision<currentRevision.current)return;
  const freshReadmodel=revision===currentRevision.current&&JSON.stringify(initial)!==JSON.stringify(original.current);
  if(waiting!==null||revision>currentRevision.current||freshReadmodel){
   if(waiting===null&&JSON.stringify(currentPlaylist.current)!==JSON.stringify(original.current)){
    if(revision>currentRevision.current)setNotice('Een andere sessie heeft de playlist gewijzigd. Je lokale wijzigingen blijven behouden; vergelijk de serverversie.');
    return;
   }
   original.current=initial;currentRevision.current=revision;additions.current.clear();setPlaylist(initial);setMedia(initialMedia);awaitingRevision.current=null;setAwaitingServer(false);
  }
 },[initial,revision,ready,initialMedia,hasPending,saving,awaitingServer]);
 function change(next:Playlist){if(!canWrite||!ready||recoveryBlocked||pendingCommand.current||savePending.current||awaitingRevision.current!==null)return;next.slides.forEach(slide=>{if(!original.current.slides.some(item=>item.id===slide.id))additions.current.set(slide.id,slide);});setPlaylist(next);}
 function changeMedia(action:SetStateAction<Media[]>){setMedia(action);}
 function clearPending(){try{sessionStorage.removeItem(playlistBatchJournalKey(scope));}catch{throw Error('De bevestiging is ontvangen, maar de browser kan de oorspronkelijke opdracht nog niet opruimen. Bevestig dezelfde opdracht opnieuw; je concept blijft behouden.');}pendingCommand.current=null;pendingNormalized.current=null;setHasPending(false);}
 async function confirm(command:PlaylistBatchCommand,normalized:Playlist|null):Promise<Playlist|null>{
  const result=await savePlaylistBatch(command,actorScope);if(!alive.current)return null;
  if(result.outcome==='failed'){if(result.uncertain===false){clearPending();attempt.current=null;}throw Error(result.message);}
  if(result.outcome==='conflict'){clearPending();attempt.current=null;setNotice(`Een andere sessie heeft serverversie ${result.actualRevision} opgeslagen. Je eigen wijzigingen blijven open. Open de serverversie in een nieuw tabblad om te vergelijken.`);return null;}
  clearPending();attempt.current=null;additions.current.clear();
  if(!normalized){awaitingRevision.current=result.actualRevision;setAwaitingServer(true);router.refresh();if(revision>=result.actualRevision){original.current=initial;currentRevision.current=revision;setPlaylist(initial);awaitingRevision.current=null;setAwaitingServer(false);return initial;}setNotice('De oorspronkelijke opdracht is bevestigd. De actuele playlist wordt opnieuw gelezen; wacht voordat je verdergaat.');return null;}
  const saved:Playlist={...normalized,slides:normalized.slides.map(slide=>({...slide,id:result.itemIds[slide.id]??slide.id,duplicateOf:undefined,seriesClientId:undefined,seriesClientItemIds:undefined,seriesIndex:undefined,seriesRevision:undefined,...(slide.mediaFrame?{mediaFrame:{...slide.mediaFrame,pinnedVersionId:slide.mediaFrame.selected.id,pinnedVersionNumber:slide.mediaFrame.selected.number,overrides:{...slide.mediaFrame.overrides,...Object.fromEntries(Object.keys(slide.mediaFrame.edits??{}).map(key=>[key,true as const]))},edits:undefined}}:{})}))};
  original.current=saved;currentRevision.current=result.actualRevision;setPlaylist(saved);setNotice('Je concept is bevestigd door de server.');router.refresh();return saved;
 }
 async function save(next:Playlist):Promise<Playlist|null>{
  if(!canWrite||!ready||recoveryBlocked||awaitingServer){setNotice('Deze playlist kan nu niet veilig worden gewijzigd. Je oorspronkelijke opdracht en invoer blijven behouden.');return null;}
  if(savePending.current){setNotice('De vorige opdracht wacht nog op serverbevestiging. Je wijzigingen blijven behouden.');return null;}
  savePending.current=true;setSaving(true);setNotice('De server controleert je wijzigingen…');
  try{
   if(pendingCommand.current)return await confirm(pendingCommand.current,pendingNormalized.current);
   const fingerprint=JSON.stringify(next);if(attempt.current?.fingerprint!==fingerprint)attempt.current={fingerprint,key:crypto.randomUUID()};
   const key=attempt.current.key;const normalized:Playlist={...next,slides:[]};
   async function readyExport(started:StudioPlacementThemeResult){
    if(!started.ok||!started.jobId)throw new Error(started.error??'De themarender kon niet starten. Je wijzigingen blijven open.');
    let rendered=started;
    for(let poll=0;poll<90&&rendered.status==='pending';poll++){await new Promise(resolve=>setTimeout(resolve,2000));rendered=await readStudioPlacementThemeRenderAction({jobId:started.jobId});}
    if(!rendered.ok||rendered.status!=='ready'||!rendered.mediaAssetId||!rendered.exportId||!rendered.document)throw new Error(rendered.error??'De themarender is opgeslagen en nog niet gereed. Open Studio om de voortgang te volgen; je playlistwijzigingen blijven open.');
    return {...rendered,mediaAssetId:rendered.mediaAssetId,exportId:rendered.exportId,document:rendered.document};
   }
   async function readyRender(started:StudioPlacementThemeResult){
    const rendered=await readyExport(started);
    if(rendered.document.sitesPresentation?.kind!=='studio')throw new Error('De themarender hoort niet bij de gekozen ontwerpsoort. Je playlistwijzigingen blijven open.');
    return {...rendered,presentation:rendered.document.sitesPresentation};
   }
   for(const slide of next.slides){
    if(slide.mediaFrame){normalized.slides.push(slide);continue;}
    if(slide.syncDynamic){
     const source=slide.syncDynamic,targetTheme=slide.themeId??source.presentation.theme;
     if(targetTheme===source.presentation.theme&&slide.seconds*playlistPlacementPages(slide)===source.durationSeconds){normalized.slides.push(slide);continue;}
     const cacheKey=`source:${source.snapshotId}:${targetTheme}:${slide.seconds}`,cached=prepared.current.get(cacheKey);
     if(cached){normalized.slides.push({...cached,id:slide.id,name:slide.name});continue;}
     setNotice('Het gekozen Source-thema en de volledige paginaduur worden gecontroleerd voorbereid. Je bronontwerp blijft behouden.');
     let themeKey=themeKeys.current.get(cacheKey);if(!themeKey){themeKey=crypto.randomUUID();themeKeys.current.set(cacheKey,themeKey);}
     let rendered=await prepareSyncDynamicPlacementAction({snapshotId:source.snapshotId,theme:targetTheme,secondsPerPage:slide.seconds,idempotencyKey:themeKey});
     for(let poll=0;poll<90&&rendered.ok&&rendered.status==='pending';poll++){
      await new Promise(resolve=>setTimeout(resolve,2000));rendered=await readSyncDynamicPlacementAction({jobId:rendered.jobId});
     }
     if(!rendered.ok||rendered.status!=='ready')throw Error(!rendered.ok?rendered.error:'De volledige Source-uitvoer is nog niet gereed. Je concept blijft behouden; probeer opslaan opnieuw na bronherstel.');
     const design=rendered.design;
     if(design.id!==source.id||design.presentation.theme!==targetTheme||design.configuration.secondsPerPage!==slide.seconds||design.durationSeconds!==slide.seconds*playlistPlacementPages(slide))throw Error('De Source-uitvoer bevestigde de gekozen variant niet. Je concept blijft behouden; ververs de bronselectie.');
     const themed:Slide={...slide,themeId:undefined,mediaId:design.mediaAssetId,mediaChecksumSha256:design.checksumSha256,kind:design.kind,syncDynamic:{...design,placementVariantBaseSnapshotId:source.snapshotId}};
     prepared.current.set(cacheKey,themed);normalized.slides.push(themed);continue;
    }
    if(slide.syncStudio){
     if((!slide.themeId||slide.themeId===slide.syncStudio.presentation.theme)&&slide.seconds*playlistPlacementPages(slide)===slide.syncStudio.durationSeconds){normalized.slides.push(slide);continue;}
     if(!slide.syncStudio.exportId)throw new Error('Het Studio-ontwerp is nog niet voor afspelen voorbereid. Selecteer het opnieuw uit de bibliotheek.');
     const targetTheme=slide.themeId??slide.syncStudio.presentation.theme;const cacheKey=`sync:${slide.syncStudio.exportId}:${targetTheme}:${slide.seconds}`;const cached=prepared.current.get(cacheKey);
     if(cached){normalized.slides.push({...cached,id:slide.id,name:slide.name,seconds:slide.seconds});continue;}
     setNotice('Het gekozen thema wordt als nieuwe, gecontroleerde Studio-render voorbereid. Je bronontwerp blijft behouden.');
     let themeKey=themeKeys.current.get(cacheKey);if(!themeKey){themeKey=crypto.randomUUID();themeKeys.current.set(cacheKey,themeKey);}
     const rendered=await readyExport(await prepareStudioPlacementThemeAction({exportId:slide.syncStudio.exportId,themeId:targetTheme,secondsPerPage:slide.seconds,idempotencyKey:themeKey}));
     const presentation=rendered.document.syncPresentation;
     if(!presentation||presentation.theme!==targetTheme||rendered.document.motion.durationMs!==slide.seconds*playlistPlacementPages(slide)*1000||!rendered.checksumSha256||!rendered.projectId)throw new Error('De themarender bevestigde niet het gekozen Studio-ontwerp. Je playlistwijzigingen blijven open.');
     const themed:Slide={...slide,themeId:undefined,mediaId:rendered.mediaAssetId,mediaChecksumSha256:rendered.checksumSha256,kind:rendered.document.motion.enabled?'video':'image',syncStudio:{...slide.syncStudio,id:rendered.projectId,draftRevision:0,presentation,durationSeconds:rendered.document.motion.durationMs/1000,exportId:rendered.exportId,exportAssetId:rendered.mediaAssetId,exportKind:rendered.document.motion.enabled?'video':'image',checksumSha256:rendered.checksumSha256}};
     prepared.current.set(cacheKey,themed);normalized.slides.push(themed);continue;
    }
    const photoPlacement=slide.studioSlide?.presentation.slide.id==='sites-v17-media-placement';
    const sourcePhoto=photoPlacement?slide.studioSlide?.presentation.slide.photo:undefined;
    if(photoPlacement&&slide.studioSlide?.themeId==='fieldflow'&&sourcePhoto?.kind==='tenant'){
     normalized.slides.push({...slide,mediaId:sourcePhoto.mediaAssetId,image:slide.studioSlide.assetUrls[sourcePhoto.mediaAssetId]??'',kind:'image',mediaChecksumSha256:sourcePhoto.checksumSha256,studioSlide:undefined,studioSlideId:undefined,frozenStudioSlide:undefined,themeId:'fieldflow'});continue;
    }
    const photoId=sourcePhoto?.kind==='tenant'?sourcePhoto.mediaAssetId:slide.mediaId;
    const photoUrl=sourcePhoto?.kind==='tenant'?slide.studioSlide?.assetUrls[sourcePhoto.mediaAssetId]??'':slide.image;
    const photoTheme=slide.studioSlide?.themeId??slide.themeId;
    if(!slide.syncStudio&&!slide.design&&slide.kind!=='video'&&photoId&&photoTheme==='onzetrots-tv'&&(!slide.studioSlide||(photoPlacement&&slide.studioSlide.presentation.slide.title!==slide.name))){
     const cacheKey=`photo:${photoId}:${slide.orientation??slide.studioSlide?.orientation??'landscape'}:${slide.name}:${Math.min(120,slide.seconds)}`;const cached=prepared.current.get(cacheKey);
     if(cached){normalized.slides.push({...cached,id:slide.id});continue;}
     setNotice('De foto krijgt het gekozen schermthema. De server maakt eerst een geverifieerde render.');
     let themeKey=themeKeys.current.get(cacheKey);if(!themeKey){themeKey=crypto.randomUUID();themeKeys.current.set(cacheKey,themeKey);}
     const rendered=await readyRender(await prepareMediaPlacementThemeAction({mediaAssetId:photoId,orientation:slide.orientation??slide.studioSlide?.orientation??'landscape',title:slide.name,seconds:Math.min(120,slide.seconds),idempotencyKey:themeKey}));
     const assetUrls={[photoId]:photoUrl};const presentation=rendered.presentation;
     const themed:Slide={...slide,mediaId:rendered.mediaAssetId,themeId:undefined,studioSlideId:presentation.slide.id,studioSlide:{...resolveSitesStudioSlide(presentation.slide,asset=>asset.kind==='system'?asset.path:assetUrls[asset.mediaAssetId]),presentation,assetUrls,exportId:rendered.exportId,exportAssetId:rendered.mediaAssetId,exportKind:'image'}};
     prepared.current.set(cacheKey,themed);normalized.slides.push(themed);continue;
    }
    if(!slide.studioSlide||slide.studioSlide.themeId===slide.studioSlide.presentation.slide.themeId){normalized.slides.push(slide);continue;}
    if(!slide.studioSlide.exportId)throw new Error('De Studio-slide is nog niet voor afspelen voorbereid. Selecteer hem opnieuw uit de bibliotheek.');
    const cacheKey=`${slide.studioSlide.exportId}:${slide.studioSlide.themeId}`;const cached=prepared.current.get(cacheKey);if(cached){normalized.slides.push({...cached,id:slide.id,name:slide.name,seconds:slide.seconds});continue;}
    setNotice('Het gekozen thema wordt als nieuwe, gecontroleerde Studio-render voorbereid. Je bronontwerp blijft behouden.');
    let themeKey=themeKeys.current.get(cacheKey);if(!themeKey){themeKey=crypto.randomUUID();themeKeys.current.set(cacheKey,themeKey);}
    const rendered=await readyRender(await prepareStudioPlacementThemeAction({exportId:slide.studioSlide.exportId,themeId:slide.studioSlide.themeId,idempotencyKey:themeKey}));
    const presentation=rendered.presentation;const themed:Slide={...slide,mediaId:rendered.mediaAssetId,studioSlide:{...slide.studioSlide,...resolveSitesStudioSlide(presentation.slide,asset=>asset.kind==='system'?asset.path:slide.studioSlide!.assetUrls[asset.mediaAssetId]),duration:slide.seconds,presentation,exportId:rendered.exportId,exportAssetId:rendered.mediaAssetId}};
    prepared.current.set(cacheKey,themed);normalized.slides.push(themed);
   }
   const operations=planPlaylistChanges(original.current,normalized,additions.current);
   if(!operations.length){setNotice('Er zijn geen nieuwe wijzigingen.');return normalized;}
   const command=validatePlaylistPlan(initial.id,currentRevision.current,key,operations),journal=preparePlaylistBatchJournal(scope,command);
   try{sessionStorage.setItem(playlistBatchJournalKey(scope),JSON.stringify(journal));}catch{throw Error('De browser kan de oorspronkelijke opdracht niet bewaren. Er is geen playlistopdracht verstuurd; maak ruimte vrij en probeer opnieuw.');}
   if(!alive.current)return null;pendingCommand.current=journal.command;pendingNormalized.current=normalized;setHasPending(true);
   return await confirm(journal.command,normalized);
  }catch(error){if(alive.current)setNotice(error instanceof Error?error.message:'Opslaan is niet bevestigd. Je wijzigingen blijven open; probeer opnieuw.');return null;}finally{savePending.current=false;if(alive.current)setSaving(false);}
 }
 async function publish(next:Playlist,screenIds:string[]){if(!canPublish){setNotice('Je hebt geen toestemming om deze playlist te publiceren.');return;}const saved=canWrite?await save(next):original.current;if(saved)router.push(`/dashboard/playlists/${initial.id}/publish?screens=${encodeURIComponent(screenIds.join(','))}`);}
 return <>
  {notice.includes('andere sessie')&&<p><Link href={`/dashboard/playlists/${initial.id}`}target="_blank"rel="noopener">Serverversie vergelijken</Link></p>}
  <PlaylistEditor playlist={playlist}confirmedPlaylist={original.current}onChange={change}onClose={()=>router.push('/dashboard/playlists')}onSave={save}onPublish={(next,ids)=>void publish(next,ids)}inventory={inventory}groups={groups}initialScreenIds={inventory.filter(screen=>screen.playlist===initial.name).map(screen=>screen.id)}media={media}onMediaChange={changeMedia}designs={designs}syncDesigns={syncDesigns}projects={projects}onGoStudio={()=>router.push('/dashboard/studio')}onAdvanced={()=>router.push(`/dashboard/playlists/${initial.id}?advanced=1`)}startAdding={startAdding}videoUploadConfig={videoUploadConfig}notice={notice}busy={saving||!ready||awaitingServer}canWrite={canWrite&&ready&&!recoveryBlocked&&!hasPending&&!awaitingServer}canPublish={canPublish&&!hasPending&&!awaitingServer}onReplay={hasPending&&canWrite&&!recoveryBlocked?()=>void save(playlist):undefined}renderPreview={(slide,active)=>slide.mediaFrame?<MediaFramePlacementPreview slide={slide}active={active}/>:<PlaylistPlacementPreview slide={slide}active={active}tenantName={tenantName}/>}/>
 </>;
}

function MediaFramePlacementPreview({slide,active}:{slide:Slide;active:boolean}){
 const binding=slide.mediaFrame!,version=binding.selected,settings=version.settings,choice=settings.appearance.background;
 const value:MediaFramePlaybackBackground={schemaVersion:1,themeId:settings.appearance.themeId,accentColor:settings.appearance.accentColor,background:choice.kind==='preset'?choice:{...choice,checksumSha256:version.backgroundChecksumSha256??'0'.repeat(64)}};
 const style=binding.overrides.backgroundColor?{background:binding.backgroundColor??'var(--vc-brand-ink-black)'}:mediaFrameBackgroundStyle(value,{image:version.backgroundImage,clubmuur:syncSystemAssets.find(asset=>asset.path==='/assets/clubmuur-wall.webp')?.path});
 if(!style)return <p>Het geverifieerde media-ontwerpvoorbeeld is niet beschikbaar. De opgeslagen plaatsing blijft behouden.</p>;
 const mediaStyle:CSSProperties={width:'100%',height:'100%',objectFit:binding.fitMode,objectPosition:`${binding.cropFocusX*100}% ${binding.cropFocusY*100}%`};
 return <div style={{...style,width:'100%',height:'100%',position:'relative'}as CSSProperties}>{version.kind==='video'?<video src={version.image}autoPlay={active}muted playsInline loop style={mediaStyle}/>:<Image src={version.image}alt={slide.name}fill unoptimized style={mediaStyle}/>}</div>;
}
