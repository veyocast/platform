import { describe, expect, it } from "vitest";

import {
  LedScoresGoalDetector,
  LedScoresProtocolError,
  createLedScoresUrl,
  parseLedScoresMessage,
  type LedScoresStatus,
  type LedScoresTeamMapping
} from "../src/ledscores";

const now = new Date("2026-08-30T12:00:30.000Z");
const mappings: LedScoresTeamMapping[] = [
  { side: "own", teamKey: "23603", teamName: "Duindorp SV" },
  { side: "opponent", teamKey: "27753", teamName: "Tegenstander" }
];

function status(overrides: Partial<LedScoresStatus> = {}): LedScoresStatus {
  return {
    awayScore: 2,
    awayTeamId: "27753",
    endedAt: null,
    homeScore: 3,
    homeTeamId: "23603",
    matchClockSeconds: 2807.5,
    matchId: "wedstrijd-1",
    paused: false,
    period: "2",
    scored: { date: "2026-08-30T12:00:20.000Z", id: "12", side: "home" },
    startedAt: "2026-08-30T11:00:00.000Z",
    updateId: "update-1",
    updatedAt: "2026-08-30T12:00:20.500Z",
    ...overrides
  };
}

function observePair(
  baseline: LedScoresStatus,
  next: LedScoresStatus,
  customMappings = mappings
) {
  const detector = new LedScoresGoalDetector();
  expect(detector.observe({
    connectionId: "connection-1", mappings: customMappings, now, status: baseline
  }).kind).toBe("baseline");
  return detector.observe({
    connectionId: "connection-1", mappings: customMappings, now, status: next
  });
}

describe("LED Scores protocol", () => {
  it("constructs only the allowlisted websocket host", () => {
    expect(createLedScoresUrl("duindorp-sv"))
      .toBe("wss://wss.ledscores.score.tel/clubs/duindorp-sv/scores/");
    expect(() => createLedScoresUrl("../ander?token=lek"))
      .toThrow(LedScoresProtocolError);
  });

  it("parses the bounded external score schema", () => {
    const parsed = parseLedScoresMessage(JSON.stringify({
      type: "scores",
      message: {
        endedAt: null,
        matchId: null,
        paused: false,
        period: 1,
        scoreboard: {
          away: 2,
          home: 3,
          scored: { date: "2026-08-30T12:00:20.000Z", id: 1, side: "away" }
        },
        startedAt: "2026-08-30T11:00:00.000Z",
        teams: { away: 27753, home: 23603 },
        time: 2807.5,
        updateId: "91745745cb",
        updatedAt: "2026-08-30T12:00:20.500Z"
      }
    }));
    expect(parsed).toMatchObject({
      awayScore: 2,
      awayTeamId: "27753",
      homeScore: 3,
      homeTeamId: "23603",
      period: "1"
    });
  });

  it("rejects malformed, contradictory and oversized payloads", () => {
    expect(() => parseLedScoresMessage("{"))
      .toThrowError(/ongeldige JSON/);
    expect(() => parseLedScoresMessage(JSON.stringify({ type: "scores", message: {} })))
      .toThrowError(/geen ondersteund/);
    expect(() => parseLedScoresMessage("x".repeat(65 * 1024)))
      .toThrowError(/te groot/);
  });
});

describe("LED Scores goal detection", () => {
  it("treats the initial status as baseline and does not replay it", () => {
    const detector = new LedScoresGoalDetector();
    expect(detector.observe({
      connectionId: "connection-1", mappings, now, status: status()
    })).toEqual({ kind: "baseline", reason: "initial" });
  });

  it("detects one fresh home goal and classifies the own team", () => {
    const result = observePair(
      status({ homeScore: 3, scored: null, updateId: "before" }),
      status({ homeScore: 4, updateId: "after" })
    );
    expect(result.kind).toBe("goal");
    if (result.kind === "goal") {
      expect(result.goal).toMatchObject({
        previousHomeScore: 3,
        homeScore: 4,
        scoringSide: "own"
      });
      expect(result.goal.canonicalKey).toMatch(/^[a-f0-9]{64}$/);
    }
  });

  it("detects one fresh away goal and classifies the opponent", () => {
    const result = observePair(
      status({ awayScore: 2, scored: null }),
      status({
        awayScore: 3,
        scored: { date: "2026-08-30T12:00:22.000Z", id: "13", side: "away" }
      })
    );
    expect(result.kind === "goal" && result.goal.scoringSide).toBe("opponent");
  });

  it("does not emit on repeated identical messages", () => {
    const result = observePair(status(), status());
    expect(result).toEqual({ kind: "ignored", reason: "no_score_change" });
  });

  it("does not emit a downward score correction", () => {
    const result = observePair(status({ homeScore: 4 }), status({ homeScore: 3 }));
    expect(result).toEqual({ kind: "ignored", reason: "correction" });
  });

  it("suppresses jumps and simultaneous score changes", () => {
    const jump = observePair(status(), status({ homeScore: 5 }));
    const simultaneous = observePair(status(), status({ homeScore: 4, awayScore: 3 }));
    expect(jump).toEqual({ kind: "ignored", reason: "ambiguous_score_change" });
    expect(simultaneous).toEqual({ kind: "ignored", reason: "ambiguous_score_change" });
  });

  it("suppresses a score increase without scored metadata", () => {
    const result = observePair(status(), status({ homeScore: 4, scored: null }));
    expect(result).toEqual({ kind: "ignored", reason: "missing_scored_metadata" });
  });

  it("suppresses mismatched scored-side metadata", () => {
    const result = observePair(status(), status({
      homeScore: 4,
      scored: { date: "2026-08-30T12:00:22.000Z", id: "13", side: "away" }
    }));
    expect(result).toEqual({ kind: "ignored", reason: "scored_side_mismatch" });
  });

  it("suppresses strongly stale scored metadata", () => {
    const result = observePair(status(), status({
      homeScore: 4,
      scored: { date: "2026-08-30T11:40:00.000Z", id: "13", side: "home" }
    }));
    expect(result).toEqual({ kind: "ignored", reason: "stale_goal" });
  });

  it("suppresses a completed match status", () => {
    const result = observePair(status(), status({
      endedAt: "2026-08-30T12:00:25.000Z",
      homeScore: 4,
      scored: { date: "2026-08-30T12:00:22.000Z", id: "13", side: "home" }
    }));
    expect(result).toEqual({ kind: "ignored", reason: "inactive_match" });
  });

  it("creates a new baseline when match identity changes", () => {
    const result = observePair(status(), status({ matchId: "wedstrijd-2", homeScore: 4 }));
    expect(result).toEqual({ kind: "baseline", reason: "match_changed" });
  });

  it("re-baselines after reconnect even when the stored score is higher", () => {
    const detector = new LedScoresGoalDetector();
    detector.observe({ connectionId: "connection-1", mappings, now, status: status() });
    detector.markReconnected();
    expect(detector.observe({
      connectionId: "connection-1",
      mappings,
      now,
      status: status({ homeScore: 8 })
    })).toEqual({ kind: "baseline", reason: "reconnect" });
  });

  it("recognizes the own team on the away side", () => {
    const result = observePair(
      status({
        awayTeamId: "23603",
        homeTeamId: "27753",
        awayScore: 2,
        homeScore: 3,
        scored: null
      }),
      status({
        awayTeamId: "23603",
        homeTeamId: "27753",
        awayScore: 3,
        homeScore: 3,
        scored: { date: "2026-08-30T12:00:22.000Z", id: "13", side: "away" }
      })
    );
    expect(result.kind === "goal" && result.goal.scoringSide).toBe("own");
  });

  it("classifies an unmapped scoring team as unknown", () => {
    const result = observePair(
      status({ scored: null }),
      status({ homeScore: 4 }),
      []
    );
    expect(result.kind === "goal" && result.goal.scoringSide).toBe("unknown");
    if (result.kind === "goal") {
      expect(result.goal).toMatchObject({
        homeTeam: "Thuisteam",
        scoreboardSide: "home",
        scoringTeamKey: "23603"
      });
      expect(JSON.stringify(result.goal)).not.toContain("Team 23603");
    }
  });
});
