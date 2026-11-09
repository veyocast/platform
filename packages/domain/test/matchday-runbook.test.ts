import { describe, expect, it } from "vitest";
import { matchdayDraftConfigurationSchema, type MatchdayPublication } from "@veyocast/contracts";
import { expandMatchdayTargets, matchdayActionObjectKey, matchdayRunState, matchdaySuggestedExpiry, replaceMatchdayDraftContext, validateMatchdayAction } from "../src/matchday-runbook";

const uuid=(n:number)=>`30000000-0000-4000-8000-${String(n).padStart(12,"0")}`;
const tenantId=uuid(1),now=Date.parse("2026-11-09T12:00:00Z");
const context={sourceId:uuid(2),connectionId:uuid(3),teamId:"own",competitionId:"league",poolId:"pool",seasonId:"2026-2027",phaseId:"1",selectionMode:"pinned" as const};
const draft=()=>matchdayDraftConfigurationSchema.parse({schemaVersion:1,name:"Clubdag",timezone:"Europe/Amsterdam",startsAt:"2026-11-09T10:00:00Z",endsAt:"2026-11-09T18:00:00Z",context,matches:[{id:uuid(4),matchCode:"official-4",context,homeTeamId:"own",awayTeamId:"away",homeTeamName:"Eigen team",awayTeamName:"Tegenstander",kickoffAt:"2026-11-09T13:00:00Z",field:"1",status:"scheduled",observedAt:null,lastSuccessfulSyncAt:null}],mainMatchId:uuid(4),roles:[{role:"entrance",targets:[{kind:"screen_group",id:uuid(5)}],defaultReleaseId:uuid(6),phaseReleaseIds:{halftime:uuid(7)},menuFallbacks:[],ledBinding:null}],overlapDecisions:[],phaseWindows:[]});
const screen=(n:number,expiryCapability=true)=>({id:uuid(n),tenantId,name:`Scherm ${n}`,status:"active",orientation:"landscape" as const,width:1920,height:1080,playerId:uuid(n+100),expiryCapability});
const input=()=>({tenantId,configuration:draft(),screens:[screen(10),screen(11)],groups:[{id:uuid(5),tenantId,screenIds:[uuid(10),uuid(11)]}],releaseChecks:[10,11].flatMap(n=>[6,7].map(r=>({tenantId,screenId:uuid(n),releaseId:uuid(r),ready:true,compatible:true})))});
const publication=():MatchdayPublication=>({id:uuid(20),runbookId:uuid(21),version:1,draftRevision:2,configuration:draft(),targets:[{screenId:uuid(10),screenName:"Entree",role:"entrance",targetSnapshotId:uuid(22),defaultReleaseId:uuid(6),phaseReleaseIds:{halftime:uuid(7)},orientation:"landscape",width:1920,height:1080,expiryCapability:"matchday-expiry-v1",playerId:uuid(110)}],publishedAt:"2026-11-09T09:00:00Z",status:"active",phase:"before",phaseActor:"Beheerder",phaseChangedAt:"2026-11-09T10:00:00Z"});
const field=()=>({runbookId:uuid(21),publicationId:uuid(20),expectedRevision:0,requestId:uuid(23),screenIds:[uuid(10)],endsAt:"2026-11-09T12:20:00Z",reason:"Veld tijdelijk gewijzigd",kind:"field" as const,matchId:uuid(4),field:"2"});

describe("S300 frozen role and exact scope preflight",()=>{
 it("deduplicates shared members within one role without adding new targets later",()=>{
  const initial=input();initial.configuration.roles[0]!.targets.push({kind:"screen",id:uuid(10)});
  const frozen=expandMatchdayTargets(initial);
  expect(frozen.canPublish).toBe(true);expect(frozen.targets.map(target=>target.screen.id)).toEqual([uuid(10),uuid(11)]);
  initial.groups[0]!.screenIds.push(uuid(99));
  expect(frozen.targets).toHaveLength(2);
 });
 it("requires an explicit physical-screen role decision for overlapping groups",()=>{
  const initial=input();initial.configuration.roles.push({...initial.configuration.roles[0]!,role:"clubwall"});
  expect(expandMatchdayTargets(initial).issues.map(issue=>issue.code)).toContain("OVERLAPPING_ROLES");
  initial.configuration.overlapDecisions=[{screenId:uuid(10),role:"entrance"},{screenId:uuid(11),role:"clubwall"}];
  expect(expandMatchdayTargets(initial).canPublish).toBe(true);
 });
 it("never receives a foreign tenant target, even with equal labels/ids",()=>{
  const initial=input();initial.screens[1]!.tenantId=uuid(999);
  const result=expandMatchdayTargets(initial);
  expect(result.canPublish).toBe(false);expect(result.targets.map(target=>target.screen.id)).toEqual([uuid(10)]);
 });
 it("blocks legacy LG expiry and incompatible publication independently",()=>{
  const initial=input();initial.screens[1]!.expiryCapability=false;initial.releaseChecks[0]!.compatible=false;
  const result=expandMatchdayTargets(initial);expect(result.targets).toEqual([]);
  expect(result.issues.map(issue=>issue.code)).toEqual(expect.arrayContaining(["PLAYER_EXPIRY_UNSUPPORTED","PUBLICATION_INCOMPATIBLE"]));
 });
 it("preserves a legitimate null season without inventing a year; unresolved contexts remain blocked",()=>{
  const initial=input();initial.configuration.context!.seasonId=null;initial.configuration.matches[0]!.context.seasonId=null;
  expect(matchdayDraftConfigurationSchema.safeParse(initial.configuration).success).toBe(true);
  expect(expandMatchdayTargets(initial).canPublish).toBe(true);
  initial.configuration.context!.seasonId="unknown";
  expect(expandMatchdayTargets(initial).issues.map(issue=>issue.code)).toContain("SEASON_CONTEXT_UNKNOWN");
  initial.configuration.context=null;
  expect(expandMatchdayTargets(initial).issues.map(issue=>issue.code)).toContain("EXACT_MATCH_REQUIRED");
 });
});

describe("S300 draft CAS and action boundaries",()=>{
 it("never silently moves a selected provider match to another season",()=>{
  const configuration=draft(),next={...context,seasonId:"2027-2028"};
  const input={editable:true,actualRevision:2,expectedRevision:2,configuration,context:next,clearSelectedMatches:false};
  expect(replaceMatchdayDraftContext(input)).toMatchObject({ok:false,reason:"EXPLICIT_MATCH_CLEAR_REQUIRED"});
  expect(replaceMatchdayDraftContext({...input,clearSelectedMatches:true})).toMatchObject({ok:true,configuration:{matches:[],mainMatchId:null}});
  expect(configuration.matches).toHaveLength(1);
  expect(replaceMatchdayDraftContext({...input,expectedRevision:1})).toMatchObject({ok:false,reason:"REVISION_CONFLICT"});
  expect(replaceMatchdayDraftContext({...input,editable:false})).toMatchObject({ok:false,reason:"PUBLISHED_VERSION_LOCKED"});
 });
 it("uses an exclusive end and never treats a planned time as a factual match phase",()=>{
  const pub=publication();expect(matchdayRunState(pub.status,pub.configuration.startsAt,pub.configuration.endsAt,Date.parse(pub.configuration.endsAt))).toBe("closed");
  expect(validateMatchdayAction(pub,field(),now)).toEqual({allowed:true});
  expect(validateMatchdayAction(pub,{...field(),endsAt:new Date(now).toISOString()},now)).toMatchObject({allowed:false,code:"INVALID_EXPIRY"});
  expect(validateMatchdayAction(pub,{...field(),endsAt:"2026-11-09T18:00:00.001Z"},now)).toMatchObject({allowed:false,code:"INVALID_EXPIRY"});
  expect(pub.phase).toBe("before");
 });
 it("rejects action replay onto another match/target/publication and invalid phase jumps",()=>{
  const pub=publication();
  expect(validateMatchdayAction(pub,{...field(),screenIds:[uuid(99)]},now)).toMatchObject({code:"TARGET_NOT_IN_PUBLICATION"});
  expect(validateMatchdayAction(pub,{...field(),matchId:uuid(99)},now)).toMatchObject({code:"MATCH_NOT_IN_PUBLICATION"});
  expect(validateMatchdayAction(pub,{...field(),publicationId:uuid(99)},now)).toMatchObject({code:"WRONG_PUBLICATION"});
  expect(validateMatchdayAction(pub,{...field(),kind:"phase",phase:"halftime"},now)).toMatchObject({code:"INVALID_PHASE_TRANSITION"});
 });
 it("requires explicit complete target selection for global main status while field actions remain subsets",()=>{
  const pub=publication();pub.targets.push({...pub.targets[0]!,screenId:uuid(11),screenName:"Clubmuur"});
  expect(validateMatchdayAction(pub,field(),now)).toEqual({allowed:true});
  expect(validateMatchdayAction(pub,{...field(),kind:"cancelled"},now)).toMatchObject({code:"MAIN_ACTION_REQUIRES_ALL_TARGETS"});
  expect(validateMatchdayAction(pub,{...field(),kind:"cancelled",screenIds:[uuid(10),uuid(11)]},now)).toEqual({allowed:true});
 });
 it("blocks menu operations lacking an exact published product placement/fallback",()=>{
  const {runbookId,publicationId,expectedRevision,requestId,screenIds,endsAt,reason}=field();
  const base={runbookId,publicationId,expectedRevision,requestId,screenIds,endsAt,reason};
  expect(validateMatchdayAction(publication(),{...base,kind:"sold_out",productId:uuid(30),menuSnapshotId:uuid(31),placementId:"bar-menu"},now)).toMatchObject({code:"MENU_PLACEMENT_NOT_SUPPORTED"});
 });
 it("suggests 20/30 minutes capped at the published runbook boundary",()=>{
  expect(matchdaySuggestedExpiry("field","2026-11-09T18:00:00Z",now)).toBe("2026-11-09T12:20:00.000Z");
  expect(matchdaySuggestedExpiry("postponed","2026-11-09T12:25:00Z",now)).toBe("2026-11-09T12:25:00.000Z");
 });
 it("uses the same object revision for a field correction and separates exact product placements",()=>{
  expect(matchdayActionObjectKey(field())).toBe(`match:${uuid(4)}:field`);
  expect(matchdayActionObjectKey({...field(),kind:"cancelled"})).toBe(`match:${uuid(4)}:phase`);
  const base={runbookId:uuid(21),publicationId:uuid(20),expectedRevision:0,requestId:uuid(23),screenIds:[uuid(10)],endsAt:"2026-11-09T12:20:00Z",reason:"Tijdelijke beschikbaarheid",kind:"sold_out" as const,productId:uuid(30),menuSnapshotId:uuid(31),placementId:"bar-menu"};
  expect(matchdayActionObjectKey(base)).not.toBe(matchdayActionObjectKey({...base,placementId:"entrance-menu"}));
 });
});
