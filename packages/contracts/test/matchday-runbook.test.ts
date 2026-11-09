import { describe, expect, it } from "vitest";
import { matchdayActionInputSchema, matchdayDraftConfigurationSchema, matchdayMatchSchema } from "../src/matchday-runbook";

const uuid = (n: number) => `30000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const context = {sourceId:uuid(1),connectionId:uuid(2),teamId:"own-team",competitionId:"league",poolId:"pool",seasonId:"2026-2027",phaseId:"1",selectionMode:"pinned" as const};
const match = (n: number) => ({id:uuid(n),matchCode:`official-${n}`,context,homeTeamId:"own-team",awayTeamId:"opponent",homeTeamName:"Eigen team",awayTeamName:"Tegenstander",kickoffAt:"2026-11-09T13:00:00Z",field:"1",status:"scheduled" as const,observedAt:null,lastSuccessfulSyncAt:null});
const draft = () => ({schemaVersion:1 as const,name:"Sportpark maandag",timezone:"Europe/Amsterdam",startsAt:"2026-11-09T10:00:00Z",endsAt:"2026-11-09T18:00:00Z",context,matches:[match(3),match(4)],mainMatchId:uuid(3),roles:[],overlapDecisions:[],phaseWindows:[]});

describe("S300 exact match and bounded draft contract", () => {
  it("retains two distinct provider matches for the same team on the same day", () => {
    expect(matchdayDraftConfigurationSchema.parse(draft()).matches.map(row => row.matchCode)).toEqual(["official-3","official-4"]);
  });
  it("cannot identify a match using only labels/date or substitute another pool for the main match", () => {
    expect(matchdayMatchSchema.safeParse({...match(3),matchCode:undefined}).success).toBe(false);
    expect(matchdayDraftConfigurationSchema.safeParse({...draft(),matches:[{...match(3),context:{...context,poolId:"other"}}]}).success).toBe(false);
  });
  it("allows other exact park matches with their own team context but never another connection", () => {
    const other={...match(4),context:{...context,teamId:"other-own-team",poolId:"other"},homeTeamId:"other-own-team"};
    expect(matchdayDraftConfigurationSchema.safeParse({...draft(),matches:[match(3),other]}).success).toBe(true);
    expect(matchdayDraftConfigurationSchema.safeParse({...draft(),matches:[match(3),{...other,context:{...other.context,connectionId:uuid(99)}}]}).success).toBe(false);
  });
  it("rejects duplicate normalized provider identities and a main match outside the selection", () => {
    expect(matchdayDraftConfigurationSchema.safeParse({...draft(),matches:[match(3),{...match(4),matchCode:"official-3"}]}).success).toBe(false);
    expect(matchdayDraftConfigurationSchema.safeParse({...draft(),mainMatchId:uuid(99)}).success).toBe(false);
  });
  it("requires an exclusive bounded end and valid club timezone", () => {
    for(const override of [{endsAt:"2026-11-09T10:00:00Z"},{endsAt:"2026-11-12T18:00:00Z"},{timezone:"not/a-timezone"}])
      expect(matchdayDraftConfigurationSchema.safeParse({...draft(),...override}).success).toBe(false);
  });
  it("accepts touching phase boundaries and rejects overlap/outside windows", () => {
    const windows=[{phase:"before",startsAt:"2026-11-09T10:00:00Z",endsAt:"2026-11-09T13:00:00Z"},{phase:"playing",startsAt:"2026-11-09T13:00:00Z",endsAt:"2026-11-09T15:00:00Z"}];
    expect(matchdayDraftConfigurationSchema.safeParse({...draft(),phaseWindows:windows}).success).toBe(true);
    expect(matchdayDraftConfigurationSchema.safeParse({...draft(),phaseWindows:[windows[0],{...windows[1],startsAt:"2026-11-09T12:59:59Z"}]}).success).toBe(false);
  });
  it("has no all-screens action and rejects arbitrary provider/catalog fields", () => {
    const input={runbookId:uuid(8),publicationId:uuid(5),expectedRevision:0,requestId:uuid(6),screenIds:[uuid(7)],endsAt:"2026-11-09T14:00:00Z",reason:"Veld opnieuw ingedeeld",kind:"field",matchId:uuid(3),field:"2"};
    expect(matchdayActionInputSchema.safeParse(input).success).toBe(true);
    expect(matchdayActionInputSchema.safeParse({...input,screenIds:[]}).success).toBe(false);
    expect(matchdayActionInputSchema.safeParse({...input,providerWrite:true}).success).toBe(false);
    expect(matchdayActionInputSchema.safeParse({...input,price:100}).success).toBe(false);
  });
});
