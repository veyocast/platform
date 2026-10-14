"use client";
import {useEffect,useState,useRef,type ReactNode} from "react";
import {SitesPresentationView} from "@veyocast/content-templates/sites-presentation";
import {sitesPresentationPages} from "@veyocast/content-templates/sites-presentation-model";
import {buildSitesLedOverlayPresentation,resolveSitesLedAsset} from "../_lib/player-sites-led-presentation";
import type {ActiveLedScoresOverlay} from "./ledscores-goal-overlay";
export function SitesLedOverlay({overlay,onComplete,onReady,fallback}:{overlay:ActiveLedScoresOverlay;onComplete:(id:string)=>void;onReady:(id:string)=>void;fallback:ReactNode}){
 const root=useRef<HTMLElement>(null);
 const[orientation,setOrientation]=useState<"landscape"|"portrait">(()=>typeof window!=="undefined"&&window.innerWidth<window.innerHeight?"portrait":"landscape");const[page,setPage]=useState(0);
 useEffect(()=>{const resize=()=>setOrientation(window.innerWidth<window.innerHeight?"portrait":"landscape");window.addEventListener("resize",resize);return()=>window.removeEventListener("resize",resize);},[]);
 const presentation=buildSitesLedOverlayPresentation(overlay,orientation);const pages=presentation?sitesPresentationPages(presentation):1;
 useEffect(()=>{const timeout=window.setTimeout(()=>onComplete(overlay.deliveryId),overlay.durationMs);const tick=window.setInterval(()=>setPage(value=>(value+1)%pages),Math.max(1,overlay.durationMs/pages));return()=>{window.clearTimeout(timeout);window.clearInterval(tick);};},[onComplete,overlay.deliveryId,overlay.durationMs,pages]);
 useEffect(()=>{if(!presentation)return;let disposed=false;const frames:number[]=[];void document.fonts.ready.then(async()=>{await Promise.all(Array.from(root.current?.querySelectorAll("img")??[]).map(image=>image.decode()));frames.push(window.requestAnimationFrame(()=>frames.push(window.requestAnimationFrame(()=>{if(!disposed)onReady(overlay.deliveryId);}))))}).catch(()=>{ /* The existing expiry keeps the previous screen content valid. */ });return()=>{disposed=true;frames.forEach(frame=>window.cancelAnimationFrame(frame));};},[onReady,overlay.deliveryId,Boolean(presentation)]);
 if(!presentation)return fallback;
 return <section ref={root} role="alert" className="ledscores-sites-overlay" style={{position:"absolute",inset:0,zIndex:55,overflow:"hidden",display:"flex",alignItems:"center",justifyContent:"center",containerType:"inline-size"}} data-testid="ledscores-sites-overlay"><SitesPresentationView presentation={presentation} page={page} active fitViewport systemAssetUrls={overlay.sitesSystemAssetUrls} resolveAsset={asset=>resolveSitesLedAsset(overlay.assets,asset)}/></section>;
}
