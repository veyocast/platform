"use client";
import {useEffect,useRef,useState} from "react";
import {OnzeTrotsTvMarkup,type SitesTvPreviewProps} from "./sites-onzetrots-tv-markup";
export function OnzeTrotsTvPreview({content,orientation,active=false,compact=false}:SitesTvPreviewProps){
 const ref=useRef<HTMLDivElement>(null);const [width,setWidth]=useState(orientation==='portrait'?1080:1920);const portrait=orientation==='portrait';
 useEffect(()=>{const node=ref.current;if(!node)return;const measure=()=>setWidth(node.clientWidth);measure();const observer=new ResizeObserver(measure);observer.observe(node);return()=>observer.disconnect()},[]);
 useEffect(()=>{
  let disposed=false;const node=ref.current;if(!node)return;
  const saved=new Map<HTMLElement,string>();
  const fit=()=>{if(disposed)return;node.querySelectorAll<HTMLElement>('.otv-live-score,.otv-score-team h2,.otv-score-screen h1,.ns-match-teams h3,.otv-generic h1,.nk-welcome-copy h1,.nk-walking-feature h2').forEach(element=>{
   if(!saved.has(element))saved.set(element,element.style.fontSize);else element.style.fontSize=saved.get(element)||'';
   const computed=getComputedStyle(element);let size=parseFloat(computed.fontSize);const base=size;const max=parseFloat(computed.maxHeight);
   for(let i=0;i<22&&size>base*.45&&(element.scrollWidth>element.clientWidth+2||(Number.isFinite(max)&&element.scrollHeight>max+2));i++){size*=.94;element.style.fontSize=`${size}px`;}
  })};
  const frame=requestAnimationFrame(fit);void document.fonts.ready.then(fit);
  return()=>{disposed=true;cancelAnimationFrame(frame);saved.forEach((size,element)=>{element.style.fontSize=size})};
 },[content,width,portrait]);
 return <OnzeTrotsTvMarkup content={content} orientation={orientation} active={active} compact={compact} width={width} rootRef={ref}/>;
}
