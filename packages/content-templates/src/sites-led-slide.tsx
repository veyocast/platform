"use client";
import {useLayoutEffect,useRef} from "react";
import type {SitesDynamicDesignView as DynamicDesign} from "./sites-render-types";
import {LedSlideMarkup} from "./sites-led-markup";
export function LedSlidePreview({design,background,active=false,compact=false}:{design:DynamicDesign;background:string;active?:boolean;compact?:boolean}){
 const root=useRef<HTMLDivElement>(null);
 useLayoutEffect(()=>{
  const node=root.current;if(!node)return;
  let frame=0;let disposed=false;
  const measure=()=>{
   if(disposed)return;
   const sizes=Array.from(node.querySelectorAll<HTMLElement>('[data-fit-box]')).map(box=>{
    const inner=box.querySelector<HTMLElement>('[data-fit-content]');
    if(!inner)return null;
    const base=inner.getBoundingClientRect();
    const ratio=base.width/Math.max(1,inner.offsetWidth)||1;
    const bounds=[base,...Array.from(inner.children).map(child=>child.getBoundingClientRect())];
    const width=Math.max(inner.scrollWidth,inner.offsetWidth,(Math.max(...bounds.map(r=>r.right))-Math.min(...bounds.map(r=>r.left)))/ratio,1);
    const height=Math.max(inner.scrollHeight,inner.offsetHeight,(Math.max(...bounds.map(r=>r.bottom))-Math.min(...bounds.map(r=>r.top)))/ratio,1);
    const fit=Math.min(1,box.clientWidth/(width*1.035),box.clientHeight/(height*1.08));
    return {inner,fit:Math.max(.01,fit)};
   });
   for(const item of sizes)if(item)item.inner.style.setProperty('--led-auto-fit',String(item.fit));
  };
  const schedule=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(measure)};
  measure();
  const observer=typeof ResizeObserver==='undefined'?null:new ResizeObserver(schedule);
  observer?.observe(node);
  node.querySelectorAll('[data-fit-box]').forEach(box=>observer?.observe(box));
  window.addEventListener('resize',schedule);
  node.addEventListener('animationend',schedule);
  void document.fonts?.ready.then(()=>{if(!disposed)schedule()});
  return()=>{disposed=true;cancelAnimationFrame(frame);observer?.disconnect();window.removeEventListener('resize',schedule);node.removeEventListener('animationend',schedule)};
 },[design,background]);

 return <LedSlideMarkup rootRef={root} design={design} background={background} active={active} compact={compact}/>;
}
