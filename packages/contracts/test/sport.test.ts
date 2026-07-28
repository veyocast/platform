import { describe, expect, it } from "vitest";

import {
  sportMatchSchema,
  sportSnapshotSchema
} from "../src/sport";

const match = {
  awayTeam: { externalId: "away", logoUrl: null, name: "Uit", score: null },
  cancellationReason: null,
  competition: null,
  dressingRooms: { away: null, home: null, official: null },
  externalId: "match-1",
  homeTeam: { externalId: "home", logoUrl: null, name: "Thuis", score: null },
  isHomeMatch: true,
  officials: [],
  pool: null,
  startsAt: "2026-07-28T18:30:00+02:00",
  status: "scheduled",
  venue: { city: "Leiden", field: "1", name: "Sportpark", routeUrl: null }
};

describe("canonical sports contracts", () => {
  it("accepts a privacy-safe match without scores", () => {
    expect(sportMatchSchema.parse(match).homeTeam.score).toBeNull();
  });

  it("rejects contact fields instead of exposing them to templates", () => {
    const parsed = sportSnapshotSchema.parse({
      activities: [],
      club: null,
      emptyStateCode: null,
      expiresAt: null,
      generatedAt: "2026-07-28T16:30:00+02:00",
      matches: [{ ...match, email: "verboden@example.nl" }],
      people: [],
      sponsors: [],
      stale: false,
      standings: [],
      teams: [],
      trainings: [],
      volunteerTasks: []
    });
    expect(parsed.matches[0]).not.toHaveProperty("email");
  });
});
