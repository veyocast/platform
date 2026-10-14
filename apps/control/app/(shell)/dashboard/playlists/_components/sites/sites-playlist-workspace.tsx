"use client";
import {useRef,useState,type SetStateAction}from"react";
import {useRouter}from"next/navigation";
import Link from"next/link";
import {resolveSitesStudioSlide}from"@veyocast/content-templates/sites-presentation-model";
import {savePlaylistBatch}from"../../sites-batch-actions";
import {prepareStudioPlacementThemeAction,prepareMediaPlacementThemeAction,readStudioPlacementThemeRenderAction,type StudioPlacementThemeResult}from"../../../studio/sites-placement-theme-actions";
import {PlaylistEditor}from"./playlist-editor";
import {PlaylistPlacementPreview}from"./placement-preview";
import {planPlaylistChanges,validatePlaylistPlan}from"./playlist-command-plan";
import type {DynamicDesign,Group,Media,Playlist,Screen,Slide,StudioProject}from"./model";

type Props={tenantName:string;initial:Playlist;revision:number;inventory:Screen[];groups:Group[];media:Media[];designs:DynamicDesign[];projects:StudioProject[];canWrite:boolean;canPublish:boolean;startAdding?:boolean;videoUploadConfig?:{anonKey:string;supabaseUrl:string}};
export function SitesPlaylistWorkspace({tenantName,initial,revision,inventory,groups,media:initialMedia,designs,projects,canWrite,canPublish,startAdding,videoUploadConfig}:Props){
 const router=useRouter();const[playlist,setPlaylist]=useState(initial);const[media,setMedia]=useState(initialMedia);const[notice,setNotice]=useState('');const[saving,setSaving]=useState(false);
 const original=useRef(initial),currentRevision=useRef(revision),additions=useRef(new Map<string,Slide>()),themeKeys=useRef(new Map<string,string>()),savePending=useRef(false),attempt=useRef<{fingerprint:string;key:string}|null>(null),prepared=useRef(new Map<string,Slide>());
 function change(next:Playlist){if(!canWrite||savePending.current)return;next.slides.forEach(slide=>{if(!original.current.slides.some(item=>item.id===slide.id))additions.current.set(slide.id,slide);});setPlaylist(next);}
 function changeMedia(action:SetStateAction<Media[]>){setMedia(action);}
 async function save(next:Playlist):Promise<Playlist|null>{
  if(!canWrite){setNotice('Je hebt geen toestemming om dit concept te wijzigen.');return null;}
  if(savePending.current){setNotice('De vorige opdracht wacht nog op serverbevestiging. Je wijzigingen blijven behouden.');return null;}
  savePending.current=true;setSaving(true);setNotice('De server controleert je wijzigingen…');
  try{
   const fingerprint=JSON.stringify(next);if(attempt.current?.fingerprint!==fingerprint)attempt.current={fingerprint,key:crypto.randomUUID()};
   const key=attempt.current.key;const normalized:Playlist={...next,slides:[]};
   async function readyRender(started:StudioPlacementThemeResult){
    if(!started.ok||!started.jobId)throw new Error(started.error??'De themarender kon niet starten. Je wijzigingen blijven open.');
    let rendered=started;
    for(let poll=0;poll<90&&rendered.status==='pending';poll++){await new Promise(resolve=>setTimeout(resolve,2000));rendered=await readStudioPlacementThemeRenderAction({jobId:started.jobId});}
    if(!rendered.ok||rendered.status!=='ready'||!rendered.mediaAssetId||!rendered.exportId||rendered.document?.sitesPresentation?.kind!=='studio')throw new Error(rendered.error??'De themarender is opgeslagen en nog niet gereed. Open Studio om de voortgang te volgen; je playlistwijzigingen blijven open.');
    return {...rendered,mediaAssetId:rendered.mediaAssetId,exportId:rendered.exportId,presentation:rendered.document.sitesPresentation};
   }
   for(const slide of next.slides){
    const photoPlacement=slide.studioSlide?.presentation.slide.id==='sites-v17-media-placement';
    const sourcePhoto=photoPlacement?slide.studioSlide?.presentation.slide.photo:undefined;
    if(photoPlacement&&slide.studioSlide?.themeId==='fieldflow'&&sourcePhoto?.kind==='tenant'){
     normalized.slides.push({...slide,mediaId:sourcePhoto.mediaAssetId,image:slide.studioSlide.assetUrls[sourcePhoto.mediaAssetId]??'',kind:'image',mediaChecksumSha256:sourcePhoto.checksumSha256,studioSlide:undefined,studioSlideId:undefined,frozenStudioSlide:undefined,themeId:'fieldflow'});continue;
    }
    const photoId=sourcePhoto?.kind==='tenant'?sourcePhoto.mediaAssetId:slide.mediaId;
    const photoUrl=sourcePhoto?.kind==='tenant'?slide.studioSlide?.assetUrls[sourcePhoto.mediaAssetId]??'':slide.image;
    const photoTheme=slide.studioSlide?.themeId??slide.themeId;
    if(!slide.design&&slide.kind!=='video'&&photoId&&photoTheme==='onzetrots-tv'&&(!slide.studioSlide||(photoPlacement&&slide.studioSlide.presentation.slide.title!==slide.name))){
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
    const cacheKey=`${slide.studioSlide.exportId}:${slide.studioSlide.themeId}`;const cached=prepared.current.get(cacheKey);if(cached){normalized.slides.push({...cached,id:slide.id,name:slide.name,seconds:slide.seconds});continue;}
    setNotice('Het gekozen thema wordt als nieuwe, gecontroleerde Studio-render voorbereid. Je bronontwerp blijft behouden.');
    let themeKey=themeKeys.current.get(cacheKey);if(!themeKey){themeKey=crypto.randomUUID();themeKeys.current.set(cacheKey,themeKey);}
    const rendered=await readyRender(await prepareStudioPlacementThemeAction({exportId:slide.studioSlide.exportId,themeId:slide.studioSlide.themeId,idempotencyKey:themeKey}));
    const presentation=rendered.presentation;const themed:Slide={...slide,mediaId:rendered.mediaAssetId,studioSlide:{...slide.studioSlide,...resolveSitesStudioSlide(presentation.slide,asset=>asset.kind==='system'?asset.path:slide.studioSlide!.assetUrls[asset.mediaAssetId]),duration:slide.seconds,presentation,exportId:rendered.exportId,exportAssetId:rendered.mediaAssetId}};
    prepared.current.set(cacheKey,themed);normalized.slides.push(themed);
   }
   const operations=planPlaylistChanges(original.current,normalized,additions.current);
   if(!operations.length){setNotice('Er zijn geen nieuwe wijzigingen.');return normalized;}
   const result=await savePlaylistBatch(validatePlaylistPlan(initial.id,currentRevision.current,key,operations));
   if(result.outcome==='failed')throw new Error(result.message);
   if(result.outcome==='conflict'){setNotice(`Een andere sessie heeft serverversie ${result.actualRevision} opgeslagen. Je eigen wijzigingen blijven open. Open de serverversie in een nieuw tabblad om te vergelijken.`);return null;}
   const saved:Playlist={...normalized,slides:normalized.slides.map(slide=>({...slide,id:result.itemIds[slide.id]??slide.id,duplicateOf:undefined,seriesClientId:undefined,seriesClientItemIds:undefined,seriesIndex:undefined,seriesRevision:undefined}))};
   original.current=saved;currentRevision.current=result.actualRevision;attempt.current=null;additions.current.clear();setPlaylist(saved);setNotice('Je concept is bevestigd door de server.');return saved;
  }catch(error){setNotice(error instanceof Error?error.message:'Opslaan is niet bevestigd. Je wijzigingen blijven open; probeer opnieuw.');return null;}finally{savePending.current=false;setSaving(false);}
 }
 async function publish(next:Playlist,screenIds:string[]){if(!canPublish){setNotice('Je hebt geen toestemming om deze playlist te publiceren.');return;}const saved=canWrite?await save(next):original.current;if(saved)router.push(`/dashboard/playlists/${initial.id}/publish?screens=${encodeURIComponent(screenIds.join(','))}`);}
 return <>
  {notice.includes('andere sessie')&&<p><Link href={`/dashboard/playlists/${initial.id}`}target="_blank"rel="noopener">Serverversie vergelijken</Link></p>}
  <PlaylistEditor playlist={playlist}onChange={change}onClose={()=>router.push('/dashboard/playlists')}onSave={save}onPublish={(next,ids)=>void publish(next,ids)}inventory={inventory}groups={groups}initialScreenIds={inventory.filter(screen=>screen.playlist===initial.name).map(screen=>screen.id)}media={media}onMediaChange={changeMedia}designs={designs}projects={projects}onGoStudio={()=>router.push('/dashboard/studio')}onAdvanced={()=>router.push(`/dashboard/playlists/${initial.id}?advanced=1`)}startAdding={startAdding}videoUploadConfig={videoUploadConfig}notice={notice}busy={saving}canWrite={canWrite}canPublish={canPublish}renderPreview={(slide,active)=><PlaylistPlacementPreview slide={slide}active={active}tenantName={tenantName}/>}/>
 </>;
}
