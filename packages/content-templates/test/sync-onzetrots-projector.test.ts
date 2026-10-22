import {describe,it,expect} from 'vitest';
import {syncSlidePresentationSchema,syncSlidePageCount,type SyncContentFamily,type PlayerDynamicTemplatePayload} from '@veyocast/contracts';
import {projectSyncDynamicSnapshot} from '../src/sync-dynamic-projector';
import {selectSyncOnzeTrotsVisitors} from '../src/sync-onzetrots-motion';
const now=new Date('2026-10-22T12:00:00Z');
const scope={schemaVersion:1,tenantId:'10000000-0000-4000-8000-000000000285',sourceId:'20000000-0000-4000-8000-000000000285',sourceConnectionId:'30000000-0000-4000-8000-000000000285',ownClubId:'club-a',ownTeamIds:['team-a'],context:{teamId:'team-a',competitionId:'competition-a',poolId:'pool-a',seasonId:'2026'}};
const seed=(family:SyncContentFamily)=>syncSlidePresentationSchema.parse({schemaVersion:1,rendererVersion:'sync-onzetrots-v1',sourceRevision:'ae83f2b4312408eacae9f29177d3c743e104185b',family,orientation:'landscape',theme:'onzetrots-tv',name:'Eigen testontwerp',title:'Eigen titel',club:{name:'Eigen club'},style:{motion:'rustig'},visual:{schemaVersion:1,mode:'dark'}});
const payload=(slideType:PlayerDynamicTemplatePayload['slideType'],sport:Record<string,unknown>):PlayerDynamicTemplatePayload=>({schemaVersion:1,slideType,orientation:'landscape',snapshotId:'40000000-0000-4000-8000-000000000285',snapshotHash:'a'.repeat(64),templateVersionId:'50000000-0000-4000-8000-000000000285',templateSlug:'controlled-onzetrots-test',data:{type:slideType,sport,syncScope:scope,brand:{clubName:'Eigen club'}}});
const fixture=(index:number)=>({id:`match-${index}`,primary:'Eigen wedstrijd',homeTeam:'Eigen team',awayTeam:`Gast ${index}`,homeTeamId:'team-a',homeClubId:'club-a',awayTeamId:`guest-${index}`,awayClubId:'club-b',kickoffAt:`2026-10-${23+index}T12:30:00Z`,status:'scheduled',homeScore:null,awayScore:null,field:'1',homeRoom:'2',awayRoom:'3'});
const row=(index:number)=>({id:`row-${index}`,teamId:`team-${index}`,clubId:null,teamName:`Team ${index}`,position:index+1,played:null,won:null,drawn:null,lost:null,points:index===0?-1:null,goalDifference:-5,form:['W','GL','V']});
function project(input:PlayerDynamicTemplatePayload,family:SyncContentFamily){const result=projectSyncDynamicSnapshot(input,seed(family),now);expect(result.ok,JSON.stringify(result)).toBe(true);if(!result.ok||result.presentation.rendererVersion!=='sync-onzetrots-v1')throw Error('Projection unavailable');return result.presentation;}
describe('approved OnzeTrots canonical facts in the active projector',()=>{
 it('keeps cancelled fixture time, full match, observed status, venue and field in their real information columns',()=>{
  const slide=project(payload('sport_cancellations',{items:[{...fixture(0),status:'cancelled',kickoffTime:'14:30',venueName:'Eigen sportpark',field:'4'}]}),'cancellations');
  expect(slide.rich?.infoRows).toHaveLength(1);
  expect(slide.rich?.infoRows?.[0]?.cells).toEqual(['14:30','Eigen team — Gast 0','Afgelast','Eigen sportpark','4']);
 });
 it.each([['pre_match','scheduled'],['live','live'],['paused','paused'],['half_time','halftime'],['finished','finished']] as const)('retains the observed %s phase and the authorized showClock choice', (status,phase)=>{
  for(const showClock of [true,false]){
   const input=payload('ledscores_live_match',{});
   input.data.liveMatch={configuration:{showClock},state:{schemaVersion:1,status,home:{name:'Eigen team',score:0},away:{name:'Gast',score:1},sourceUpdatedAt:now.toISOString(),staleAfter:'2026-10-22T12:00:20Z',clock:{anchorAt:now.toISOString(),anchorSeconds:4020,running:status==='live',direction:'up'}}};
   const result=projectSyncDynamicSnapshot(input,seed('scoreboard'),new Date('2026-10-22T12:00:06Z'));
   expect(result.ok).toBe(true);if(!result.ok||result.presentation.rendererVersion!=='sync-onzetrots-v1')throw Error('Missing observed score');
   expect(result.presentation.rich?.phase).toBe(phase);
   expect(result.presentation.match?.homeScore).toBe('0');
   expect(result.presentation.match?.clock).toBe(showClock?(status==='live'?'67:06':'67:00'):'');
  }
 });
 it('preserves every row, nullable statistics, negative points and exact controlled own identity',()=>{
  const records=Array.from({length:17},(_,i)=>row(i));records[16]!.teamId='team-a';
  const input=payload('sport_standing',{items:records}),before=JSON.stringify(input),slide=project(input,'standings');
  expect(slide.rich?.standings?.rows).toHaveLength(17);expect(slide.rich?.standings?.ownTeamId).toBe('team-a');
  expect(slide.rich?.standings?.rows[0]).toMatchObject({played:null,won:null,drawn:null,lost:null,points:-1,goalDifference:-5,form:['W','GL','V']});
  expect(syncSlidePageCount(slide)).toBe(1);expect(JSON.stringify(input)).toBe(before);
 });
 it('supports new linked welcome only through this version and checks both home IDs before limiting',()=>{
  const records=[{...fixture(0),id:'foreign-home',homeClubId:'club-b'},{...fixture(0),id:'unknown-home',homeTeamId:'unknown'},{...fixture(0),id:'cancelled',status:'cancelled'},...Array.from({length:5},(_,i)=>fixture(4-i))];
  const input=payload('sport_visitor_arrivals',{items:records}),slide=project(input,'welcome');
  expect(selectSyncOnzeTrotsVisitors(slide.rich!.fixtures!,slide.rich!.visitorsSelection!).map(match=>match.id)).toEqual(['match-0','match-1','match-2','match-3']);
  expect(slide.rich!.fixtures![0]!.away.logo).toBeUndefined();
  const sample=seed('welcome');if(sample.rendererVersion!=='sync-onzetrots-v1')throw Error('Invalid test seed');
  const {visual:discard,...legacy}=sample;void discard;
  const wire=syncSlidePresentationSchema.parse({...legacy,rendererVersion:'sync-v1',sourceRevision:'8b1fdf1f8637dda23d48ecdaf08e0e5978e2707a'});
  expect(projectSyncDynamicSnapshot(input,wire,now)).toEqual({ok:false,code:'SYNC_FAMILY_SCOPE_MISMATCH'});
 });
 it('combines three complete datasets only within one tenant/team/competition/pool/season context',()=>{
  const context={tenantId:scope.tenantId,...scope.context},part=(items:unknown[])=>({context,items}),composite={context:{...context,revisions:['results','standings','fixtures'].map(dataset=>({dataset,revision:2}))},results:part([{...fixture(0),status:'finished',homeScore:1,awayScore:0}]),standings:part([row(0),{...row(1),teamId:'team-a'}]),fixtures:part([fixture(1)])};
  const input=payload('sport_match_of_the_day',{items:[],matchday:composite}),slide=project(input,'matchday');
  expect(slide.rich?.matchday?.results[0]?.homeScore).toBe(1);expect(slide.rich?.matchday?.standings.rows).toHaveLength(2);expect(slide.rich?.matchday?.fixtures[0]?.id).toBe('match-1');
  for(const [key,value]of Object.entries({tenantId:'10000000-0000-4000-8000-000000000286',teamId:'other-team',competitionId:'other-competition',poolId:'other-pool',seasonId:'2025'})){
   const changed=structuredClone(input),matchday=(changed.data.sport as {matchday:typeof composite}).matchday;Object.assign(matchday.fixtures.context,{[key]:value});
   expect(projectSyncDynamicSnapshot(changed,seed('matchday'),now).ok,key).toBe(false);
  }
 });
 it('retains thirteen authorized birthdays and seven activities over six fixed places per page',()=>{
  const birthdays=project(payload('sport_birthdays',{fetchedAt:now.toISOString(),birthdays:Array.from({length:13},(_,i)=>({id:`birthday-${i}`,displayName:`Persoon ${i}`,age:i===0?null:20,day:23,month:10,isToday:false,role:'',teams:[]}))}),'birthdays');
  expect(birthdays.rich?.birthdays).toHaveLength(13);expect(birthdays.rich?.birthdays?.[0]?.age).toBeNull();expect(syncSlidePageCount(birthdays)).toBe(3);
  const activities=project(payload('sport_activities',{items:Array.from({length:7},(_,i)=>({id:`event-${i}`,primary:`Activiteit ${i}`,secondary:'Eigen activiteit',date:'24 okt',time:'14:00'}))}),'activities');
  expect(activities.rich?.activities).toHaveLength(7);expect(syncSlidePageCount(activities)).toBe(2);
 });
});
