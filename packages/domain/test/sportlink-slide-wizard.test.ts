import { describe, expect, it } from "vitest";

import {
  buildSportlinkSlideDrafts,
  copySportlinkContextToTeam,
  paginateSportlinkArrivals,
  resolveSportlinkArrivalCards
} from "../src/sportlink-slide-wizard";

const templateVersionId = "00000000-0000-4000-8000-000000000001";
const themeSelection = {
  accent: null,
  categoryOverrides: [],
  modePolicy: { kind: "fixed" as const, mode: "light" as const },
  ref: { catalog: "v2" as const, id: "editorial" as const, version: "1.0.0" },
  support: null
};
const team = (id: string) => ({
  context: {
    competitionId: "competition-1", competitionSelectionMode: "pinned" as const,
    phaseId: "phase-1", poolId: "pool-1", providerTeamId: id, seasonId: "2026"
  },
  name: id
});

describe("Sportlink bulk wizard", () => {
  for (const [teams, types, total] of [[1, 1, 1], [1, 3, 3], [2, 3, 6], [5, 3, 15]] as const) {
    it(`maakt ${teams} × ${types} = ${total} onafhankelijke concepten`, () => {
      const result = buildSportlinkSlideDrafts({
        blueprintKeys: [
          "sportlink.club_schedule_today",
          "sportlink.pool_results_previous_7_days",
          "sportlink.pool_standings"
        ].slice(0, types) as never,
        orientation: "portrait",
        teams: Array.from({ length: teams }, (_, index) => team(`team-${index}`)),
        templateVersionIdBySlideType: {
          sport_program: templateVersionId,
          sport_results: templateVersionId,
          sport_standing: templateVersionId
        },
        themeSelection
      });
      expect(result).toHaveLength(total);
      if (result.length > 1) {
        result[0]!.context.poolId = "changed";
        expect(result[1]?.context.poolId).toBe("pool-1");
      }
    });
  }

  it("kopieert context als gemak zonder concepten aan elkaar te koppelen", () => {
    const drafts = buildSportlinkSlideDrafts({
      blueprintKeys: ["sportlink.pool_standings"], orientation: "landscape",
      teams: [team("a"), team("b")],
      templateVersionIdBySlideType: { sport_standing: templateVersionId },
      themeSelection
    });
    const copied = copySportlinkContextToTeam(drafts, 0, "b");
    copied[0]!.context.poolId = "later-aangepast";
    expect(copied[1]!.context.poolId).toBe("pool-1");
    expect(copied[1]!.context.providerTeamId).toBe("b");
  });

  it("bundelt ieder aankomsttype tot één logisch concept met alle teams", () => {
    const teams = Array.from({ length: 22 }, (_, index) => team(`team-${index}`));
    const drafts = buildSportlinkSlideDrafts({
      blueprintKeys: [
        "sportlink.visitor_arrivals",
        "sportlink.referee_arrivals"
      ],
      orientation: "landscape",
      teams,
      templateVersionIdBySlideType: {
        sport_referee_arrivals: templateVersionId,
        sport_visitor_arrivals: templateVersionId
      },
      themeSelection
    });

    expect(drafts).toHaveLength(2);
    expect(drafts.map((draft) => draft.blueprintKey)).toEqual([
      "sportlink.visitor_arrivals",
      "sportlink.referee_arrivals"
    ]);
    for (const draft of drafts) {
      expect(draft.teamContexts).toHaveLength(22);
      expect(draft.teamContexts?.map((context) => context.providerTeamId))
        .toEqual(teams.map((candidate) => candidate.context.providerTeamId));
      expect(draft.name).not.toContain("team-0 ·");
    }
  });

  it("behoudt team × type voor gewone slides naast aggregate aankomsten", () => {
    const drafts = buildSportlinkSlideDrafts({
      blueprintKeys: [
        "sportlink.club_schedule_today",
        "sportlink.visitor_arrivals"
      ],
      orientation: "portrait",
      teams: [team("a"), team("b"), team("c")],
      templateVersionIdBySlideType: {
        sport_program: templateVersionId,
        sport_visitor_arrivals: templateVersionId
      },
      themeSelection
    });

    expect(drafts.filter((draft) =>
      draft.blueprintKey === "sportlink.club_schedule_today"
    )).toHaveLength(3);
    expect(drafts.filter((draft) =>
      draft.blueprintKey === "sportlink.visitor_arrivals"
    )).toHaveLength(1);
    expect(drafts).toHaveLength(4);
  });

  it("maakt onafhankelijke kopieën van aggregate teamcontexten", () => {
    const [draft] = buildSportlinkSlideDrafts({
      blueprintKeys: ["sportlink.visitor_arrivals"],
      orientation: "landscape",
      teams: [team("a"), team("b")],
      templateVersionIdBySlideType: {
        sport_visitor_arrivals: templateVersionId
      },
      themeSelection
    });

    expect(draft).toBeDefined();
    draft!.context.poolId = "primary-changed";
    expect(draft!.teamContexts?.[0]?.poolId).toBe("pool-1");
    draft!.teamContexts![0]!.poolId = "aggregate-changed";
    expect(draft!.teamContexts?.[1]?.poolId).toBe("pool-1");
  });

  it("weigert onbegrensde of dubbele aggregate teamselecties", () => {
    const input = {
      blueprintKeys: ["sportlink.visitor_arrivals"] as const,
      orientation: "landscape" as const,
      templateVersionIdBySlideType: {
        sport_visitor_arrivals: templateVersionId
      },
      themeSelection
    };

    expect(() => buildSportlinkSlideDrafts({
      ...input,
      blueprintKeys: [...input.blueprintKeys],
      teams: Array.from({ length: 101 }, (_, index) => team(`team-${index}`))
    })).toThrow();
    expect(() => buildSportlinkSlideDrafts({
      ...input,
      blueprintKeys: [...input.blueprintKeys],
      teams: [team("dubbel"), team("dubbel")]
    })).toThrow();
  });
});

describe("aankomstslides", () => {
  const config = {
    cardCount: 2, dutyDeskText: null, emptyBehavior: "skip" as const,
    highlightRecentMinutes: 15, minutesAfter: 30, minutesBefore: 90,
    motionPreset: "auto" as const, pageDurationSeconds: 12,
    placeholderText: "Geen aankomsten",
    showArrivalTime: true, showClubLogo: true, showCompetition: false,
    showDressingRoom: true, showField: true, showKickoffTime: true,
    showSponsor: false, showWelcome: true, sponsorMediaAssetId: null,
    welcomeText: "Welkom bij {{club}}"
  };
  const match = {
    awayTeam: "Uit FC", competition: "1e klasse", dressingRoom: "4", field: "2",
    id: "m1", officialDressingRoom: "S", officials: ["Sam", "Kim"],
    startsAt: "2026-08-23T12:00:00.000Z"
  };

  it("gebruikt het live venster en nooit de thuiskleedkamer voor bezoekers", () => {
    const cards = resolveSportlinkArrivalCards({ config, kind: "visitor", matches: [match], now: new Date("2026-08-23T11:00:00.000Z") });
    expect(cards).toMatchObject([{ dressingRoom: "4", name: "Uit FC" }]);
    expect(resolveSportlinkArrivalCards({ config, kind: "visitor", matches: [match], now: new Date("2026-08-23T13:00:01.000Z") })).toEqual([]);
  });

  it("maakt official-kaarten met de official-kleedkamer en deterministische pagina's", () => {
    const cards = resolveSportlinkArrivalCards({ config, kind: "referee", matches: [match], now: new Date("2026-08-23T11:00:00.000Z") });
    expect(cards.map((card) => card.dressingRoom)).toEqual(["S", "S"]);
    expect(paginateSportlinkArrivals([...cards, ...cards, ...cards], 2)).toHaveLength(3);
  });

  it("neemt een wedstrijd binnen 10.000 minuten vooruit mee", () => {
    const cards = resolveSportlinkArrivalCards({
      config: { ...config, minutesBefore: 10_000 },
      kind: "visitor",
      matches: [{ ...match, startsAt: "2026-08-30T09:00:00.000Z" }],
      now: new Date("2026-08-23T12:00:00.000Z")
    });

    expect(cards).toHaveLength(1);
  });
});
