"use client";
import {useLayoutEffect,useRef,type CSSProperties} from 'react';
import type {DynamicDesign} from './experience';
import s from './led-slide.module.css';

type TimelineItem={id:string;primary:string;value?:string};
const factor=(value:unknown)=>{const n=Number(value??100);return Number.isFinite(n)?Math.max(.7,Math.min(2,n/100)):1};

export function LedSlidePreview({design,background,active=false,compact=false}:{design:DynamicDesign;background:string;active?:boolean;compact?:boolean}){
 const root=useRef<HTMLDivElement>(null);
 const config=design.config;
 const moment=String(config.ledMoment||(design.kind==='live-score'?'live':design.kind==='goal-overlay'?'goal':'live'));
 const goal=moment==='goal';const lineup=moment==='lineup'||config.ledView==='lineup';const paper=config.ledTheme==='paper';
 const rawTitle=design.title||'GOALLL!';
 const heading=moment==='live'?'De tussenstand':goal&&/^(go+a+l+!?|doelpunt)$/i.test(rawTitle.trim())?'GOALLL!':rawTitle;
 const club=String(config.clubName||'Duindorp SV');const home=design.rows[0];const away=design.rows[1];
 const ownName=home?.primary||String(config.ownTeam||'Duindorp SV 1');const awayName=away?.primary||String(config.opponent||'Bezoekers');
 const homeScore=home?.value??String(config.homeScore??2);const awayScore=away?.value??String(config.awayScore??1);
 const timeline=Array.isArray(config.ledTimeline)?config.ledTimeline as TimelineItem[]:[];
 const showTimeline=!lineup&&moment==='live'&&Boolean(config.showTimeline)&&config.template!=='scoreboard'&&timeline.length>0;
 const showBranding=config.showBranding!==false;
 const margin=Math.max(1,Math.min(12,design.safeArea??3));const scale=factor(design.scale);
 const grunge=Math.max(0,Math.min(100,Number(config.grunge??55)))/100;
 const customAccent=design.accent==='#ff8127'?'#b8d7f2':design.accent;
 const titleScale=Math.min(1,18/Math.max(1,heading.length));const isDuindorp=/duindorp/i.test(club);
 const subtitle=moment==='live'?(config.showClock?`${String(config.clock||'67:24')} · wedstrijd bezig`:'Samen langs de lijn'):design.subtitle;

 // Measure natural content within independent, fixed grid regions. Transforming the
 // inner group leaves those regions unchanged, so a larger score cannot hit the timeline.
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
 },[design,background,heading]);

 return <div ref={root} className={s.slide} data-theme={paper?'paper':'blue'} data-layout={design.layout} data-orientation={design.orientation} data-moment={moment} data-active={active} data-animation={String(config.animation||'rise')} data-compact={compact} data-branding={showBranding} style={{'--led-accent':customAccent,'--led-grunge':grunge,'--led-scale':scale,'--led-title-size':scale*factor(config.ledTitleScale)*titleScale,'--led-subtitle-size':scale*factor(config.ledTitleScale),'--led-score-size':scale*factor(config.ledScoreScale),'--led-logo-size':scale*factor(config.ledLogoScale),'--led-team-size':scale*factor(config.ledTeamScale),'--led-margin':`${margin}cqw`,'--led-overlay':Math.max(0,Math.min(.95,(design.overlay??20)/100)),'--led-align':design.align} as CSSProperties} aria-label={`OnzeTrots · ${design.name}`}>
  {background&&<img className={s.photo} src={background} alt="" style={{objectFit:config.backgroundFit==='cover'?'cover':'contain'}}/>}
  <div className={s.wash}/><div className={s.edgePaint} aria-hidden="true"/><div className={s.lightPaint} aria-hidden="true"/>
  <div className={s.content}>
   {showBranding&&<div className={s.topline}><span>{club.toUpperCase()}</span><span>{goal?(config.ledSide==='opponent'?'WEDSTRIJDMOMENT':'DIT IS ONZE TROTS'):'ONZE CLUB. ONS VERHAAL.'}</span></div>}
   <header className={s.headline} data-fit-box><div className={`${s.fitInner} ${s.headlineInner}`} data-fit-content>{!goal&&config.showSceneLabel!==false&&<span className={s.sceneLabel}>{lineup?'Samen het veld op':moment==='half'?'Even op adem komen':moment==='end'?'Alles gegeven':'Volg de wedstrijd'}</span>}<h2>{heading}</h2>{subtitle&&<p>{subtitle}</p>}</div></header>
   {lineup?<div className={s.lineup} data-fit-box><div className={`${s.fitInner} ${s.lineupInner}`} data-fit-content>{design.rows.slice(0,8).map((row,index)=><div key={row.id}><span>{(row.primary.match(/^\d+/)?.[0]||String(index+1)).padStart(2,'0')}</span><div><strong>{row.primary.replace(/^\d+\s*[·.−-]\s*/, '')}</strong>{row.secondary&&<small>{row.secondary}</small>}</div></div>)}</div></div>:<div className={s.match}>
    <div className={s.team} data-team="own" data-fit-box><div className={`${s.fitInner} ${s.teamInner}`} data-fit-content>{isDuindorp?<img className={s.crest} src="/onzetrots/duindorp-logo.png" alt="Duindorp SV"/>:<span className={s.monogram}>{ownName.split(' ').map(v=>v[0]).join('').slice(0,3)}</span>}<strong>{ownName}</strong><small>Eigen team</small></div></div>
    <div className={s.score} aria-label={`Stand ${homeScore} tegen ${awayScore}`} data-fit-box><div className={`${s.fitInner} ${s.scoreInner}`} data-fit-content><div className={s.scoreDigits}><b>{homeScore}</b><span>–</span><b>{awayScore}</b></div><small>{moment==='end'?'EINDSTAND':moment==='half'?'RUSTSTAND':goal?'NIEUWE STAND':'LIVE STAND'}</small></div></div>
    <div className={s.team} data-team="away" data-fit-box><div className={`${s.fitInner} ${s.teamInner}`} data-fit-content><span className={s.monogram}>{awayName.split(' ').map(v=>v[0]).join('').slice(0,3)}</span><strong>{awayName}</strong><small>Tegenstander</small></div></div>
   </div>}
   {showTimeline&&<div className={s.timeline}>{timeline.slice(0,3).map(event=><div key={event.id}><span>{event.primary}</span><strong>{event.value}</strong></div>)}</div>}
   {showBranding&&<footer className={s.footer}><span className={s.signature}>OnzeTrots.</span><span>{goal&&config.ledSide!=='opponent'?'Voor deze momenten doen we het.':'Voor de club. Voor elkaar.'}</span><i aria-hidden="true"/></footer>}
  </div>
 </div>
}
