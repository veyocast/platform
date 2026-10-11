import React from "react";
import type { CSSProperties } from "react";
import type { SitesStudioSlideView as Slide } from "./sites-render-types";
import { sitesStudioClasses as s } from "./sites-styles";
function SitesMapPin(){return <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/></svg>}
export function SlideCanvas({slide,selected=false,playing=false,onSelect}:{slide:Slide;selected?:boolean;playing?:boolean;onSelect?:(field:'title'|'time'|'subtitle'|'location')=>void}){

 const full=slide.layout==='full'||slide.layout==='bottom';const headlineWidth=slide.orientation==='portrait'?80:full?80:40;const headlineMax=slide.orientation==='portrait'?19:slide.layout==='full'?11:slide.layout==='bottom'?8:12;
 return <div data-layout={slide.layout??'split'} data-motion={slide.animation} className={`${s.slideCanvas} ${slide.orientation==='portrait'?s.portrait:''} ${playing?s.animate:''}`} style={{'--slide-headline-size':`${Math.min(headlineMax,headlineWidth*1.6/Math.max(4,slide.time.length))}cqw`,'--slide-bg':slide.background,'--slide-accent':slide.color,'--slide-overlay':(slide.overlay??55)/100,'--slide-easing':slide.transition==='Lineair'?'linear':slide.transition==='Versnellen'?'ease-in':slide.transition==='Vloeiend'?'ease-in-out':'ease-out'} as CSSProperties}>
  {slide.photo&&<img className={s.slidePhoto} src={slide.photo} alt="" style={{objectPosition:slide.photoPosition??'center'}}/>}
  <div className={s.slideAngle}/><div className={s.slideSeam}/>
  {selected&&<span className={s.safeBadge}>Veilige zone</span>}
  <div className={`${s.slideCopy} ${selected?s.selectedCopy:''}`} style={{textAlign:slide.align}}>
   {selected&&<><i className={s.handleTL}/><i className={s.handleTR}/><i className={s.handleBL}/><i className={s.handleBR}/></>}
   {slide.context&&<><span role={onSelect?"button":undefined} tabIndex={onSelect?0:undefined} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onSelect?.('title')}}} onClick={()=>onSelect?.('title')} className={s.slideTitle} style={{color:slide.color,fontWeight:slide.bold?800:500,fontStyle:slide.italic?'italic':'normal',fontSize:`${slide.size/19.5}cqw`}}>{slide.title}</span><span role={onSelect?"button":undefined} tabIndex={onSelect?0:undefined} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onSelect?.('time')}}} onClick={()=>onSelect?.('time')} className={s.slideTime}>{slide.time}</span><span role={onSelect?"button":undefined} tabIndex={onSelect?0:undefined} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onSelect?.('subtitle')}}} onClick={()=>onSelect?.('subtitle')} className={s.slideSubtitle}>{slide.subtitle}</span></>}
   {slide.showLocation&&<span role={onSelect?"button":undefined} tabIndex={onSelect?0:undefined} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onSelect?.('location')}}} onClick={()=>onSelect?.('location')} className={s.slideLocation}><SitesMapPin/>{slide.location}</span>}
  </div><span className={s.clubMonogram} title={slide.clubName||'Onze club'}>{slide.logo?<img src={slide.logo} alt={slide.clubName||'Clublogo'}/>:((slide.clubName||'Onze club').split(' ').map(x=>x[0]).join('').slice(0,3).toUpperCase())}</span>
 </div>
}
