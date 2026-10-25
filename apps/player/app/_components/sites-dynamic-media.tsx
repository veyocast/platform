"use client";
import React,{useEffect,useRef,useState,type ReactNode} from "react";
import type {SitesPresentation,PlayerDynamicTemplateAsset,MenuDomPlayback} from "@veyocast/contracts";
import {SitesPresentationView,sitesPresentationPages,resolveSitesDynamicAsset} from "@veyocast/content-templates/sites-presentation";
import {sitesPresentationForPlacement} from "../_lib/sites-placement-presentation";
import type {EditorialArenaItem} from "@veyocast/content-templates";

export function SitesDynamicMedia({item,presentation,onReady,onBoundary,fallback,passive=false,paused=false,iteration=0}:{item:EditorialArenaItem & {sitesSystemAssetUrls?:Record<string,string>;sitesStudioAssets?:Record<string,PlayerDynamicTemplateAsset>;menuDom?:MenuDomPlayback};presentation:SitesPresentation;onReady:(id:string)=>void;onBoundary?:(id:string)=>void;fallback?:ReactNode;passive?:boolean;paused?:boolean;iteration?:number}){
 const[page,setPage]=useState(0);const[failed,setFailed]=useState(false);const root=useRef<HTMLDivElement>(null);const elapsed=useRef(0);const pages=sitesPresentationPages(presentation);
 const readyCallback=useRef(onReady);readyCallback.current=onReady;
 useEffect(()=>{if(item.menuDom){elapsed.current=0;setPage(0);}},[iteration,item.menuDom?.contentHash]);
 const seconds=Math.max(0.1,item.durationSeconds/pages);
 const placedPresentation=sitesPresentationForPlacement(presentation,item.durationSeconds);
 useEffect(()=>{if(passive)return;if(item.menuDom){setFailed(false);elapsed.current=0;setPage(0);}let disposed=false;let frame=0;void document.fonts.ready.then(async()=>{await Promise.all(Array.from(root.current?.querySelectorAll("img")??[]).map(img=>img.decode()));await Promise.all([...new Set(Object.values(item.menuDom?.assets??{}).map(asset=>asset.url))].map(url=>new Promise<void>((resolve,reject)=>{const image=new Image();image.src=url;void image.decode().then(()=>resolve(),reject);})));frame=window.requestAnimationFrame(()=>{if(!disposed)readyCallback.current(item.id);});}).catch(()=>{if(!disposed)setFailed(true);});return()=>{disposed=true;window.cancelAnimationFrame(frame);};},[item.id,item.menuDom?.contentHash,item.menuDom?undefined:onReady,passive]);
 useEffect(()=>{if(passive||paused||pages<2)return;let last=performance.now();const timer=window.setInterval(()=>{const now=performance.now();elapsed.current+=now-last;last=now;if(elapsed.current>=seconds*1000){elapsed.current%=seconds*1000;setPage(value=>(value+1)%pages);onBoundary?.(item.id);}},100);return()=>window.clearInterval(timer);},[item.id,onBoundary,pages,passive,paused,seconds]);
 if(failed&&fallback)return fallback;
 return <div ref={root} data-menu-content-hash={item.menuDom?.contentHash} className="playback-media playback-sites" style={{width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center",containerType:"inline-size"}}><SitesPresentationView presentation={placedPresentation} page={page%pages} active={!passive&&!paused} fitViewport systemAssetUrls={item.sitesSystemAssetUrls} resolveAsset={asset=>{if(asset.kind==="system")return item.sitesSystemAssetUrls?.[asset.path]??asset.path;const stored=(item.menuDom?.assets??item.sitesStudioAssets)?.[asset.mediaAssetId];return stored?.checksumSha256===asset.checksumSha256?stored.url:item.dynamicTemplate?resolveSitesDynamicAsset(item.dynamicTemplate,asset):undefined;}}/></div>;
}
