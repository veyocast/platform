import { describe, expect, it } from "vitest";

import {
  createSportlinkSlideBatchSchema,
  sportlinkArrivalConfigSchema,
  sportlinkSlideBatchMaxDrafts,
  sportlinkSlideContextSchema,
  sportlinkSlideDraftSchema,
  sportlinkSlideTeamContextsSchema
} from "../src/sportlink-slide-blueprints";

const templateVersionId = "00000000-0000-4000-8000-000000000001";
const themeSelection = {
  accent: null,
  categoryOverrides: [],
  modePolicy: { kind: "fixed" as const, mode: "light" as const },
  ref: { catalog: "v2" as const, id: "fieldflow" as const, version: "1.0.0" },
  support: null
};

function context(providerTeamId: string) {
  return {
    competitionId: null,
    competitionSelectionMode: "auto_current" as const,
    phaseId: null,
    poolId: null,
    providerTeamId,
    seasonId: null
  };
}

function draft(blueprintKey: "sportlink.pool_standings" | "sportlink.visitor_arrivals") {
  return {
    blueprintKey,
    context: context("team-1"),
    name: "Welkomstslide",
    orientation: "landscape" as const,
    templateVersionId,
    teamContexts: [context("team-1"), context("team-2")],
    themeSelection,
    title: "Welkom"
  };
}

describe("Sportlink slidecontext", () => {
  it.each(["competitionId", "phaseId", "poolId", "seasonId"] as const)(
    "weigert %s bij actuele competitie",
    (key) => {
      expect(sportlinkSlideContextSchema.safeParse({
        ...context("team-1"),
        [key]: "vastgezet"
      }).success).toBe(false);
    }
  );

  it("accepteert een volledig lege actuele competitiecontext", () => {
    expect(sportlinkSlideContextSchema.safeParse(context("team-1")).success)
      .toBe(true);
  });
});

describe("Sportlink aggregate teamcontexten", () => {
  it("gebruikt twee wedstrijden per slide zonder legacyconfiguraties te breken", () => {
    expect(sportlinkArrivalConfigSchema.parse({})).toMatchObject({
      cardCount: 2,
      showArrivalTime: false
    });
    expect(sportlinkArrivalConfigSchema.safeParse({ cardCount: 4 }).success)
      .toBe(true);
  });

  it("accepteert maximaal honderd unieke teams", () => {
    expect(sportlinkSlideTeamContextsSchema.safeParse(
      Array.from({ length: 100 }, (_, index) => context(`team-${index}`))
    ).success).toBe(true);
  });

  it("weigert meer dan honderd teams en dubbele team-ID's", () => {
    expect(sportlinkSlideTeamContextsSchema.safeParse(
      Array.from({ length: 101 }, (_, index) => context(`team-${index}`))
    ).success).toBe(false);
    expect(sportlinkSlideTeamContextsSchema.safeParse([
      context("team-1"),
      context("team-1")
    ]).success).toBe(false);
  });

  it("staat teamContexts alleen op een welkomstslide toe", () => {
    expect(sportlinkSlideDraftSchema.safeParse(
      draft("sportlink.visitor_arrivals")
    ).success).toBe(true);
    expect(sportlinkSlideDraftSchema.safeParse(
      draft("sportlink.pool_standings")
    ).success).toBe(false);
  });

  it("behoudt legacy drafts zonder teamContexts", () => {
    const { teamContexts, ...legacyDraft } = draft(
      "sportlink.visitor_arrivals"
    );
    expect(teamContexts).toHaveLength(2);
    expect(sportlinkSlideDraftSchema.safeParse(legacyDraft).success).toBe(true);
    expect(createSportlinkSlideBatchSchema.safeParse({
      dataSourceId: "00000000-0000-4000-8000-000000000002",
      drafts: [legacyDraft],
      idempotencyKey: "00000000-0000-4000-8000-000000000003"
    }).success).toBe(false);
  });

  it("vereist dat de primaire context het eerste geselecteerde team is", () => {
    expect(sportlinkSlideDraftSchema.safeParse({
      ...draft("sportlink.visitor_arrivals"),
      context: context("team-2")
    }).success).toBe(false);
  });

  it("weigert onbekende velden binnen een teamcontext", () => {
    expect(sportlinkSlideTeamContextsSchema.safeParse([{
      ...context("team-1"),
      unexpected: true
    }]).success).toBe(false);
  });
});

describe("Sportlink batchgrens", () => {
  it("maakt de maximale batchgrootte expliciet en toetsbaar", () => {
    const aggregate = draft("sportlink.visitor_arrivals");
    const command = {
      dataSourceId: "00000000-0000-4000-8000-000000000002",
      drafts: Array.from(
        { length: sportlinkSlideBatchMaxDrafts },
        (_, index) => ({ ...aggregate, name: `Welkomstslide ${index + 1}` })
      ),
      idempotencyKey: "00000000-0000-4000-8000-000000000003"
    };
    expect(createSportlinkSlideBatchSchema.safeParse(command).success).toBe(true);
    expect(createSportlinkSlideBatchSchema.safeParse({
      ...command,
      drafts: [...command.drafts, aggregate]
    }).success).toBe(false);
  });
});
