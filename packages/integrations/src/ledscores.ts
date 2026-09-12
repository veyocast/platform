import { createHash } from "node:crypto";

import { z } from "zod";

export const LED_SCORES_HOST = "wss.ledscores.score.tel";
export const LED_SCORES_PLAYER_MEDIA_HOST = "api.ledscores.score.tel";
export const LED_SCORES_MAX_MESSAGE_BYTES = 64 * 1024;
export const LED_SCORES_DEFAULT_TIMEOUT_MS = 6_000;

const clubSlugPattern = /^[a-z0-9](?:[a-z0-9-]{0,78}[a-z0-9])?$/;
const dateValue = z.string().datetime({ offset: true });
const teamId = z.union([z.number().int().nonnegative(), z.string().min(1).max(120)]);
const playerNumber = z.union([
  z.number().int().nonnegative(),
  z.string().max(40)
]);

const playerSchema = z.object({
  active: z.boolean().nullable().optional(),
  goalImage: z.string().max(2_048).nullable().optional(),
  id: teamId,
  name: z.string().max(200),
  number: playerNumber.nullable().optional()
}).passthrough();

const lineupSideSchema = z.union([
  z.array(playerSchema).max(200),
  z.object({ players: z.array(playerSchema).max(200) }).passthrough()
]);

const selectedLineupEntrySchema = z.union([
  teamId,
  z.object({ id: teamId }).passthrough()
]);

const scorerSchema = z.object({
  period: z.union([z.number().int().nonnegative(), z.string().max(40)]).nullable().optional(),
  player: playerSchema,
  time: z.number().finite().nonnegative().nullable().optional()
}).passthrough();

const scoredSchema = z.object({
  date: dateValue,
  id: z.union([z.number().int().nonnegative(), z.string().min(1).max(120)]),
  side: z.enum(["home", "away"])
}).strict();

const scoresMessageSchema = z.object({
  message: z.object({
    displayTeam: z.union([z.enum(["home", "away"]), z.literal(""), z.null()]).optional(),
    endedAt: dateValue.nullable().optional(),
    lineup: z.object({
      away: lineupSideSchema.optional(),
      home: lineupSideSchema.optional()
    }).passthrough().optional(),
    lineups: z.object({
      away: z.array(selectedLineupEntrySchema).max(200).optional(),
      home: z.array(selectedLineupEntrySchema).max(200).optional()
    }).passthrough().optional(),
    matchId: z.union([z.string().max(200), z.number().int()]).nullable().optional(),
    paused: z.boolean().optional(),
    period: z.union([z.number().int().nonnegative(), z.string().max(40)]).optional(),
    rest: z.boolean().optional(),
    scoreboard: z.object({
      away: z.number().int().min(0).max(999),
      home: z.number().int().min(0).max(999),
      scored: scoredSchema.nullable().optional()
    }).passthrough(),
    scorers: z.object({
      away: z.array(scorerSchema.nullable()).max(1_000).optional(),
      home: z.array(scorerSchema.nullable()).max(1_000).optional()
    }).passthrough().optional(),
    startedAt: dateValue.nullable().optional(),
    teams: z.object({ away: teamId, home: teamId }).strict(),
    time: z.number().finite().nonnegative().optional(),
    updateId: z.union([z.string().min(1).max(200), z.number().int()]).optional(),
    updatedAt: dateValue
  }).passthrough(),
  type: z.literal("scores")
}).strict();

export type LedScoresSide = "away" | "home";

export type LedScoresPlayer = {
  active: boolean | null;
  goalImageUrl: string | null;
  id: string;
  name: string;
  number: string | null;
};

export type LedScoresScorer = {
  matchClockSeconds: number | null;
  period: string | null;
  player: LedScoresPlayer;
  resultingScore: number;
};

export type LedScoresMatchState = "ended" | "idle" | "paused" | "rest" | "running";

export type LedScoresStatus = {
  awayScore: number;
  awayTeamId: string;
  displayTeam: LedScoresSide | null;
  endedAt: string | null;
  lineupPlayers: Record<LedScoresSide, LedScoresPlayer[]>;
  matchClockSeconds: number | null;
  matchId: string | null;
  matchState: LedScoresMatchState;
  paused: boolean;
  period: string | null;
  rest: boolean;
  scored: { date: string; id: string; side: "away" | "home" } | null;
  scorers: Record<LedScoresSide, LedScoresScorer[]>;
  selectedLineupPlayerIds: Record<LedScoresSide, string[]>;
  homeScore: number;
  homeTeamId: string;
  startedAt: string | null;
  updateId: string | null;
  updatedAt: string;
};

export type LedScoresTeamMapping = {
  side: "opponent" | "own";
  teamKey: string;
  teamName: string;
};

export type LedScoresGoal = {
  homeTeamKey?: string;
  awayTeamKey?: string;
  awayScore: number;
  awayTeam: string;
  canonicalKey: string;
  homeScore: number;
  homeTeam: string;
  matchClock: string | null;
  matchIdentity: string;
  previousAwayScore: number;
  previousHomeScore: number;
  scoreboardSide: "away" | "home";
  scoredAt: string;
  scorer: LedScoresPlayer | null;
  scorerName: string | null;
  scoringTeamKey: string;
  scoringSide: "opponent" | "own" | "unknown";
  sourceUpdateId: string | null;
};

export type LedScoresGoalScorerEnrichment = {
  canonicalKey: string;
  goalCanonicalKey: string;
  matchIdentity: string;
  resultingScore: number;
  scoreboardSide: LedScoresSide;
  scorer: LedScoresPlayer;
  scoringTeamKey: string;
  sourceObservedAt: string;
  sourceUpdateId: string | null;
};

export type LedScoresLineupDisplay = {
  players: LedScoresPlayer[];
  selectedPlayerIds: string[];
  side: LedScoresSide;
  teamKey: string;
  teamName: string;
  unresolvedPlayerIds: string[];
};

type LedScoresEventBase = {
  canonicalKey: string;
  matchIdentity: string;
  sourceObservedAt: string;
  sourceUpdateId: string | null;
};

export type LedScoresSemanticEvent =
  | { kind: "goal"; goal: LedScoresGoal }
  | ({
      enrichment: LedScoresGoalScorerEnrichment;
      kind: "goal_scorer_enriched";
    })
  | (LedScoresEventBase & {
      display: LedScoresLineupDisplay;
      kind: "lineup_display_requested";
    })
  | (LedScoresEventBase & {
      display: LedScoresLineupDisplay;
      fromSide: LedScoresSide;
      kind: "lineup_display_switched";
    })
  | (LedScoresEventBase & {
      kind: "lineup_display_cleared";
      previousSide: LedScoresSide;
    })
  | (LedScoresEventBase & {
      kind:
        | "match_ended"
        | "match_rest_ended"
        | "match_rest_started"
        | "match_started";
      state: LedScoresMatchEventState;
    });

export type LedScoresMatchEventState = {
  awayScore: number;
  awayTeamKey: string;
  endedAt: string | null;
  homeScore: number;
  homeTeamKey: string;
  matchClockSeconds: number | null;
  matchState: LedScoresMatchState;
  period: string | null;
  startedAt: string | null;
};

export type LedScoresEventObservation =
  | { kind: "baseline"; reason: "initial" | "match_changed" | "reconnect" }
  | { events: LedScoresSemanticEvent[]; kind: "events" }
  | { kind: "ignored"; reason: LedScoresIgnoredReason };

export type LedScoresIgnoredReason =
  | "ambiguous_score_change"
  | "correction"
  | "duplicate"
  | "inactive_match"
  | "missing_scored_metadata"
  | "no_score_change"
  | "scored_side_mismatch"
  | "stale_goal";

export type LedScoresObservation =
  | { kind: "baseline"; reason: "initial" | "match_changed" | "reconnect" }
  | { kind: "goal"; goal: LedScoresGoal }
  | {
      kind: "ignored";
      reason: LedScoresIgnoredReason;
    };

export class LedScoresProtocolError extends Error {
  constructor(
    readonly code:
      | "LEDSCORES_MESSAGE_INVALID"
      | "LEDSCORES_MESSAGE_TOO_LARGE"
      | "LEDSCORES_SLUG_INVALID",
    message: string
  ) {
    super(message);
    this.name = "LedScoresProtocolError";
  }
}

export function normalizeLedScoresClubSlug(value: string) {
  const slug = value.trim().toLowerCase();
  if (!clubSlugPattern.test(slug)) {
    throw new LedScoresProtocolError(
      "LEDSCORES_SLUG_INVALID",
      "De LED Scores-clubslug bevat ongeldige tekens."
    );
  }
  return slug;
}

export function createLedScoresUrl(value: string) {
  const slug = normalizeLedScoresClubSlug(value);
  return `wss://${LED_SCORES_HOST}/clubs/${slug}/scores/`;
}

export function createLedScoresMatchIdentity(status: LedScoresStatus) {
  return status.matchId
    ? `match:${status.matchId}`
    : `fixture:${normalizeLedScoresTeamKey(status.homeTeamId)}:${normalizeLedScoresTeamKey(
        status.awayTeamId
      )}:${status.startedAt ?? "unknown"}`;
}

export function normalizeLedScoresTeamKey(value: string) {
  return value.trim().toLowerCase();
}

export function parseLedScoresMessage(raw: string | ArrayBuffer | Uint8Array) {
  const bytes = typeof raw === "string"
    ? new TextEncoder().encode(raw)
    : raw instanceof Uint8Array
      ? raw
      : new Uint8Array(raw);
  if (bytes.byteLength > LED_SCORES_MAX_MESSAGE_BYTES) {
    throw new LedScoresProtocolError(
      "LEDSCORES_MESSAGE_TOO_LARGE",
      "LED Scores gaf een te groot bericht terug."
    );
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new LedScoresProtocolError(
      "LEDSCORES_MESSAGE_INVALID",
      "LED Scores gaf ongeldige JSON terug."
    );
  }
  const result = scoresMessageSchema.safeParse(parsed);
  if (!result.success) {
    throw new LedScoresProtocolError(
      "LEDSCORES_MESSAGE_INVALID",
      "LED Scores gaf geen ondersteund scorebericht terug."
    );
  }
  const message = result.data.message;
  const endedAt = message.endedAt ?? null;
  const paused = message.paused ?? false;
  const rest = message.rest ?? false;
  const startedAt = message.startedAt ?? null;
  return {
    awayScore: message.scoreboard.away,
    awayTeamId: normalizeLedScoresTeamKey(String(message.teams.away)),
    displayTeam: message.displayTeam === "away" || message.displayTeam === "home"
      ? message.displayTeam
      : null,
    endedAt,
    homeScore: message.scoreboard.home,
    homeTeamId: normalizeLedScoresTeamKey(String(message.teams.home)),
    lineupPlayers: {
      away: normalizeLineupSide(message.lineup?.away),
      home: normalizeLineupSide(message.lineup?.home)
    },
    matchClockSeconds: message.time ?? null,
    matchId: message.matchId === null || message.matchId === undefined
      ? null
      : String(message.matchId),
    matchState: resolveMatchState({ endedAt, paused, rest, startedAt }),
    paused,
    period: message.period === undefined ? null : String(message.period),
    rest,
    scored: message.scoreboard.scored
      ? {
          date: message.scoreboard.scored.date,
          id: String(message.scoreboard.scored.id),
          side: message.scoreboard.scored.side
        }
      : null,
    scorers: {
      away: normalizeScorers(message.scorers?.away),
      home: normalizeScorers(message.scorers?.home)
    },
    selectedLineupPlayerIds: {
      away: normalizeSelectedLineup(message.lineups?.away),
      home: normalizeSelectedLineup(message.lineups?.home)
    },
    startedAt,
    updateId: message.updateId === undefined ? null : String(message.updateId),
    updatedAt: message.updatedAt
  } satisfies LedScoresStatus;
}

export class LedScoresGoalDetector {
  private previous: LedScoresStatus | null = null;
  private reconnectPending = false;
  private readonly emittedKeys = new Set<string>();

  markReconnected() {
    this.previous = null;
    this.reconnectPending = true;
  }

  observe({
    connectionId,
    mappings,
    now = new Date(),
    status
  }: {
    connectionId: string;
    mappings: LedScoresTeamMapping[];
    now?: Date;
    status: LedScoresStatus;
  }): LedScoresObservation {
    const matchIdentity = createLedScoresMatchIdentity(status);
    const previous = this.previous;
    this.previous = status;
    if (!previous) {
      const reason = this.reconnectPending ? "reconnect" : "initial";
      this.reconnectPending = false;
      return { kind: "baseline", reason };
    }
    if (!isSameMatch(previous, status)) {
      return { kind: "baseline", reason: "match_changed" };
    }
    const homeDelta = status.homeScore - previous.homeScore;
    const awayDelta = status.awayScore - previous.awayScore;
    if (homeDelta === 0 && awayDelta === 0) {
      return { kind: "ignored", reason: "no_score_change" };
    }
    if (homeDelta < 0 || awayDelta < 0) {
      return { kind: "ignored", reason: "correction" };
    }
    if (!status.scored) {
      return { kind: "ignored", reason: "missing_scored_metadata" };
    }
    if (
      (homeDelta !== 1 && awayDelta !== 1)
      || homeDelta + awayDelta !== 1
    ) {
      return { kind: "ignored", reason: "ambiguous_score_change" };
    }
    const expectedSide = homeDelta === 1 ? "home" : "away";
    if (status.scored.side !== expectedSide) {
      return { kind: "ignored", reason: "scored_side_mismatch" };
    }
    if (!isFreshLiveGoal(status, now)) {
      return {
        kind: "ignored",
        reason: isMatchInactive(status, now) ? "inactive_match" : "stale_goal"
      };
    }
    const canonicalKey = hashGoal(
      connectionId,
      matchIdentity,
      status.scored,
      status.homeScore,
      status.awayScore
    );
    if (this.emittedKeys.has(canonicalKey)) {
      return { kind: "ignored", reason: "duplicate" };
    }
    this.emittedKeys.add(canonicalKey);
    if (this.emittedKeys.size > 500) {
      const oldest = this.emittedKeys.values().next().value;
      if (oldest) this.emittedKeys.delete(oldest);
    }
    const scoringTeamId = normalizeLedScoresTeamKey(expectedSide === "home"
      ? status.homeTeamId
      : status.awayTeamId);
    const mapping = mappingFor(mappings, scoringTeamId);
    const scorer = scorerForResult(status, expectedSide);
    return {
      goal: {
        homeTeamKey: normalizeLedScoresTeamKey(status.homeTeamId),
        awayTeamKey: normalizeLedScoresTeamKey(status.awayTeamId),
        awayScore: status.awayScore,
        awayTeam: displayName(mappings, status.awayTeamId, "Uitteam"),
        canonicalKey,
        homeScore: status.homeScore,
        homeTeam: displayName(mappings, status.homeTeamId, "Thuisteam"),
        matchClock: formatMatchClock(status.matchClockSeconds, status.period),
        matchIdentity,
        previousAwayScore: previous.awayScore,
        previousHomeScore: previous.homeScore,
        scoreboardSide: expectedSide,
        scoredAt: status.scored.date,
        scorer: scorer?.player ?? null,
        scorerName: scorer?.player.name || null,
        scoringTeamKey: scoringTeamId,
        scoringSide: mapping?.side ?? "unknown",
        sourceUpdateId: status.updateId
      },
      kind: "goal"
    };
  }
}

type ActiveLedScoresGoal = {
  canonicalKey: string;
  matchIdentity: string;
  resultingScore: number;
  scoredAt: string;
  scoreboardSide: LedScoresSide;
  scoringTeamKey: string;
  seenScorerFingerprints: Set<string>;
};

/**
 * Derives every supported semantic transition from a single ordered source
 * stream. The first message, a changed match and a reconnect are always safe
 * baselines: level state from before this process owned the socket is never
 * replayed as a new public event.
 */
export class LedScoresSemanticEventDetector {
  private activeGoal: ActiveLedScoresGoal | null = null;
  private readonly goalDetector = new LedScoresGoalDetector();
  private pendingLineupRefresh: { matchIdentity: string; side: LedScoresSide } | null = null;
  private previous: LedScoresStatus | null = null;

  markReconnected() {
    this.activeGoal = null;
    this.pendingLineupRefresh = null;
    this.previous = null;
    this.goalDetector.markReconnected();
  }

  observe(input: {
    connectionId: string;
    mappings: LedScoresTeamMapping[];
    now?: Date;
    sourceObservedAt?: string;
    status: LedScoresStatus;
  }): LedScoresEventObservation {
    const previous = this.previous;
    this.previous = input.status;
    const goalObservation = this.goalDetector.observe(input);
    if (goalObservation.kind === "baseline") {
      this.activeGoal = null;
      this.pendingLineupRefresh = null;
      return goalObservation;
    }
    if (!previous || !isSameMatch(previous, input.status)) {
      this.activeGoal = null;
      this.pendingLineupRefresh = null;
      return { kind: "baseline", reason: "match_changed" };
    }

    const events: LedScoresSemanticEvent[] = [];
    const matchIdentity = createLedScoresMatchIdentity(input.status);
    const sourceObservedAt = input.sourceObservedAt ?? input.status.updatedAt;
    this.appendMatchEvents(
      events,
      input.connectionId,
      matchIdentity,
      previous,
      input.status,
      sourceObservedAt
    );
    this.appendLineupDisplayEvent(
      events,
      input.connectionId,
      input.mappings,
      matchIdentity,
      previous,
      input.status,
      sourceObservedAt
    );

    if (goalObservation.kind === "goal") {
      events.push({ goal: goalObservation.goal, kind: "goal" });
      const seenScorerFingerprints = new Set<string>();
      if (goalObservation.goal.scorer) {
        seenScorerFingerprints.add(playerFingerprint(goalObservation.goal.scorer));
      }
      this.activeGoal = {
        canonicalKey: goalObservation.goal.canonicalKey,
        matchIdentity,
        resultingScore: scoreForSide(input.status, goalObservation.goal.scoreboardSide),
        scoredAt: goalObservation.goal.scoredAt,
        scoreboardSide: goalObservation.goal.scoreboardSide,
        scoringTeamKey: goalObservation.goal.scoringTeamKey,
        seenScorerFingerprints
      };
    } else {
      this.appendGoalScorerEnrichment(
        events,
        input.connectionId,
        matchIdentity,
        input.status,
        sourceObservedAt
      );
    }

    if (events.length > 0) return { events, kind: "events" };
    return goalObservation.kind === "ignored"
      ? goalObservation
      : { kind: "ignored", reason: "no_score_change" };
  }

  private appendMatchEvents(
    events: LedScoresSemanticEvent[],
    connectionId: string,
    matchIdentity: string,
    previous: LedScoresStatus,
    status: LedScoresStatus,
    sourceObservedAt: string
  ) {
    if (!previous.endedAt && status.endedAt) {
      events.push(matchTransitionEvent(
        "match_ended",
        connectionId,
        matchIdentity,
        status,
        sourceObservedAt
      ));
      return;
    }
    if (!previous.startedAt && status.startedAt) {
      events.push(matchTransitionEvent(
        "match_started",
        connectionId,
        matchIdentity,
        status,
        sourceObservedAt
      ));
    }
    if (!previous.rest && status.rest) {
      events.push(matchTransitionEvent(
        "match_rest_started",
        connectionId,
        matchIdentity,
        status,
        sourceObservedAt
      ));
    }
    if (previous.rest && !status.rest) {
      events.push(matchTransitionEvent(
        "match_rest_ended",
        connectionId,
        matchIdentity,
        status,
        sourceObservedAt
      ));
    }
  }

  private appendLineupDisplayEvent(
    events: LedScoresSemanticEvent[],
    connectionId: string,
    mappings: LedScoresTeamMapping[],
    matchIdentity: string,
    previous: LedScoresStatus,
    status: LedScoresStatus,
    sourceObservedAt: string
  ) {
    if (previous.displayTeam === status.displayTeam) {
      const pending = this.pendingLineupRefresh;
      const display = status.displayTeam
        ? lineupDisplayFor(status, status.displayTeam, mappings)
        : null;
      if (
        !status.displayTeam
        || !pending
        || pending.matchIdentity !== matchIdentity
        || pending.side !== status.displayTeam
        || !display
        || !hasResolvedLineupSelection(display)
      ) return;
      this.pendingLineupRefresh = null;
      events.push({
        ...semanticEventBase(connectionId, matchIdentity, status, [
          "late-lineup-refresh",
          status.displayTeam
        ], sourceObservedAt),
        display,
        kind: "lineup_display_requested"
      });
      return;
    }
    this.pendingLineupRefresh = null;
    const source = semanticEventBase(connectionId, matchIdentity, status, [
      previous.displayTeam ?? "none",
      status.displayTeam ?? "none"
    ], sourceObservedAt);
    if (!status.displayTeam && previous.displayTeam) {
      events.push({
        ...source,
        kind: "lineup_display_cleared",
        previousSide: previous.displayTeam
      });
      return;
    }
    if (!status.displayTeam) return;
    const display = lineupDisplayFor(status, status.displayTeam, mappings);
    if (!hasResolvedLineupSelection(display)) {
      this.pendingLineupRefresh = { matchIdentity, side: status.displayTeam };
    }
    if (previous.displayTeam) {
      events.push({
        ...source,
        display,
        fromSide: previous.displayTeam,
        kind: "lineup_display_switched"
      });
      return;
    }
    events.push({ ...source, display, kind: "lineup_display_requested" });
  }

  private appendGoalScorerEnrichment(
    events: LedScoresSemanticEvent[],
    connectionId: string,
    matchIdentity: string,
    status: LedScoresStatus,
    sourceObservedAt: string
  ) {
    const activeGoal = this.activeGoal;
    if (!activeGoal || activeGoal.matchIdentity !== matchIdentity) {
      this.activeGoal = null;
      return;
    }
    const enrichmentAge = Date.parse(status.updatedAt) - Date.parse(activeGoal.scoredAt);
    if (
      enrichmentAge < -10_000
      || enrichmentAge > 120_000
      || scoreForSide(status, activeGoal.scoreboardSide) !== activeGoal.resultingScore
    ) {
      this.activeGoal = null;
      return;
    }
    if (status.scored) {
      const currentGoalKey = hashGoal(
        connectionId,
        matchIdentity,
        status.scored,
        status.homeScore,
        status.awayScore
      );
      if (currentGoalKey !== activeGoal.canonicalKey) {
        this.activeGoal = null;
        return;
      }
    }
    const scorer = scorerForResult(status, activeGoal.scoreboardSide);
    if (!scorer) return;
    const fingerprint = playerFingerprint(scorer.player);
    if (activeGoal.seenScorerFingerprints.has(fingerprint)) return;
    activeGoal.seenScorerFingerprints.add(fingerprint);
    const enrichment: LedScoresGoalScorerEnrichment = {
      canonicalKey: hashParts("goal-scorer", activeGoal.canonicalKey, fingerprint),
      goalCanonicalKey: activeGoal.canonicalKey,
      matchIdentity,
      resultingScore: activeGoal.resultingScore,
      scoreboardSide: activeGoal.scoreboardSide,
      scorer: scorer.player,
      scoringTeamKey: activeGoal.scoringTeamKey,
      sourceObservedAt,
      sourceUpdateId: status.updateId
    };
    events.push({ enrichment, kind: "goal_scorer_enriched" });
  }
}

export type LedScoresConnectionTestResult = {
  awayScore: number;
  awayTeamId: string;
  homeScore: number;
  homeTeamId: string;
  period: string | null;
  responseTimeMs: number;
  updatedAt: string;
};

export async function testLedScoresConnection(
  clubSlug: string,
  options: {
    timeoutMs?: number;
    webSocketFactory?: (url: string) => WebSocket;
  } = {}
): Promise<LedScoresConnectionTestResult> {
  const url = createLedScoresUrl(clubSlug);
  const timeoutMs = Math.min(
    10_000,
    Math.max(1_000, options.timeoutMs ?? LED_SCORES_DEFAULT_TIMEOUT_MS)
  );
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const socket = options.webSocketFactory?.(url) ?? new WebSocket(url);
    let settled = false;
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { socket.close(1000, "read-only test complete"); } catch { /* noop */ }
      callback();
    };
    const timer = setTimeout(() => finish(() => reject(
      new LedScoresProtocolError(
        "LEDSCORES_MESSAGE_INVALID",
        "LED Scores antwoordde niet binnen de veilige testtijd."
      )
    )), timeoutMs);
    socket.addEventListener("message", (event) => {
      try {
        if (typeof event.data !== "string" && !(event.data instanceof ArrayBuffer)) {
          throw new LedScoresProtocolError(
            "LEDSCORES_MESSAGE_INVALID",
            "LED Scores gaf een niet-ondersteund bericht terug."
          );
        }
        const status = parseLedScoresMessage(event.data);
        finish(() => resolve({
          awayScore: status.awayScore,
          awayTeamId: status.awayTeamId,
          homeScore: status.homeScore,
          homeTeamId: status.homeTeamId,
          period: status.period,
          responseTimeMs: Date.now() - started,
          updatedAt: status.updatedAt
        }));
      } catch (error) {
        finish(() => reject(error));
      }
    }, { once: true });
    socket.addEventListener("error", () => finish(() => reject(
      new LedScoresProtocolError(
        "LEDSCORES_MESSAGE_INVALID",
        "LED Scores kon niet veilig worden bereikt."
      )
    )), { once: true });
  });
}

function normalizePlayer(value: z.infer<typeof playerSchema>): LedScoresPlayer {
  const goalImageUrl = normalizePlayerMediaUrl(value.goalImage);
  const number = value.number === null || value.number === undefined
    ? ""
    : String(value.number).trim();
  return {
    active: value.active ?? null,
    goalImageUrl,
    id: String(value.id),
    name: value.name.trim(),
    number: number || null
  };
}

function normalizeLineupSide(
  value: z.infer<typeof lineupSideSchema> | undefined
): LedScoresPlayer[] {
  if (!value) return [];
  const players = Array.isArray(value) ? value : value.players;
  return players.map(normalizePlayer);
}

function normalizeSelectedLineup(
  value: z.infer<typeof selectedLineupEntrySchema>[] | undefined
) {
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const entry of value ?? []) {
    const id = String(typeof entry === "object" ? entry.id : entry);
    if (!seen.has(id)) {
      seen.add(id);
      ids.push(id);
    }
  }
  return ids;
}

function normalizeScorers(
  value: Array<z.infer<typeof scorerSchema> | null> | undefined
): LedScoresScorer[] {
  const scorers: LedScoresScorer[] = [];
  for (let resultingScore = 1; resultingScore < (value?.length ?? 0); resultingScore += 1) {
    const scorer = value?.[resultingScore];
    if (!scorer) continue;
    scorers.push({
      matchClockSeconds: scorer.time ?? null,
      period: scorer.period === null || scorer.period === undefined
        ? null
        : String(scorer.period),
      player: normalizePlayer(scorer.player),
      resultingScore
    });
  }
  return scorers;
}

function resolveMatchState({
  endedAt,
  paused,
  rest,
  startedAt
}: {
  endedAt: string | null;
  paused: boolean;
  rest: boolean;
  startedAt: string | null;
}): LedScoresMatchState {
  if (endedAt) return "ended";
  if (rest) return "rest";
  if (paused) return "paused";
  if (startedAt) return "running";
  return "idle";
}

function isSameMatch(previous: LedScoresStatus, status: LedScoresStatus) {
  if (
    normalizeLedScoresTeamKey(previous.homeTeamId)
      !== normalizeLedScoresTeamKey(status.homeTeamId)
    || normalizeLedScoresTeamKey(previous.awayTeamId)
      !== normalizeLedScoresTeamKey(status.awayTeamId)
  ) {
    return false;
  }
  if (previous.matchId && status.matchId) {
    return previous.matchId === status.matchId;
  }
  if (previous.matchId && !status.matchId) return false;
  if (previous.startedAt && !status.startedAt) return false;
  if (previous.startedAt && status.startedAt && previous.startedAt !== status.startedAt) {
    return false;
  }
  return !previous.startedAt
    || !status.startedAt
    || previous.startedAt === status.startedAt;
}

function normalizePlayerMediaUrl(value: string | null | undefined) {
  if (!value?.trim()) return null;
  try {
    const url = new URL(value.trim());
    if (
      url.protocol !== "https:"
      || url.hostname !== LED_SCORES_PLAYER_MEDIA_HOST
      || url.port
      || url.username
      || url.password
    ) return null;
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

function scoreForSide(status: LedScoresStatus, side: LedScoresSide) {
  return side === "home" ? status.homeScore : status.awayScore;
}

function scorerForResult(status: LedScoresStatus, side: LedScoresSide) {
  const resultingScore = scoreForSide(status, side);
  return status.scorers[side].find((scorer) => scorer.resultingScore === resultingScore) ?? null;
}

function playerFingerprint(player: LedScoresPlayer) {
  return hashParts(
    player.id,
    player.name,
    player.number ?? "",
    player.goalImageUrl ?? ""
  );
}

function lineupDisplayFor(
  status: LedScoresStatus,
  side: LedScoresSide,
  mappings: LedScoresTeamMapping[]
): LedScoresLineupDisplay {
  const selectedPlayerIds = status.selectedLineupPlayerIds[side];
  const playersById = new Map(
    status.lineupPlayers[side].map((player) => [player.id, player])
  );
  const players: LedScoresPlayer[] = [];
  const unresolvedPlayerIds: string[] = [];
  for (const id of selectedPlayerIds) {
    const player = playersById.get(id);
    if (player) players.push(player);
    else unresolvedPlayerIds.push(id);
  }
  const teamKey = normalizeLedScoresTeamKey(
    side === "home" ? status.homeTeamId : status.awayTeamId
  );
  return {
    players,
    selectedPlayerIds: [...selectedPlayerIds],
    side,
    teamKey,
    teamName: displayName(mappings, teamKey, side === "home" ? "Thuisteam" : "Uitteam"),
    unresolvedPlayerIds
  };
}

function hasResolvedLineupSelection(display: LedScoresLineupDisplay) {
  return display.selectedPlayerIds.length > 0 && display.players.length > 0;
}

function matchTransitionEvent(
  kind:
    | "match_ended"
    | "match_rest_ended"
    | "match_rest_started"
    | "match_started",
  connectionId: string,
  matchIdentity: string,
  status: LedScoresStatus,
  sourceObservedAt: string
): Extract<LedScoresSemanticEvent, { state: LedScoresMatchEventState }> {
  return {
    ...semanticEventBase(connectionId, matchIdentity, status, [kind], sourceObservedAt),
    kind,
    state: {
      awayScore: status.awayScore,
      awayTeamKey: normalizeLedScoresTeamKey(status.awayTeamId),
      endedAt: status.endedAt,
      homeScore: status.homeScore,
      homeTeamKey: normalizeLedScoresTeamKey(status.homeTeamId),
      matchClockSeconds: status.matchClockSeconds,
      matchState: status.matchState,
      period: status.period,
      startedAt: status.startedAt
    }
  };
}

function semanticEventBase(
  connectionId: string,
  matchIdentity: string,
  status: LedScoresStatus,
  details: string[],
  sourceObservedAt: string
): LedScoresEventBase {
  return {
    canonicalKey: hashParts(
      "semantic-event",
      connectionId,
      matchIdentity,
      status.updateId ?? status.updatedAt,
      ...details
    ),
    matchIdentity,
    sourceObservedAt,
    sourceUpdateId: status.updateId
  };
}

function hashParts(...parts: string[]) {
  return createHash("sha256").update(parts.join(":"), "utf8").digest("hex");
}

function mappingFor(mappings: LedScoresTeamMapping[], teamId: string) {
  const normalized = normalizeLedScoresTeamKey(teamId);
  return mappings.find((mapping) =>
    normalizeLedScoresTeamKey(mapping.teamKey) === normalized
  );
}

function displayName(
  mappings: LedScoresTeamMapping[],
  teamId: string,
  fallback: "Thuisteam" | "Uitteam"
) {
  return mappingFor(mappings, teamId)?.teamName ?? fallback;
}

function hashGoal(
  connectionId: string,
  matchIdentity: string,
  scored: NonNullable<LedScoresStatus["scored"]>,
  homeScore: number,
  awayScore: number
) {
  return createHash("sha256").update([
    connectionId,
    matchIdentity,
    scored.id,
    scored.date,
    scored.side,
    `${homeScore}-${awayScore}`
  ].join(":"), "utf8").digest("hex");
}

function isFreshLiveGoal(status: LedScoresStatus, now: Date) {
  if (!status.scored || isMatchInactive(status, now)) return false;
  const scoredAge = now.getTime() - Date.parse(status.scored.date);
  const updatedAge = now.getTime() - Date.parse(status.updatedAt);
  return scoredAge >= -10_000 && scoredAge <= 120_000
    && updatedAge >= -10_000 && updatedAge <= 180_000;
}

function isMatchInactive(status: LedScoresStatus, now: Date) {
  if (!status.endedAt) return false;
  const endedAt = Date.parse(status.endedAt);
  const scoredAt = status.scored ? Date.parse(status.scored.date) : 0;
  return endedAt <= now.getTime() && endedAt >= scoredAt;
}

function formatMatchClock(seconds: number | null, period: string | null) {
  if (seconds === null) return period ? `Periode ${period}` : null;
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.floor(seconds % 60);
  return `${period ? `P${period} · ` : ""}${minutes}:${String(remainder).padStart(2, "0")}`;
}
