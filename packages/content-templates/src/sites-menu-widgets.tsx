"use client";
import React, {useEffect,useLayoutEffect,useRef,useState} from "react";
import type {SitesPresentation} from "@veyocast/contracts";
import {SitesMenuWidgetsMarkup} from "./sites-menu-widgets-markup";
import {fitSitesUnifiedViewport} from "./sites-unified-v17";
import type {SitesAssetResolver} from "./sites-presentation-model";
const useMeasurement=typeof window==="undefined"?useEffect:useLayoutEffect;
export function SitesMenuWidgets({presentation,resolveAsset,page=0,fitViewport=false,active=false}:{presentation:Extract<SitesPresentation,{kind:"dynamic"}>;resolveAsset:SitesAssetResolver;page?:number;fitViewport?:boolean;active?:boolean}) {
 const root=useRef<HTMLDivElement>(null),[width,setWidth]=useState(0),portrait=presentation.configuration.orientation==="portrait";
 useMeasurement(()=>{const element=root.current;if(!element)return;const measure=()=>setWidth(fitSitesUnifiedViewport(element.clientWidth,fitViewport?element.clientHeight:0,presentation.configuration.orientation));measure();const observer=new ResizeObserver(measure);observer.observe(element);return()=>observer.disconnect();},[fitViewport,presentation.configuration.orientation]);
 useMeasurement(()=>{const element=root.current;if(!element)return;let current=true;
  const measure=()=>{if(!current)return;for(const frame of element.querySelectorAll<HTMLElement>(".vm-widget-image[data-ratio]")){const image=frame.querySelector<HTMLImageElement>("img");if(!image)continue;const ratio=frame.dataset.ratio==="9:16"?9/16:16/9,w=Math.min(frame.clientWidth,frame.clientHeight*ratio);image.style.width=`${w}px`;image.style.height=`${w/ratio}px`;}for(const box of element.querySelectorAll<HTMLElement>("[data-fit-box]")){const inner=box.querySelector<HTMLElement>("[data-fit-content]");if(!inner)continue;inner.style.setProperty("--led-auto-fit","1");const bounds=inner.getBoundingClientRect(),ratio=bounds.width/Math.max(1,inner.offsetWidth)||1;let right=bounds.right,bottom=bounds.bottom;for(const child of inner.children){const rect=child.getBoundingClientRect();right=Math.max(right,rect.right);bottom=Math.max(bottom,rect.bottom);}const w=Math.max(inner.scrollWidth,inner.offsetWidth,(right-bounds.left)/ratio,1),h=Math.max(inner.scrollHeight,inner.offsetHeight,(bottom-bounds.top)/ratio,1);inner.style.setProperty("--led-auto-fit",String(Math.max(.01,Math.min(1,box.clientWidth/w,box.clientHeight/h))));}};
  measure();void document.fonts.ready.then(measure);const observer=new ResizeObserver(measure);observer.observe(element);return()=>{current=false;observer.disconnect();};
 },[presentation,page,width]);
 return <div ref={root} style={{width:"100%",...(fitViewport?{height:"100%"}:{aspectRatio:portrait?"9 / 16":"16 / 9"}),minWidth:0,minHeight:0,overflow:"hidden",display:"grid",placeItems:"center"}}><SitesMenuWidgetsMarkup active={active} presentation={presentation} resolveAsset={resolveAsset} page={page} width={width||undefined}/></div>;
}
