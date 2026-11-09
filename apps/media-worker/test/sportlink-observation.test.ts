import { afterEach, describe, expect, it, vi } from "vitest";
import { mapSportlinkMatches, SportlinkClient } from "@veyocast/integrations/server";
import {
  collectSportlinkPoolContexts, dedupeSportlinkMatches, enrichSportlinkOwnMatchesWithPoolContexts,
  enrichSportlinkPoolMatches, fetchSportlinkDataset, SupabaseSportlinkSyncBackend
} from "../src/sportlink-sync-runner";

const job = {
  connectionId: "20000000-0000-4000-8000-000000000001", dataSourceId: "30000000-0000-4000-8000-000000000001",
  datasetGroup: "matches", encryptedClientId: "unused", encryptionIv: "unused", encryptionTag: "unused",
  runId: "40000000-0000-4000-8000-000000000001", tenantId: "10000000-0000-4000-8000-000000000001", timezone: "Europe/Amsterdam"
};
const team = { teamcode: 10, lokaleteamcode: 110, teamnaam: "Onze club 1", poulecode: 701, poule: "C", fase: "Competitie", seizoen: "2026/2027" };
const match = (code = 1, extra = {}) => ({
  wedstrijdcode: code, thuisteamid: 10, thuisteam: "Onze club 1", uitteamid: 20, uitteam: "Bezoekers 1",
  wedstrijddatum: "2026-11-07", aanvangstijd: "14:30", ...extra
});
const client = (respond: (url: URL) => unknown | Promise<unknown>) => new SportlinkClient("fixture-only", {
  maxAttempts: 1,
  fetchImpl: async (input) => {
    const value = await respond(new URL(input instanceof Request ? input.url : input));
    return value instanceof Response ? value : Response.json(value);
  }
});
const defaultResponse = (url: URL) => url.pathname === "/teams" ? [team] : [];
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe("Sportlink authoritative observation scopes", () => {
  it.each(["2026-11-08T23:30:00Z", "2026-11-09T23:30:00Z"])("includes the running local day across a week boundary at %s", async (instant) => {
    vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date(instant));
    const requests: URL[] = [];
    const batch = await fetchSportlinkDataset("matches", client((url) => {
      requests.push(url);
      if (["/uitslagen", "/pouleuitslagen"].includes(url.pathname)) {
        // Provider-shaped fixture: the old defaults do not cover today's row.
        return url.searchParams.get("weekoffset") === "-2" && url.searchParams.get("aantaldagen") === "15"
          ? [match(7, { uitslag: "0-0" })] : [];
      }
      return defaultResponse(url);
    }), job);
    expect(batch.matches).toHaveLength(1);
    expect(batch.matches[0]).toMatchObject({ externalId: "7", status: "finished", homeTeam: { score: 0 }, awayTeam: { score: 0 } });
    expect(batch.matchObservation?.scopes).toEqual(expect.arrayContaining([
      expect.objectContaining({ scope: "club", fromDate: instant.includes("08T") ? "2026-10-26" : "2026-10-27",
        throughDate: instant.includes("08T") ? "2026-11-09" : "2026-11-10", complete: true, resultExternalIds: ["7"] })
    ]));
    for (const url of requests.filter((url) => ["/uitslagen", "/pouleuitslagen"].includes(url.pathname))) {
      expect(url.searchParams.get("sorteervolgorde")).toBe("datum-omgekeerd");
    }
    expect(batch.matchObservation?.sourceObservations?.every((observation) =>
      /^[a-f0-9-]{36}$/.test(observation.correlationId) && observation.recordCount >= observation.normalizedCount
    )).toBe(true);
    expect(JSON.stringify(batch.matchObservation)).not.toContain("fixture-only");
  });

  it("defers absence reconciliation if a sync crosses a connection-local date boundary", async () => {
    vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-11-08T22:59:00Z"));
    const batch = await fetchSportlinkDataset("matches", client((url) => {
      if (url.pathname === "/pouleuitslagen") vi.setSystemTime(new Date("2026-11-08T23:01:00Z"));
      return defaultResponse(url);
    }), job);
    expect(batch.matchObservation?.scopes.every((scope) => !scope.complete)).toBe(true);
    expect(batch.matchObservation?.scopes[0]?.throughDate).toBe("2026-11-08");
  });

  it("correlates successful provider observations with their leased sync without logging source rows or credentials", async () => {
    const batch = await fetchSportlinkDataset("matches", client((url) =>
      url.pathname === "/uitslagen" ? [match(7, { uitslag: "0-0" })] : defaultResponse(url)
    ), job);
    const write = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const rpc = vi.fn().mockResolvedValue({ data: { readCount: 1 }, error: null });
    await new SupabaseSportlinkSyncBackend("https://fixture.test", "fixture-only", { rpc }).complete(job, "worker:fixture", batch);
    const logs = write.mock.calls.map(([line]) => JSON.parse(String(line)));
    expect(logs).toHaveLength(batch.matchObservation!.sourceObservations!.length);
    expect(logs.every((entry) => entry.correlation_id === job.runId && entry.fields.outcome === "source_observation")).toBe(true);
    expect(logs.find((entry) => entry.fields.articleKey === "uitslagen")?.fields).toMatchObject({ recordCount: 1, normalizedCount: 1, complete: true });
    expect(JSON.stringify(logs)).not.toMatch(/fixture-only|Onze club|Bezoekers|thuisteam|uitteam|uitslag":/);
  });

  it("distinguishes a valid complete empty selection from parser loss and partial pool coverage", async () => {
    const empty = await fetchSportlinkDataset("matches", client(defaultResponse), job);
    expect(empty.matchObservation?.scopes.every((scope) => scope.complete)).toBe(true);
    expect(empty.matches).toEqual([]);
    const partial = await fetchSportlinkDataset("matches", client((url) => {
      if (url.pathname === "/uitslagen") return [match(1, { uitslag: "2-1" }), { wedstrijdcode: 2, thuisteam: "Broken" }];
      if (url.pathname === "/pouleuitslagen" && url.searchParams.get("eigenwedstrijden") === "NEE") return Response.json({}, { status: 429 });
      if (url.pathname === "/pouleuitslagen") return [match(3, { uitslag: "1-1" })];
      return defaultResponse(url);
    }), job);
    expect(partial.matchObservation?.scopes.map((scope) => scope.complete)).toEqual([false, false]);
    expect(partial.matches.map((row) => row.externalId)).toEqual(["1", "3"]);
  });

  it.each([null, {}, ["unknown"], [{ wedstrijdcode: 9 }]])("does not claim an authoritative empty feed for malformed %j", async (payload) => {
    const batch = await fetchSportlinkDataset("matches", client((url) =>
      ["/uitslagen", "/pouleuitslagen"].includes(url.pathname) ? payload : defaultResponse(url)
    ), job);
    expect(batch.matches).toEqual([]);
    expect(batch.matchObservation?.scopes.every((scope) => !scope.complete)).toBe(true);
  });

  it.each([undefined, null, "", "not-a-score"])("preserves the last official score when a results row loses its score field (%j)", async (uitslag) => {
    const previous = mapSportlinkMatches([match(1, { uitslag: "3-1" })], "results");
    const batch = await fetchSportlinkDataset("matches", client((url) =>
      ["/uitslagen", "/pouleuitslagen"].includes(url.pathname) ? [match(1, { uitslag })] : defaultResponse(url)
    ), job);
    expect(batch.matches).toEqual([]);
    expect(batch.matchObservation?.scopes.every((scope) => !scope.resultsComplete && !scope.complete)).toBe(true);
    expect(batch.matchObservation?.scopes.every((scope) => scope.resultExternalIds.length === 0)).toBe(true);
    expect(dedupeSportlinkMatches([...previous, ...batch.matches])[0]).toMatchObject({
      status: "finished", homeTeam: { score: 3 }, awayTeam: { score: 1 }
    });
  });

  it("publishes a valid new 0–0 beside score parser loss without treating the partial scope as empty", async () => {
    const previous = mapSportlinkMatches([match(1, { uitslag: "3-1" })], "results");
    const batch = await fetchSportlinkDataset("matches", client((url) =>
      ["/uitslagen", "/pouleuitslagen"].includes(url.pathname)
        ? [match(1, { uitslag: "not-a-score" }), match(2, { uitslag: "0-0" })] : defaultResponse(url)
    ), job);
    expect(batch.matches).toHaveLength(1);
    expect(batch.matches[0]).toMatchObject({ externalId: "2", status: "finished", homeTeam: { score: 0 }, awayTeam: { score: 0 } });
    expect(batch.matchObservation?.scopes.every((scope) => !scope.resultsComplete && scope.resultExternalIds.join() === "2")).toBe(true);
    expect(dedupeSportlinkMatches([...previous, ...batch.matches]).map((item) => [item.externalId, item.homeTeam.score, item.awayTeam.score])).toEqual([
      ["1", 3, 1], ["2", 0, 0]
    ]);
  });

  it("accepts an explicit official cancellation without requiring published result scores", async () => {
    const batch = await fetchSportlinkDataset("matches", client((url) =>
      ["/uitslagen", "/pouleuitslagen"].includes(url.pathname) ? [match(1, { status: "Afgelast" })] : defaultResponse(url)
    ), job);
    expect(batch.matches[0]).toMatchObject({ externalId: "1", status: "cancelled", homeTeam: { score: null }, awayTeam: { score: null } });
    expect(batch.matchObservation?.scopes.every((scope) => scope.resultsComplete && scope.complete)).toBe(true);
  });

  it.each([4001, 4031, 5001])("keeps a failed scope while applying a successful independent pool (%s)", async (code) => {
    const batch = await fetchSportlinkDataset("matches", client((url) => {
      if (url.pathname === "/teams") return [team, { ...team, teamcode: 11, lokaleteamcode: 111, poulecode: 702 }];
      if (url.pathname === "/pouleuitslagen") return url.searchParams.get("poulecode") === "701"
        ? { error: { code } } : [match(4, { uitslag: "3-2" })];
      return [];
    }), job);
    expect(batch.matchObservation?.scopes.filter((scope) => scope.scope === "pool").map((scope) => scope.complete)).toEqual([false, true]);
    expect(batch.matches[0]).toMatchObject({ externalId: "4", pool: { externalId: "702" } });
  });

  it.each(["/programma", "/uitslagen"])("retains independent programme/results authority when %s fails", async (failedArticle) => {
    const batch = await fetchSportlinkDataset("matches", client((url) => {
      if (url.pathname === failedArticle) return { error: { code: 5001 } };
      return defaultResponse(url);
    }), job);
    expect(batch.matchObservation?.scopes[0]).toMatchObject({
      complete: false, programComplete: failedArticle !== "/programma", resultsComplete: failedArticle !== "/uitslagen"
    });
    const scope = batch.matchObservation!.scopes[0]!;
    expect(scope.programFromDate).toBe(scope.throughDate);
    expect(Date.parse(scope.programThroughDate!) - Date.parse(scope.programFromDate!)).toBe(41 * 86_400_000);
  });

  it("does not hide a connection-wide source failure behind an empty completion", async () => {
    await expect(fetchSportlinkDataset("matches", client((url) =>
      url.pathname === "/teams" || url.pathname === "/poulelijst" ? [] : { error: { code: 5001 } }
    ), job)).rejects.toHaveProperty("code", "SPORTLINK_SERVER_ERROR");
  });

  it.each([110, -1])("splits a club feed at the documented cap over exact own teams (local code %s)", async (localCode) => {
    const requests: URL[] = [];
    const batch = await fetchSportlinkDataset("matches", client((url) => {
      requests.push(url);
      if (url.pathname === "/teams") return [{ ...team, lokaleteamcode: localCode }];
      if (url.pathname === "/uitslagen") return url.searchParams.has("teamcode")
        ? [match(600, { uitslag: "4-3" })]
        : Array.from({ length: 500 }, (_, index) => match(index + 1, { uitslag: "1-0" }));
      return defaultResponse(url);
    }), job);
    expect(batch.matches).toHaveLength(501);
    expect(batch.matches.some((row) => row.externalId === "600")).toBe(true);
    expect(batch.matchObservation?.scopes[0]?.complete).toBe(true);
    const split = requests.find((url) => url.pathname === "/uitslagen" && url.searchParams.has("teamcode"));
    expect(split?.searchParams.get("teamcode")).toBe("10");
    expect(split?.searchParams.get("lokaleteamcode")).toBe(String(localCode));
  });

  it("retains bounded newest rows without claiming full coverage when a capped feed cannot be split", async () => {
    const batch = await fetchSportlinkDataset("matches", client((url) => {
      if (url.pathname === "/teams") return [{ ...team, lokaleteamcode: null }];
      if (url.pathname === "/uitslagen") return Array.from({ length: 500 }, (_, index) => match(index + 1, { uitslag: "1-0" }));
      return [];
    }), job);
    expect(batch.matches).toHaveLength(500);
    expect(batch.matchObservation?.scopes[0]?.complete).toBe(false);
  });

  it("rejects explicit foreign pool, season and phase before the scope is marked complete", async () => {
    const batch = await fetchSportlinkDataset("matches", client((url) => {
      if (url.pathname === "/pouleuitslagen") return [
        match(1, { poulecode: 999, poule: "Other", uitslag: "1-1" }),
        match(2, { fase: "Beker", uitslag: "1-1" }),
        match(3, { seizoen: "2025/2026", uitslag: "1-1" }),
        match(4, { uitslag: "2-1" })
      ];
      return defaultResponse(url);
    }), job);
    expect(batch.matches.map((row) => row.externalId)).toEqual(["4"]);
    expect(batch.matchObservation?.scopes[1]?.complete).toBe(false);
  });

  it("sends detail observations through the additive completion and never reports scope absence", async () => {
    const batch = await fetchSportlinkDataset("match_details", client((url) =>
      url.pathname === "/programma" || url.pathname === "/wedstrijd-informatie" ? [match()] : defaultResponse(url)
    ), { ...job, datasetGroup: "match_details" });
    expect(batch.matchObservation).toMatchObject({ kind: "details", scopes: [] });
    const rpc = vi.fn().mockResolvedValue({ data: { readCount: 1 }, error: null });
    await new SupabaseSportlinkSyncBackend("https://fixture.test", "fixture-only", { rpc }).complete({ ...job, datasetGroup: "match_details" }, "worker:fixture", batch);
    expect(rpc).toHaveBeenCalledWith("complete_sportlink_sync_v5", expect.objectContaining({ p_match_observation: batch.matchObservation }));
  });
});

describe("Sportlink result and context identity", () => {
  it("keeps 0–0 and a later official correction on one ID, and preserves its score through Programma enrichment", () => {
    const scored = mapSportlinkMatches([match(1, { uitslag: "0-0" })], "results");
    const corrected = mapSportlinkMatches([match(1, { uitslag: "2-0" })], "results");
    const program = mapSportlinkMatches([match(1, { veld: "Veld 2" })], "program");
    const result = dedupeSportlinkMatches([...scored, ...corrected, ...program]);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ status: "finished", homeTeam: { score: 2 }, awayTeam: { score: 0 }, venue: { field: "Veld 2" } });
    expect(dedupeSportlinkMatches([...result, ...mapSportlinkMatches([match()], "results")])[0]?.homeTeam.score).toBeNull();
  });

  it("sorts on actual separate kickoff time and uses the normalized code for ties", () => {
    const result = dedupeSportlinkMatches(mapSportlinkMatches([
      match(3, { aanvangstijd: "16:00" }), match(2), match(1)
    ], "results"));
    expect(result.map((row) => row.externalId)).toEqual(["1", "2", "3"]);
    expect(result[0]?.startsAt).toBe("2026-11-07T13:30:00.000Z");
  });

  it("binds differing club-feed labels to the checked official pool competition identity", () => {
    const context = collectSportlinkPoolContexts([team], [])[0]!;
    const ownResult = mapSportlinkMatches([match(1, { competitie: "Label from club results", poulecode: 701, poule: "C", uitslag: "1-0" })], "results");
    const normalized = enrichSportlinkOwnMatchesWithPoolContexts(ownResult, [team], []);
    expect(ownResult[0]?.competition?.externalId).not.toBe(context.competition?.externalId);
    expect(normalized[0]?.competition?.externalId).toBe(context.competition?.externalId);
    expect(normalized[0]?.pool?.competitionExternalId).toBe(context.competition?.externalId);
    const ambiguous = { ...ownResult[0]!, pool: null };
    expect(dedupeSportlinkMatches([...enrichSportlinkPoolMatches(ownResult, context), ambiguous])[0]?.competition?.externalId).toBe(context.competition?.externalId);
  });

  it("leaves an explicit incompatible phase outside the resolved own context", () => {
    const context = collectSportlinkPoolContexts([team], [])[0]!;
    const result = enrichSportlinkOwnMatchesWithPoolContexts(mapSportlinkMatches([
      match(1, { fase: "Beker", poulecode: 701, poule: "C", uitslag: "1-0" })
    ], "results"), [team], []);
    expect(result[0]?.competition?.externalId).not.toBe(context.competition?.externalId);
  });
});

describe("Sportlink independent official standings", () => {
  it("publishes fresh official positions and points when optional results-form enrichment fails", async () => {
    const batch = await fetchSportlinkDataset("competitions", client((url) => {
      if (url.pathname === "/poulestand") return [{ teamcode: 10, team: "Onze club 1", positie: 2, punten: 9, doelpuntenvoor: 7, doelpuntentegen: 3 }];
      if (url.pathname === "/pouleuitslagen") return { error: { code: 5001 } };
      return defaultResponse(url);
    }), { ...job, datasetGroup: "competitions" });
    expect(batch.standings[0]?.rows[0]).toMatchObject({ position: 2, points: 9, goalsFor: 7, goalsAgainst: 3, form: [] });
  });

  it("keeps a failed pool untouched while publishing another pool, including confirmed unpublished standings", async () => {
    const batch = await fetchSportlinkDataset("competitions", client((url) => {
      if (url.pathname === "/teams") return [team, { ...team, teamcode: 11, lokaleteamcode: 111, poulecode: 702 }];
      if (url.pathname === "/poulestand") return url.searchParams.get("poulecode") === "701" ? Response.json({}, { status: 429 }) : [];
      return [];
    }), { ...job, datasetGroup: "competitions" });
    expect(batch.standings).toHaveLength(1);
    expect(batch.standings[0]).toMatchObject({ pool: { externalId: "702" }, rows: [], scoresPublished: false });
  });
});
