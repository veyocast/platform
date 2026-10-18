"use client";
import {useEffect,useRef,useState} from 'react';
import {motion} from 'motion/react';
import {syncSlidePageCount,syncSlideTransition,syncSlideAssets,type SyncSlidePresentation} from '@veyocast/contracts';
import {SyncSlideStaticView} from '@veyocast/content-templates/sync-slide-static-view';
import type {SyncStudioLibraryMember} from './model';

/** Frozen Source document preview; no provider request or authoring operation. */
export function SyncStudioLibraryPreview({member,active=false,compact=false,intrinsic=false}:{member:SyncStudioLibraryMember;active?:boolean;compact?:boolean;intrinsic?:boolean}){
 return <SyncSlidePreview presentation={member.presentation}assetUrls={member.assetUrls}durationSeconds={member.durationSeconds}id={member.id}active={active}compact={compact}intrinsic={intrinsic}/>;
}
/** Shared visual only; Studio and connected Source keep their own provenance. */
export function SyncSlidePreview({presentation,assetUrls,durationSeconds,id,active=false,compact=false,intrinsic=false}:{presentation:SyncSlidePresentation;assetUrls:Record<string,string>;durationSeconds:number;id:string;active?:boolean;compact?:boolean;intrinsic?:boolean}){
 const root=useRef<HTMLDivElement>(null),[size,setSize]=useState({width:0,height:0}),[page,setPage]=useState(0);
 const pages=syncSlidePageCount(presentation),transition=active?syncSlideTransition(presentation):null;
 useEffect(()=>{const element=root.current;if(!element)return;const ratio=presentation.orientation==='portrait'?9/16:16/9;const resize=()=>{const width=Math.min(element.clientWidth,element.clientHeight*ratio);setSize({width,height:width/ratio});};resize();const observer=new ResizeObserver(resize);observer.observe(element);return()=>observer.disconnect();},[presentation.orientation]);
 useEffect(()=>{setPage(0);if(!active||pages<2)return;const timer=setInterval(()=>setPage(value=>(value+1)%pages),Math.max(3000,durationSeconds*1000/pages));return()=>clearInterval(timer);},[active,id,durationSeconds,pages]);
 const missing=syncSlideAssets(presentation).some(asset=>asset.kind==='tenant'&&!assetUrls[asset.mediaAssetId]);
 return <div ref={root} style={{width:'100%',height:intrinsic?'auto':'100%',aspectRatio:intrinsic?(presentation.orientation==='portrait'?'9 / 16':'16 / 9'):undefined,display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden'}}>
  {missing?<p role={compact?undefined:'status'}>Het privébeeld kon niet worden geladen. Vernieuw het ontwerp om het voorbeeld opnieuw te controleren.</p>:<div style={{width:size.width,height:size.height,flexShrink:0}}><motion.div key={`${id}:${page}`} style={{width:'100%',height:'100%'}} initial={transition?{opacity:0,y:transition.offsetPx}:false} animate={{opacity:1,y:0}} transition={{duration:transition?transition.durationMs/1000:0,ease:'easeOut'}}><SyncSlideStaticView presentation={presentation} page={page} compact={compact} resolveAsset={asset=>asset.kind==='system'?asset.path:assetUrls[asset.mediaAssetId]}/></motion.div></div>}
 </div>;
}
