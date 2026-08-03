import { describe, expect, it } from "vitest";

import { buildSportlinkSlideOptions } from "./sportlink-slide-options";

describe("Sportlink team- en competitieopties", () => {
  it("toont competitie, beker, fase en poule als één duidelijke keuze", () => {
    const result = buildSportlinkSlideOptions({
      matches: [{
        away_team: { externalId: "20", name: "Bezoekers" },
        competition: {
          externalId: "cup-3",
          name: "Districtsbeker",
          period: "Groep 3",
          type: "Beker"
        },
        home_team: { externalId: "10", name: "Testclub 1" },
        pool: { externalId: "702", name: "Poule B" },
        source_connection_id: "connection"
      }],
      teams: [{
        external_id: "10",
        metadata: {},
        name: "Testclub 1",
        source_connection_id: "connection"
      }]
    });

    expect(result.teams).toEqual([
      { externalId: "10", label: "Testclub 1" }
    ]);
    expect(result.competitions).toEqual([{
      externalId: "cup-3",
      label: "Beker · Districtsbeker · Groep 3 · Poule B",
      teamExternalIds: ["10"]
    }]);
  });

  it("koppelt een wedstrijd op teamnaam als Sportlink andere ids gebruikt", () => {
    const result = buildSportlinkSlideOptions({
      matches: [{
        away_team: { externalId: "provider-opponent", name: "Bezoekers" },
        competition: {
          externalId: "league-2",
          name: "Tweede klasse",
          type: "Competitie"
        },
        home_team: { externalId: "provider-team", name: "Testclub 1" },
        pool: null,
        source_connection_id: "connection"
      }],
      teams: [{
        external_id: "10",
        metadata: {},
        name: "Testclub 1",
        source_connection_id: "connection"
      }]
    });

    expect(result.competitions[0]?.teamExternalIds).toEqual(["10"]);
  });

  it("behoudt teamcontexten wanneer er nog geen wedstrijd is gepubliceerd", () => {
    const result = buildSportlinkSlideOptions({
      matches: [],
      teams: [{
        external_id: "10",
        metadata: {
          competitionOptions: [{
            externalId: "phase-1",
            name: "Voorjaarsreeks",
            period: "Fase 2",
            poolName: "Poule C",
            type: "Competitie"
          }]
        },
        name: "Testclub 1",
        source_connection_id: "connection"
      }]
    });

    expect(result.competitions[0]).toMatchObject({
      externalId: "phase-1",
      label: "Competitie · Voorjaarsreeks · Fase 2 · Poule C",
      teamExternalIds: ["10"]
    });
  });
});
