import {useMemo, useState, type ReactNode} from 'react';
import {motion} from 'motion/react';
import {useApp} from '../store';
import {Badge, Button, EmptyState, Icon} from '../ui';
import {SlidePreview} from './Content';
import coverage from '../coverage.json';
import './overview.css';

type Row=Record<string,any>;
type Scenario={id:string;area:string;label:string;acceptance:string};
const healthy=['connected','healthy','active','fresh'];
const labelStatus=(value:string)=>({online:'Bereikbaar',offline:'Offline',unknown:'Status onbekend'}[value]??'Status onbekend');
const toneStatus=(value:string)=>value==='online'?'green':value==='offline'?'amber':'neutral';
function clock(value:string){const d=new Date(value);return Number.isNaN(d.getTime())?'Tijd onbekend':new Intl.DateTimeFormat('nl-NL',{hour:'2-digit',minute:'2-digit'}).format(d)}
function shortDate(value:string){const d=new Date(value);return Number.isNaN(d.getTime())?value:new Intl.DateTimeFormat('nl-NL',{day:'numeric',month:'short'}).format(d)}
function eventTime(value:string){const d=new Date(value);return Number.isNaN(d.getTime())?value:new Intl.DateTimeFormat('nl-NL',{hour:'2-digit',minute:'2-digit'}).format(d)}

function confirmedItem(data:Row, screen?:Row){
  if(!screen?.confirmedVersion)return null;
  const release=(data.releases??[]).find((r:Row)=>r.id===screen.confirmedVersion);
  if(!release)return null;
  const placed=(release.items??[]).find((i:Row)=>i.visible!==false&&i.enabled!==false);
  if(!placed)return null;
  const snapshot=placed.snapshot??placed.contentSnapshot??placed.content;
  const frozen=release.contentSnapshots??release.content??[];
  const content=snapshot??frozen.find?.((c:Row)=>c.placementId===placed.id)??frozen.find?.((c:Row)=>c.id===placed.contentId)??(data.content??[]).find((c:Row)=>c.id===placed.contentId);
  if(!content)return null;
  const playlist=(data.playlists??[]).find((p:Row)=>p.id===release.playlistId);
  return {item:{...content,theme:placed.theme&&placed.theme!=='inherit'?placed.theme:release.theme??playlist?.theme??content.theme},release};
}
function ScreenPreview({screen,className=''}:{screen?:Row;className?:string}){
  const{data}=useApp();const preview=confirmedItem(data,screen);
  return <div className={`ov-preview ${className}`}>
    {preview?<SlidePreview item={preview.item}/>:<div className="ov-preview-empty"><Icon name="Monitor" size={32}/><strong>Nog geen bevestigde inhoud</strong><span>Koppel een scherm en publiceer je eerste playlist.</span></div>}
  </div>;
}
function Heading({eyebrow,title,copy,action}:{eyebrow?:string;title:string;copy?:string;action?:ReactNode}){
  return <div className="ov-heading"><div>{eyebrow&&<span className="ov-eyebrow">{eyebrow}</span>}<h2>{title}</h2>{copy&&<p>{copy}</p>}</div>{action}</div>;
}
function Metric({icon,label,value,note}:{icon:string;label:string;value:ReactNode;note:string}){
  return <div className="ov-metric"><span className="ov-metric-icon"><Icon name={icon}/></span><span>{label}</span><strong>{value}</strong><small>{note}</small></div>;
}
function ScreenRows({compact=false}:{compact?:boolean}){
  const{data,go}=useApp();return <div className={`ov-screen-rows ${compact?'is-compact':''}`}>
    {(data.screens??[]).map((s:Row)=>{const release=(data.releases??[]).find((r:Row)=>r.id===s.confirmedVersion);return <button className="ov-screen-row" key={s.id} onClick={()=>go('screens',s.id)}>
      <span className={`ov-device-icon ${s.status}`}><Icon name={s.platform==='Web'?'Laptop':'Monitor'}/></span>
      <span className="ov-screen-name"><strong>{s.name}</strong><small>{s.platform} · {s.location}</small></span>
      <span className="ov-screen-publication"><strong>{release?.name??'Geen bevestigde publicatie'}</strong><small>{s.confirmedVersion??'—'} {s.desiredVersion!==s.confirmedVersion?`→ ${s.desiredVersion??'nog geen doel'}`:'· bevestigde versie'}</small></span>
      <span className="ov-screen-state"><Badge tone={toneStatus(s.status)}>{labelStatus(s.status)}</Badge><small>{s.lastSeen??'Nog geen contact'}</small></span><Icon name="ChevronRight" size={16}/>
    </button>})}
    {!data.screens?.length&&<EmptyState title="Je eerste scherm wacht op je" description="Maak een scherm aan en koppel de Player." action={<Button onClick={()=>go('screens')}>Scherm koppelen</Button>}/>}
  </div>;
}
function AttentionList({limit=4}:{limit?:number}){
  const{data,go}=useApp();const items:Row[]=[];
  (data.screens??[]).forEach((s:Row)=>{
    if(s.status==='offline')items.push({id:s.id,icon:'WifiOff',title:s.name,copy:`Geen contact · ${s.lastSeen??'controleer het apparaat'}`,route:'screens',tone:'amber'});
    else if(s.status==='unknown')items.push({id:s.id,icon:'CircleHelp',title:s.name,copy:'Nog geen recente status ontvangen',route:'screens',tone:'neutral'});
    else if(s.desiredVersion!==s.confirmedVersion)items.push({id:s.id,icon:'Download',title:s.name,copy:`Wacht op ${s.desiredVersion??'publicatiebevestiging'}`,route:'screens',tone:'blue'});
  });
  (data.sources??[]).filter((s:Row)=>!healthy.includes(s.status)).forEach((s:Row)=>items.push({id:s.id,icon:'PlugZap',title:s.name,copy:['error','failed'].includes(s.status)?'Synchronisatie mislukt · bekijk de bron':'Brongegevens vragen aandacht',route:'sources',tone:'amber'}));
  (data.content??[]).filter((c:Row)=>['processing','pending','failed','error'].includes(c.status)).forEach((c:Row)=>items.push({id:c.id,icon:'Image',title:c.title,copy:['failed','error'].includes(c.status)?'Verwerking mislukt':'Media wordt nog verwerkt',route:'content',tone:'blue'}));
  return <div className="ov-attentions">{items.slice(0,limit).map((a:Row)=><button key={`${a.route}-${a.id}`} className={`ov-attention ${a.tone}`} onClick={()=>go(a.route,a.id)}><span className="ov-attention-icon"><Icon name={a.icon}/></span><span><strong>{a.title}</strong><small>{a.copy}</small></span><Icon name="ArrowUpRight" size={16}/></button>)}{!items.length&&<div className="ov-clear-state"><Icon name="CircleCheck"/><strong>Alles rustig, alles in beeld.</strong><span>Er zijn geen actuele signalen die aandacht vragen.</span></div>}</div>;
}
function ScheduleList(){const{data,go}=useApp();const items=[...(data.schedule??[])].sort((a:Row,b:Row)=>String(a.start).localeCompare(String(b.start)));return <div className="ov-schedule-list">{items.slice(0,3).map((s:Row)=><button className="ov-schedule-item" key={s.id} onClick={()=>go('planning',s.id)}><span className="ov-schedule-date">{shortDate(s.start)}<strong>{clock(s.start)}</strong></span><span><strong>{s.title}</strong><small>{s.targets?.length??0} schermen · {s.repeat==='weekly'?'Wekelijks':s.repeat==='daily'?'Dagelijks':'Eenmalig'}</small></span><Icon name="ArrowUpRight" size={17}/></button>)}{!items.length&&<div className="ov-list-empty">Nog niets gepland. Maak ruimte voor je volgende clubmoment.</div>}</div>}
function Activity({limit=4}:{limit?:number}){const{data}=useApp();return <div className="ov-activity">{(data.audit??[]).slice(0,limit).map((a:Row)=><div className="ov-activity-item" key={a.id}><span className="ov-activity-dot"/><div><strong>{a.action}</strong><small>{a.actor??'Clubbeheer'} · {eventTime(a.at??'')}</small></div></div>)}{!data.audit?.length&&<div className="ov-list-empty">Je eerste wijziging verschijnt hier.</div>}</div>}
function SourcesStrip(){const{data,go}=useApp();return <div className="ov-sources-strip"><span>Je bronnen</span>{(data.sources??[]).map((s:Row)=><button key={s.id} onClick={()=>go('sources',s.id)}><i className={healthy.includes(s.status)?'healthy':'warning'}/>{s.name}<Icon name="ArrowUpRight" size={13}/></button>)}</div>}

export function OverviewPage(){
  const{data,design,go,openPlayer}=useApp();
  const screens:Row[]=data.screens??[],playlists:Row[]=data.playlists??[],sources:Row[]=data.sources??[],content:Row[]=data.content??[];
  const online=screens.filter(s=>s.status==='online').length;
  const confirmed=screens.filter(s=>s.confirmedVersion&&s.confirmedVersion===s.desiredVersion&&s.status==='online').length;
  const concept=playlists.filter(p=>!p.publishedVersion).length;
  const sourceHealthy=sources.filter(s=>healthy.includes(s.status)).length;
  const needsAttention=screens.filter(s=>s.status!=='online'||s.confirmedVersion!==s.desiredVersion).length+sources.filter(s=>!healthy.includes(s.status)).length+content.filter(c=>['processing','pending','failed','error'].includes(c.status)).length;
  const primary=screens.find(s=>s.status==='online'&&confirmedItem(data,s))??screens[0];
  const primaryRelease=primary?(data.releases??[]).find((r:Row)=>r.id===primary.confirmedVersion):null;
  const demoDay=data.schedule?.[0]?.start?shortDate(data.schedule[0].start):'Jouw clubdag';
  const quick=<div className="ov-quick-actions"><Button icon="CalendarDays" onClick={()=>go('planning')}>Planning</Button><Button icon="Plus" variant="primary" onClick={()=>go('studio')}>Content maken</Button></div>;
  const metrics=<div className="ov-metrics"><Metric icon="Monitor" label="Schermen bereikbaar" value={<>{online}<em> / {screens.length}</em></>} note={`${screens.filter(s=>s.status==='unknown').length} zonder recente status`}/><Metric icon="CircleCheck" label="Publicatie bevestigd" value={confirmed} note="Bereikbaar en gewenste versie actief"/><Metric icon="Layers" label="Conceptplaylists" value={concept} note="Nog niet gepubliceerd"/><Metric icon="Plug" label="Bronnen actueel" value={<>{sourceHealthy}<em> / {sources.length}</em></>} note="Volgens laatste bronstatus"/></div>;
  const heroPreview=<><ScreenPreview screen={primary}/><div className="ov-preview-caption"><span>Preview bevestigde publicatie · demodata</span><strong>{primary?.confirmedVersion??'Nog geen versie'} · {primary?.lastSeen??'Geen contact'}</strong></div></>;
  const headName=data.settings?.tenantName??'Jouw club';
  return <motion.div className={`ov-page ov-${design||'sync'}`} initial={{opacity:0,y:9}} animate={{opacity:1,y:0}} transition={{duration:.28}}>
    {(!design||design==='sync')&&<>
      <header className="ov-page-header"><div><span className="ov-eyebrow">JOUW WERKPLEK · {headName}</span><h1>Mooi dat je er bent, Danny<span>.</span></h1><p>De club in beeld. Jij houdt het overzicht.</p></div>{quick}</header>
      {metrics}
      <div className="ov-sync-feature"><section className="ov-today-hero"><div className="ov-today-copy"><span className="ov-eyebrow"><i className="ov-live-dot"/> DEMODAG · {demoDay}</span><h2>Een mooie dag<br/>voor jouw club.</h2><p>{primaryRelease?.name??'Je verhaal begint hier.'}<br/>{confirmed} schermen hebben de gewenste publicatie bevestigd.</p><div className="ov-hero-actions"><Button variant="primary" icon="Play" onClick={()=>openPlayer(primary?.id)}>Player bekijken</Button><button className="ov-text-link" onClick={()=>go('playlists',primaryRelease?.playlistId)}>Playlist openen <Icon name="ArrowUpRight" size={15}/></button></div></div><div className="ov-today-visual">{heroPreview}</div></section><section className="ov-panel ov-attention-panel"><Heading eyebrow="EVEN BIJKIJKEN" title="Vraagt je aandacht" action={<span className="ov-count">{needsAttention}</span>}/><AttentionList limit={3}/></section></div>
      <div className="ov-main-columns"><section className="ov-panel"><Heading title="Jouw schermen" copy="Bereikbaarheid en bevestigde inhoud, naast elkaar." action={<button className="ov-text-link" onClick={()=>go('screens')}>Alle schermen <Icon name="ArrowRight" size={15}/></button>}/><ScreenRows/></section><section className="ov-panel"><Heading title="Op de planning" action={<button className="ov-icon-link" aria-label="Planning openen" onClick={()=>go('planning')}><Icon name="ArrowUpRight"/></button>}/><ScheduleList/><div className="ov-panel-divider"/><Heading title="Zojuist gebeurd"/><Activity limit={2}/></section></div><SourcesStrip/>
    </>}
  </motion.div>;
}

function scenarioDestination(id:string):{route:string;label:string}{
  const prefix=id.split('.')[0];
  if(id.startsWith('sport_')||['studio','sportlink','menu'].includes(prefix))return{route:'studio',label:'Open Studio'};
  const routes:Record<string,[string,string]>={experience:['overview','Open werkplek'],overview:['overview','Open overzicht'],content:['content','Open bibliotheek'],playlist:['playlists','Open playlists'],publish:['playlists','Open publicatieflow'],planning:['planning','Open planning'],screens:['screens','Open schermbeheer'],automation:['screens','Open bedrijfstijden'],composition:['screens','Open indelingen'],venues:['screens','Open locaties'],sources:['sources','Open bronnen'],products:['products','Open producten'],rss:['sources','Open RSS-bronnen'],led:['sources','Open LED-bron'],youtube:['sources','Open YouTube'],themes:['themes','Open thema’s'],sponsors:['sponsors','Open sponsors'],engage:['engage','Open Engage'],team:['team','Open team'],support:['support','Open support'],billing:['billing','Open abonnement'],platform:['platform','Open platform'],mobile:['mobile','Open mobiele ervaring'],marketing:['marketing','Open marketing'],player:['player','Open Player-demo']};
  const route=routes[prefix]??['overview','Open overzicht'];return{route:route[0],label:route[1]};
}
export function CoveragePage(){
  const{data,update,go,openPlayer,toast}=useApp();const[q,setQ]=useState(''),[area,setArea]=useState('all'),[status,setStatus]=useState('all');
  const rows=coverage as Scenario[];const checked=new Set<string>(data.coverageChecked??[]);const areas=useMemo(()=>[...new Set(rows.map(r=>r.area))],[]);
  const visible=rows.filter(r=>(area==='all'||r.area===area)&&(status==='all'||(status==='checked'?checked.has(r.id):!checked.has(r.id)))&&`${r.label} ${r.area} ${r.acceptance} ${r.id}`.toLowerCase().includes(q.toLowerCase()));
  const completeCount=rows.filter(r=>checked.has(r.id)).length;
  function toggle(id:string){update((d:Row)=>{const next=new Set<string>(d.coverageChecked??[]);next.has(id)?next.delete(id):next.add(id);d.coverageChecked=[...next]})}
  return <div className="ov-page ov-coverage"><header className="ov-page-header"><div><span className="ov-eyebrow">V1 / FUNCTIONELE RONDE</span><h1>Alle ruimte om te proberen.</h1><p>Handmatig te doorlopen scenario’s voor het definitieve Sync-prototype.</p></div><Badge>{rows.length} scenario’s</Badge></header><div className="ov-coverage-intro"><span className="ov-round-icon"><Icon name="ClipboardCheck" size={25}/></span><div><strong>Jouw checklist, geen automatisch testbewijs.</strong><p>Open een onderdeel, probeer de beschreven handeling en vink zelf af wat je hebt doorlopen. Alle externe diensten en apparaten zijn gesimuleerd; een vinkje bevestigt geen productie- of hardwarewerking.</p></div><div className="ov-coverage-progress"><strong>{completeCount}<span> / {rows.length}</span></strong><small>Door jou afgevinkt</small><div><i style={{width:`${completeCount/rows.length*100}%`}}/></div></div></div>
    <div className="ov-coverage-toolbar"><label className="ov-search"><Icon name="Search"/><input aria-label="Scenario’s doorzoeken" placeholder="Zoek op functie, scenario of onderdeel…" value={q} onChange={e=>setQ(e.target.value)}/></label><select aria-label="Onderdeel filteren" value={area} onChange={e=>setArea(e.target.value)}><option value="all">Alle onderdelen</option>{areas.map(a=><option key={a}>{a}</option>)}</select><select aria-label="Checkliststatus filteren" value={status} onChange={e=>setStatus(e.target.value)}><option value="all">Alle scenario’s</option><option value="unchecked">Nog door te lopen</option><option value="checked">Zelf afgevinkt</option></select></div>
    <div className="ov-coverage-summary"><span>{visible.length} scenario’s in beeld</span>{completeCount>0&&<button className="ov-text-link" onClick={()=>{update((d:Row)=>{d.coverageChecked=[]});toast('Je handmatige vinkjes zijn gewist. De demogegevens blijven staan.')}}><Icon name="RotateCcw" size={14}/> Checklist opnieuw beginnen</button>}</div>
    <div className="ov-coverage-list">{visible.map(r=>{const dest=scenarioDestination(r.id);return <article className={`ov-scenario ${checked.has(r.id)?'is-checked':''}`} key={r.id}><label className="ov-scenario-check"><input type="checkbox" checked={checked.has(r.id)} onChange={()=>toggle(r.id)} aria-label={`${r.label}: zelf doorlopen`}/><span><Icon name="Check" size={15}/></span></label><div className="ov-scenario-copy"><div><span className="ov-eyebrow">{r.area}</span>{checked.has(r.id)&&<small>Zelf afgevinkt</small>}</div><h2>{r.label}</h2><p>{r.acceptance}</p><code>{r.id}</code></div><Button small variant="secondary" icon="ArrowUpRight" onClick={()=>dest.route==='player'?openPlayer():go(dest.route)}>{dest.label}</Button></article>})}{!visible.length&&<EmptyState title="Geen scenario’s met deze filters" description="Probeer een andere zoekterm of toon alle onderdelen." action={<Button onClick={()=>{setQ('');setArea('all');setStatus('all')}}>Filters wissen</Button>}/>}</div>
  </div>;
}
