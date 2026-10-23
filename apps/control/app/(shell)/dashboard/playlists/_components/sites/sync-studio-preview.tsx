"use client";
import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {motion} from 'motion/react';
import {isSyncOnzeTrotsPresentation,syncSlidePageCount,syncSlideTransition,syncSlideAssets,syncSlideMinimumDurationMs,type SyncSlidePresentation} from '@veyocast/contracts';
import {SyncSlideStaticView,measureSyncOnzeTrotsV9Layout,measureSyncOnzeTrotsLayout,projectSyncOnzeTrotsMotion,applySyncOnzeTrotsMotion,advanceSyncOnzeTrotsTime} from '@veyocast/content-templates/sync-slide-static-view';
import type {SyncStudioLibraryMember} from './model';

/** Frozen Source document preview; no provider request or authoring operation. */
export function SyncStudioLibraryPreview({member,active=false,compact=false,intrinsic=false}:{member:SyncStudioLibraryMember;active?:boolean;compact?:boolean;intrinsic?:boolean}){
 return <SyncSlidePreview presentation={member.presentation}assetUrls={member.assetUrls}durationSeconds={member.durationSeconds}id={member.id}active={active}compact={compact}intrinsic={intrinsic}/>;
}
/** Shared visual only; Studio and connected Source keep their own provenance. */
export function SyncSlidePreview({presentation,assetUrls,durationSeconds,id,active=false,compact=false,intrinsic=false,pageOverride,onPageChange,replayToken=0}:{presentation:SyncSlidePresentation;assetUrls:Record<string,string>;durationSeconds:number;id:string;active?:boolean;compact?:boolean;intrinsic?:boolean;pageOverride?:number;onPageChange?:(page:number)=>void;replayToken?:number}){
 const root=useRef<HTMLDivElement>(null),[size,setSize]=useState({width:0,height:0}),[page,setPage]=useState(0);
 const elapsed=useRef(0),introFinished=useRef(false),scenePage=useRef(0),modern=isSyncOnzeTrotsPresentation(presentation);
 const pages=syncSlidePageCount(presentation),transition=active?syncSlideTransition(presentation):null;
 useEffect(()=>{const element=root.current;if(!element)return;const ratio=presentation.orientation==='portrait'?9/16:16/9;const resize=()=>{const width=Math.min(element.clientWidth,element.clientHeight*ratio);setSize({width,height:width/ratio});};resize();const observer=new ResizeObserver(resize);observer.observe(element);return()=>observer.disconnect();},[presentation.orientation]);
 useLayoutEffect(()=>{elapsed.current=0;introFinished.current=false;scenePage.current=0;setPage(0);},[id,presentation,replayToken]);
 useEffect(()=>{if(modern){return;}setPage(0);if(!active||pages<2)return;const timer=setInterval(()=>setPage(value=>(value+1)%pages),Math.max(3000,durationSeconds*1000/pages));return()=>clearInterval(timer);},[active,id,durationSeconds,pages,modern]);
 useEffect(()=>{if(!modern||pageOverride===undefined)return;const loopMs=Math.max(syncSlideMinimumDurationMs(presentation),durationSeconds*1000),perPage=loopMs/pages,target=Math.max(0,Math.min(pages-1,pageOverride));if(Math.floor((elapsed.current%loopMs)/perPage)!==target)elapsed.current=target*perPage;},[modern,pageOverride,presentation,durationSeconds,pages]);
 useEffect(()=>{onPageChange?.(page);},[page,onPageChange]);
 useLayoutEffect(()=>{
  const element=root.current;if(!element||!isSyncOnzeTrotsPresentation(presentation))return;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let panelCount=presentation.rendererVersion==='sync-onzetrots-v9'?measureSyncOnzeTrotsV9Layout(element):0;
  let layouts=measureSyncOnzeTrotsLayout(element),stopped=false;
  const refreshLayout=()=>{if(stopped)return;if(presentation.rendererVersion==='sync-onzetrots-v9')panelCount=measureSyncOnzeTrotsV9Layout(element);layouts=measureSyncOnzeTrotsLayout(element);};
  void document.fonts.ready.then(refreshLayout);
  const images=[...element.querySelectorAll('img')];
  images.forEach(image=>image.addEventListener('load',refreshLayout));
  const loopMs=Math.max(syncSlideMinimumDurationMs(presentation),durationSeconds*1000),perPage=loopMs/pages;
  let previous:number|null=null,animation=0;
  const frame=(now:number)=>{
   const running=active&&!document.hidden&&!reduced.matches;
   elapsed.current=advanceSyncOnzeTrotsTime(elapsed.current,previous,now,running);
   previous=running?now:null;
   const local=elapsed.current%loopMs,currentPage=Math.floor(local/perPage);
   if(scenePage.current!==currentPage){scenePage.current=currentPage;introFinished.current=false;}
   setPage(before=>before===currentPage?before:currentPage);
   const internal=active||elapsed.current>0?Math.max(0,local-currentPage*perPage):presentation.family==='goal'?1200:presentation.rendererVersion==='sync-onzetrots-v9'&&presentation.family==='rss'?1000:0;
   const scene=presentation.rendererVersion==='sync-onzetrots-v9'?{panelCount,mode:presentation.visual.mode,paused:!active,introFinished:introFinished.current,entranceAllowed:presentation.style.motion!=='geen'}:undefined;
   const projected=projectSyncOnzeTrotsMotion(internal,layouts,presentation.visual.scrollSpeed,reduced.matches,scene);
   if(projected.entrance)introFinished.current=projected.entrance.finished;
   applySyncOnzeTrotsMotion(projected,element);
   if(active)animation=requestAnimationFrame(frame);
  };
  frame(performance.now());return()=>{stopped=true;cancelAnimationFrame(animation);images.forEach(image=>image.removeEventListener('load',refreshLayout));};
 },[active,presentation,id,page,pageOverride,pages,durationSeconds,size.width,size.height,transition?.durationMs,replayToken]);
 const selectedPage=Math.max(0,Math.min(pages-1,pageOverride??page));
 const missing=syncSlideAssets(presentation).some(asset=>asset.kind==='tenant'&&!assetUrls[asset.mediaAssetId]);
 return <div ref={root} style={{width:'100%',height:intrinsic?'auto':'100%',aspectRatio:intrinsic?(presentation.orientation==='portrait'?'9 / 16':'16 / 9'):undefined,display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden'}}>
  {missing?<p role={compact?undefined:'status'}>Het privébeeld kon niet worden geladen. Vernieuw het ontwerp om het voorbeeld opnieuw te controleren.</p>:<div style={{width:size.width,height:size.height,flexShrink:0}}><motion.div key={`${id}:${selectedPage}`} style={{width:'100%',height:'100%'}} initial={transition?{opacity:0,y:transition.offsetPx}:false} animate={{opacity:1,y:0}} transition={{duration:transition?transition.durationMs/1000:0,ease:'easeOut'}}><SyncSlideStaticView presentation={presentation} page={selectedPage} compact={compact} resolveAsset={asset=>asset.kind==='system'?asset.path:assetUrls[asset.mediaAssetId]}/></motion.div></div>}
 </div>;
}
