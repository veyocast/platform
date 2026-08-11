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
      seasonValues: [],
      teamExternalIds: ["10"]
    }]);
  });

  it("onthoudt historische standseizoenen en teams uit de stand", () => {
    const result = buildSportlinkSlideOptions({
      matches: [],
      standings: [
        {
          metadata: {
            competition: {
              externalId: "league-4",
              name: "Vierde klasse",
              season: "2025/2026",
              type: "Competitie"
            },
            pool: { name: "4C" }
          },
          rows_json: [{
            externalId: "10",
            teamName: "Testclub 1"
          }],
          source_connection_id: "connection"
        },
        {
          metadata: {
            competition: {
              externalId: "league-4",
              name: "Vierde klasse",
              season: "2026/2027",
              type: "Competitie"
            },
            pool: { name: "4C" }
          },
          rows_json: [{
            externalId: "10",
            teamName: "Testclub 1"
          }],
          source_connection_id: "connection"
        }
      ],
      teams: []
    });

    expect(result.teams).toEqual([
      { externalId: "10", label: "Testclub 1" }
    ]);
    expect(result.seasons.map((season) => season.value)).toEqual([
      "2026/2027",
      "2025/2026"
    ]);
    expect(result.competitions[0]?.seasonValues).toEqual([
      "2026/2027",
      "2025/2026"
    ]);
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

  it("merkt alleen renderbare wedstrijdinhoud als beschikbaar aan", () => {
    const result = buildSportlinkSlideOptions({
      matches: [
        {
          active: true,
          away_team: { externalId: "away", name: "Bezoekers" },
          competition: {
            externalId: "league-1",
            name: "Eerste klasse",
            season: "2026/2027"
          },
          home_team: { externalId: "team-1", name: "Testclub 1" },
          pool: null,
          source_connection_id: "connection",
          starts_at: "2026-08-12T18:00:00.000Z",
          status: "scheduled"
        },
        {
          active: true,
          away_team: { externalId: "away", name: "Bezoekers", score: 1 },
          competition: {
            externalId: "league-1",
            name: "Eerste klasse",
            season: "2026/2027"
          },
          home_team: { externalId: "team-1", name: "Testclub 1", score: 2 },
          pool: null,
          scores_published: true,
          source_connection_id: "connection",
          starts_at: "2026-08-09T12:00:00.000Z",
          status: "finished"
        },
        {
          active: true,
          away_team: { externalId: "away", name: "Bezoekers" },
          competition: {
            externalId: "league-1",
            name: "Eerste klasse",
            season: "2026/2027"
          },
          home_team: { externalId: "team-1", name: "Testclub 1" },
          pool: null,
          scores_published: false,
          source_connection_id: "connection",
          starts_at: "2026-08-08T12:00:00.000Z",
          status: "finished"
        }
      ],
      now: new Date("2026-08-11T12:00:00.000Z"),
      teams: [{
        external_id: "team-1",
        metadata: {},
        name: "Testclub 1",
        source_connection_id: "connection"
      }]
    });

    expect(result.availability.filter((item) =>
      item.slideType === "sport_program"
    )).toHaveLength(1);
    expect(result.availability.filter((item) =>
      item.slideType === "sport_results"
    )).toHaveLength(1);
  });
});
