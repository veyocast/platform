import { afterEach, describe, expect, it, vi } from "vitest";
import { mapSportlinkMatches, SportlinkClient } from "@veyocast/integrations/server";
import sharp from "sharp";

import {
  collectSportlinkPoolContexts,
  collectSportlinkPoolIds,
  collectSportlinkMatchLogoCandidates,
  dedupeSportlinkMatches,
  enrichSportlinkOwnMatchesWithPoolContexts,
  enrichSportlinkPoolMatches,
  fetchSportlinkDataset,
  runSportlinkSyncLoop,
  runSportlinkSyncOnce,
  SupabaseSportlinkSyncBackend
} from "../src/sportlink-sync-runner";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("Sportlink sync worker", () => {
  it("fetches the tenant logo with the daily club profile observation", async () => {
    const logo = await sharp({
      create: { background: "#FF5C20", channels: 4, height: 64, width: 64 }
    }).png().toBuffer();
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(input instanceof Request ? input.url : input);
      if (url.pathname === "/clubgegevens") {
        return new Response(JSON.stringify({
          clubcode: "DUIN",
          clubnaam: "Duindorp sv"
        }), { headers: { "content-type": "application/json" } });
      }
      if (url.pathname === "/clublogo") {
        return new Response(new Uint8Array(logo), {
          headers: { "content-type": "image/png" }
        });
      }
      return new Response("not found", { status: 404 });
    });

    await expect(fetchSportlinkDataset(
      "club_profile",
      new SportlinkClient("client-id", {
        fetchImpl: fetchImpl as typeof fetch,
        maxAttempts: 1
      }),
      {
        connectionId: "20000000-0000-4000-8000-000000000001",
        dataSourceId: "30000000-0000-4000-8000-000000000001",
        datasetGroup: "club_profile",
        encryptedClientId: "ciphertext",
        encryptionIv: "initialization",
        encryptionTag: "authentication",
        runId: "40000000-0000-4000-8000-000000000001",
        tenantId: "10000000-0000-4000-8000-000000000001",
        timezone: "Europe/Amsterdam"
      }
    )).resolves.toMatchObject({
      club: { externalId: "DUIN", name: "Duindorp sv" },
      clubLogo: { externalId: "DUIN", role: "club_logo" }
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("uses the same connection catalog to identify equally named standing teams", async () => {
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(input instanceof Request ? input.url : input);
      const payload = url.pathname === "/teams" ? [
        { teamcode: 355471, teamnaam: "Club 35+1", poulecode: 833025, competitienaam: "Veteranen beker zaterdag" },
        { teamcode: 394546, teamnaam: "Club 35+1", poulecode: 836218, competitienaam: "Vrijdag 7x7" }
      ] : url.pathname === "/poulestand" ? [{ team: "Club 35+1", positie: 1, punten: 6 }] : [];
      return new Response(JSON.stringify(payload), { headers: { "content-type": "application/json" } });
    });
    const batch = await fetchSportlinkDataset("competitions", new SportlinkClient("client-id", {
      fetchImpl: fetchImpl as typeof fetch, maxAttempts: 1
    }), {
      connectionId: "20000000-0000-4000-8000-000000000001",
      dataSourceId: "30000000-0000-4000-8000-000000000001",
      datasetGroup: "competitions", encryptedClientId: "ciphertext",
      encryptionIv: "initialization", encryptionTag: "authentication",
      runId: "40000000-0000-4000-8000-000000000001",
      tenantId: "10000000-0000-4000-8000-000000000001", timezone: "Europe/Amsterdam"
    });
    expect(batch.standings.map((standing) => ({
      pool: standing.pool.externalId, team: standing.rows[0]?.externalId
    }))).toEqual([{ pool: "833025", team: "355471" }, { pool: "836218", team: "394546" }]);
    expect(fetchImpl).toHaveBeenCalledTimes(8);
  });

  describe("standing form for every pool team", () => {
    const job = {
      connectionId: "20000000-0000-4000-8000-000000000001",
      dataSourceId: "30000000-0000-4000-8000-000000000001",
      datasetGroup: "competitions", encryptedClientId: "ciphertext",
      encryptionIv: "initialization", encryptionTag: "authentication",
      runId: "40000000-0000-4000-8000-000000000001",
      tenantId: "10000000-0000-4000-8000-000000000001", timezone: "Europe/Amsterdam"
    };
    const ownTeam = { teamcode: 10, teamnaam: "Testclub 1", poulecode: 701 };
    const client = (fetchImpl: typeof fetch) => new SportlinkClient("test-client", { fetchImpl, maxAttempts: 1 });

    it("fetches own and other results over 90 days and completes forms without creating selectable opponents", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-10-10T12:00:00Z"));
      const requests: string[] = [];
      const fetchImpl = vi.fn(async (input: string | URL | Request) => {
        const url = new URL(input instanceof Request ? input.url : input);
        if (url.pathname === "/teams") return Response.json([ownTeam]);
        if (url.pathname === "/poulestand") return Response.json([
          { team: "Testclub 1" }, { team: "Bezoekers 1" }, { team: "Bezoekers 2" }
        ]);
        if (url.pathname === "/pouleuitslagen") {
          expect(url.searchParams.get("poulecode")).toBe("701");
          expect(url.searchParams.get("aantaldagen")).toBe("90");
          const own = url.searchParams.get("eigenwedstrijden") === "JA";
          requests.push(url.searchParams.get("eigenwedstrijden")!);
          return Response.json([
            { wedstrijdcode: own ? 11 : 21, wedstrijddatum: "2026-08-01", uitslag: "1-0" },
            { wedstrijdcode: own ? 12 : 22, wedstrijddatum: "2026-08-15", uitslag: "1-1" },
            { wedstrijdcode: own ? 13 : 23, wedstrijddatum: "2026-09-05", uitslag: "0-1" }
          ].map((match) => ({
            ...match, thuisteam: own ? "Testclub 1" : "Bezoekers 1",
            thuisteamid: own ? 10 : 20, uitteam: "Bezoekers 2", uitteamid: 30
          })));
        }
        return Response.json([]);
      });
      const batch = await fetchSportlinkDataset("competitions", client(fetchImpl as typeof fetch), job);
      expect(requests).toEqual(["NEE", "JA"]);
      expect(batch.standings[0]?.rows.map((row) => row.form)).toEqual([
        ["win", "draw", "loss"], ["win", "draw", "loss"], ["draw", "win", "win"]
      ]);
      expect(batch.teams).toEqual([]);
      expect(batch.matches).toEqual([]);
      expect(fetchImpl).toHaveBeenCalledTimes(5);
    });

    it.each([
      [[{ team: "Testclub 1", vorm: "WGV" }, { team: "Bezoekers 1", vorm: "VGW" }]],
      [[]]
    ])("avoids extra provider requests for complete provider form or an empty standing: %j", async (rows) => {
      const fetchImpl = vi.fn(async (input: string | URL | Request) => {
        const url = new URL(input instanceof Request ? input.url : input);
        if (url.pathname === "/teams") return Response.json([ownTeam]);
        if (url.pathname === "/poulestand") return Response.json(rows);
        if (url.pathname === "/pouleuitslagen") throw new Error("unexpected result request");
        return Response.json([]);
      });
      const batch = await fetchSportlinkDataset("competitions", client(fetchImpl as typeof fetch), job);
      expect(batch.standings[0]?.rows).toHaveLength(rows.length);
      expect(fetchImpl).toHaveBeenCalledTimes(3);
    });

    it.each([4001, 4031])("retains the standing when pool results are unavailable (%s)", async (code) => {
      const fetchImpl = vi.fn(async (input: string | URL | Request) => {
        const url = new URL(input instanceof Request ? input.url : input);
        if (url.pathname === "/teams") return Response.json([ownTeam]);
        if (url.pathname === "/poulestand") return Response.json([{ team: "Testclub 1", punten: 6 }]);
        if (url.pathname === "/pouleuitslagen") return Response.json({ error: { code } });
        return Response.json([]);
      });
      const batch = await fetchSportlinkDataset("competitions", client(fetchImpl as typeof fetch), job);
      expect(batch.standings[0]?.rows[0]).toMatchObject({ teamName: "Testclub 1", points: 6, form: [] });
      expect(fetchImpl).toHaveBeenCalledTimes(5);
    });

    it.each([4012, 5001])("rejects an incomplete observation on a genuine provider failure (%s)", async (code) => {
      const fetchImpl = vi.fn(async (input: string | URL | Request) => {
        const url = new URL(input instanceof Request ? input.url : input);
        if (url.pathname === "/teams") return Response.json([ownTeam]);
        if (url.pathname === "/poulestand") return Response.json([{ team: "Testclub 1" }]);
        if (url.pathname === "/pouleuitslagen") return Response.json({ error: { code } });
        return Response.json([]);
      });
      await expect(fetchSportlinkDataset("competitions", client(fetchImpl as typeof fetch), job)).rejects.toHaveProperty("code", code === 4012 ? "SPORTLINK_CLIENT_ID_INVALID" : "SPORTLINK_SERVER_ERROR");
    });

    it("keeps equally named teams in different pools separate and rejects explicit conflicting pool rows", async () => {
      const fetchImpl = vi.fn(async (input: string | URL | Request) => {
        const url = new URL(input instanceof Request ? input.url : input);
        if (url.pathname === "/teams") return Response.json([ownTeam, { ...ownTeam, teamcode: 11, poulecode: 702 }]);
        if (url.pathname === "/poulestand") return Response.json([{ team: "Bezoekers 1" }]);
        if (url.pathname === "/pouleuitslagen" && url.searchParams.get("eigenwedstrijden") === "NEE") {
          const pool = url.searchParams.get("poulecode")!;
          return Response.json([
            { wedstrijdcode: Number(pool), wedstrijddatum: "2026-09-05", thuisteam: "Bezoekers 1", thuisteamid: Number(pool), uitteam: "Bezoekers 2", uitslag: pool === "701" ? "1-0" : "0-1" },
            { wedstrijdcode: 999, wedstrijddatum: "2026-09-12", poulecode: 999, thuisteam: "Bezoekers 1", thuisteamid: 999, uitteam: "Bezoekers 2", uitslag: "1-1" }
          ]);
        }
        return Response.json([]);
      });
      const batch = await fetchSportlinkDataset("competitions", client(fetchImpl as typeof fetch), job);
      expect(batch.standings.map((standing) => standing.rows[0]?.form)).toEqual([["win"], ["loss"]]);
    });
  });

  it("verzamelt beide wedstrijdlogo's voor een immutable snapshot", () => {
    const candidates = collectSportlinkMatchLogoCandidates([{
      awayTeam: {
        externalId: "away",
        logoUrl: "https://provider.test/away.png",
        name: "Uit",
        score: null
      },
      cancellationReason: null,
      competition: null,
      dressingRooms: { away: null, home: null, official: null },
      externalId: "fixture",
      homeTeam: {
        externalId: "home",
        logoUrl: "https://provider.test/home.png",
        name: "Thuis",
        score: null
      },
      isHomeMatch: false,
      officials: [],
      pool: null,
      startsAt: "2026-09-02T18:00:00.000Z",
      status: "scheduled",
      venue: { city: null, field: null, name: null, routeUrl: null }
    }]);
    expect([...candidates]).toEqual([
      ["https://provider.test/home.png", { externalId: "home", teamName: "Thuis" }],
      ["https://provider.test/away.png", { externalId: "away", teamName: "Uit" }]
    ]);
  });

  it("uses both provider team identifiers for birthday enrichment", async () => {
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(input instanceof Request ? input.url : input);
      if (url.pathname === "/teams") {
        return new Response(JSON.stringify([{
          lokaleteamcode: -1,
          teamcode: 123456,
          teamnaam: "Duindorp 1"
        }]), { headers: { "content-type": "application/json" } });
      }
      if (url.pathname === "/team-indeling") {
        expect(url.searchParams.get("teamcode")).toBe("123456");
        expect(url.searchParams.get("lokaleteamcode")).toBe("-1");
        expect(url.searchParams.get("toonlidfoto")).toBe("JA");
        return new Response("[]", {
          headers: { "content-type": "application/json" }
        });
      }
      if (url.pathname === "/verjaardagen") {
        return new Response("[]", {
          headers: { "content-type": "application/json" }
        });
      }
      return new Response("not found", { status: 404 });
    });

    await expect(fetchSportlinkDataset(
      "public_people",
      new SportlinkClient("client-id", {
        fetchImpl: fetchImpl as typeof fetch,
        maxAttempts: 1
      }),
      {
        connectionId: "20000000-0000-4000-8000-000000000001",
        dataSourceId: "30000000-0000-4000-8000-000000000001",
        datasetGroup: "public_people",
        encryptedClientId: "ciphertext",
        encryptionIv: "initialization",
        encryptionTag: "authentication",
        runId: "40000000-0000-4000-8000-000000000001",
        tenantId: "10000000-0000-4000-8000-000000000001",
        timezone: "Europe/Amsterdam"
      }
    )).resolves.toMatchObject({
      birthdays: [],
      teamMembers: []
    });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it("normalizes abbreviated provider birthday dates", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-30T12:00:00.000Z"));
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(input instanceof Request ? input.url : input);
      if (url.pathname === "/verjaardagen") {
        return new Response(JSON.stringify([{
          verjaardag: "30 aug",
          volledigenaam: "Testpersoon"
        }]), { headers: { "content-type": "application/json" } });
      }
      if (url.pathname === "/teams") {
        return new Response("[]", {
          headers: { "content-type": "application/json" }
        });
      }
      return new Response("not found", { status: 404 });
    });

    await expect(fetchSportlinkDataset(
      "public_people",
      new SportlinkClient("client-id", {
        fetchImpl: fetchImpl as typeof fetch,
        maxAttempts: 1
      }),
      {
        connectionId: "20000000-0000-4000-8000-000000000001",
        dataSourceId: "30000000-0000-4000-8000-000000000001",
        datasetGroup: "public_people",
        encryptedClientId: "ciphertext",
        encryptionIv: "initialization",
        encryptionTag: "authentication",
        runId: "40000000-0000-4000-8000-000000000001",
        tenantId: "10000000-0000-4000-8000-000000000001",
        timezone: "Europe/Amsterdam"
      }
    )).resolves.toMatchObject({
      birthdays: [{ day: 30, displayName: "Testpersoon", month: 8 }]
    });
  });

  it("fails closed when provider birthdays cannot be normalized", async () => {
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(input instanceof Request ? input.url : input);
      if (url.pathname === "/verjaardagen") {
        return new Response(JSON.stringify([{
          verjaardag: "30 onbekend",
          volledigenaam: "Testpersoon"
        }]), { headers: { "content-type": "application/json" } });
      }
      if (url.pathname === "/teams") {
        return new Response("[]", {
          headers: { "content-type": "application/json" }
        });
      }
      return new Response("not found", { status: 404 });
    });
    const job = {
      connectionId: "20000000-0000-4000-8000-000000000001",
      dataSourceId: "30000000-0000-4000-8000-000000000001",
      datasetGroup: "public_people",
      encryptedClientId: "ciphertext",
      encryptionIv: "initialization",
      encryptionTag: "authentication",
      runId: "40000000-0000-4000-8000-000000000001",
      tenantId: "10000000-0000-4000-8000-000000000001",
      timezone: "Europe/Amsterdam"
    };
    const complete = vi.fn().mockResolvedValue(0);
    const fail = vi.fn().mockResolvedValue(undefined);
    const client = new SportlinkClient("client-id", {
      fetchImpl: fetchImpl as typeof fetch,
      maxAttempts: 1
    });

    await expect(runSportlinkSyncOnce({
      backend: {
        claim: vi.fn().mockResolvedValue(job),
        complete,
        fail,
        renew: vi.fn().mockResolvedValue(true)
      },
      encryptionKey: "x".repeat(32),
      executeDataset: () => fetchSportlinkDataset("public_people", client, job),
      lockTimeoutSeconds: 900,
      workerId: "worker:sportlink"
    })).resolves.toEqual({
      datasetGroup: "public_people",
      errorCode: "SPORTLINK_BIRTHDAY_NORMALIZATION_EMPTY",
      runId: job.runId,
      status: "failed"
    });
    expect(complete).not.toHaveBeenCalled();
    expect(fail).toHaveBeenCalledWith(
      job,
      "worker:sportlink",
      "SPORTLINK_BIRTHDAY_NORMALIZATION_EMPTY",
      expect.stringContaining("bestaande verjaardagen blijven behouden")
    );
  });

  it.each([
    ["explicit empty", []],
    ["empty wrapper", { records: [] }],
    ["valid outside window", [{ verjaardag: "20 nov", volledigenaam: "Fixture" }]],
    ["valid expired provider cache", [{ verjaardag: "10 okt", volledigenaam: "Fixture" }]],
    ["mixed valid outside window and invalid", [
      { verjaardag: "20 nov", volledigenaam: "Fixture" },
      { verjaardag: "42 okt", volledigenaam: "Invalid fixture" }
    ]]
  ])("completes a safe empty birthday selection for %s", async (_label, payload) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-11T10:00:00.000Z"));
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(input instanceof Request ? input.url : input);
      return new Response(JSON.stringify(url.pathname === "/verjaardagen" ? payload : []), {
        headers: { "content-type": "application/json" }
      });
    });
    const job = {
      connectionId: "connection", dataSourceId: "source", datasetGroup: "public_people",
      encryptedClientId: "unused", encryptionIv: "unused", encryptionTag: "unused",
      runId: "run", tenantId: "tenant", timezone: "Europe/Amsterdam"
    };
    const complete = vi.fn().mockResolvedValue(0);
    const fail = vi.fn();
    const client = new SportlinkClient("test-client", { fetchImpl, maxAttempts: 1 });
    await expect(runSportlinkSyncOnce({
      backend: {
        claim: vi.fn().mockResolvedValue(job), complete, fail,
        renew: vi.fn().mockResolvedValue(true)
      },
      encryptionKey: "x".repeat(32),
      executeDataset: () => fetchSportlinkDataset("public_people", client, job),
      lockTimeoutSeconds: 900,
      workerId: "worker:sportlink"
    })).resolves.toMatchObject({ status: "completed", readCount: 0 });
    expect(complete).toHaveBeenCalledWith(job, "worker:sportlink", expect.objectContaining({
      birthdays: [], birthdayFetchedAt: "2026-10-11T10:00:00.000Z"
    }));
    expect(fail).not.toHaveBeenCalled();
  });

  it.each([
    ["unknown object", {}],
    ["unrecognized null", null],
    ["invalid entries", ["unknown"]],
    ["completely invalid dates", [{ verjaardag: "42 okt", volledigenaam: "Fixture" }]]
  ])("preserves last-known-good birthdays for %s", async (_label, payload) => {
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(input instanceof Request ? input.url : input);
      return new Response(JSON.stringify(url.pathname === "/verjaardagen" ? payload : []), {
        headers: { "content-type": "application/json" }
      });
    });
    const client = new SportlinkClient("test-client", { fetchImpl, maxAttempts: 1 });
    const job = {
      connectionId: "connection", dataSourceId: "source", datasetGroup: "public_people",
      encryptedClientId: "unused", encryptionIv: "unused", encryptionTag: "unused",
      runId: "run", tenantId: "tenant", timezone: "Europe/Amsterdam"
    };
    const complete = vi.fn();
    const fail = vi.fn().mockResolvedValue(undefined);
    await expect(runSportlinkSyncOnce({
      backend: {
        claim: vi.fn().mockResolvedValue(job), complete, fail,
        renew: vi.fn().mockResolvedValue(true)
      },
      encryptionKey: "x".repeat(32),
      executeDataset: () => fetchSportlinkDataset("public_people", client, job),
      lockTimeoutSeconds: 900,
      workerId: "worker:sportlink"
    })).resolves.toMatchObject({
      status: "failed", errorCode: "SPORTLINK_BIRTHDAY_NORMALIZATION_EMPTY"
    });
    expect(complete).not.toHaveBeenCalled();
    expect(fail).toHaveBeenCalledWith(job, "worker:sportlink",
      "SPORTLINK_BIRTHDAY_NORMALIZATION_EMPTY", expect.stringContaining("bestaande verjaardagen"));
  });

  it("derives bounded club pools without an incomplete team-pool request", () => {
    expect(collectSportlinkPoolIds(
      [
        { poulecode: 90, teamcode: 10, teamnaam: "Club 1" },
        { poulecode: null, teamcode: 11, teamnaam: "Club 2" },
        { poulecode: 90, teamcode: 12, teamnaam: "Club 3" }
      ],
      [
        { poulecode: 91, teamcode: 11 },
        { poulecode: 92, teamcode: 999 }
      ]
    )).toEqual(["90", "91"]);
  });

  it("matches pool rows through a positive local team code", () => {
    expect(collectSportlinkPoolIds(
      [{ lokaleteamcode: 44, teamcode: -1, teamnaam: "Club 4" }],
      [
        { lokaleteamcode: -1, poulecode: 93, teamcode: -1 },
        { lokaleteamcode: 44, poulecode: 94, teamcode: -1 }
      ]
    )).toEqual(["94"]);
  });

  it("includes all 32 club pools, including youth teams beyond the former limit", () => {
    const teams = Array.from({ length: 32 }, (_, index) => ({
      teamcode: index + 1, teamnaam: `Vereniging team ${index + 1}`
    }));
    const pools = teams.map((team, index) => ({ ...team, poulecode: index + 100 }));
    const result = collectSportlinkPoolIds(teams, [
      ...pools, ...pools, { teamcode: 999, poulecode: 999 }
    ]);
    expect(result).toHaveLength(32);
    expect(result.slice(24)).toEqual(["124", "125", "126", "127", "128", "129", "130", "131"]);
  });

  it("fails explicitly instead of silently publishing an incomplete catalogue", () => {
    const teams = Array.from({ length: 129 }, (_, index) => ({
      teamcode: index + 1, poulecode: index + 100
    }));
    expect(() => collectSportlinkPoolIds(teams, [])).toThrow(
      expect.objectContaining({ code: "SPORTLINK_POOL_LIMIT_EXCEEDED" })
    );
    expect(() => collectSportlinkPoolIds(teams.slice(0, 3), [], 2)).toThrow(
      expect.objectContaining({ code: "SPORTLINK_POOL_LIMIT_EXCEEDED" })
    );
  });

  it("resolves cup and league by exact fixture phase rather than catalogue order", () => {
    const teams = [{ teamcode: 10, teamnaam: "Vereniging 1" }];
    const pools = [
      { teamcode: 10, poulecode: 701, poule: "A", fase: "Beker" },
      { teamcode: 10, poulecode: 702, poule: "B", fase: "Competitie" }
    ];
    const matches = mapSportlinkMatches([{
      wedstrijdcode: 11, thuisteamid: 10, thuisteam: "Vereniging 1",
      uitteamid: 20, uitteam: "Bezoekers", wedstrijddatum: "2026-09-12",
      aanvangstijd: "14:00", fase: "Beker"
    }]);
    for (const catalogue of [pools, [...pools].reverse()]) {
      expect(enrichSportlinkOwnMatchesWithPoolContexts(matches, teams, catalogue)[0])
        .toMatchObject({ pool: { externalId: "701" } });
    }
    const withoutPhase = matches.map((match) => ({ ...match, competition: null }));
    expect(enrichSportlinkOwnMatchesWithPoolContexts(withoutPhase, teams, pools)[0]?.pool).toBeNull();
  });

  it("preserves authoritative pool rows when an own fixture has only a derived ambiguous pool", () => {
    const teams = [{ teamcode: 10, teamnaam: "Vereniging 1" }];
    const pools = [
      { teamcode: 10, poulecode: 701, poule: "A" },
      { teamcode: 10, poulecode: 702, poule: "B" }
    ];
    const matches = mapSportlinkMatches([{
      wedstrijdcode: 11, thuisteamid: 10, thuisteam: "Vereniging 1",
      uitteamid: 20, uitteam: "Bezoekers", wedstrijddatum: "2026-09-12",
      aanvangstijd: "14:00", poule: "Fixture label"
    }]);
    const context = collectSportlinkPoolContexts(teams, pools)[0]!;
    const authoritative = enrichSportlinkPoolMatches(matches, context);
    const own = enrichSportlinkOwnMatchesWithPoolContexts(matches, teams, pools);
    expect(own[0]?.pool).toBeNull();
    expect(dedupeSportlinkMatches([...authoritative, ...own])[0]?.pool).toMatchObject({
      externalId: "701", competitionExternalId: context.competition?.externalId
    });
    const explicit = matches.map((match) => ({
      ...match, pool: { externalId: "701", name: "A", competitionExternalId: "fixture-hash" }
    }));
    expect(enrichSportlinkOwnMatchesWithPoolContexts(explicit, teams, pools)[0]?.pool)
      .toMatchObject({ competitionExternalId: context.competition?.externalId });
  });

  it("keeps competition and season with every standings context", () => {
    expect(collectSportlinkPoolContexts(
      [{
        competitie: "Vierde klasse",
        poule: "4C",
        poulecode: 701,
        seizoen: "2026/2027",
        teamcode: 10
      }],
      []
    )).toEqual([{
      competition: expect.objectContaining({
        name: "Vierde klasse",
        season: "2026/2027"
      }),
      poolExternalId: "701",
      poolName: "4C"
    }]);
  });

  it("marks every pool fixture with the requested pool context", () => {
    const context = collectSportlinkPoolContexts([{
      competitie: "Vierde klasse", poule: "4C", poulecode: 701, teamcode: 10,
      fase: "Beker", seizoen: "2026/2027"
    }], [])[0]!;
    const match = {
      awayTeam: { externalId: "away", logoUrl: null, name: "Uit", score: null },
      cancellationReason: null, competition: null,
      dressingRooms: { away: null, home: null, official: null }, externalId: "match-1",
      homeTeam: { externalId: "home", logoUrl: null, name: "Thuis", score: null },
      isHomeMatch: false, officials: [], pool: null,
      startsAt: "2026-08-23T12:00:00.000Z", status: "scheduled" as const,
      venue: { city: null, field: null, name: null, routeUrl: null }
    };
    expect(enrichSportlinkPoolMatches([match], context)[0]).toMatchObject({
      pool: { externalId: "701", name: "4C" },
      competition: { name: "Vierde klasse" }
    });
    expect(enrichSportlinkPoolMatches([{
      ...match,
      competition: { externalId: "fixture-label", name: "Fixture label", period: null, season: null, type: null }
    }], context)[0]?.competition).toMatchObject({
      name: "Fixture label", period: "Beker", season: "2026/2027"
    });
  });

  it("combines home, away and other pool fixtures without losing pool metadata", async () => {
    const poolRequests: string[] = [];
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(input instanceof Request ? input.url : input);
      if (url.pathname === "/teams") {
        return Response.json([{
          competitie: "Vierde klasse",
          poule: "4C",
          poulecode: 701,
          teamcode: 10,
          teamnaam: "Duindorp 1"
        }]);
      }
      if (url.pathname === "/uitslagen") {
        return Response.json([{
          aanvangstijd: "14:30",
          thuisteam: "Duindorp 1",
          thuisteamid: 10,
          uitteam: "Vereniging Uit 1",
          uitslag: "2-1",
          wedstrijddatum: "2026-08-29",
          wedstrijdcode: 7002
        }]);
      }
      if (url.pathname === "/programma") {
        return Response.json([{
          aanvangstijd: "14:30",
          teamvolgorde: "thuis",
          thuisteam: "Duindorp 1",
          thuisteamid: 10,
          uitteam: "Bezoekers 1",
          uitteamid: 30,
          veld: "Veld 1",
          wedstrijddatum: "2026-09-06",
          wedstrijdcode: 7004
        }]);
      }
      if (url.pathname === "/poule-programma" || url.pathname === "/pouleuitslagen") {
        poolRequests.push(`${url.pathname}:${url.searchParams.get("eigenwedstrijden")}`);
        expect(url.searchParams.get("aantaldagen")).toBe("14");
        const own = url.searchParams.get("eigenwedstrijden") === "JA";
        if (url.pathname === "/poule-programma") {
          return Response.json([own ? {
            aanvangstijd: "12:00",
            teamvolgorde: "uit",
            thuisteam: "Pouleclub 3",
            thuisteamid: 40,
            uitteam: "Duindorp 1",
            uitteamid: 10,
            wedstrijddatum: "2026-09-07",
            wedstrijdcode: 7003
          } : {
            aanvangstijd: "14:30",
            thuisteam: "Pouleclub 1",
            thuisteamid: 20,
            uitteam: "Pouleclub 2",
            uitteamid: 21,
            wedstrijddatum: "2026-09-06",
            wedstrijdcode: 7001
          }]);
        }
        return Response.json([own ? {
          aanvangstijd: "14:30",
          teamvolgorde: "thuis",
          thuisteam: "Duindorp 1",
          thuisteamid: 10,
          uitteam: "Vereniging Uit 1",
          uitteamid: 50,
          uitslag: "2-1",
          wedstrijddatum: "2026-08-29",
          wedstrijdcode: 7002
        } : {
          aanvangstijd: "11:00",
          thuisteam: "Pouleclub 5",
          uitteam: "Pouleclub 6",
          uitslag: "1-1",
          wedstrijddatum: "2026-08-30",
          wedstrijdcode: 7005
        }]);
      }
      return Response.json([]);
    });

    const batch = await fetchSportlinkDataset(
      "matches",
      new SportlinkClient("client-id", {
        fetchImpl: fetchImpl as typeof fetch,
        maxAttempts: 1
      }),
      {
        connectionId: "20000000-0000-4000-8000-000000000001",
        dataSourceId: "30000000-0000-4000-8000-000000000001",
        datasetGroup: "matches",
        encryptedClientId: "ciphertext",
        encryptionIv: "initialization",
        encryptionTag: "authentication",
        runId: "40000000-0000-4000-8000-000000000001",
        tenantId: "10000000-0000-4000-8000-000000000001",
        timezone: "Europe/Amsterdam"
      }
    );

    expect(poolRequests).toEqual([
      "/poule-programma:NEE",
      "/poule-programma:JA",
      "/pouleuitslagen:NEE",
      "/pouleuitslagen:JA"
    ]);
    expect(batch.matches).toEqual(expect.arrayContaining([
      expect.objectContaining({
        externalId: "7001",
        pool: expect.objectContaining({ externalId: "701" }),
        status: "scheduled"
      }),
      expect.objectContaining({
        externalId: "7002",
        homeTeam: expect.objectContaining({ score: 2 }),
        isHomeMatch: true,
        pool: expect.objectContaining({ externalId: "701" }),
        status: "finished"
      }),
      expect.objectContaining({
        externalId: "7003",
        isHomeMatch: false,
        pool: expect.objectContaining({ externalId: "701" })
      }),
      expect.objectContaining({
        externalId: "7004",
        isHomeMatch: true,
        pool: expect.objectContaining({ externalId: "701" })
      }),
      expect.objectContaining({
        externalId: "7005",
        pool: expect.objectContaining({ externalId: "701" }),
        status: "finished"
      })
    ]));
    expect(batch.matches.filter((match) => match.externalId === "7002"))
      .toHaveLength(1);
  });

  it("claims a command once and reports missing encryption configuration safely", async () => {
    const rpc = vi.fn()
      .mockResolvedValueOnce({
        data: [{
          connection_id: "20000000-0000-4000-8000-000000000001",
          data_source_id: "30000000-0000-4000-8000-000000000001",
          dataset_group: "matches",
          encrypted_client_id: "ciphertext",
          encryption_iv: "initialization",
          encryption_tag: "authentication",
          run_id: "40000000-0000-4000-8000-000000000001",
          tenant_id: "10000000-0000-4000-8000-000000000001",
          timezone: "Europe/Amsterdam"
        }],
        error: null
      })
      .mockResolvedValueOnce({ data: null, error: null });
    const backend = new SupabaseSportlinkSyncBackend(
      "https://project.supabase.co",
      "service-secret",
      { rpc }
    );

    await expect(runSportlinkSyncOnce({
      backend,
      encryptionKey: null,
      lockTimeoutSeconds: 900,
      workerId: "worker:sportlink"
    })).resolves.toEqual({
      datasetGroup: "matches",
      errorCode: "SPORTLINK_CONFIGURATION_UNAVAILABLE",
      runId: "40000000-0000-4000-8000-000000000001",
      status: "failed"
    });

    expect(rpc).toHaveBeenNthCalledWith(1, "claim_due_sportlink_sync_v2", {
      p_lock_timeout_seconds: 900,
      p_worker_id: "worker:sportlink"
    });
    expect(rpc).toHaveBeenNthCalledWith(2, "fail_sportlink_sync_v1", {
      p_error_code: "SPORTLINK_CONFIGURATION_UNAVAILABLE",
      p_error_detail: "De serverconfiguratie voor Sportlink-synchronisatie ontbreekt.",
      p_run_id: "40000000-0000-4000-8000-000000000001",
      p_worker_id: "worker:sportlink"
    });
  });

  it("does not execute anything when no dataset is due", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [], error: null });
    const backend = new SupabaseSportlinkSyncBackend(
      "https://project.supabase.co",
      "service-secret",
      { rpc }
    );

    await expect(runSportlinkSyncOnce({
      backend,
      encryptionKey: "x".repeat(32),
      lockTimeoutSeconds: 900,
      workerId: "worker:sportlink"
    })).resolves.toEqual({ status: "idle" });
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("returns a safe retryable failure when the claim RPC is unavailable", async () => {
    const claim = vi.fn().mockRejectedValue(new Error("private provider URL and token"));
    const fail = vi.fn();
    await expect(runSportlinkSyncOnce({
      backend: { claim, complete: vi.fn(), fail, renew: vi.fn() },
      encryptionKey: "x".repeat(32), lockTimeoutSeconds: 900, workerId: "worker:test"
    })).resolves.toEqual({ status: "failed", errorCode: "SPORTLINK_SYNC_CLAIM_FAILED" });
    expect(fail).not.toHaveBeenCalled();
  });

  it("aborts an unresponsive Supabase claim at the transport deadline", async () => {
    let requestSignal: AbortSignal | null | undefined;
    const fetchMock = vi.fn((_input: unknown, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      requestSignal = init?.signal;
      requestSignal?.addEventListener("abort", () => reject(new DOMException("Request timed out", "AbortError")), { once: true });
    }));
    vi.stubGlobal("fetch", fetchMock);
    const backend = new SupabaseSportlinkSyncBackend("https://supabase.test", "test-only", undefined, 10);
    await expect(runSportlinkSyncOnce({
      backend, encryptionKey: "x".repeat(32), lockTimeoutSeconds: 900, workerId: "worker:test"
    })).resolves.toEqual({ status: "failed", errorCode: "SPORTLINK_SYNC_CLAIM_FAILED" });
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(requestSignal?.aborted).toBe(true);
  });

  it("recovers from claim outages with bounded backoff and an immediate abort", async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const claim = vi.fn().mockRejectedValue(new Error("database timeout"));
    const onResult = vi.fn();
    const execution = runSportlinkSyncLoop({
      backend: { claim, complete: vi.fn(), fail: vi.fn(), renew: vi.fn() },
      encryptionKey: "x".repeat(32), intervalMs: 15_000,
      lockTimeoutSeconds: 900, onResult, signal: controller.signal, workerId: "worker:test"
    });
    await vi.advanceTimersByTimeAsync(0);
    expect(claim).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(14_999);
    expect(claim).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(claim).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(29_999);
    expect(claim).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(claim).toHaveBeenCalledTimes(3);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(claim).toHaveBeenCalledTimes(4);
    claim.mockResolvedValue(null);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(claim).toHaveBeenCalledTimes(5);
    expect(onResult).toHaveBeenLastCalledWith({ status: "idle" });
    controller.abort();
    await expect(execution).resolves.toBeUndefined();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("continues dispatching when recording a dataset failure is unavailable", async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const job = {
      connectionId: "connection", dataSourceId: "source", datasetGroup: "matches",
      encryptedClientId: "unused", encryptionIv: "unused", encryptionTag: "unused",
      runId: "run", tenantId: "tenant", timezone: "Europe/Amsterdam"
    };
    const claim = vi.fn().mockResolvedValueOnce(job).mockResolvedValue(null);
    const fail = vi.fn().mockRejectedValue(new Error("database unavailable during failure recording"));
    const onResult = vi.fn((result: { status: string }) => {
      if (result.status === "idle") controller.abort();
    });
    const execution = runSportlinkSyncLoop({
      backend: { claim, complete: vi.fn(), fail, renew: vi.fn() },
      encryptionKey: null, intervalMs: 1_000, lockTimeoutSeconds: 900,
      onResult, signal: controller.signal, workerId: "worker:test"
    });
    await vi.advanceTimersByTimeAsync(0);
    expect(fail).toHaveBeenCalledOnce();
    expect(onResult).toHaveBeenCalledWith(expect.objectContaining({
      status: "failed", errorCode: "SPORTLINK_CONFIGURATION_UNAVAILABLE", runId: job.runId
    }));
    expect(claim).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(1_000);
    await expect(execution).resolves.toBeUndefined();
    expect(claim).toHaveBeenCalledTimes(2);
    expect(onResult).toHaveBeenLastCalledWith({ status: "idle" });
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([
    ["23505", "SPORTLINK_SYNC_COMPLETE_23505"],
    ["57014", "SPORTLINK_SYNC_COMPLETE_57014"],
    ["unexpected\nprivate details", "SPORTLINK_SYNC_COMPLETE_INVALID_RESULT"]
  ])("retains a bounded completion diagnostic for %s without raw errors", async (code, expectedCode) => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { code } });
    const backend = new SupabaseSportlinkSyncBackend("https://project.supabase.co", "test-only", { rpc });
    await expect(backend.complete({
      connectionId: "connection", dataSourceId: "source", datasetGroup: "competitions",
      encryptedClientId: "unused", encryptionIv: "unused", encryptionTag: "unused",
      runId: "run", tenantId: "tenant", timezone: "Europe/Amsterdam"
    }, "worker:test", {
      activities: [], birthdayFetchedAt: null, birthdays: [], club: null, clubLogo: null,
      matches: [], personPhotos: [], standings: [], teamMembers: [], teamLogos: [], teams: []
    })).rejects.toMatchObject({
      code: expectedCode,
      message: "Sportlink-gegevens zijn opgehaald maar konden niet worden verwerkt. De bestaande gegevens blijven behouden; controleer de synchronisatiediagnose."
    });
  });

  it("uploads an official club logo locally before completing the provider run", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { readCount: 1 },
      error: null
    });
    const upload = vi.fn().mockResolvedValue({ error: null });
    const from = vi.fn(() => ({ upload }));
    const backend = new SupabaseSportlinkSyncBackend(
      "https://project.supabase.co",
      "service-secret",
      { rpc, storage: { from } }
    );
    const bytes = new Uint8Array([1, 2, 3]);

    await expect(backend.complete({
      connectionId: "20000000-0000-4000-8000-000000000001",
      dataSourceId: "30000000-0000-4000-8000-000000000001",
      datasetGroup: "club_profile",
      encryptedClientId: "ciphertext",
      encryptionIv: "initialization",
      encryptionTag: "authentication",
      runId: "40000000-0000-4000-8000-000000000001",
      tenantId: "10000000-0000-4000-8000-000000000001",
      timezone: "Europe/Amsterdam"
    }, "worker:sportlink", {
      activities: [],
      birthdayFetchedAt: null,
      birthdays: [],
      club: {
        city: "Den Haag",
        clubCode: "DUIN",
        colors: { primary: null, secondary: null, text: null },
        externalId: "club-1",
        foundedOn: null,
        information: null,
        logoUrl: null,
        name: "Duindorp sv",
        websiteUrl: null
      },
      clubLogo: {
        assetId: "50000000-0000-5000-8000-000000000001",
        bytes,
        checksumSha256: "a".repeat(64),
        externalId: "club-1",
        fileSizeBytes: 3,
        height: 100,
        mimeType: "image/webp",
        role: "club_logo",
        storagePath: `providers/sportlink/club_logo/${"a".repeat(64)}.webp`,
        title: "Duindorp sv clublogo",
        width: 100
      },
      matches: [],
      personPhotos: [],
      standings: [],
      teamMembers: [],
      teamLogos: [],
      teams: []
    })).resolves.toBe(1);

    expect(from).toHaveBeenCalledWith("provider-assets");
    expect(upload).toHaveBeenCalledWith(
      `providers/sportlink/club_logo/${"a".repeat(64)}.webp`,
      bytes,
      {
        cacheControl: "31536000",
        contentType: "image/webp",
        upsert: true
      }
    );
    expect(rpc).toHaveBeenCalledWith("complete_sportlink_sync_v4", expect.objectContaining({
      p_club_logo: expect.objectContaining({
        assetId: "50000000-0000-5000-8000-000000000001",
        role: "club_logo"
      }),
      p_run_id: "40000000-0000-4000-8000-000000000001"
    }));
  });

  it("completes birthdays through the minimized birthday RPC without credentials", async () => {
    const rpc = vi.fn()
      .mockResolvedValueOnce({ data: { readCount: 2 }, error: null })
      .mockResolvedValueOnce({ data: null, error: null });
    const backend = new SupabaseSportlinkSyncBackend(
      "https://project.supabase.co", "service-secret", { rpc }
    );
    const fetchedAt = "2026-08-28T12:00:00.000Z";
    await expect(backend.complete({
      connectionId: "20000000-0000-4000-8000-000000000001",
      dataSourceId: "30000000-0000-4000-8000-000000000001",
      datasetGroup: "public_people", encryptedClientId: "ciphertext",
      encryptionIv: "initialization", encryptionTag: "authentication",
      runId: "40000000-0000-4000-8000-000000000001",
      tenantId: "10000000-0000-4000-8000-000000000001",
      timezone: "Europe/Amsterdam"
    }, "worker:sportlink", {
      activities: [], birthdayFetchedAt: fetchedAt,
      birthdays: [{
        day: 29, displayName: "Testpersoon", externalId: "b".repeat(40),
        matchStatus: "unmatched", memberIdentityKey: null, month: 8,
        nextOccurrence: "2026-08-29", normalizedName: "testpersoon",
        role: null, teamAssignments: []
      }], club: null, clubLogo: null, matches: [], personPhotos: [],
      standings: [], teamLogos: [], teamMembers: [], teams: []
    })).resolves.toBe(2);
    expect(rpc).toHaveBeenNthCalledWith(1, "complete_sportlink_birthdays_v1", {
      p_birthdays: [expect.objectContaining({ externalId: "b".repeat(40) })],
      p_fetched_at: fetchedAt, p_person_photos: [],
      p_run_id: "40000000-0000-4000-8000-000000000001",
      p_team_members: [], p_worker_id: "worker:sportlink"
    });
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("keeps successful ingest successful without a fallible post-commit render RPC", async () => {
    const rpc = vi.fn(async (name: string) => {
      if (name === "refresh_sportlink_time_sensitive_slides_v1") {
        throw new Error("obsolete refresh timed out after ingest committed");
      }
      return { data: { readCount: 0 }, error: null };
    });
    const backend = new SupabaseSportlinkSyncBackend("https://project.supabase.co", "test-only", { rpc });
    await expect(backend.complete({
      connectionId: "connection", dataSourceId: "source", datasetGroup: "matches",
      encryptedClientId: "unused", encryptionIv: "unused", encryptionTag: "unused",
      runId: "run", tenantId: "tenant", timezone: "Europe/Amsterdam"
    }, "worker:test", {
      activities: [], birthdayFetchedAt: null, birthdays: [], club: null, clubLogo: null,
      matches: [], personPhotos: [], standings: [], teamMembers: [], teamLogos: [], teams: []
    })).resolves.toBe(0);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("complete_sportlink_sync_v4", expect.any(Object));
  });

  it("renews the lease while a provider dataset is still being fetched", async () => {
    vi.useFakeTimers();
    let finishDataset: ((value: {
      activities: [];
      birthdayFetchedAt: null;
      birthdays: [];
      club: null;
      clubLogo: null;
      matches: [];
      personPhotos: [];
      standings: [];
      teamMembers: [];
      teamLogos: [];
      teams: [];
    }) => void) | undefined;
    const rpc = vi.fn(async (functionName: string) => {
      if (functionName === "claim_due_sportlink_sync_v2") {
        return {
          data: [{
            connection_id: "20000000-0000-4000-8000-000000000001",
            data_source_id: "30000000-0000-4000-8000-000000000001",
            dataset_group: "competitions",
            encrypted_client_id: "ciphertext",
            encryption_iv: "initialization",
            encryption_tag: "authentication",
            run_id: "40000000-0000-4000-8000-000000000001",
            tenant_id: "10000000-0000-4000-8000-000000000001",
            timezone: "Europe/Amsterdam"
          }],
          error: null
        };
      }
      if (functionName === "renew_sportlink_sync_lease_v1") {
        return { data: true, error: null };
      }
      if (functionName === "complete_sportlink_sync_v4") {
        return { data: { readCount: 0 }, error: null };
      }
      return { data: null, error: null };
    });
    const backend = new SupabaseSportlinkSyncBackend(
      "https://project.supabase.co",
      "service-secret",
      { rpc }
    );
    const execution = runSportlinkSyncOnce({
      backend,
      encryptionKey: "x".repeat(32),
      executeDataset: () => new Promise((resolve) => {
        finishDataset = resolve;
      }),
      lockTimeoutSeconds: 900,
      workerId: "worker:sportlink"
    });

    await vi.waitFor(() => expect(finishDataset).toBeTypeOf("function"));
    await vi.advanceTimersByTimeAsync(30_000);

    expect(rpc).toHaveBeenCalledWith("renew_sportlink_sync_lease_v1", {
      p_run_id: "40000000-0000-4000-8000-000000000001",
      p_worker_id: "worker:sportlink"
    });

    finishDataset?.({
      activities: [],
      birthdayFetchedAt: null,
      birthdays: [],
      club: null,
      clubLogo: null,
      matches: [],
      personPhotos: [],
      standings: [],
      teamMembers: [],
      teamLogos: [],
      teams: []
    });
    await expect(execution).resolves.toEqual({
      datasetGroup: "competitions",
      readCount: 0,
      runId: "40000000-0000-4000-8000-000000000001",
      status: "completed"
    });
  });
});
