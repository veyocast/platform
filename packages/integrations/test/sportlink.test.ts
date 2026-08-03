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
      positie: 1,
      punten: 9,
      team: "Testclub 1",
      vorm: "WGV"
    }], "pool-1");
    expect(standing.scoresPublished).toBe(true);
    expect(standing.rows[0]?.form).toEqual(["win", "draw", "loss"]);
    expect(stableSportlinkExternalId("test", "a")).toBe(
      stableSportlinkExternalId("test", "a")
    );
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
