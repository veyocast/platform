import {describe,it,expect} from 'vitest';
import {sportDynamicSlideTypes,syncDynamicFamilies,syncDynamicConfigurationSchema,type SyncDynamicConfiguration,type SyncContentFamily} from '@veyocast/contracts';
import {createSyncStudioStarter} from '@veyocast/studio';
import {compileSyncSportlinkBinding,readSyncSportlinkSelection,syncSportlinkAutoContext,syncSportlinkSelectionPolicy,type SyncSportlinkTeam} from './sync-sportlink-binding';

const teams:SyncSportlinkTeam[]=[{externalId:'own-team-1',name:'Eigen team',contexts:[{label:'Eigen poule · periode 2',competitionId:'competition-1',phaseId:'2',poolId:'pool-1',seasonId:'2026-2027'}]}];
function configuration(type:(typeof sportDynamicSlideTypes)[number],family:SyncContentFamily=syncDynamicFamilies[type][0]):SyncDynamicConfiguration{
 const seed=createSyncStudioStarter({family,tenantName:'Eigen club'}).syncPresentation!;
 return syncDynamicConfigurationSchema.parse({schemaVersion:1,kind:'dynamic',rendererVersion:seed.rendererVersion,sourceRevision:seed.sourceRevision,slideType:type,seed,secondsPerPage:5});
}
describe('Source selections compile into the existing canonical Sportlink contracts',()=>{
 for(const type of sportDynamicSlideTypes)it(`retains actual Source identity for ${type}`,()=>{
  const cfg=configuration(type),policy=syncSportlinkSelectionPolicy(cfg),selection={mode:policy.required?'selected' as const:'all' as const,contexts:policy.required?[syncSportlinkAutoContext('own-team-1')]:[],birthdayDays:21 as const};
  const result=compileSyncSportlinkBinding(cfg,{syncConfiguration:cfg},selection,teams);
  expect(result.syncConfiguration).toEqual(cfg);expect(result).not.toHaveProperty('sitesConfiguration');expect(result).not.toHaveProperty('rows');expect(result.maxItems).toBe(200);
 });
 it('selects the actual pool blueprint and exact pinned competition context',()=>{
  const cfg=configuration('sport_program','pool-program'),context={...teams[0]!.contexts[0]!,providerTeamId:'own-team-1',competitionSelectionMode:'pinned' as const};
  const {label:_,...selected}=context;void _;
  const result=compileSyncSportlinkBinding(cfg,{}, {mode:'selected',contexts:[selected],birthdayDays:7},teams);
  expect(result.blueprintKey).toBe('sportlink.pool_schedule_next_7_days');expect(result.context).toEqual(selected);expect(result).not.toHaveProperty('teamSelection');
 });
 it('rejects unknown teams, forged pool context and missing single-team choices',()=>{
  const cfg=configuration('sport_period_standing');
  expect(()=>compileSyncSportlinkBinding(cfg,{}, {mode:'selected',contexts:[],birthdayDays:7},teams)).toThrow('Kies');
  expect(()=>compileSyncSportlinkBinding(cfg,{}, {mode:'selected',contexts:[syncSportlinkAutoContext('foreign-team')],birthdayDays:7},teams)).toThrow('bron');
  expect(()=>compileSyncSportlinkBinding(cfg,{}, {mode:'selected',contexts:[{...syncSportlinkAutoContext('own-team-1'),competitionSelectionMode:'pinned',competitionId:'foreign-pool'}],birthdayDays:7},teams)).toThrow('bron');
 });
 it('preserves canonical birthday privacy choices and explicitly selects the full 21-day period',()=>{
  const cfg=configuration('sport_birthdays'),result=compileSyncSportlinkBinding(cfg,{birthday:{selection:{nameMode:'first',showAge:false}}},{mode:'selected',contexts:[syncSportlinkAutoContext('own-team-1')],birthdayDays:21},teams);
  expect(result.blueprintKey).toBe('sportlink.birthdays');
  expect(result.birthday).toMatchObject({period:{days:21,mode:'next_21_days'},selection:{nameMode:'first',showAge:false,selectedTeamIds:['own-team-1'],includeWithoutTeam:false}});
 });
 it('reopens canonical source-team bindings without replacing them with an all-team selection',()=>{
  const cfg=configuration('sport_trainings'),selection={mode:'selected' as const,contexts:[syncSportlinkAutoContext('own-team-1')],birthdayDays:7 as const};
  const value=compileSyncSportlinkBinding(cfg,{},selection,teams);expect(readSyncSportlinkSelection(cfg,value)).toEqual(selection);
 });
});

describe('S291 selection persistence',()=>{
 for(const kind of ['sport_program','sport_results','sport_match_of_the_day']as const)for(const matchLocation of ['both','home','away']as const)it(`${kind} round-trips ${matchLocation} with stable team identities`,()=>{
  const cfg=configuration(kind),selection={mode:'selected' as const,contexts:[syncSportlinkAutoContext('own-team-1')],birthdayDays:7 as const,matchLocation};
  const bound=compileSyncSportlinkBinding(cfg,{},selection,teams);
  expect(bound.teamSelection).toMatchObject({matchLocation,teamContexts:selection.contexts});
  expect(readSyncSportlinkSelection(cfg,structuredClone(bound))).toEqual(selection);
 });
 it('stores the selected welcome days in the existing arrival window and retains it on reopening',()=>{
  const cfg=configuration('sport_visitor_arrivals'),selection={mode:'selected' as const,contexts:[syncSportlinkAutoContext('own-team-1')],birthdayDays:7 as const,welcomeDays:14};
  const bound=compileSyncSportlinkBinding(cfg,{},selection,teams);
  expect(bound.arrival).toMatchObject({minutesBefore:20160,minutesAfter:0,emptyBehavior:'skip'});
  expect(readSyncSportlinkSelection(cfg,bound)).toEqual(selection);
  expect(()=>compileSyncSportlinkBinding(cfg,{}, {...selection,welcomeDays:43},teams)).toThrow('42 dagen');
 });
});
