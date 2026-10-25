import {syncOnzeTrotsSourceScopeSchema,syncOnzeTrotsMatchdayContextSchema,syncSlidePresentationSchema,type PlayerDynamicTemplatePayload,type SyncOnzeTrotsPresentation,type SyncOnzeTrotsRich,type SyncSlideAsset} from '@veyocast/contracts';
import {type DynamicTemplateView} from './dynamic-template-view';
import {selectSyncOnzeTrotsVisitors} from './sync-onzetrots-motion';

type RecordValue=Record<string,unknown>;
const record=(value:unknown):RecordValue=>value&&typeof value==='object'&&!Array.isArray(value)?value as RecordValue:{};
const text=(value:unknown)=>typeof value==='string'?value:'';
const id=(value:unknown)=>typeof value==='string'&&value.trim()?value.trim():null;
const integer=(value:unknown,negative=false)=>typeof value==='number'&&Number.isSafeInteger(value)&&(negative||value>=0)?value:null;
const items=(value:unknown):RecordValue[]=>Array.isArray(value)?value.map(record):[];
type Fixture=NonNullable<SyncOnzeTrotsRich['fixtures']>[number];
export class SyncCanonicalIdentityError extends Error {}

/** Enrich the established canonical read model without converting display
 * strings back into domain facts or trusting a provider URL as an image. */
export function enrichSyncOnzeTrotsProjection(payload:PlayerDynamicTemplatePayload,presentation:SyncOnzeTrotsPresentation,view:DynamicTemplateView,now:Date,image:(url:string|null|undefined)=>SyncSlideAsset|undefined):SyncOnzeTrotsPresentation{
 const sport=record(payload.data.sport),scopeResult=syncOnzeTrotsSourceScopeSchema.safeParse(payload.data.syncScope),scope=scopeResult.success?scopeResult.data:null;
 const asset=(value:unknown):SyncSlideAsset|undefined=>{
  const key=id(value),entry=key?payload.assets?.[key]:undefined;
  return entry?.mimeType.startsWith('image/')?{kind:'tenant',mediaAssetId:key!,checksumSha256:entry.checksumSha256}:undefined;
 };
 const raw=items(sport.items),byId=new Map(raw.map(item=>[id(item.id),item]));
 if(raw.some(item=>!id(item.id))||byId.size!==raw.length)throw new SyncCanonicalIdentityError('Canonical source identities unavailable');
 const fixture=(item:RecordValue):Fixture=>{
  const key=id(item.id);if(!key)throw new SyncCanonicalIdentityError('Canonical fixture identity unavailable');
  const kickoff=text(item.kickoffAt),validKickoff=kickoff&&Number.isFinite(Date.parse(kickoff))&&/T.*(?:Z|[+-]\d\d:\d\d)$/.test(kickoff)?kickoff:null;
  const statuses:Record<string,Fixture['status']>={scheduled:'scheduled',live:'live',finished:'finished',cancelled:'cancelled',postponed:'postponed'};
  return {id:key,home:{name:text(item.homeTeam),teamId:id(item.homeTeamId),clubId:id(item.homeClubId),logo:asset(item.homeLogoMediaAssetId)},away:{name:text(item.awayTeam),teamId:id(item.awayTeamId),clubId:id(item.awayClubId),logo:asset(item.awayLogoMediaAssetId)},kickoffAt:validKickoff,status:statuses[text(item.status)]??'unknown',field:id(item.field),homeRoom:id(item.homeRoom),awayRoom:id(item.awayRoom),venue:text(item.venueName)||text(item.venue),homeScore:integer(item.homeScore),awayScore:integer(item.awayScore)};
 };
 const standing=(rows:RecordValue[],ownTeamId:string|null):NonNullable<SyncOnzeTrotsRich['standings']>=>({ownTeamId,rows:rows.map(item=>{
  const key=id(item.id);if(!key)throw new SyncCanonicalIdentityError('Canonical standing identity unavailable');
  const form=Array.isArray(item.form)?item.form:typeof item.form==='string'?item.form.split(/[\s,;|/-]+/u):[];
  const normalizedForm:Record<string,'W'|'GL'|'V'>={w:'W',win:'W',winst:'W',gewonnen:'W',g:'GL',gl:'GL',draw:'GL',gelijk:'GL',v:'V',l:'V',loss:'V',verlies:'V',verloren:'V'};
  return {id:key,teamId:id(item.teamId),clubId:id(item.clubId),teamName:text(item.teamName),logo:asset(item.logoMediaAssetId),position:integer(item.position),played:integer(item.played),won:integer(item.won),drawn:integer(item.drawn),lost:integer(item.lost),goalDifference:integer(item.goalDifference,true),points:integer(item.points,true),form:form.flatMap(result=>{const value=typeof result==='string'?normalizedForm[result.toLowerCase()]:undefined;return value?[value]:[];})};
 })});
 const rich:SyncOnzeTrotsRich={};
 if(scope)rich.teamSelection={ownClubId:scope.ownClubId,ownTeamIds:scope.ownTeamIds,primaryTeamId:scope.context?.teamId??null};
 const unique=new Set<string>(),add=<T extends {id:string}>(values:T[],item:T)=>{if(!unique.has(item.id)){unique.add(item.id);values.push(item);}};
 const fixtures=raw.filter(item=>id(item.homeTeam)||id(item.awayTeam)).map(fixture);
 if(['sport_program','sport_results','sport_next_match'].includes(payload.slideType))rich.fixtures=fixtures;
 if(['sport_standing','sport_period_standing'].includes(payload.slideType)){
  if(!scope)throw Error('Controlled standings scope unavailable');
  rich.standings=standing(raw,scope.context?.teamId??null);
  rich.standings.label=text(sport.competitionName)||presentation.topLabel;
 }
 if(payload.slideType==='sport_visitor_arrivals'){
  if(!scope?.ownClubId||!scope.ownTeamIds.length)throw Error('Controlled home selection unavailable');
  rich.fixtures=fixtures;rich.visitorsSelection={ownClubId:scope.ownClubId,ownTeamIds:scope.ownTeamIds,referenceAt:now.toISOString(),...(typeof record(sport.arrivalConfig).minutesBefore==='number'?{windowMinutes:record(sport.arrivalConfig).minutesBefore as number}:{})};
 }
 if(payload.slideType==='sport_match_of_the_day'){
  if(!scope?.context||!scope.ownTeamIds.includes(scope.context.teamId))throw new SyncCanonicalIdentityError('Matchday team/pool/season scope unavailable');
  const composite=record(sport.matchday),context=syncOnzeTrotsMatchdayContextSchema.parse(composite.context);
  const equal=(value:RecordValue)=>value.tenantId===scope.tenantId&&value.teamId===scope.context!.teamId&&value.competitionId===scope.context!.competitionId&&value.poolId===scope.context!.poolId&&value.seasonId===scope.context!.seasonId;
  if(!equal(context))throw new SyncCanonicalIdentityError('Mixed matchday scope');
  const parts=['results','standings','fixtures'].map(key=>{const part=record(composite[key]);if(!equal(record(part.context)))throw new SyncCanonicalIdentityError('Mixed matchday dataset scope');return part;});
  // Dataset labels alone do not authorize matches. Both roles always belong
  // to the exact selected provider team; the full pool standings stay intact.
  for(const part of [parts[0]!,parts[2]!])for(const item of items(part.items)){
   if(item.homeTeamId!==context.teamId&&item.awayTeamId!==context.teamId)throw new SyncCanonicalIdentityError('Matchday item does not belong to selected team');
  }
  const time=(item:Fixture)=>item.kickoffAt?Date.parse(item.kickoffAt):NaN;
  const identity=(a:Fixture,b:Fixture)=>a.id<b.id?-1:a.id>b.id?1:0;
  rich.matchday={context,
   results:items(parts[0]!.items).map(fixture).filter(item=>item.status==='finished'&&time(item)<=now.valueOf()&&item.homeScore!==null&&item.awayScore!==null).sort((a,b)=>time(b)-time(a)||identity(a,b)),
   standings:standing(items(parts[1]!.items),scope.context.teamId),
   fixtures:items(parts[2]!.items).map(fixture).filter(item=>item.status==='scheduled'&&time(item)>now.valueOf()).sort((a,b)=>time(a)-time(b)||identity(a,b))};
 }
 for(const page of view.pages){
  if(page.kind==='birthday'){for(const item of page.items){rich.birthdays??=[];add(rich.birthdays,{id:item.id,displayName:item.displayName,age:item.age,dateLabel:item.dateLabel,meta:item.meta});}}
  else if(page.kind==='news'){for(const item of [page.item,...page.secondaryItems])if(item){rich.news??=[];add(rich.news,{id:item.id,title:item.title,intro:item.intro,source:item.source,url:item.link||undefined,heroImage:image(item.heroUrl),...(view.providerLogoUrl?{providerLogo:image(view.providerLogoUrl)}:{})});}}
  else if(page.kind==='arrivals'||page.kind==='sport-list'||page.kind==='team'||page.kind==='sponsor'||page.kind==='trainings'||page.kind==='volunteers')for(const item of page.items){
   if(!('primary' in item))continue;
   if(payload.slideType==='sport_activities'){
    rich.activities??=[];add(rich.activities,{id:item.id,title:item.primary,body:item.secondary,dateLabel:item.date,timeLabel:item.time,location:item.venueName||item.venue||item.meta,image:image(item.photoUrl)});
   }else if(payload.slideType==='sport_sponsor'){
    rich.sponsors??=[];add(rich.sponsors,{id:item.id,name:item.primary,logo:image(item.logoUrl)});
   }else if(payload.slideType==='sport_cancellations'){
    const status=({cancelled:'Afgelast',postponed:'Uitgesteld',afgelast:'Afgelast',uitgesteld:'Uitgesteld'} as Record<string,string>)[item.status]??item.status;
    rich.infoRows??=[];add(rich.infoRows,{id:item.id,cells:[item.kickoffTime||item.time,[item.homeTeam||item.primary,item.awayTeam||item.secondary].filter(Boolean).join(' — '),status,item.venueName||item.venue,item.field],selected:false});
   }else if(['sport_dressing_rooms','sport_trainings','sport_officials','sport_volunteers','sport_referee_arrivals'].includes(payload.slideType)||presentation.family==='team-arrivals'){
    const rooms=['dressing-rooms','changing-rooms','team-arrivals'].includes(presentation.family),training=presentation.family==='training';
    rich.infoRows??=[];add(rich.infoRows,{id:item.id,cells:rooms?[item.kickoffTime||item.time,item.primary,item.field,item.homeMatch?'Thuis':'Uit',[item.homeRoom,item.awayRoom].filter(Boolean).join(' / ')]:training?[item.time,item.primary,item.field,item.secondary,item.meta]:[item.time,item.primary,item.secondary,item.meta,item.field],logo:image(item.logoUrl),selected:false});
   }
  }
 }
 // A team-info feature may carry one source-controlled photograph, never a
 // prototype photograph inserted as default tenant content.
 if(payload.slideType==='sport_team'){
  const first=raw[0];if(first)rich.featureImage=asset(first.photoMediaAssetId);
 }
 let empty=presentation.state==='empty';
 if(rich.standings)empty=!rich.standings.rows.length;
 else if(rich.matchday)empty=![...rich.matchday.results,...rich.matchday.standings.rows,...rich.matchday.fixtures].length;
 else if(rich.visitorsSelection&&['welcome','visitors'].includes(presentation.family))empty=!selectSyncOnzeTrotsVisitors(rich.fixtures??[],rich.visitorsSelection).length;
 else if(rich.birthdays)empty=!rich.birthdays.length;
 else if(rich.activities)empty=!rich.activities.length;
 else if(rich.news)empty=!rich.news.length;
 const output=syncSlidePresentationSchema.parse({...presentation,rich,state:empty?'empty':'ready'});
 if(output.rendererVersion==='sync-v1')throw Error('OnzeTrots output identity missing');
 return output;
}
