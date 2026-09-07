import { describe, expect, it } from "vitest";

import {
  buildSportlinkSlideDrafts,
  copySportlinkContextToTeam,
  paginateSportlinkArrivals,
  resolveSportlinkArrivalCards,
  type SportlinkWizardTeam
} from "../src/sportlink-slide-wizard";

const templateVersionId = "00000000-0000-4000-8000-000000000001";
const themeSelection = {
  accent: null,
  categoryOverrides: [],
  modePolicy: { kind: "fixed" as const, mode: "light" as const },
  ref: { catalog: "v2" as const, id: "editorial" as const, version: "1.0.0" },
  support: null
};
const team = (id: string): SportlinkWizardTeam => ({
  context: {
    competitionId: "competition-1", competitionSelectionMode: "pinned" as const,
    phaseId: "phase-1", poolId: "pool-1", providerTeamId: id, seasonId: "2026"
  },
  name: id
});

describe("Sportlink bulk wizard", () => {
  it("maakt per clubprogramma of -uitslag precies één slide met meer dan 25 teams", () => {
    const teams = Array.from({ length: 40 }, (_, index) =>
      team("team-" + index)
    );
    const drafts = buildSportlinkSlideDrafts({
      blueprintKeys: [
        "sportlink.club_schedule_today",
        "sportlink.club_schedule_next_7_days",
        "sportlink.club_results_today",
        "sportlink.club_results_previous_7_days"
      ],
      orientation: "portrait",
      teams,
      templateVersionIdBySlideType: {
        sport_program: templateVersionId,
        sport_results: templateVersionId
      },
      themeSelection
    });

    expect(drafts).toHaveLength(4);
    for (const draft of drafts) {
      expect(draft.teamSelection).toMatchObject({ mode: "selected" });
      expect(draft.teamSelection?.teamContexts).toHaveLength(40);
      expect(draft.teamSelection?.teamContexts.map((context) =>
        context.providerTeamId
      )).toEqual(teams.map((candidate) =>
        candidate.context.providerTeamId
      ));
      expect(draft.display).toMatchObject({
        columns: "one",
        showLogo: true
      });
      expect(draft.name).not.toContain("team-0 ·");
      expect(draft.teamSelection?.matchLocation).toBe("both");
    }

    drafts[0]!.teamSelection!.teamContexts[0]!.poolId = "changed";
    expect(drafts[1]!.teamSelection?.teamContexts[0]?.poolId).toBe("pool-1");
  });

  it.each(["both", "home", "away"] as const)(
    "bewaart wedstrijdlocatie %s alleen op een clubbrede slide",
    (matchLocation) => {
      const [clubDraft, poolDraft] = buildSportlinkSlideDrafts({
        blueprintKeys: [
          "sportlink.club_schedule_next_7_days",
          "sportlink.pool_schedule_next_7_days"
        ],
        matchLocation,
        orientation: "landscape",
        teams: [team("team-1")],
        templateVersionIdBySlideType: { sport_program: templateVersionId },
        themeSelection
      });
      expect(clubDraft?.teamSelection?.matchLocation).toBe(matchLocation);
      expect(poolDraft?.teamSelection).toBeUndefined();
    }
  );

  it.each([
    ["sportlink.club_schedule_today", "home", "sport_program"],
    ["sportlink.club_schedule_today", "away", "sport_program"],
    ["sportlink.club_schedule_today", "both", "sport_program"],
    ["sportlink.club_results_today", "home", "sport_results"],
    ["sportlink.club_results_today", "away", "sport_results"],
    ["sportlink.club_results_today", "both", "sport_results"]
  ] as const)(
    "bouwt vandaagvariant %s voor locatie %s",
    (blueprintKey, matchLocation, slideType) => {
      const drafts = buildSportlinkSlideDrafts({
        blueprintKeys: [blueprintKey],
        matchLocation,
        orientation: "landscape",
        teams: [team("team-1"), team("team-2")],
        templateVersionIdBySlideType: { [slideType]: templateVersionId },
        themeSelection
      });

      expect(drafts).toHaveLength(1);
      expect(drafts[0]).toMatchObject({
        blueprintKey,
        teamSelection: {
          matchLocation,
          mode: "selected",
          teamContexts: [
            { providerTeamId: "team-1" },
            { providerTeamId: "team-2" }
          ]
        }
      });
    }
  );

  it("bouwt programma en uitslagen vandaag als zes benoemde varianten", () => {
    const drafts = buildSportlinkSlideDrafts({
      blueprintKeys: [
        "sportlink.club_schedule_today",
        "sportlink.club_results_today"
      ],
      matchLocations: ["both", "home", "away"],
      orientation: "landscape",
      teams: [team("team-1"), team("team-2")],
      templateVersionIdBySlideType: {
        sport_program: templateVersionId,
        sport_results: templateVersionId
      },
      themeSelection
    });

    expect(drafts).toHaveLength(6);
    expect(drafts.map((draft) => [
      draft.blueprintKey,
      draft.teamSelection?.matchLocation,
      draft.title
    ])).toEqual([
      ["sportlink.club_schedule_today", "both", "Clubprogramma vandaag · Thuis en uit"],
      ["sportlink.club_schedule_today", "home", "Clubprogramma vandaag · Thuis"],
      ["sportlink.club_schedule_today", "away", "Clubprogramma vandaag · Uit"],
      ["sportlink.club_results_today", "both", "Clubuitslagen vandaag · Thuis en uit"],
      ["sportlink.club_results_today", "home", "Clubuitslagen vandaag · Thuis"],
      ["sportlink.club_results_today", "away", "Clubuitslagen vandaag · Uit"]
    ]);
  });

  it("bewaart in Alle teams alleen individuele competitie-overrides", () => {
    const automatic = team("automatic");
    automatic.context = {
      competitionId: null,
      competitionSelectionMode: "auto_current",
      phaseId: null,
      poolId: null,
      providerTeamId: "automatic",
      seasonId: null
    };
    const pinned = team("pinned");
    const [draft] = buildSportlinkSlideDrafts({
      blueprintKeys: ["sportlink.club_schedule_next_7_days"],
      orientation: "landscape",
      teamSelectionMode: "all",
      teams: [automatic, pinned],
      templateVersionIdBySlideType: {
        sport_program: templateVersionId
      },
      themeSelection
    });

    expect(draft?.teamSelection).toEqual({
      matchLocation: "both",
      mode: "all",
      teamContexts: [pinned.context]
    });
    expect(draft?.context).toEqual(pinned.context);

    const follower = team("follower");
    follower.context = {
      competitionId: null,
      competitionSelectionMode: "auto_current",
      phaseId: null,
      poolId: null,
      providerTeamId: "follower",
      seasonId: null
    };
    const [unfilteredDraft] = buildSportlinkSlideDrafts({
      blueprintKeys: ["sportlink.club_schedule_next_7_days"],
      orientation: "landscape",
      teamSelectionMode: "all",
      teams: [automatic, follower],
      templateVersionIdBySlideType: { sport_program: templateVersionId },
      themeSelection
    });
    expect(unfilteredDraft?.teamSelection).toEqual({
      matchLocation: "both",
      mode: "all",
      teamContexts: []
    });
    expect(unfilteredDraft?.context).toEqual(automatic.context);
  });

  it("behoudt team × type voor poulecontent", () => {
    const drafts = buildSportlinkSlideDrafts({
      blueprintKeys: [
        "sportlink.pool_schedule_next_7_days",
        "sportlink.pool_results_previous_7_days",
        "sportlink.pool_standings"
      ],
      orientation: "portrait",
      teams: [team("a"), team("b"), team("c"), team("d")],
      templateVersionIdBySlideType: {
        sport_program: templateVersionId,
        sport_results: templateVersionId,
        sport_standing: templateVersionId
      },
      themeSelection
    });

    expect(drafts).toHaveLength(12);
    expect(drafts.every((draft) => draft.teamSelection === undefined)).toBe(true);
    drafts[0]!.context.poolId = "changed";
    expect(drafts[1]?.context.poolId).toBe("pool-1");
  });

  it("kopieert context als gemak zonder concepten aan elkaar te koppelen", () => {
    const drafts = buildSportlinkSlideDrafts({
      blueprintKeys: ["sportlink.pool_standings"],
      orientation: "landscape",
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
    const teams = Array.from({ length: 22 }, (_, index) =>
      team("team-" + index)
    );
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
        .toEqual(teams.map((candidate) =>
          candidate.context.providerTeamId
        ));
      expect(draft.name).not.toContain("team-0 ·");
    }
  });

  it("maakt één clubprogramma naast één aggregate aankomstslide", () => {
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
    )).toHaveLength(1);
    expect(drafts.filter((draft) =>
      draft.blueprintKey === "sportlink.visitor_arrivals"
    )).toHaveLength(1);
    expect(drafts).toHaveLength(2);
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

  it("weigert meer dan 500 of dubbele aggregate teamselecties", () => {
    const teams = Array.from({ length: 501 }, (_, index) =>
      team("team-" + index)
    );
    expect(() => buildSportlinkSlideDrafts({
      blueprintKeys: ["sportlink.club_schedule_today"],
      orientation: "landscape",
      teams,
      templateVersionIdBySlideType: {
        sport_program: templateVersionId
      },
      themeSelection
    })).toThrow();
    expect(() => buildSportlinkSlideDrafts({
      blueprintKeys: ["sportlink.visitor_arrivals"],
      orientation: "landscape",
      teams,
      templateVersionIdBySlideType: {
        sport_visitor_arrivals: templateVersionId
      },
      themeSelection
    })).toThrow();
    expect(() => buildSportlinkSlideDrafts({
      blueprintKeys: ["sportlink.club_schedule_today"],
      orientation: "landscape",
      teams: [team("dubbel"), team("dubbel")],
      templateVersionIdBySlideType: {
        sport_program: templateVersionId
      },
      themeSelection
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
