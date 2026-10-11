import React from "react";
import {type CSSProperties,type RefObject} from 'react';
import type {SitesDynamicDesignView as DynamicDesign} from './sites-render-types';
import { sitesLedClasses as s } from "./sites-styles";

type TimelineItem={id:string;primary:string;value?:string};
const factor=(value:unknown)=>{const n=Number(value??100);return Number.isFinite(n)?Math.max(.7,Math.min(2,n/100)):1};

export function LedSlideMarkup({design,background,active=false,compact=false,rootRef}:{design:DynamicDesign;background:string;active?:boolean;compact?:boolean;rootRef?:RefObject<HTMLDivElement|null>}){
 const config=design.config;
 const moment=String(config.ledMoment||(design.kind==='live-score'?'live':design.kind==='goal-overlay'?'goal':'live'));
 const goal=moment==='goal';const lineup=moment==='lineup'||config.ledView==='lineup';const paper=config.ledTheme==='paper';
 const rawTitle=design.title||'GOALLL!';
 const heading=moment==='live'?'De tussenstand':goal&&/^(go+a+l+!?|doelpunt)$/i.test(rawTitle.trim())?'GOALLL!':rawTitle;
 const club=String(config.clubName||'Onze club');const home=design.rows[0];const away=design.rows[1];
 const ownName=home?.primary||String(config.homeTeam||'Thuisteam');const awayName=away?.primary||String(config.awayTeam||'Uitteam');
 const homeScore=home?.value??String(config.homeScore??"—");const awayScore=away?.value??String(config.awayScore??"—");
 const timeline=Array.isArray(config.ledTimeline)?config.ledTimeline as TimelineItem[]:[];
 const showTimeline=!lineup&&moment==='live'&&Boolean(config.showTimeline)&&config.template!=='scoreboard'&&timeline.length>0;
 const showBranding=config.showBranding!==false;
 const margin=Math.max(1,Math.min(12,design.safeArea??3));const scale=factor(design.scale);
 const grunge=Math.max(0,Math.min(100,Number(config.grunge??55)))/100;
 const customAccent=design.accent==='#ff8127'?'#b8d7f2':design.accent;
 const titleScale=Math.min(1,18/Math.max(1,heading.length));const homeLogo=typeof config.homeLogo==='string'?config.homeLogo:'';const awayLogo=typeof config.awayLogo==='string'?config.awayLogo:'';
 const subtitle=moment==='live'?(config.showClock?`${String(config.clock||'—')} · wedstrijd bezig`:'Samen langs de lijn'):design.subtitle;

 // Measure natural content within independent, fixed grid regions. Transforming the
 // inner group leaves those regions unchanged, so a larger score cannot hit the timeline.

 return <div ref={rootRef} className={s.slide} data-theme={paper?'paper':'blue'} data-layout={design.layout} data-orientation={design.orientation} data-moment={moment} data-active={active} data-animation={String(config.animation||'rise')} data-compact={compact} data-branding={showBranding} style={{'--led-accent':customAccent,'--led-grunge':grunge,'--led-scale':scale,'--led-title-size':scale*factor(config.ledTitleScale)*titleScale,'--led-subtitle-size':scale*factor(config.ledTitleScale),'--led-score-size':scale*factor(config.ledScoreScale),'--led-logo-size':scale*factor(config.ledLogoScale),'--led-team-size':scale*factor(config.ledTeamScale),'--led-margin':`${margin}cqw`,'--led-overlay':Math.max(0,Math.min(.95,(design.overlay??20)/100)),'--led-align':design.align} as CSSProperties} aria-label={`OnzeTrots · ${design.name}`}>
  {background&&<img className={s.photo} src={background} alt="" style={{objectFit:config.backgroundFit==='cover'?'cover':'contain'}}/>}
  <div className={s.wash}/><div className={s.edgePaint} aria-hidden="true"/><div className={s.lightPaint} aria-hidden="true"/>
  <div className={s.content}>
   {showBranding&&<div className={s.topline}><span>{club.toUpperCase()}</span><span>{goal?(config.ledSide==='opponent'?'WEDSTRIJDMOMENT':'DIT IS ONZE TROTS'):'ONZE CLUB. ONS VERHAAL.'}</span></div>}
   <header className={s.headline} data-fit-box><div className={`${s.fitInner} ${s.headlineInner}`} data-fit-content>{!goal&&config.showSceneLabel!==false&&<span className={s.sceneLabel}>{lineup?'Samen het veld op':moment==='half'?'Even op adem komen':moment==='end'?'Alles gegeven':'Volg de wedstrijd'}</span>}<h2>{heading}</h2>{subtitle&&<p>{subtitle}</p>}</div></header>
   {lineup?<div className={s.lineup} data-fit-box><div className={`${s.fitInner} ${s.lineupInner}`} data-fit-content>{design.rows.slice(0,8).map((row,index)=><div key={row.id}><span>{(row.primary.match(/^\d+/)?.[0]||String(index+1)).padStart(2,'0')}</span><div><strong>{row.primary.replace(/^\d+\s*[·.−-]\s*/, '')}</strong>{row.secondary&&<small>{row.secondary}</small>}</div></div>)}</div></div>:<div className={s.match}>
    <div className={s.team} data-team="own" data-fit-box><div className={`${s.fitInner} ${s.teamInner}`} data-fit-content>{homeLogo?<img className={s.crest} src={homeLogo} alt={ownName}/>:<span className={s.monogram}>{ownName.split(' ').map(v=>v[0]).join('').slice(0,3)}</span>}<strong>{ownName}</strong><small>{config.homeOwn?"Eigen team":config.awayOwn?"Tegenstander":"Thuis"}</small></div></div>
    <div className={s.score} aria-label={`Stand ${homeScore} tegen ${awayScore}`} data-fit-box><div className={`${s.fitInner} ${s.scoreInner}`} data-fit-content><div className={s.scoreDigits}><b>{homeScore}</b><span>–</span><b>{awayScore}</b></div><small>{moment==='end'?'EINDSTAND':moment==='half'?'RUSTSTAND':goal?'NIEUWE STAND':'LIVE STAND'}</small></div></div>
    <div className={s.team} data-team="away" data-fit-box><div className={`${s.fitInner} ${s.teamInner}`} data-fit-content>{awayLogo?<img className={s.crest} src={awayLogo} alt={awayName}/>:<span className={s.monogram}>{awayName.split(' ').map(v=>v[0]).join('').slice(0,3)}</span>}<strong>{awayName}</strong><small>{config.awayOwn?"Eigen team":config.homeOwn?"Tegenstander":"Uit"}</small></div></div>
   </div>}
   {showTimeline&&<div className={s.timeline}>{timeline.slice(0,3).map(event=><div key={event.id}><span>{event.primary}</span><strong>{event.value}</strong></div>)}</div>}
   {showBranding&&<footer className={s.footer}><span className={s.signature}>OnzeTrots.</span><span>{goal&&config.ledSide!=='opponent'?'Voor deze momenten doen we het.':'Voor de club. Voor elkaar.'}</span><i aria-hidden="true"/></footer>}
  </div>
 </div>
}
