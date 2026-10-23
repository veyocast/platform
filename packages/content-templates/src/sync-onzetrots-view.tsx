import React,{type CSSProperties,type ReactNode} from 'react';
import QR from 'qrcode';
import {syncOnzeTrotsHeaderSubtitle,syncOnzeTrotsHeaderText,syncOnzeTrotsSystemAssets,type SyncOnzeTrotsPresentation,type SyncOnzeTrotsRich,type SyncSlideAsset} from '@veyocast/contracts';
import type {SyncSlideAssetResolver} from './sync-slide-static-view';
import {syncOnzeTrotsSixSlots,selectSyncOnzeTrotsVisitors} from './sync-onzetrots-motion';

type Props={slide:SyncOnzeTrotsPresentation;resolveAsset:SyncSlideAssetResolver;page:number};
type Fixture=NonNullable<SyncOnzeTrotsRich['fixtures']>[number];
const initial=(name:string)=>name.trim().split(/\s+/).slice(0,3).map(word=>word[0]).join('').toUpperCase();
const lines=(text:string)=>text.split('\n').map((line,index)=><React.Fragment key={index}>{index>0&&<br/>}{line}</React.Fragment>);
const date=(value:string|null,options:Intl.DateTimeFormatOptions)=>value&&Number.isFinite(Date.parse(value))?new Intl.DateTimeFormat('nl-NL',{timeZone:'Europe/Amsterdam',...options}).format(new Date(value)):'';
const phases={scheduled:'De aftrap',live:'Live',paused:'Gepauzeerd',halftime:'Rust',finished:'Eindstand',unknown:''};

function Icon({name='shirt'}:{name?:string}){
 const paths:Record<string,string>={shirt:'m7 3 5 3 5-3 5 5-4 4-2-2v11H8V10l-2 2-4-4z',flag:'M4 22V3m0 0c5-4 10 4 16 0v10c-6 4-11-4-16 0',heart:'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8',news:'M4 3h16v18H4zM8 7h8M8 11h8m-8 4h3m2 0h3m-8 3h8'};
 return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]??paths.shirt}/></svg>;
}
function Crest({name,asset,resolveAsset,className=''}:{name:string;asset?:SyncSlideAsset;resolveAsset:SyncSlideAssetResolver;className?:string}){
 const src=asset&&resolveAsset(asset);
 return src?<img className={`club-logo ${className}`} src={src} alt={`${name} logo`}/>:<span className={`club-initials ${className}`} aria-label={`${name}; clublogo niet beschikbaar`}>{initial(name)}</span>;
}
function ClubMark({slide,resolveAsset,outer=false}:{slide:SyncOnzeTrotsPresentation;resolveAsset:SyncSlideAssetResolver;outer?:boolean}){
 if(slide.rendererVersion==='sync-onzetrots-v9'&&!outer)return null;
 const src=slide.style.showLogo&&slide.club.logo&&resolveAsset(slide.club.logo);
 return src?<img className="container-club-logo" src={src} alt={`${slide.club.name} clublogo`}/>:null;
}
function Header({slide,resolveAsset,eyebrow,title}:{slide:SyncOnzeTrotsPresentation;resolveAsset:SyncSlideAssetResolver;eyebrow?:string;title:string}){
 if(slide.rendererVersion==='sync-onzetrots-v9'&&slide.family!=='matchday')return null;
 return <div className="panel-head"><div>{eyebrow&&<div className="eyebrow">{eyebrow}</div>}<h3>{lines(title)}</h3></div><ClubMark slide={slide} resolveAsset={resolveAsset}/></div>;
}
function InlineHeader({slide,resolveAsset,children}:{slide:SyncOnzeTrotsPresentation;resolveAsset:SyncSlideAssetResolver;children:ReactNode}){
 return <header className="container-inline-header">{children}<ClubMark slide={slide} resolveAsset={resolveAsset}/></header>;
}
function CornerHeader(props:Pick<Props,'slide'|'resolveAsset'>){if(props.slide.rendererVersion==='sync-onzetrots-v9')return null;return <header className="container-corner-header"><ClubMark {...props}/></header>;}
function Context({left,right}:{left:ReactNode;right?:ReactNode}){return <div className="panel-context"><strong>{left}</strong><span>{right}</span></div>;}
function Foot({left,right}:{left?:ReactNode;right?:ReactNode}){return <div className="panel-foot"><span>{left}</span><span>{right}</span></div>;}
function Empty({title='Er zijn nog geen gegevens beschikbaar.'}:{title?:string}){return <div className="ot-empty" role="status">{title}</div>;}

function Ranking({slide,resolveAsset,standing=slide.rich?.standings,dashboard=false}:{slide:SyncOnzeTrotsPresentation;resolveAsset:SyncSlideAssetResolver;standing?:SyncOnzeTrotsRich['standings'];dashboard?:boolean}){
 const rows=standing?.rows??slide.rows.map((row,index)=>({id:`manual-${index}`,teamId:null,clubId:null,teamName:row[1],position:row[0],played:row[2],won:null,drawn:null,lost:null,goalDifference:null,points:row[3],form:[],logo:undefined}));
 const isOwn=(row:(typeof rows)[number],index:number)=>standing?row.teamId!==null&&row.teamId===standing.ownTeamId:slide.ownRowIndexes.includes(index),hasOwn=rows.some(isOwn);
 return <section className={`panel rank-panel ${dashboard?'dashboard-rank':'stand-alone'}`}>
  <Header slide={slide} resolveAsset={resolveAsset} eyebrow={standing?.label??slide.topLabel} title={dashboard?'Dit is onze plek.':slide.title||'De ranglijst.'}/>
  <Context left={slide.family==='period-standings'?'De periodestand':'De ranglijst'} right={slide.subline||`De hele poule · ${slide.club.name} in beeld`}/>
  <div className="rank-head"><span>#</span><span>Team</span><span>G</span><span>W</span><span>GL</span><span>V</span><span>+/−</span><span>P</span><span>Vorm</span></div>
  <div className="rank-list" tabIndex={0} role="region" aria-label={hasOwn?'Volledige ranglijst; het eigen team blijft zichtbaar':'Volledige ranglijst; geen eigen rij beschikbaar'} data-ot-rank-list>
   {rows.length?rows.map((row,index)=>{
    const own=isOwn(row,index);
    return <div className={`rank-row${own?' own':''}`} key={row.id} data-position={row.position??''} data-team-id={row.teamId??undefined} data-own={own}>
     <span>{row.position??'–'}</span><span className="team"><Crest name={row.teamName} asset={row.logo} resolveAsset={resolveAsset}/><span>{row.teamName}</span></span>
     <span>{row.played??'–'}</span><span>{row.won??'–'}</span><span>{row.drawn??'–'}</span><span>{row.lost??'–'}</span>
     <span>{row.goalDifference===null?'–':row.goalDifference>=0?`+${row.goalDifference}`:row.goalDifference}</span><span className="points">{row.points??'–'}</span>
     <span className="form-badges" aria-label={row.form.map(result=>result==='W'?'Winst':result==='GL'?'Gelijk':'Verlies').join(', ')}>{row.form.map((result,index)=><i key={index} className={result==='V'?'loss':result==='GL'?'draw':''}>{result==='GL'?'G':result}</i>)}</span>
    </div>;
   }):<Empty title="De stand is nog niet beschikbaar."/>}
  </div>
  <Foot left={<><i className="form-dot"/>Winst &nbsp; <i className="form-dot draw"/>Gelijk &nbsp; <i className="form-dot loss"/>Verlies</>} right={<><span className="rank-status">{hasOwn?slide.footerRight||`${slide.club.name} blijft in beeld`:'Geen eigen rij beschikbaar'}</span> &nbsp; <span className="rank-progress"><i/></span></>}/>
 </section>;
}

function MatchCard({fixture,result,resolveAsset,own,primary=false,home=false,compact=false}:{fixture:Fixture;result:boolean;resolveAsset:SyncSlideAssetResolver;own:boolean;primary?:boolean;home?:boolean;compact?:boolean}){
 return <div className={`match-card${own?' ours':''}${!compact&&!home?' away-match':''}`}>
  <div className="match-meta"><span>{date(fixture.kickoffAt,{weekday:'short',day:'numeric',month:'short'}).toUpperCase()}</span><b>{primary?'ONS EERSTE':result?'AFGELOPEN':fixture.status==='cancelled'?'AFGELAST':fixture.status==='postponed'?'UITGESTELD':home?`THUIS${fixture.field?` · VELD ${fixture.field}`:''}`:'UITWEDSTRIJD'}</b></div>
  <div className="mini-match"><div>{[fixture.home,fixture.away].map((team,index)=><div className="team-line" key={index}><Crest name={team.name} asset={team.logo} resolveAsset={resolveAsset}/><span>{team.name}</span>{result&&<b>{(index===0?fixture.homeScore:fixture.awayScore)??'–'}</b>}</div>)}</div>{!result&&<div className="kickoff">{date(fixture.kickoffAt,{hour:'2-digit',minute:'2-digit'})}<small>AFTRAP</small></div>}</div>
 </div>;
}
function ManualMatchCard({row,result,resolveAsset}:{row:SyncOnzeTrotsPresentation['rows'][number];result:boolean;resolveAsset:SyncSlideAssetResolver}){
 return <div className="match-card"><div className="match-meta"><span/>{row[3]&&<b>{row[3]}</b>}</div><div className="mini-match"><div>{row.slice(0,2).map((name,index)=><div className="team-line" key={index}><Crest name={name} resolveAsset={resolveAsset}/><span>{name}</span></div>)}</div>{row[2]&&<div className="kickoff">{row[2]}<small>{result?'UITSLAG':'AFTRAP'}</small></div>}</div></div>;
}
function MatchPanel({slide,resolveAsset,page,fixtures=slide.rich?.fixtures??[],result=false,dashboard=false}:{slide:SyncOnzeTrotsPresentation;resolveAsset:SyncSlideAssetResolver;page:number;fixtures?:Fixture[];result?:boolean;dashboard?:boolean}){
 const capacity=slide.orientation==='portrait'?5:6,count=dashboard?Math.min(3,fixtures.length):capacity;
 const manual=slide.rich?.fixtures===undefined&&!dashboard,countItems=manual?slide.rows.length:fixtures.length;
 const pages=Math.max(1,Math.ceil(countItems/capacity)),selected=dashboard?fixtures.slice(0,3):fixtures.slice(page*capacity,(page+1)*capacity);
 return <section className={`panel ${dashboard?(result?'dashboard-results':'dashboard-fixtures'):'single-panel'}`}>
  <Header slide={slide} resolveAsset={resolveAsset} eyebrow={dashboard?(result?'VORIGE SPEELRONDE':'VOLGENDE SPEELRONDE'):slide.topLabel} title={dashboard?(result?'De uitslagen.':'Het programma.'):slide.title||(result?'De uitslagen.':'Het programma.')}/>
  <Context left={dashboard?(()=>{const label=date(selected[0]?.kickoffAt??null,{weekday:'long',day:'numeric',month:'long'});return label.charAt(0).toLocaleUpperCase('nl-NL')+label.slice(1);})():slide.subtitle} right={dashboard?(result?'Afgelopen':`${fixtures.length} wedstrijden`):<span className="page-indicator">{String(page+1).padStart(2,'0')} / {String(pages).padStart(2,'0')}</span>}/>
  {manual&&slide.rows.length>0?null:dashboard?<>{selected.length?selected.map(fixture=><MatchCard key={fixture.id} compact={dashboard} fixture={fixture} result={result} resolveAsset={resolveAsset} own={slide.rich?.teamSelection?.ownTeamIds.some(id=>id===fixture.home.teamId||id===fixture.away.teamId)??false} primary={Boolean(slide.rich?.teamSelection?.primaryTeamId&&[fixture.home.teamId,fixture.away.teamId].includes(slide.rich.teamSelection.primaryTeamId))} home={Boolean(slide.rich?.teamSelection?.ownClubId&&fixture.home.clubId===slide.rich.teamSelection.ownClubId&&fixture.home.teamId&&slide.rich.teamSelection.ownTeamIds.includes(fixture.home.teamId))}/>):<Empty/>}</>:<div className="matches-grid">{selected.length?selected.map(fixture=><MatchCard key={fixture.id} compact={dashboard} fixture={fixture} result={result} resolveAsset={resolveAsset} own={slide.rich?.teamSelection?.ownTeamIds.some(id=>id===fixture.home.teamId||id===fixture.away.teamId)??false} primary={Boolean(slide.rich?.teamSelection?.primaryTeamId&&[fixture.home.teamId,fixture.away.teamId].includes(slide.rich.teamSelection.primaryTeamId))} home={Boolean(slide.rich?.teamSelection?.ownClubId&&fixture.home.clubId===slide.rich.teamSelection.ownClubId&&fixture.home.teamId&&slide.rich.teamSelection.ownTeamIds.includes(fixture.home.teamId))}/>):<Empty title={result?'Er zijn nog geen uitslagen beschikbaar.':'Er zijn nog geen wedstrijden beschikbaar.'}/>}</div>}
  {manual&&slide.rows.length>0&&<div className="matches-grid">{slide.rows.slice(page*capacity,(page+1)*capacity).map((row,index)=><ManualMatchCard key={index} row={row} result={result} resolveAsset={resolveAsset}/>)}</div>}
  <Foot left={dashboard?(result?'De vorige ronde':'De volgende aftrap'):slide.body||slide.footer} right={dashboard?(result?'AFGELOPEN':date(selected[0]?.kickoffAt??null,{hour:'2-digit',minute:'2-digit'})):countItems?`${page*capacity+1}–${Math.min(page*capacity+(manual?capacity:count),countItems)} van ${countItems}`:undefined}/>
 </section>;
}

function Welcome({slide,resolveAsset}:Props){
 const selection=slide.rich?.visitorsSelection,matches=selection?selectSyncOnzeTrotsVisitors(slide.rich?.fixtures??[],selection):[];
 if(!matches.length)return <section className="panel welcome-empty"><CornerHeader slide={slide} resolveAsset={resolveAsset}/><span className="brand-brush" role="img" aria-label="OnzeTrots"/><h3>Even geen aankomende thuiswedstrijden.</h3><p>De eerstvolgende eigen thuiswedstrijden verschijnen hier zodra ze bekend zijn.</p></section>;
 return <div className="welcome-grid visitor-layout" data-match-count={matches.length}>{matches.map(fixture=>{
  const away=fixture.away.logo&&resolveAsset(fixture.away.logo);
  const identity=<div className="visitor-spotlight"><div className="visitor-crest"><Crest name={fixture.away.name} asset={fixture.away.logo} resolveAsset={resolveAsset}/></div><div className="visitor-copy"><span>Van harte welkom!</span><h3>{fixture.away.name}</h3></div></div>;
  return <article className="panel welcome-card" key={fixture.id} data-match-id={fixture.id} data-home-team={fixture.home.teamId??undefined} data-kickoff={fixture.kickoffAt??undefined}>
   {away&&<img className="visitor-watermark" src={away} alt=""/>}
   <div className="welcome-card-top"><div><span className="welcome-date">{date(fixture.kickoffAt,{weekday:'long',day:'numeric',month:'long'})} · THUIS</span><span className="welcome-host">TE GAST{fixture.venue?` OP ${fixture.venue.toUpperCase()}`:''}</span></div><strong>{date(fixture.kickoffAt,{hour:'2-digit',minute:'2-digit'})}<small>AFTRAP</small></strong><ClubMark slide={slide} resolveAsset={resolveAsset}/></div>
   {slide.rendererVersion==='sync-onzetrots-v9'?<div className="visitor-stage">{identity}</div>:identity}
   <div className="fixture-caption"><span>DE WEDSTRIJD</span><strong>{fixture.home.name} <i>—</i> {fixture.away.name}</strong></div>
   <div className="welcome-logistics"><span><Icon name="flag"/> Veld <b>{fixture.field??'–'}</b></span><span><Icon/> Thuis <b>{fixture.homeRoom??'–'}</b></span><span><Icon/> Bezoekers <b>{fixture.awayRoom??'–'}</b></span></div>
  </article>;
 })}</div>;
}

export function birthdayDisplayName(displayName:string):string{
 const parts=displayName.trim().split(/\s+/);
 if(parts.length<2)return parts[0]??'';
 return `${parts[0]} ${parts[parts.length-1]!.replace(/\.$/,'').slice(0,1).toLocaleUpperCase('nl-NL')}.`;
}

function SixGrid({slide,resolveAsset,page}:Props){
 // Legacy manual labels remain authored text and an unknown age stays
 // unknown. The card editor and connected sources supply typed rich facts.
 const birthday=slide.family==='birthdays',items=birthday?slide.rich?.birthdays??slide.rows.map((row,index)=>({id:`manual-${index}`,displayName:row[2],age:null,dateLabel:[row[0],row[1]].filter(Boolean).join(' '),meta:row[3]})):slide.rich?.activities??slide.rows.map((row,index)=>({id:`manual-${index}`,title:row[2],body:row[3],dateLabel:row[1],timeLabel:row[0],location:'',image:undefined}));
 return <div className={`${birthday?'birthday-grid':'event-grid'} fixed-six-grid`} data-grid-kind={slide.family} data-slot-count="6" data-filled-count={Math.min(6,Math.max(0,items.length-page*6))}>
  {syncOnzeTrotsSixSlots<(typeof items)[number]>(items,page).map((item,index)=>{
   if(!item)return <div className="empty-grid-slot" aria-hidden="true" data-empty-slot={index+1} key={`empty-${index}`}/>;
   if('displayName' in item)return <article className="panel birthday-card" key={item.id}><header className="birthday-card-header"><span>{item.dateLabel}</span><ClubMark slide={slide} resolveAsset={resolveAsset}/></header>{slide.rendererVersion==='sync-onzetrots-v9'&&<h3 className="birthday-name">Gefeliciteerd, {birthdayDisplayName(item.displayName)}!</h3>}<div className="birthday-age-block"><b className="birthday-age">{item.age??'–'}</b>{item.age!==null&&<span>JAAR</span>}</div>{slide.rendererVersion!=='sync-onzetrots-v9'&&<h3 className="birthday-name">Gefeliciteerd, {item.displayName}!</h3>}<p>{item.meta}</p></article>;
   const photoAsset=item.image??slide.rich?.featureImage,photo=photoAsset&&resolveAsset(photoAsset);
   return <article className="panel event-card" key={item.id}>{photo&&<img className="event-photo" src={photo} alt=""/>}<div className="event-copy"><InlineHeader slide={slide} resolveAsset={resolveAsset}><span className="event-date">{item.dateLabel} · {slide.family==='agenda'?'CLUBAGENDA':'CLUBACTIVITEIT'}</span></InlineHeader><h3>{item.title}</h3><p>{item.body}</p><small>{[item.timeLabel,item.location].filter(Boolean).join(' · ')}</small></div></article>;
  })}
 </div>;
}

function QRCode({url}:{url:string}){
 const{modules}=QR.create(url,{errorCorrectionLevel:'M'}),quiet=4,dimension=modules.size+2*quiet;let path='';
 for(let y=0;y<modules.size;y++)for(let x=0;x<modules.size;x++)if(modules.get(y,x))path+=`M${x+quiet},${y+quiet}h1v1h-1z`;
 return <svg className="ot-qr" viewBox={`0 0 ${dimension} ${dimension}`} role="img" aria-label="QR-code voor de getoonde link" shapeRendering="crispEdges"><rect width={dimension} height={dimension} fill="white"/><path d={path} fill="black"/></svg>;
}
function Feature({slide,resolveAsset,page}:Props){
 const richArticle=slide.rich?.news?.[page],article=richArticle??slide.news[page],asset=richArticle?.heroImage??slide.rich?.featureImage;
 const src=asset&&resolveAsset(asset);
 const cta=<><Icon name={slide.family==='team-info'?'shirt':'news'}/>{slide.category||'Lees verder'}</>;
 const teamFacts=slide.family==='team-info'?slide.rows.slice(page*slide.rowsPerPage,(page+1)*slide.rowsPerPage):[];
 return <div className="feature-grid"><div className="photo-panel">{src&&<img className="feature-photo" src={src} alt={slide.imageCaption||''}/>}<div className="photo-caption"><small>{slide.club.name.toUpperCase()}{slide.club.tagline?` · ${slide.club.tagline}`:''}</small><h3>{lines(slide.imageCaption)}</h3></div></div><article className="panel feature-copy"><InlineHeader slide={slide} resolveAsset={resolveAsset}><span className="eyebrow">{article?.source??slide.topLabel}</span></InlineHeader><h3>{lines(article?.title||slide.headline||slide.title)}</h3><p>{article?.intro??slide.body}</p>{teamFacts.length>0&&<div className="news-label">{teamFacts.map((row,index)=><span key={index}>{row.filter(Boolean).join(' · ')}</span>)}</div>}{slide.family==='team-info'&&slide.subline&&<div className="news-label">{slide.subline.split('\n').map((label,index)=><span key={index}>{label}</span>)}</div>}{(article?.url||slide.category)&&(article?.url?<><a className="blue-cta" href={article.url}>{cta}</a><QRCode url={article.url}/></>:<div className="blue-cta">{cta}</div>)}{['rss','club-story'].includes(slide.family)&&<div className="article-number">{page+1} / {Math.max(1,slide.rich?.news?.length??slide.news.length)}{slide.footerRight?` \u00a0 · \u00a0 ${slide.footerRight}`:''}</div>}</article></div>;
}

function MatchHero({slide,resolveAsset}:Props){
 const score=slide.family==='scoreboard',phase=slide.rich?.phase??'unknown',fixture=slide.rich?.fixtures?.[0];
 const moment=phase==='halftime'?'RUST':phase==='finished'?'EINDSTAND':phase==='paused'?'GEPAUZEERD':phase==='live'?['LIVE',slide.match?.clock].filter(Boolean).join(' · '):slide.match?.clock||(phase==='scheduled'?'DE AFTRAP':'');
 const watermark=slide.club.logo&&resolveAsset(slide.club.logo);
 return <section className={`panel match-hero${score?' score-display':''}`}>
  <div className="panel-context"><strong>{slide.subtitle||phases[phase]}</strong><span>{score?'WEDSTRIJDMOMENT':slide.topLabel}</span><ClubMark slide={slide} resolveAsset={resolveAsset}/></div>
  {watermark&&<img className="watermark" src={watermark} alt=""/>}
  <div className="huge-teams"><div className="huge-team"><Crest name={slide.home?.name??''} asset={slide.home?.logo} resolveAsset={resolveAsset}/><h3>{slide.home?.name}</h3><span>{slide.home?.team}</span></div>
   <div className="match-middle">{score?<>{moment&&<span className="match-clock" data-ot-clock>{moment}</span>}<strong className="score-number" data-ot-score>{slide.match?.homeScore||'–'} − {slide.match?.awayScore||'–'}</strong></>:<><strong>VS</strong><span>DE AFTRAP</span></>}</div>
   <div className="huge-team"><Crest name={slide.away?.name??''} asset={slide.away?.logo} resolveAsset={resolveAsset}/><h3>{slide.away?.name}</h3><span>{slide.away?.team}</span></div>
  </div><div className="match-bottom"><b>{score?slide.headline:slide.match?.time}</b><span>{slide.body||[fixture?.venue,fixture?.field?`Veld ${fixture.field}`:''].filter(Boolean).join(' · ')}</span><span>{slide.match?.date||date(fixture?.kickoffAt??null,{weekday:'long',day:'numeric',month:'long'})}</span></div>
 </section>;
}
function Goal({slide,resolveAsset}:Props){
 return <div className="goal-scene"><CornerHeader slide={slide} resolveAsset={resolveAsset}/>{Array.from({length:26},(_,index)=><i key={index} className="confetti" style={{'--left':`${index*3.9}%`,'--delay':`${-index*.23}s`,'--rot':`${index*17}deg`,...(index%2?{background:'#8ebaff'}:{})} as CSSProperties}/>)}<div className="goal-word">{slide.headline||'GOOOAL!'}</div><p>{slide.body}</p><strong className="goal-score">{slide.home?.name} &nbsp; {slide.match?.homeScore||'–'} − {slide.match?.awayScore||'–'} &nbsp; {slide.away?.name}</strong></div>;
}
function InfoTable({slide,resolveAsset,page}:Props){
 const family=slide.family,rooms=['dressing-rooms','changing-rooms','team-arrivals'].includes(family),training=family==='training',cancellation=family==='cancellations';
 const rows=slide.rich?.infoRows??slide.rows.map((row,index)=>({id:`manual-${index}`,cells:(rooms?[row[2],`${row[0]} — ${row[1]}`,'','',row[3]]:training?[row[0],row[2],'',row[3],row[1]]:[row[2],row[0],row[1],row[3],'']) as [string,string,string,string,string],selected:slide.ownRowIndexes.includes(index),logo:undefined}));
 const labels=rooms?[family==='team-arrivals'?'Aankomst':'Aftrap','Team / wedstrijd','Veld',family==='team-arrivals'?'Ontvangst':'Thuis / uit','Kamer']:training?['Vanaf','Team','Veld','Trainer','Tot']:cancellation?['Aftrap','Wedstrijd','Status','Locatie','Veld']:['Tijd','Naam','Rol',family==='volunteers'?'Tot':'Wedstrijd',family==='volunteers'?'Plek':'Veld'];
 const count=slide.rowsPerPage,selected=rows.slice(page*count,(page+1)*count);
 return <section className={`panel ${cancellation?'notice-panel':rooms||training?'single-panel':'single-panel people-table'}`}><Header slide={slide} resolveAsset={resolveAsset} eyebrow={slide.topLabel} title={slide.title}/>{cancellation&&slide.body?<div className="notice-banner">{slide.body}</div>:<Context left={slide.subtitle} right={slide.subline}/>}
  <div className="room-table"><div className="info-table-row table-labels">{labels.map(label=><span key={label}>{label}</span>)}</div>{selected.length?selected.map(row=><div className={`info-table-row${row.selected?' ours':''}`} key={row.id}>{row.cells.map((cell,index)=>index===1?<span className="team" key={index}>{row.logo?<Crest name={cell} asset={row.logo} resolveAsset={resolveAsset}/>:!rooms&&!training&&!cancellation?<Icon name={family==='volunteers'?'heart':'flag'}/>:null}<span>{cell}</span></span>:index===0||rooms&&index===2||index===4&&!training&&!cancellation||training&&(index===2||index===4)?<b className={index===4&&!training||training&&index===2?'room-number':undefined} key={index}>{cell}</b>:cancellation&&index===2?<b style={{color:'#bd3f58'}} key={index}>{cell}</b>:<span key={index}>{cell}</span>)}</div>):<Empty/>}</div><Foot left={slide.category||slide.footer} right={slide.footerRight}/>
 </section>;
}
function Lineup({slide,resolveAsset}:Props){
 return <div className="lineup-layout"><div className="pitch">{slide.lineup.map((row,index)=><div className="pitch-line" key={index}>{row.map(number=><div className="player-token" key={number}><span className="player-shirt">{number}</span><small>{slide.rich?.lineupPlayers?.find(player=>player.number===number)?.name}</small></div>)}</div>)}</div><section className="panel"><Header slide={slide} resolveAsset={resolveAsset} eyebrow={slide.topLabel} title={slide.title}/><div className="squad-list"><h3>{slide.headline}</h3>{slide.rows.map((row,index)=><div key={index}><span>{row[0]}</span><b>{row[1]}</b></div>)}<small>{slide.body}</small></div></section></div>;
}
function Menu({slide,resolveAsset,page}:Props){
 const visibleRows=slide.rows.slice(page*10,(page+1)*10),categories=[...new Set(visibleRows.map(row=>row[3]))];
 const columns=categories.length===2?categories.map(category=>({title:category,rows:visibleRows.filter(row=>row[3]===category)})):[{title:slide.category,rows:visibleRows.slice(0,Math.ceil(visibleRows.length/2))},{title:slide.subline,rows:visibleRows.slice(Math.ceil(visibleRows.length/2))}];
 return <div className="menu-layout"><section className="panel"><Header slide={slide} resolveAsset={resolveAsset} eyebrow={slide.topLabel} title={slide.title}/><div className="menu-columns">{columns.map((column,index)=><div className="menu-category" key={index}><h3>{column.title}</h3>{column.rows.map((row,index)=><div className="price-row" key={index}><span>{row[0]}<small>{row[2]}</small></span><b>{row[1]}</b></div>)}</div>)}</div><Foot left={slide.subtitle||slide.footer} right={slide.footerRight}/></section><section className="panel menu-feature"><CornerHeader slide={slide} resolveAsset={resolveAsset}/>{slide.special&&<div className="round-promo"><small>{slide.special.label}</small><b>{new Intl.NumberFormat('nl-NL',{style:'currency',currency:'EUR'}).format(slide.special.priceCents/100)}</b></div>}<h3>{lines(slide.special?.title??slide.headline)}</h3><p>{lines(slide.body)}</p></section></div>;
}
function Sponsors({slide,resolveAsset,page}:Props){
 const sponsors=(slide.rich?.sponsors??slide.rows.map((row,index)=>({id:`manual-${index}`,name:row[0],logo:undefined}))).slice(page*6,(page+1)*6);
 return <section className="panel single-panel"><Header slide={slide} resolveAsset={resolveAsset} eyebrow={slide.topLabel} title={slide.title}/><div className="sponsor-grid">{sponsors.map(sponsor=><div className="sponsor-cell" key={sponsor.id}><>{sponsor.logo&&resolveAsset(sponsor.logo)?<img src={resolveAsset(sponsor.logo)} alt={sponsor.name}/>:<span className="club-initials" aria-label={sponsor.name}>{initial(sponsor.name)}</span>}</><small>PARTNER VAN {slide.club.name.toUpperCase()}</small></div>)}</div><div className="sponsor-thanks">{slide.body}</div></section>;
}
function Engage({slide,resolveAsset,page}:Props){
 const poll=slide.poll,options=poll?.options??[],count=poll&&'optionsPerPage' in poll?poll.optionsPerPage:options.length;
 const visible=Boolean(poll&&(poll.visibility==='live'&&['live','closed','archived'].includes(poll.status)||poll.visibility==='after_close'&&['closed','archived'].includes(poll.status)));
 const total=options.reduce((sum,option)=>sum+option.votes,0);
 const longQuestion=(poll?.title??slide.title).length>80,longOptions=options.some(option=>option.label.length>80);
 return <div className={`engage-layout${longQuestion?' has-long-poll-question':''}${longOptions?' has-long-poll-options':''}`}><section className="panel poll-panel"><InlineHeader slide={slide} resolveAsset={resolveAsset}><span className="news-label">{slide.topLabel}</span></InlineHeader><h3>{poll?.title??slide.title}</h3>{options.slice(page*count,(page+1)*count).map(option=>{const percent=visible&&total?Math.round(option.votes*100/total):0;return <div className="poll-option" key={option.id} style={{'--percent':`${percent}%`} as CSSProperties}><span>{option.label}</span>{visible&&<b>{percent}%</b>}</div>;})}<p>{visible?slide.body:'De resultaten zijn nog niet openbaar.'}</p></section><aside className="panel engage-aside"><CornerHeader slide={slide} resolveAsset={resolveAsset}/><h3>{lines(slide.headline)}</h3><p>{lines(slide.subtitle)}</p>{poll?.publicUrl&&<div className="engage-qr"><QRCode url={poll.publicUrl}/><small>{poll.publicUrl}</small></div>}</aside></div>;
}
function Video({slide,resolveAsset}:Props){
 const src=slide.rich?.featureImage&&resolveAsset(slide.rich.featureImage);
 return <div className="video-layout"><CornerHeader slide={slide} resolveAsset={resolveAsset}/>{src&&<img src={src} alt=""/>}<div className="video-overlay"><span className="video-play" aria-hidden="true">▶</span><h3>{slide.headline||slide.title}</h3><p>{slide.body}</p>{slide.youtubeUrl&&<a href={slide.youtubeUrl} target="_blank" rel="noopener noreferrer">{slide.category||'Bekijk de video ↗'}</a>}{slide.subline&&<p className="news-label" style={{justifyContent:'center'}}>{slide.subline}</p>}</div></div>;
}
function Free({slide,resolveAsset}:Props){return <section className="panel free-scene"><CornerHeader slide={slide} resolveAsset={resolveAsset}/><h3>{lines(slide.headline||slide.title)}</h3><p>{slide.body}</p><small>{slide.subtitle}</small></section>;}

function Content(props:Props){
 const{slide,resolveAsset}=props;
 if(slide.state==='empty'&&['scoreboard','goal','next-match'].includes(slide.family))return <section className="panel single-panel"><Header slide={slide} resolveAsset={resolveAsset} eyebrow={slide.topLabel} title={slide.title}/><Empty title="De wedstrijdgegevens zijn nog niet beschikbaar. Zodra de bron is bijgewerkt, verschijnt het actuele wedstrijdmoment."/></section>;
 if(slide.family==='matchday'){
  const data=slide.rich?.matchday;
  return <><MatchPanel {...props} fixtures={data?.results??[]} result dashboard/><Ranking slide={slide} resolveAsset={resolveAsset} standing={data?.standings??{ownTeamId:null,rows:[]}} dashboard/><MatchPanel {...props} fixtures={data?.fixtures??[]} dashboard/></>;
 }
 if(['standings','period-standings'].includes(slide.family))return <Ranking {...props}/>;
 if(['fixtures','club-program','team-program','pool-program','results','club-results','team-results','pool-results'].includes(slide.family))return <MatchPanel {...props} result={['results','club-results','team-results','pool-results'].includes(slide.family)}/>;
 if(['welcome','visitors'].includes(slide.family))return <Welcome {...props}/>;
 if(['birthdays','activities','agenda'].includes(slide.family))return <SixGrid {...props}/>;
 if(['team-info','rss','club-story'].includes(slide.family))return <Feature {...props}/>;
 if(['next-match','scoreboard'].includes(slide.family))return <MatchHero {...props}/>;
 if(slide.family==='goal')return <Goal {...props}/>;
 if(slide.family==='lineup')return <Lineup {...props}/>;
 if(slide.family==='menu')return <Menu {...props}/>;
 if(slide.family==='sponsors')return <Sponsors {...props}/>;
 if(slide.family==='engage')return <Engage {...props}/>;
 if(slide.family==='youtube')return <Video {...props}/>;
 if(slide.family==='free')return <Free {...props}/>;
 return <InfoTable {...props}/>;
}

/** Real HTML containers inside one logical canvas. SVG only provides uniform
 * coordinate scaling; all data, text, images and scrolling remain native DOM. */
export function SyncOnzeTrotsView({slide,resolveAsset,page}:Props){
 const portrait=slide.orientation==='portrait',width=portrait?900:1600,height=portrait?1600:900,v9=slide.rendererVersion==='sync-onzetrots-v9';
 const background=slide.style.backgroundAsset&&resolveAsset(slide.style.backgroundAsset);
 const defaultPath=`/onzetrots-approved-v1/assets/clubmuur-brush-v25/houtrust-${portrait?'portrait-941':'wide-1672'}.webp`;
 const defaultAsset=syncOnzeTrotsSystemAssets.find(asset=>asset.path===defaultPath);
 const defaultBackground=defaultAsset?resolveAsset({kind:'system',path:defaultAsset.path,checksumSha256:defaultAsset.sha256}):undefined;
 return <div className="vc-slide-preview ot-approved-frame" style={{width:'100%',height:'100%',overflow:'hidden'}}>
  <svg className="ot-approved-canvas" viewBox={`0 0 ${width} ${height}`} style={{display:'block',width:'100%',height:'100%'}}>
   <foreignObject width={width} height={height}>
    <div className={`screen${portrait?' portrait':''} ot-controlled`} data-theme={slide.visual.mode} data-ot-welcome-scale={v9?slide.authoring.welcomeScalePercent:undefined} style={{'--welcome-scale':v9?slide.authoring.welcomeScalePercent/100:undefined,'--ot-background-position':slide.style.backgroundPosition,'--bg':`url(${JSON.stringify(background??defaultBackground)})`,'--panel':slide.visual.mode==='light'?`rgba(255,255,255,${slide.visual.panelOpacity/100})`:`rgba(12,31,58,${slide.visual.panelOpacity/100})`,fontFamily:'OTManrope, Arial, sans-serif',lineHeight:'normal',letterSpacing:'normal',wordSpacing:'normal',fontStyle:'normal',fontVariant:'normal',textAlign:'left',textTransform:'none'} as CSSProperties}>
     <div className={`slide-layout ${v9?'with-slide-header':'no-outer-heading'}`}>{v9&&<header className="panel slide-header-container"><div className="slide-header-copy"><p className="slide-subtitle" data-ot-header-subtitle hidden={!syncOnzeTrotsHeaderSubtitle(slide)}>{syncOnzeTrotsHeaderSubtitle(slide)}</p><h2 data-ot-header-text hidden={!syncOnzeTrotsHeaderText(slide)}>{syncOnzeTrotsHeaderText(slide)}</h2></div><ClubMark slide={slide} resolveAsset={resolveAsset} outer/></header>}<div className="slide-content"><Content slide={slide} resolveAsset={resolveAsset} page={page}/></div>{slide.style.showFooter&&<footer className="slide-footer"><span className="source">{slide.footer}</span><span className="signature"><span className="brand-brush" role="img" aria-label="OnzeTrots"/><small>ONZE CLUB. ONZE TROTS.</small></span></footer>}</div>
    </div>
   </foreignObject>
  </svg>
 </div>;
}
