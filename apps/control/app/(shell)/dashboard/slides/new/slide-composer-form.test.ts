import { describe, expect, it } from "vitest";

import {
  availabilityCount,
  requiredSportlinkDatasetGroups,
  sourceHasContent,
  sourceMatchesSlideType,
  supportsSportContextSelection,
  supportsSportMatchSelection,
  supportsSportStandingSelection,
  type SlideSourceOption
} from "./slide-composer-form";

const source: SlideSourceOption = {
  id: "source-id",
  itemCount: 0,
  kind: "rss",
  lastErrorCode: null,
  lastSuccessfulSyncAt: null,
  name: "Clubnieuws",
  providerStatus: "ready",
  products: [],
  sportAvailability: [],
  sportCompetitions: [],
  sportSeasons: [],
  sportTeams: [],
  successfulDatasetGroups: []
};

describe("dynamische slide-opties", () => {
  it("combineert elk slidetype uitsluitend met de juiste bronsoort", () => {
    expect(sourceMatchesSlideType("rss", "news")).toBe(true);
    expect(sourceMatchesSlideType("rss", "menu")).toBe(false);
    expect(sourceMatchesSlideType("manual_products", "menu")).toBe(true);
    expect(sourceMatchesSlideType("sportlink", "sport_program")).toBe(true);
    expect(sourceMatchesSlideType("rss", "sport_program")).toBe(false);
  });

  it("blokkeert een RSS-bron zonder renderbare artikelen", () => {
    expect(sourceHasContent(source)).toBe(false);
  });

  it("behoudt laatste goede RSS-inhoud na een tijdelijke syncfout", () => {
    expect(sourceHasContent({
      ...source,
      itemCount: 4,
      lastErrorCode: "rss_fetch_unavailable",
      providerStatus: "error"
    })).toBe(true);
  });

  it("gebruikt Sportlink pas na de eerste geslaagde synchronisatie", () => {
    expect(sourceHasContent(
      { ...source, kind: "sportlink" },
      "sport_program"
    )).toBe(false);
    expect(sourceHasContent({
      ...source,
      kind: "sportlink",
      lastSuccessfulSyncAt: "2026-07-29T18:00:00.000Z",
      successfulDatasetGroups: ["matches", "teams"]
    }, "sport_program")).toBe(true);
  });

  it("controleert Sportlink-gereedheid per vereiste dataset", () => {
    const sportlink = {
      ...source,
      kind: "sportlink",
      lastSuccessfulSyncAt: null,
      successfulDatasetGroups: ["competitions"]
    };
    expect(sourceHasContent(sportlink, "sport_standing")).toBe(true);
    expect(sourceHasContent(sportlink, "sport_program")).toBe(false);
  });

  it("vereist voor programma en uitslagen zowel wedstrijden als teams", () => {
    expect(requiredSportlinkDatasetGroups("sport_program"))
      .toEqual(["matches", "teams"]);
    expect(requiredSportlinkDatasetGroups("sport_results"))
      .toEqual(["matches", "teams"]);
  });

  it("biedt team- en competitiekeuze voor alle wedstrijdslides", () => {
    expect(supportsSportMatchSelection("sport_program")).toBe(true);
    expect(supportsSportMatchSelection("sport_results")).toBe(true);
    expect(supportsSportMatchSelection("sport_standing")).toBe(false);
  });

  it("biedt team, competitie en seizoen voor standslides", () => {
    expect(supportsSportStandingSelection("sport_standing")).toBe(true);
    expect(supportsSportStandingSelection("sport_period_standing")).toBe(true);
    expect(supportsSportContextSelection("sport_standing")).toBe(true);
  });

  it("telt alleen inhoud binnen de gekozen team- en competitiecontext", () => {
    const availability = [
      {
        competitionExternalId: "league-a",
        homeAway: "home" as const,
        itemCount: 1,
        lastSyncedAt: "2026-08-11T10:00:00.000Z",
        season: "2026/2027",
        slideType: "sport_program",
        startsAt: "2026-08-12T18:00:00.000Z",
        teamExternalIds: ["team-1"]
      },
      {
        competitionExternalId: "league-b",
        homeAway: "away" as const,
        itemCount: 1,
        lastSyncedAt: "2026-08-11T10:00:00.000Z",
        season: "2026/2027",
        slideType: "sport_program",
        startsAt: "2026-08-13T18:00:00.000Z",
        teamExternalIds: ["team-2"]
      }
    ];
    expect(availabilityCount(availability, {
      competitionExternalId: "league-a",
      teamExternalId: "team-1"
    })).toBe(1);
    expect(availabilityCount(availability, {
      competitionExternalId: "league-a",
      teamExternalId: "team-2"
    })).toBe(0);
  });
});
