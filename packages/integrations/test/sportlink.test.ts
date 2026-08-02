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
    expect(mapSportlinkStandings([{ positie: 1, team: "Testclub 1", punten: 9 }],
      "pool-1").scoresPublished).toBe(true);
    expect(stableSportlinkExternalId("test", "a")).toBe(
      stableSportlinkExternalId("test", "a")
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
