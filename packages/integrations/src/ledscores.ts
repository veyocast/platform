import { createHash } from "node:crypto";

import { z } from "zod";

export const LED_SCORES_HOST = "wss.ledscores.score.tel";
export const LED_SCORES_MAX_MESSAGE_BYTES = 64 * 1024;
export const LED_SCORES_DEFAULT_TIMEOUT_MS = 6_000;

const clubSlugPattern = /^[a-z0-9](?:[a-z0-9-]{0,78}[a-z0-9])?$/;
const dateValue = z.string().datetime({ offset: true });
const teamId = z.union([z.number().int().nonnegative(), z.string().min(1).max(120)]);

const scoredSchema = z.object({
  date: dateValue,
  id: z.union([z.number().int().nonnegative(), z.string().min(1).max(120)]),
  side: z.enum(["home", "away"])
}).strict();

const scoresMessageSchema = z.object({
  message: z.object({
    endedAt: dateValue.nullable().optional(),
    matchId: z.union([z.string().max(200), z.number().int()]).nullable().optional(),
    paused: z.boolean().optional(),
    period: z.union([z.number().int().nonnegative(), z.string().max(40)]).optional(),
    scoreboard: z.object({
      away: z.number().int().min(0).max(999),
      home: z.number().int().min(0).max(999),
      scored: scoredSchema.nullable().optional()
    }).passthrough(),
    startedAt: dateValue.nullable().optional(),
    teams: z.object({ away: teamId, home: teamId }).strict(),
    time: z.number().finite().nonnegative().optional(),
    updateId: z.union([z.string().min(1).max(200), z.number().int()]).optional(),
    updatedAt: dateValue
  }).passthrough(),
  type: z.literal("scores")
}).strict();

export type LedScoresStatus = {
  awayScore: number;
  awayTeamId: string;
  endedAt: string | null;
  matchClockSeconds: number | null;
  matchId: string | null;
  paused: boolean;
  period: string | null;
  scored: { date: string; id: string; side: "away" | "home" } | null;
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
  scorerName: null;
  scoringTeamKey: string;
  scoringSide: "opponent" | "own" | "unknown";
  sourceUpdateId: string | null;
};

export type LedScoresObservation =
  | { kind: "baseline"; reason: "initial" | "match_changed" | "reconnect" }
  | { kind: "goal"; goal: LedScoresGoal }
  | {
      kind: "ignored";
      reason:
        | "ambiguous_score_change"
        | "correction"
        | "duplicate"
        | "inactive_match"
        | "missing_scored_metadata"
        | "no_score_change"
        | "scored_side_mismatch"
        | "stale_goal";
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
  return {
    awayScore: message.scoreboard.away,
    awayTeamId: String(message.teams.away),
    endedAt: message.endedAt ?? null,
    homeScore: message.scoreboard.home,
    homeTeamId: String(message.teams.home),
    matchClockSeconds: message.time ?? null,
    matchId: message.matchId === null || message.matchId === undefined
      ? null
      : String(message.matchId),
    paused: message.paused ?? false,
    period: message.period === undefined ? null : String(message.period),
    scored: message.scoreboard.scored
      ? {
          date: message.scoreboard.scored.date,
          id: String(message.scoreboard.scored.id),
          side: message.scoreboard.scored.side
        }
      : null,
    startedAt: message.startedAt ?? null,
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
    const matchIdentity = identityFor(status);
    const previous = this.previous;
    this.previous = status;
    if (!previous) {
      const reason = this.reconnectPending ? "reconnect" : "initial";
      this.reconnectPending = false;
      return { kind: "baseline", reason };
    }
    if (identityFor(previous) !== matchIdentity) {
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
    const scoringTeamId = expectedSide === "home"
      ? status.homeTeamId
      : status.awayTeamId;
    const mapping = mappingFor(mappings, scoringTeamId);
    return {
      goal: {
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
        scorerName: null,
        scoringTeamKey: scoringTeamId,
        scoringSide: mapping?.side ?? "unknown",
        sourceUpdateId: status.updateId
      },
      kind: "goal"
    };
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

function identityFor(status: LedScoresStatus) {
  return status.matchId
    ? `match:${status.matchId}`
    : `fixture:${status.homeTeamId}:${status.awayTeamId}:${status.startedAt ?? "unknown"}`;
}

function mappingFor(mappings: LedScoresTeamMapping[], teamId: string) {
  const normalized = teamId.trim().toLowerCase();
  return mappings.find((mapping) => mapping.teamKey.trim().toLowerCase() === normalized);
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
