import { describe, expect, it } from "vitest";

import {
  LedScoresGoalDetector,
  LedScoresProtocolError,
  LedScoresSemanticEventDetector,
  createLedScoresUrl,
  parseLedScoresMessage,
  testLedScoresConnection,
  type LedScoresEventObservation,
  type LedScoresPlayer,
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
    displayTeam: null,
    endedAt: null,
    homeScore: 3,
    homeTeamId: "23603",
    lineupPlayers: { away: [], home: [] },
    matchClockSeconds: 2807.5,
    matchId: "wedstrijd-1",
    matchState: "running",
    paused: false,
    period: "2",
    rest: false,
    scored: { date: "2026-08-30T12:00:20.000Z", id: "12", side: "home" },
    scorers: { away: [], home: [] },
    selectedLineupPlayerIds: { away: [], home: [] },
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

function player(id: string, name: string, number: string): LedScoresPlayer {
  return {
    active: true,
    goalImageUrl: null,
    id,
    name,
    number
  };
}

function singleEvent(observation: LedScoresEventObservation) {
  expect(observation.kind).toBe("events");
  if (observation.kind !== "events") return undefined;
  expect(observation.events).toHaveLength(1);
  return observation.events[0];
}

// Structure observed from the read-only Duindorp feed on 11 October 2026.
// Match/team/update identifiers are synthetic; no names or roster data copied.
function providerFixture() {
  return {
    type: "scores",
    message: {
      rest: false,
      time: 5_400,
      teams: { away: 200, home: 100 },
      buzzer: null,
      lineup: { away: null, home: null },
      paused: false,
      period: 2,
      result: {},
      endedAt: "2026-10-10T17:24:16.801Z",
      innings: {},
      lineups: { away: [], home: [] },
      matchId: null,
      scorers: { away: [], home: [] },
      schedule: null,
      settings: {},
      timeouts: {},
      updateId: "anonymous-provider-update",
      countdown: null,
      overtimes: {},
      penalties: null,
      startedAt: "2026-10-10T15:30:00.000Z",
      teamFouls: {},
      timeoutBy: null,
      autoLoaded: false,
      scoreboard: {
        away: 0,
        home: 1,
        scored: {
          id: 1,
          date: "2026-10-10T16:00:00.000Z",
          side: "home",
          serverDate: "2026-10-10T16:00:00.123Z"
        }
      },
      shot_clock: {},
      buttonStats: {},
      displayTeam: "",
      halfTimeouts: {},
      restStartedAt: null,
      play_direction: null,
      hide_match_sponsors: false,
      updatedAt: "2026-10-10T17:24:16.801Z"
    }
  };
}

describe("LED Scores protocol", () => {
  describe("bounded rejected-team shape diagnostics", () => {
    function rejected(payload: unknown) {
      try {
        parseLedScoresMessage(JSON.stringify(payload));
        throw new Error("The malformed provider payload must remain rejected.");
      } catch (error) {
        expect(error).toBeInstanceOf(LedScoresProtocolError);
        if (!(error instanceof LedScoresProtocolError)) throw error;
        expect(error.code).toBe("LEDSCORES_MESSAGE_INVALID");
        return error;
      }
    }

    function rejectedTeams(teams: Record<string, unknown>) {
      const fixture = providerFixture();
      return rejected({ ...fixture, message: { ...fixture.message, teams } });
    }

    it.each([
      { value: null, type: "null" },
      { value: true, type: "boolean" },
      { value: ["PRIVATE_ARRAY_VALUE"], type: "array" },
      { value: {}, type: "object" }
    ])("describes a rejected $type slot without accepting it or inspecting its contents", ({ value, type }) => {
      const error = rejectedTeams({ away: 200, home: value });
      expect(error.validationIssues).toEqual([{
        code: "invalid_union",
        path: "message.teams.home",
        shape: type === "object" ? { type, primitiveFields: [] } : { type }
      }]);
      expect(JSON.stringify(error.validationIssues)).not.toContain("PRIVATE_ARRAY_VALUE");
    });

    it("distinguishes a missing own slot from explicit null and bounds shape records to both exact paths", () => {
      const error = rejectedTeams({ home: null });
      expect(error.validationIssues).toEqual([
        { code: "invalid_union", path: "message.teams.away", shape: { type: "missing" } },
        { code: "invalid_union", path: "message.teams.home", shape: { type: "null" } }
      ]);
      expect(error.validationIssues.filter(issue => issue.shape)).toHaveLength(2);
    });

    it("projects only fixed primitive field types, with no values, arbitrary keys or nested content", () => {
      const error = rejectedTeams({
        away: {
          id: 4312807,
          name: null,
          type: { privateNested: "PRIVATE_NESTED_VALUE" },
          active: false,
          "PRIVATE_ARBITRARY_FIELD": "PRIVATE_TOKEN_VALUE"
        },
        home: {
          active: true,
          type: "PRIVATE_TEAM_TYPE",
          name: "PRIVATE_TEAM_NAME",
          id: "PRIVATE_TEAM_ID",
          url: "https://private.example.invalid/?token=PRIVATE_URL_TOKEN",
          players: ["PRIVATE_PLAYER_NAME"],
          ["__proto__"]: { inherited: "PRIVATE_INHERITED_VALUE" }
        }
      });
      expect(error.validationIssues).toEqual([
        {
          code: "invalid_union", path: "message.teams.away",
          shape: { type: "object", primitiveFields: [
            { key: "id", type: "number" },
            { key: "name", type: "null" },
            { key: "active", type: "boolean" }
          ] }
        },
        {
          code: "invalid_union", path: "message.teams.home",
          shape: { type: "object", primitiveFields: [
            { key: "id", type: "string" },
            { key: "name", type: "string" },
            { key: "type", type: "string" },
            { key: "active", type: "boolean" }
          ] }
        }
      ]);
      const diagnostic = JSON.stringify(error.validationIssues);
      expect(diagnostic).not.toContain("PRIVATE_");
      expect(diagnostic).not.toContain("4312807");
      expect(diagnostic).not.toContain("private.example.invalid");
      expect(diagnostic).not.toContain("players");
      expect(Buffer.byteLength(diagnostic)).toBeLessThan(1_000);
    });

    it("keeps object and array children out of the primitive-field projection", () => {
      const error = rejectedTeams({ away: 200, home: {
        id: { id: "PRIVATE_NESTED_ID" }, name: ["PRIVATE_NESTED_NAME"],
        type: [], active: { active: true }
      } });
      expect(error.validationIssues).toEqual([{
        code: "invalid_union", path: "message.teams.home",
        shape: { type: "object", primitiveFields: [] }
      }]);
    });

    it("never adds shapes to another union path or to missing parent objects", () => {
      const fixture = providerFixture();
      const invalidScorer = rejected({ ...fixture, message: { ...fixture.message,
        scoreboard: { ...fixture.message.scoreboard, scored: {
          ...fixture.message.scoreboard.scored, id: null
        } }
      } });
      expect(invalidScorer.validationIssues).toEqual([
        { code: "invalid_union", path: "message.scoreboard.scored.id" }
      ]);
      const missingTeams = rejected({ ...fixture, message: { ...fixture.message, teams: undefined } });
      expect(missingTeams.validationIssues).toEqual([{ code: "invalid_type", path: "message.teams" }]);
    });

    it("keeps all accepted identity formats and normalized statuses unchanged", () => {
      const fixture = providerFixture();
      const original = parseLedScoresMessage(JSON.stringify(fixture));
      const strings = parseLedScoresMessage(JSON.stringify({ ...fixture,
        message: { ...fixture.message, teams: { away: "200", home: "100" } }
      }));
      expect(strings).toEqual(original);
      expect(original).not.toHaveProperty("validationIssues");
      expect(original).not.toHaveProperty("shape");
    });
  });

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

  it("accepts the current provider snapshot with null lineups and serverDate metadata", () => {
    const parsed = parseLedScoresMessage(JSON.stringify(providerFixture()));
    expect(parsed).toMatchObject({
      awayScore: 0,
      homeScore: 1,
      lineupPlayers: { away: [], home: [] },
      matchState: "ended",
      scored: { date: "2026-10-10T16:00:00.000Z", id: "1", side: "home" }
    });
    expect(parsed.scored).not.toHaveProperty("serverDate");
    expect(new LedScoresSemanticEventDetector().observe({
      connectionId: "fixture-connection",
      mappings: [],
      now: new Date("2026-10-11T08:00:00.000Z"),
      status: parsed
    })).toEqual({ kind: "baseline", reason: "initial" });
  });

  it("uses the same current provider contract for the read-only connection test", async () => {
    const result = await testLedScoresConnection("duindorp-sv", {
      webSocketFactory: () => {
        const socket = new EventTarget() as EventTarget & { close: () => void };
        socket.close = () => undefined;
        queueMicrotask(() => socket.dispatchEvent(new MessageEvent("message", {
          data: JSON.stringify(providerFixture())
        })));
        return socket as unknown as WebSocket;
      }
    });
    expect(result).toMatchObject({ awayScore: 0, homeScore: 1, awayTeamId: "200", homeTeamId: "100" });
  });

  it("ignores additive metadata without exposing it or changing normalized event authority", () => {
    const fixture = providerFixture();
    const baseline = parseLedScoresMessage(JSON.stringify(fixture));
    const extended = {
      ...fixture,
      providerRevision: { diagnostic: "external-metadata" },
      message: {
        ...fixture.message,
        extraProviderSettings: { diagnostic: "external-metadata" },
        teams: { ...fixture.message.teams, providerRevision: "external-metadata" },
        scoreboard: {
          ...fixture.message.scoreboard,
          diagnostic: "external-metadata",
          scored: { ...fixture.message.scoreboard.scored, nextProviderField: "external-metadata" }
        }
      }
    };
    expect(parseLedScoresMessage(JSON.stringify(extended))).toEqual(baseline);
    expect(JSON.stringify(baseline)).not.toContain("external-metadata");
  });

  it("never substitutes provider serverDate metadata for the required scored.date", () => {
    const fixture = providerFixture();
    delete (fixture.message.scoreboard.scored as Partial<typeof fixture.message.scoreboard.scored>).date;
    expect(() => parseLedScoresMessage(JSON.stringify(fixture))).toThrow(LedScoresProtocolError);
  });

  it.each([
    { path: ["message", "scoreboard", "home"], value: -1 },
    { path: ["message", "scoreboard", "away"], value: 1_000 },
    { path: ["message", "scoreboard", "home"], value: "1" },
    { path: ["message", "scoreboard", "scored", "date"], value: "private-invalid-value" },
    { path: ["message", "scoreboard", "scored", "id"], value: null },
    { path: ["message", "scoreboard", "scored", "side"], value: "other" },
    { path: ["message", "teams", "home"], value: -1 },
    { path: ["message", "teams", "away"], value: null },
    { path: ["message", "updatedAt"], value: "private-invalid-value" },
    { path: ["message", "lineup", "home"], value: "private-invalid-value" }
  ])("keeps consumed field $path fail-closed despite additive metadata", ({ path, value }) => {
    const fixture = providerFixture();
    let target = fixture as unknown as Record<string, unknown>;
    for (const part of path.slice(0, -1)) target = target[part] as Record<string, unknown>;
    target[path[path.length - 1]!] = value;
    try {
      parseLedScoresMessage(JSON.stringify(fixture));
      expect.unreachable("Malformed consumed fields must be rejected.");
    } catch (error) {
      expect(error).toBeInstanceOf(LedScoresProtocolError);
      if (!(error instanceof LedScoresProtocolError)) throw error;
      expect(error.validationIssues).toEqual(expect.arrayContaining([
        expect.objectContaining({ path: path.join(".") })
      ]));
      expect(JSON.stringify(error.validationIssues)).not.toContain("private-invalid-value");
    }
  });

  it("normalizes live state, selected lineups and score-indexed scorers", () => {
    const parsed = parseLedScoresMessage(JSON.stringify({
      type: "scores",
      message: {
        displayTeam: "home",
        endedAt: null,
        lineup: {
          away: { players: [
            { active: true, goalImage: null, id: "away-9", name: "Uitspeler", number: 9 }
          ] },
          home: { players: [
            {
              active: true,
              goalImage: "https://api.ledscores.score.tel/players/speler-7.webp",
              id: "home-7",
              name: "  Speler Zeven  ",
              number: "7"
            },
            { active: false, id: "home-12", name: "Wissel", number: 12 }
          ] }
        },
        lineups: {
          away: [{ id: "away-9" }],
          home: ["home-7", { id: "home-12" }, "home-7"]
        },
        matchId: null,
        paused: false,
        period: 1,
        rest: false,
        scoreboard: {
          away: 0,
          home: 1,
          scored: { date: "2026-08-30T12:00:20.000Z", id: 99, side: "home" }
        },
        scorers: {
          away: [],
          home: [null, {
            period: 1,
            player: {
              active: true,
              goalImage: "https://api.ledscores.score.tel/players/speler-7.webp",
              id: "home-7",
              name: "Speler Zeven",
              number: 7
            },
            time: 123.4
          }]
        },
        startedAt: "2026-08-30T11:00:00.000Z",
        teams: { away: 27753, home: 23603 },
        time: 123.4,
        updateId: "full-snapshot",
        updatedAt: "2026-08-30T12:00:20.500Z"
      }
    }));

    expect(parsed).toMatchObject({
      displayTeam: "home",
      matchState: "running",
      rest: false,
      selectedLineupPlayerIds: {
        away: ["away-9"],
        home: ["home-7", "home-12"]
      }
    });
    expect(parsed.lineupPlayers.home[0]).toEqual({
      active: true,
      goalImageUrl: "https://api.ledscores.score.tel/players/speler-7.webp",
      id: "home-7",
      name: "Speler Zeven",
      number: "7"
    });
    expect(parsed.scorers.home).toEqual([{
      matchClockSeconds: 123.4,
      period: "1",
      player: expect.objectContaining({ id: "home-7", number: "7" }),
      resultingScore: 1
    }]);
  });

  it("drops player media URLs outside the fixed provider host", () => {
    const parsed = parseLedScoresMessage(JSON.stringify({
      type: "scores",
      message: {
        lineup: {
          home: [{
            active: true,
            goalImage: "https://api.ledscores.score.tel.example/speler.webp",
            id: "home-7",
            name: "Speler Zeven",
            number: 7
          }]
        },
        scoreboard: { away: 0, home: 0, scored: null },
        teams: { away: 27753, home: 23603 },
        updatedAt: "2026-08-30T12:00:20.500Z"
      }
    }));

    expect(parsed.lineupPlayers.home[0]?.goalImageUrl).toBeNull();
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

describe("LED Scores semantic event detection", () => {
  it("binds an immediately available scorer by resulting score, never by scored.id", () => {
    const detector = new LedScoresSemanticEventDetector();
    detector.observe({
      connectionId: "connection-1",
      mappings,
      now,
      status: status({ homeScore: 0, scored: null })
    });
    const observation = detector.observe({
      connectionId: "connection-1",
      mappings,
      now,
      status: status({
        homeScore: 1,
        scored: { date: "2026-08-30T12:00:20.000Z", id: "score-button-42", side: "home" },
        scorers: {
          away: [],
          home: [{
            matchClockSeconds: 72,
            period: "1",
            player: player("provider-player-7", "Speler Zeven", "7"),
            resultingScore: 1
          }]
        }
      })
    });

    expect(observation.kind).toBe("events");
    if (observation.kind !== "events") return;
    const goal = observation.events.find((event) => event.kind === "goal");
    expect(goal?.kind === "goal" && goal.goal.scorer).toMatchObject({
      id: "provider-player-7",
      name: "Speler Zeven",
      number: "7"
    });
    expect(goal?.kind === "goal" && goal.goal.scorer?.id).not.toBe("score-button-42");
  });

  it("correlates a late scorer even when the provider clears scored metadata", () => {
    const detector = new LedScoresSemanticEventDetector();
    const scored = { date: "2026-08-30T12:00:20.000Z", id: "score-button-42", side: "home" } as const;
    detector.observe({
      connectionId: "connection-1",
      mappings,
      now,
      status: status({ homeScore: 0, scored: null })
    });
    const goalObservation = detector.observe({
      connectionId: "connection-1",
      mappings,
      now,
      status: status({ homeScore: 1, scored, scorers: { away: [], home: [] } })
    });
    expect(goalObservation.kind === "events"
      && goalObservation.events.some((event) => event.kind === "goal")).toBe(true);

    const enrichedStatus = status({
      homeScore: 1,
      scored: null,
      scorers: {
        away: [],
        home: [{
          matchClockSeconds: 72,
          period: "1",
          player: player("provider-player-7", "Speler Zeven", "7"),
          resultingScore: 1
        }]
      },
      updateId: "scorer-selected",
      updatedAt: "2026-08-30T12:00:21.500Z"
    });
    const enrichmentObservation = detector.observe({
      connectionId: "connection-1",
      mappings,
      now,
      sourceObservedAt: "2026-08-30T12:00:30.000Z",
      status: enrichedStatus
    });
    expect(enrichmentObservation.kind).toBe("events");
    if (enrichmentObservation.kind !== "events") return;
    const enrichment = enrichmentObservation.events.find(
      (event) => event.kind === "goal_scorer_enriched"
    );
    expect(enrichment?.kind === "goal_scorer_enriched" && enrichment.enrichment)
      .toMatchObject({
        resultingScore: 1,
        scorer: { id: "provider-player-7", name: "Speler Zeven" },
        scoreboardSide: "home",
        sourceObservedAt: "2026-08-30T12:00:30.000Z"
      });

    expect(detector.observe({
      connectionId: "connection-1", mappings, now, status: enrichedStatus
    })).toEqual({ kind: "ignored", reason: "no_score_change" });
  });

  it("derives lineup request, side switch and clear with selected players only", () => {
    const detector = new LedScoresSemanticEventDetector();
    const lineupState = status({
      lineupPlayers: {
        away: [player("away-9", "Uitspeler", "9")],
        home: [
          player("home-7", "Basisspeler", "7"),
          player("home-12", "Wissel", "12")
        ]
      },
      selectedLineupPlayerIds: { away: ["away-9"], home: ["home-7"] }
    });
    detector.observe({ connectionId: "connection-1", mappings, now, status: lineupState });

    const requested = detector.observe({
      connectionId: "connection-1",
      mappings,
      now,
      sourceObservedAt: "2026-08-30T12:00:31.000Z",
      status: { ...lineupState, displayTeam: "home", updateId: "show-home" }
    });
    expect(singleEvent(requested)).toMatchObject({
      display: {
        players: [{ id: "home-7", name: "Basisspeler" }],
        selectedPlayerIds: ["home-7"],
        side: "home",
        teamKey: "23603",
        unresolvedPlayerIds: []
      },
      kind: "lineup_display_requested",
      sourceObservedAt: "2026-08-30T12:00:31.000Z"
    });

    const switched = detector.observe({
      connectionId: "connection-1",
      mappings,
      now,
      status: { ...lineupState, displayTeam: "away", updateId: "show-away" }
    });
    expect(singleEvent(switched)).toMatchObject({
      display: { players: [{ id: "away-9" }], side: "away" },
      fromSide: "home",
      kind: "lineup_display_switched"
    });

    const cleared = detector.observe({
      connectionId: "connection-1",
      mappings,
      now,
      status: { ...lineupState, displayTeam: null, updateId: "clear-lineup" }
    });
    expect(singleEvent(cleared)).toMatchObject({
      kind: "lineup_display_cleared",
      previousSide: "away"
    });
  });

  it("refreshes an initially empty displayed lineup exactly once when players arrive late", () => {
    const detector = new LedScoresSemanticEventDetector();
    const baseline = status({
      scored: null,
      selectedLineupPlayerIds: { away: [], home: ["home-7"] }
    });
    detector.observe({ connectionId: "connection-1", mappings, now, status: baseline });

    const emptyRequest = detector.observe({
      connectionId: "connection-1",
      mappings,
      now,
      status: { ...baseline, displayTeam: "home", updateId: "show-before-roster" }
    });
    expect(singleEvent(emptyRequest)).toMatchObject({
      display: { players: [], unresolvedPlayerIds: ["home-7"] },
      kind: "lineup_display_requested"
    });

    const withRoster = {
      ...baseline,
      displayTeam: "home" as const,
      lineupPlayers: { away: [], home: [player("home-7", "Basisspeler", "7")] },
      updateId: "late-roster"
    };
    const refreshed = detector.observe({
      connectionId: "connection-1", mappings, now, status: withRoster
    });
    expect(singleEvent(refreshed)).toMatchObject({
      display: {
        players: [{ id: "home-7", name: "Basisspeler" }],
        unresolvedPlayerIds: []
      },
      kind: "lineup_display_requested"
    });

    expect(detector.observe({
      connectionId: "connection-1",
      mappings,
      now,
      status: { ...withRoster, updateId: "same-lineup-again" }
    })).toEqual({ kind: "ignored", reason: "no_score_change" });
  });

  it("keeps one late refresh pending when active fallback precedes the selection", () => {
    const detector = new LedScoresSemanticEventDetector();
    const activeRoster = status({
      lineupPlayers: {
        away: [],
        home: [player("home-7", "Basisspeler", "7")]
      },
      scored: null,
      selectedLineupPlayerIds: { away: [], home: [] }
    });
    detector.observe({ connectionId: "connection-1", mappings, now, status: activeRoster });

    const fallbackRequest = detector.observe({
      connectionId: "connection-1",
      mappings,
      now,
      status: { ...activeRoster, displayTeam: "home", updateId: "show-active-fallback" }
    });
    expect(singleEvent(fallbackRequest)).toMatchObject({
      display: { players: [], selectedPlayerIds: [] },
      kind: "lineup_display_requested"
    });
    expect(detector.observe({
      connectionId: "connection-1",
      mappings,
      now,
      status: {
        ...activeRoster,
        displayTeam: "home",
        updateId: "fallback-clock-update"
      }
    })).toEqual({ kind: "ignored", reason: "no_score_change" });

    const selected = {
      ...activeRoster,
      displayTeam: "home" as const,
      selectedLineupPlayerIds: { away: [], home: ["home-7"] },
      updateId: "selection-arrived"
    };
    expect(singleEvent(detector.observe({
      connectionId: "connection-1", mappings, now, status: selected
    }))).toMatchObject({
      display: {
        players: [{ id: "home-7" }],
        selectedPlayerIds: ["home-7"]
      },
      kind: "lineup_display_requested"
    });
    expect(detector.observe({
      connectionId: "connection-1",
      mappings,
      now,
      status: { ...selected, updateId: "selection-still-present" }
    })).toEqual({ kind: "ignored", reason: "no_score_change" });
  });

  it("derives start, rest boundaries and match end without replaying baseline state", () => {
    const detector = new LedScoresSemanticEventDetector();
    const idle = status({
      endedAt: null,
      matchId: null,
      matchState: "idle",
      rest: false,
      startedAt: null
    });
    expect(detector.observe({ connectionId: "connection-1", mappings, now, status: idle }))
      .toEqual({ kind: "baseline", reason: "initial" });

    const running = {
      ...idle,
      matchId: "provider-match-1",
      matchState: "running" as const,
      startedAt: "2026-08-30T12:00:00.000Z",
      updateId: "match-started"
    };
    expect(singleEvent(detector.observe({
      connectionId: "connection-1",
      mappings,
      now,
      sourceObservedAt: "2026-08-30T12:00:32.000Z",
      status: running
    }))).toMatchObject({
      kind: "match_started",
      sourceObservedAt: "2026-08-30T12:00:32.000Z",
      state: { matchState: "running" }
    });

    const resting = {
      ...running,
      matchState: "rest" as const,
      rest: true,
      updateId: "rest-started"
    };
    expect(singleEvent(detector.observe({
      connectionId: "connection-1", mappings, now, status: resting
    }))).toMatchObject({ kind: "match_rest_started", state: { matchState: "rest" } });

    const resumed = {
      ...running,
      updateId: "rest-ended"
    };
    expect(singleEvent(detector.observe({
      connectionId: "connection-1", mappings, now, status: resumed
    }))).toMatchObject({ kind: "match_rest_ended", state: { matchState: "running" } });

    const ended = {
      ...resumed,
      endedAt: "2026-08-30T12:00:25.000Z",
      matchState: "ended" as const,
      updateId: "match-ended"
    };
    expect(singleEvent(detector.observe({
      connectionId: "connection-1", mappings, now, status: ended
    }))).toMatchObject({ kind: "match_ended", state: { matchState: "ended" } });

    const reconnect = new LedScoresSemanticEventDetector();
    reconnect.markReconnected();
    expect(reconnect.observe({
      connectionId: "connection-1",
      mappings,
      now,
      status: { ...ended, displayTeam: "home", rest: true }
    })).toEqual({ kind: "baseline", reason: "reconnect" });
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
