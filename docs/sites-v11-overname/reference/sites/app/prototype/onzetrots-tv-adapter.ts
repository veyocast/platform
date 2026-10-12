import type {DynamicDesign} from './experience';
import {ONZETROTS_TV_ASSETS,type OnzeTrotsTvContent,type OnzeTrotsTvRow} from './screen-themes';

const text=(value:unknown,fallback='')=>typeof value==='string'?value:fallback;
const num=(value:unknown,fallback:number)=>Number.isFinite(Number(value))?Number(value):fallback;
const splitTeams=(primary:string)=>{const teams=primary.split(/\s[–—]\s/);return teams.length===2?{home:teams[0],away:teams[1]}:{}};

/** Adapts the user's saved content; never replaces it with the handoff's demo rows. */
export function dynamicToOnzeTrotsTv(design:DynamicDesign,rows:DynamicDesign['rows']=design.rows,page=0,pages=1):OnzeTrotsTvContent {
  const config=design.config;
  const club=text(config.clubName,text(config.club,'Duindorp SV'));
  const base:OnzeTrotsTvContent={kind:'generic',title:design.title||design.name,subtitle:design.subtitle,rows:rows.map(row=>({...row})),clubName:club,logo:/duindorp/i.test(club)?`${ONZETROTS_TV_ASSETS}/logo.png`:undefined,background:design.background,overlay:design.overlay,scale:design.scale,accent:design.accent,align:design.align,safeArea:design.safeArea,page:num(config.previewPage,page),pages:num(config.previewPages,pages),layout:design.layout,footer:'Voor de club. Voor elkaar.'};
  if(design.provider==='led-scores'){
    const moment=text(config.ledMoment,design.kind==='goal-overlay'?'goal':'live');
    const lineup=moment==='lineup'||config.ledView==='lineup';
    const home=design.rows[0],away=design.rows[1];
    const combined=home?.value?.match(/^(\d+)\s*[–—-]\s*(\d+)$/);
    const homeName=lineup?text(config.ownTeam,'Duindorp SV 1'):home?.primary||text(config.ownTeam,'Duindorp SV 1');
    const awayName=lineup?text(config.opponent,'Bezoekers'):combined?home?.secondary||text(config.opponent,'Bezoekers'):away?.primary||text(config.opponent,'Bezoekers');
    const timeline=Array.isArray(config.ledTimeline)?config.ledTimeline as OnzeTrotsTvRow[]:[];
    return {...base,kind:lineup?'lineup':moment==='goal'?'goal':'score',title:moment==='live'?'De tussenstand':base.title,eyebrow:config.showSceneLabel===false?'':lineup?'Samen het veld op':moment==='goal'?'Dit is onze trots':moment==='half'?'Even op adem komen':moment==='end'?'Alles gegeven':'Volg de wedstrijd',match:lineup?undefined:{home:homeName,away:awayName,homeScore:combined?.[1]??home?.value??String(config.homeScore??0),awayScore:combined?.[2]??away?.value??String(config.awayScore??0),homeLogo:base.logo,homeLabel:'Eigen team',awayLabel:'Tegenstander',clock:config.showClock?text(config.clock):undefined,label:moment==='half'?'Ruststand':moment==='end'?'Eindstand':moment==='goal'?'Nieuwe stand':'Live stand'},timeline:!lineup&&moment==='live'&&config.showTimeline&&config.template!=='scoreboard'?timeline.slice(0,Math.max(1,num(config.timelineLimit,3))):[],showBranding:config.showBranding!==false,showSceneLabel:config.showSceneLabel!==false,backgroundFit:config.backgroundFit==='cover'?'cover':'contain',titleScale:num(config.ledTitleScale,100),scoreScale:num(config.ledScoreScale,100),logoScale:num(config.ledLogoScale,100),teamScale:num(config.ledTeamScale,100)};
  }
  if(design.provider==='menu')return {...base,kind:'kantine',eyebrow:'Het hart van de club',rows:rows.map(row=>({...row,tag:config.showCategories?row.secondary||'Assortiment':'Assortiment'}))};
  const kind=design.kind;
  if(kind==='programme'||kind==='results')return {...base,kind:kind==='programme'?'programma':'uitslagen',rows:rows.map(row=>{
    const scores=kind==='results'?row.value?.match(/^(\d+)\s*[–—-]\s*(\d+)$/):null;
    return {...row,...splitTeams(row.primary),...(scores?{homeScore:scores[1],awayScore:scores[2]}:{}),...(kind==='programme'?{time:row.value}:{}),field:row.secondary,own:/duindorp/i.test(row.primary)};
  })};
  if(kind==='standings'){
    const options=(config.options&&typeof config.options==='object'?config.options:{}) as {standingsColumns?:string[]};
    const columns=Array.isArray(options.standingsColumns)?options.standingsColumns:undefined;
    return {...base,kind:'stand',standingColumns:columns,rows:rows.map((row,index)=>{
      const parts=(row.value||'').split(' · ');
      const stat=(suffix:string)=>parts.find(part=>new RegExp(`^[-+]?\\d+ ${suffix}$`,'i').test(part))?.split(' ')[0];
      const difference=parts.find(part=>/^[-+]?\d+$/.test(part));
      return {...row,rank:row.rank??num(config.rankOffset,page*rows.length)+index+1,own:/duindorp/i.test(row.primary),played:row.secondary?.match(/(\d+) gespeeld/)?.[1],won:stat('W'),drawn:stat('G'),lost:stat('V'),points:stat('pt'),difference};
    })};
  }
  return {...base,kind:'generic',eyebrow:kind==='birthdays'?'Jarig bij de club':kind==='referees'?'Onze scheidsrechters':kind==='arrival'?'Welkom op de club':'Clubinformatie'};
}
