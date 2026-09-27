import { describe, expect, it, vi } from "vitest";

import {
  SportlinkClient,
  mapSportlinkClub,
  mapSportlinkMatches,
  mapSportlinkStandings,
  mapSportlinkTeams,
  privacyFilterSportlinkPayload,
  redactSportlinkText,
  stableSportlinkExternalId
} from "../src/server";
import { parseSportlinkArguments } from "../src/sportlink-registry";

describe("Sportlink server-only adapter", () => {
  it("allowlists and bounds query parameters", () => {
    expect(parseSportlinkArguments("programma", {
      aantaldagen: 42, aantalregels: 100
    })).toMatchObject({ aantaldagen: 42 });
    expect(() => parseSportlinkArguments("programma", {
      aantaldagen: 999, willekeurig: "nee"
    })).toThrow();
    expect(parseSportlinkArguments("teampoulelijst", {
      lokaleteamcode: 8,
      teamcode: 4
    })).toEqual({
      lokaleteamcode: 8,
      teamcode: 4
    });
    expect(() => parseSportlinkArguments("teampoulelijst", {
      teamcode: 4
    })).toThrow();
    expect(parseSportlinkArguments("team-indeling", {
      lokaleteamcode: -1,
      teamcode: 4,
      toonlidfoto: "JA"
    })).toEqual({
      lokaleteamcode: -1,
      teamcode: 4,
      toonlidfoto: "JA"
    });
    expect(() => parseSportlinkArguments("team-indeling", {
      teamcode: 4,
      toonlidfoto: "JA"
    })).toThrow();
  });

  it("redacts credentials in URLs", () => {
    expect(redactSportlinkText(
      "https://data.sportlink.com/teams?client_id=geheim&aantaldagen=7"
    )).not.toContain("geheim");
  });

  it("maps stable club, team, match and standing contracts", () => {
    expect(mapSportlinkClub({ gegevens: {
      clubcode: 123, clubnaam: "Testclub", banknummer: "verboden"
    } })?.name).toBe("Testclub");
    expect(mapSportlinkTeams([{ teamcode: 4, teamnaam: "Testclub 1" }])).toHaveLength(1);
    expect(mapSportlinkMatches([{
      wedstrijdcode: 7, wedstrijddatum: "2026-07-28T19:30:00+02:00",
      thuisteam: "Testclub 1", uitteam: "Bezoekers", uitslag: "2 - 1"
    }], "results")[0]?.homeTeam.score).toBe(2);
    const standing = mapSportlinkStandings([{
      gelijk: 1,
      gewonnen: 2,
      verloren: 1,
      positie: 1,
      punten: 9,
      team: "Testclub 1",
      teamlogo: "https://cdn.sportlink.com/logo/testclub.png",
      vorm: "WGV"
    }], "pool-1");
    expect(standing.scoresPublished).toBe(true);
    expect(standing.rows[0]?.form).toEqual(["win", "draw", "loss"]);
    expect(standing.rows[0]?.played).toBe(4);
    expect(standing.rows[0]?.logoUrl).toBe(
      "https://cdn.sportlink.com/logo/testclub.png"
    );
    expect(stableSportlinkExternalId("test", "a")).toBe(
      stableSportlinkExternalId("test", "a")
    );
  });

  it("prefers Sportlink's explicit played total over the W/G/V fallback", () => {
    const standing = mapSportlinkStandings([{
      aantalgespeeld: 8,
      gelijk: 2,
      gewonnen: 3,
      verloren: 2,
      team: "Testclub 1"
    }], "pool-1");

    expect(standing.rows[0]?.played).toBe(8);
  });

  it("keeps the exact legacy standing identity when Sportlink omits teamcode", () => {
    const rows = mapSportlinkStandings([
      { team: "Senioren 1", positie: 1, punten: 6 },
      { team: "Jeugd O16-1", positie: 2, punten: 3 },
      { team: "Duindorp sv O16-1", positie: 3, punten: 0 },
      { team: "Senioren 1", teamcode: 218380, positie: 4, punten: 0 }
    ], "cup-pool").rows;
    // Shared contract with the SQL fallback, including UTF-8 and the NUL separator.
    expect(rows.map((row) => row.externalId)).toEqual([
      "e9b786e5abe910e340fe1403ff82217246ce41f76605c3e4f6b5d2b1a005e341",
      "bfcf35946c849398d5bbd4485d768631482dcbcf4fe5f94ae7b753365b79fc3c",
      "29dd51fa55ec9c180a73eaa693711a2f1b50671a9041948f268a96eeb033b337",
      "218380"
    ]);
  });

  it("links equal team names through their exact catalog pool and preserves explicit IDs", () => {
    const catalog = mapSportlinkTeams([
      { teamcode: 355471, teamnaam: "Duindorp sv 35+1", poulecode: 833025, competitienaam: "Veteranen beker zaterdag" },
      { teamcode: 394546, teamnaam: "Duindorp sv 35+1", poulecode: 836218, competitienaam: "Vrijdag 7x7" }
    ]);
    const payload = [{ team: "Duindorp sv 35+1", positie: 1, punten: 6 }, { team: "Opponent", positie: 2 }];
    const saturday = mapSportlinkStandings(payload, "833025", "21", null, null, catalog);
    const friday = mapSportlinkStandings(payload, "836218", "B08", null, null, catalog);
    expect(saturday.rows[0]?.externalId).toBe("355471");
    expect(friday.rows[0]?.externalId).toBe("394546");
    expect(saturday.rows[1]?.externalId).toBe(stableSportlinkExternalId("standing-team", "Opponent"));
    expect(mapSportlinkStandings([{ ...payload[0], teamcode: 999 }], "833025", "21", null, null, catalog).rows[0]?.externalId).toBe("999");
    // No catalog identity is retained across tenant/connection batches.
    expect(mapSportlinkStandings(payload, "833025").rows[0]?.externalId).toBe(stableSportlinkExternalId("standing-team", "Duindorp sv 35+1"));
  });

  it("keeps synthetic IDs when pool membership is ambiguous or incomplete", () => {
    const rawTeam = { teamcode: 1, teamnaam: "Club 35+1", poulecode: 100, competitienaam: "Zaterdag" };
    const payload = [{ team: "Club 35+1", positie: 1 }];
    const fallback = stableSportlinkExternalId("standing-team", "Club 35+1");
    for (const rawCatalog of [
      [rawTeam, { ...rawTeam, teamcode: 2 }],
      [rawTeam, { teamcode: 2, teamnaam: "Club 35+1" }],
      [{ ...rawTeam, poulecode: 200 }],
      [{ ...rawTeam, teamnaam: "club 35+1" }],
      [{ ...rawTeam, teamcode: -1 }]
    ]) {
      expect(mapSportlinkStandings(payload, "100", "1", null, null, mapSportlinkTeams(rawCatalog)).rows[0]?.externalId).toBe(fallback);
    }
  });

  it("merges one Sportlink team across competition, cup and phase rows", () => {
    const teams = mapSportlinkTeams([
      {
        klasse: "2e klasse",
        competitieperiode: "Fase 1",
        competitienaam: "Reguliere competitie",
        competitiesoort: "Competitie",
        poule: "Poule A",
        poulecode: 701,
        teamcode: 10,
        teamnaam: "Testclub 1"
      },
      {
        klasse: "Groep 3",
        competitienaam: "Districtsbeker",
        competitiesoort: "Beker",
        poule: "Poule B",
        poulecode: 702,
        teamcode: 10,
        teamnaam: "Testclub 1"
      }
    ]);

    expect(teams).toHaveLength(1);
    expect(teams[0]).toMatchObject({
      externalId: "10",
      name: "Testclub 1"
    });
    expect(teams[0]?.competitionOptions).toHaveLength(2);
    expect(teams[0]?.competitionOptions?.map((option) => option.type))
      .toEqual(["Competitie", "Beker"]);
  });

  it("keeps the season on team competition contexts", () => {
    expect(mapSportlinkTeams([{
      competitie: "Vierde klasse",
      poule: "4C",
      poulecode: 701,
      seizoen: "2026/2027",
      teamcode: 10,
      teamnaam: "Testclub 1"
    }])[0]?.competitionOptions?.[0]?.season).toBe("2026/2027");
  });

  it("normalizes competition type, phase and pool on matches", () => {
    const [match] = mapSportlinkMatches([{
      aanvangstijd: "14:30",
      competitie: "Districtsbeker",
      competitiesoort: "Beker",
      datum: "03-08-2026",
      klasse: "Groep 3",
      poule: "Poule B",
      thuisteam: "Testclub 1",
      thuisteamid: 10,
      uitteam: "Bezoekers",
      uitteamid: 20,
      wedstrijdcode: 72,
      wedstrijddatum: "2026-08-03T14:30:00+02:00"
    }]);

    expect(match?.competition).toMatchObject({
      name: "Districtsbeker",
      period: "Groep 3",
      type: "Beker"
    });
    expect(match?.pool?.name).toBe("Poule B");
    expect(match?.homeTeam.externalId).toBe("10");
  });

  it("derives home fixtures only from the explicit team order", () => {
    const matches = mapSportlinkMatches([
      {
        eigenteam: "JA",
        teamvolgorde: "UIT",
        thuisteam: "Andere vereniging 1",
        uitteam: "Testclub 1",
        wedstrijdcode: 73,
        wedstrijddatum: "2026-08-30T12:00:00+02:00"
      },
      {
        eigenteam: "JA",
        teamvolgorde: "thuis",
        thuisteam: "Testclub 2",
        uitteam: "Bezoekers FC",
        uitteamlogo: "https://cdn.sportlink.nl/logos/bezoekers-fc.png",
        wedstrijdcode: 74,
        wedstrijddatum: "2026-08-30T14:30:00+02:00"
      },
      {
        eigenteam: 1,
        thuisteam: "Testclub 3",
        uitteam: "Onbekende tegenstander",
        wedstrijdcode: 75,
        wedstrijddatum: "2026-08-30T16:30:00+02:00"
      }
    ]);

    expect(matches.map((match) => match.isHomeMatch)).toEqual([
      false,
      true,
      false
    ]);
    expect(matches[1]?.awayTeam.logoUrl).toBe(
      "https://cdn.sportlink.nl/logos/bezoekers-fc.png"
    );
  });

  it("normalizes Europe/Amsterdam wall-clock dates across daylight saving time", () => {
    const matches = mapSportlinkMatches([
      {
        uitteam: "Bezoekers",
        thuisteam: "Testclub 1",
        wedstrijdcode: 70,
        wedstrijddatum: "2026-07-28T19:30:00"
      },
      {
        uitteam: "Bezoekers",
        thuisteam: "Testclub 1",
        wedstrijdcode: 71,
        wedstrijddatum: "2026-12-28T19:30:00"
      }
    ]);
    expect(matches.map((match) => match.startsAt)).toEqual([
      "2026-07-28T17:30:00.000Z",
      "2026-12-28T18:30:00.000Z"
    ]);
  });

  it("removes contact, financial and embedded-logo fields recursively", () => {
    expect(privacyFilterSportlinkPayload({
      clubnaam: "Testclub", email: "verboden", banknummer: "verboden",
      logo: "base64", nested: { telefoonnummer: "verboden", veilig: "ja" }
    })).toEqual({ clubnaam: "Testclub", nested: { veilig: "ja" } });
  });

  it("accepts valid empty responses and maps stable provider errors", async () => {
    const emptyFetch = vi.fn(async () => new Response("[]", {
      headers: { "content-type": "application/json" }, status: 200
    }));
    const empty = await new SportlinkClient("test-client", {
      fetchImpl: emptyFetch, maxAttempts: 1
    }).fetchArticle("uitslagen");
    expect(empty.recordCount).toBe(0);

    const errorFetch = vi.fn(async () => new Response(JSON.stringify({
      error: { code: 4012, message: "kan wijzigen" }
    }), { headers: { "content-type": "application/json" }, status: 401 }));
    await expect(new SportlinkClient("test-client", {
      fetchImpl: errorFetch, maxAttempts: 1
    }).fetchArticle("teams")).rejects.toMatchObject({
      code: "SPORTLINK_CLIENT_ID_INVALID", retryable: false
    });
  });

  it("stops reading a streamed provider response at the payload limit", async () => {
    const oversizedFetch = vi.fn(async () => new Response(
      new Uint8Array(2_000_001),
      { headers: { "content-type": "application/json" }, status: 200 }
    ));
    await expect(new SportlinkClient("test-client", {
      fetchImpl: oversizedFetch,
      maxAttempts: 1
    }).fetchArticle("teams")).rejects.toMatchObject({
      code: "SPORTLINK_RESPONSE_TOO_LARGE",
      retryable: false
    });
  });
});
