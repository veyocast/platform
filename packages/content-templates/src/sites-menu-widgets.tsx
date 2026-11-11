"use client";
import React, {useEffect,useLayoutEffect,useRef,useState} from "react";
import type {SitesPresentation} from "@veyocast/contracts";
import {SitesMenuWidgetsMarkup} from "./sites-menu-widgets-markup";
import {measureSyncOnzeTrotsV9Layout} from "./sync-onzetrots-v9-motion";
import {fitSitesUnifiedViewport} from "./sites-unified-v17";
import type {SitesAssetResolver} from "./sites-presentation-model";
import {fitSitesOnzeTrotsHeaders,loadSitesOnzeTrotsHeaderFont} from "./sites-onzetrots-brand";
const useMeasurement=typeof window==="undefined"?useEffect:useLayoutEffect;
export function SitesMenuWidgets({presentation,resolveAsset,page=0,fitViewport=false,active=false,onContentFit}:{presentation:Extract<SitesPresentation,{kind:"dynamic"}>;resolveAsset:SitesAssetResolver;page?:number;fitViewport?:boolean;active?:boolean;onContentFit?:(overflow:boolean)=>void}) {
 const root=useRef<HTMLDivElement>(null),[width,setWidth]=useState(0),portrait=presentation.configuration.orientation==="portrait";
 useMeasurement(()=>{const element=root.current;if(!element)return;const measure=()=>setWidth(fitSitesUnifiedViewport(element.clientWidth,fitViewport?element.clientHeight:0,presentation.configuration.orientation));measure();const observer=new ResizeObserver(measure);observer.observe(element);return()=>observer.disconnect();},[fitViewport,presentation.configuration.orientation]);
 useMeasurement(()=>{const element=root.current;if(!element)return;let current=true;
  const measure=()=>{if(!current)return;if(element.querySelector(".screen[data-ot-current]"))measureSyncOnzeTrotsV9Layout(element);for(const frame of element.querySelectorAll<HTMLElement>(".vm-widget-image[data-ratio]")){const image=frame.querySelector<HTMLImageElement>("img");if(!image)continue;const ratio=frame.dataset.ratio==="9:16"?9/16:16/9,frameWidth=Math.min(frame.clientWidth,frame.clientHeight*ratio);image.style.width=`${frameWidth}px`;image.style.height=`${frameWidth/ratio}px`;}const overflow=measureMenuWidgetOverflow(element);element.dataset.menuContentOverflow=String(overflow);onContentFit?.(overflow);};
  const fit=()=>{if(current){fitSitesOnzeTrotsHeaders(element);measure();}};
  fit();void loadSitesOnzeTrotsHeaderFont(element).then(fit).catch(()=>undefined);void document.fonts.ready.then(fit);element.addEventListener("load",fit,true);const observer=new ResizeObserver(fit);observer.observe(element);for(const content of element.querySelectorAll<HTMLElement>(".vm-widgets"))observer.observe(content);return()=>{current=false;observer.disconnect();element.removeEventListener("load",fit,true);};
 },[presentation,page,width,onContentFit]);
 return <div ref={root} style={{width:"100%",...(fitViewport?{height:"100%"}:{aspectRatio:portrait?"9 / 16":"16 / 9"}),minWidth:0,minHeight:0,overflow:"hidden",display:"grid",placeItems:"center"}}><SitesMenuWidgetsMarkup active={active} presentation={presentation} resolveAsset={resolveAsset} page={page} width={width||undefined}/></div>;
}

export function measureMenuWidgetOverflow(element:HTMLElement) {
 return Array.from(element.querySelectorAll<HTMLElement>(".vm-products-fit")).some(box=>{
  const bounds=box.getBoundingClientRect();
  return Array.from(box.querySelectorAll<HTMLElement>(".vm-widget,.vm-product,.vm-widget header,.vm-widget-image")).some(child=>{
   const rect=child.getBoundingClientRect();
   return rect.bottom>bounds.bottom+1||rect.right>bounds.right+1||rect.left<bounds.left-1;
  });
 });
}
