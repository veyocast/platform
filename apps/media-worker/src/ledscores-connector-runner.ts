import { createClient } from "@supabase/supabase-js";
import {
  LedScoresGoalDetector,
  LedScoresProtocolError,
  createLedScoresUrl,
  parseLedScoresMessage,
  type LedScoresGoal,
  type LedScoresStatus,
  type LedScoresTeamMapping
} from "@veyocast/integrations/server";

export type ClaimedLedScoresConnection = {
  clubSlug: string;
  connectionId: string;
  endpointUrl: string;
  mappings: LedScoresTeamMapping[];
  tenantId: string;
};

export type LedScoresConnectorEvent = {
  connectionId: string;
  deliveryCount?: number;
  errorCode?: string;
  outcome:
    | "connected"
    | "disconnected"
    | "goal_dispatched"
    | "goal_suppressed"
    | "invalid_message"
    | "lease_lost"
    | "reconnecting";
};

type RpcClient = {
  rpc(
    functionName: string,
    parameters: Record<string, unknown>
  ): Promise<{ data: unknown; error: { code?: string } | null }>;
};

export interface LedScoresConnectorBackend {
  claim(workerId: string, leaseSeconds: number, limit: number): Promise<ClaimedLedScoresConnection[]>;
  cleanup?(): Promise<void>;
  dispatch(connection: ClaimedLedScoresConnection, workerId: string, goal: LedScoresGoal): Promise<number>;
  recordState(input: {
    baseline?: LedScoresStatus;
    connectionId: string;
    detail: Record<string, unknown>;
    eventType: string;
    healthStatus: "connected" | "disconnected" | "error" | "reconnecting";
    invalidMessage?: boolean;
    severity: "error" | "info" | "warning";
    sourceMessageAt?: string;
    workerId: string;
  }): Promise<boolean>;
  release(connectionId: string, workerId: string, reason: string): Promise<boolean>;
  renew(connectionId: string, workerId: string, leaseSeconds: number): Promise<boolean>;
  touch(connectionId: string, workerId: string, status: LedScoresStatus): Promise<boolean>;
}

export class SupabaseLedScoresConnectorBackend implements LedScoresConnectorBackend {
  private readonly client: RpcClient;

  constructor(supabaseUrl: string, serviceRoleKey: string, client?: RpcClient) {
    this.client = client ?? createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    }) as unknown as RpcClient;
  }

  async claim(workerId: string, leaseSeconds: number, limit: number) {
    const result = await this.client.rpc("claim_ledscores_connections_v1", {
      p_lease_seconds: leaseSeconds,
      p_limit: limit,
      p_worker_id: workerId
    });
    if (result.error) throw new Error("ledscores_claim_failed");
    if (!Array.isArray(result.data)) return [];
    return result.data.map(parseClaimedConnection);
  }

  async cleanup() {
    const result = await this.client.rpc("cleanup_ledscores_runtime_v1", {});
    if (result.error) throw new Error("ledscores_cleanup_failed");
  }

  async renew(connectionId: string, workerId: string, leaseSeconds: number) {
    const result = await this.client.rpc("renew_ledscores_connection_lease_v1", {
      p_connection_id: connectionId,
      p_lease_seconds: leaseSeconds,
      p_worker_id: workerId
    });
    if (result.error) throw new Error("ledscores_lease_renew_failed");
    return result.data === true;
  }

  async touch(connectionId: string, workerId: string, status: LedScoresStatus) {
    const result = await this.client.rpc("touch_ledscores_connection_v1", {
      p_baseline: status,
      p_connection_id: connectionId,
      p_source_message_at: status.updatedAt,
      p_worker_id: workerId
    });
    if (result.error) throw new Error("ledscores_touch_failed");
    return result.data === true;
  }

  async recordState(input: Parameters<LedScoresConnectorBackend["recordState"]>[0]) {
    const result = await this.client.rpc("record_ledscores_connector_state_v1", {
      p_baseline: input.baseline ?? null,
      p_connection_id: input.connectionId,
      p_detail: input.detail,
      p_event_type: input.eventType,
      p_health_status: input.healthStatus,
      p_invalid_message: input.invalidMessage ?? false,
      p_severity: input.severity,
      p_source_message_at: input.sourceMessageAt ?? null,
      p_worker_id: input.workerId
    });
    if (result.error) throw new Error("ledscores_state_record_failed");
    return result.data === true;
  }

  async dispatch(
    connection: ClaimedLedScoresConnection,
    workerId: string,
    goal: LedScoresGoal
  ) {
    const result = await this.client.rpc("dispatch_ledscores_goal_v1", {
      p_alert_id: null,
      p_away_score: goal.awayScore,
      p_away_team: goal.awayTeam,
      p_canonical_key: goal.canonicalKey,
      p_connection_id: connection.connectionId,
      p_event_kind: "live",
      p_home_score: goal.homeScore,
      p_home_team: goal.homeTeam,
      p_match_clock: goal.matchClock,
      p_match_identity: goal.matchIdentity,
      p_previous_away_score: goal.previousAwayScore,
      p_previous_home_score: goal.previousHomeScore,
      p_scoreboard_side: goal.scoreboardSide,
      p_scorer_name: goal.scorerName,
      p_scoring_team_key: goal.scoringTeamKey,
      p_scoring_side: goal.scoringSide,
      p_source_observed_at: goal.scoredAt,
      p_source_update_id: goal.sourceUpdateId,
      p_worker_id: workerId
    });
    if (result.error || !isRecord(result.data)) {
      throw new Error("ledscores_goal_dispatch_failed");
    }
    const count = Number(result.data.deliveryCount ?? 0);
    if (!Number.isSafeInteger(count) || count < 0) {
      throw new Error("ledscores_goal_dispatch_invalid");
    }
    return count;
  }

  async release(connectionId: string, workerId: string, reason: string) {
    const result = await this.client.rpc("release_ledscores_connection_lease_v1", {
      p_connection_id: connectionId,
      p_reason: reason.slice(0, 500),
      p_worker_id: workerId
    });
    if (result.error) return false;
    return result.data === true;
  }
}

export async function runLedScoresConnectorLoop({
  backend,
  claimIntervalMs,
  connectTimeoutMs = 10_000,
  inactivityTimeoutMs = 45_000,
  leaseSeconds,
  maxConnections,
  onEvent = () => undefined,
  persistIntervalMs = 15_000,
  random = Math.random,
  signal,
  webSocketFactory = (url) => new WebSocket(url),
  workerId
}: {
  backend: LedScoresConnectorBackend;
  claimIntervalMs: number;
  connectTimeoutMs?: number;
  inactivityTimeoutMs?: number;
  leaseSeconds: number;
  maxConnections: number;
  onEvent?: (event: LedScoresConnectorEvent) => void;
  persistIntervalMs?: number;
  random?: () => number;
  signal: AbortSignal;
  webSocketFactory?: (url: string) => WebSocket;
  workerId: string;
}) {
  const active = new Map<string, Promise<void>>();
  let nextCleanupAt = 0;
  while (!signal.aborted) {
    if (backend.cleanup && Date.now() >= nextCleanupAt) {
      nextCleanupAt = Date.now() + 6 * 60 * 60 * 1_000;
      try { await backend.cleanup(); }
      catch {
        // Retention is diagnostic housekeeping and may never block live claims.
        nextCleanupAt = Date.now() + 15 * 60 * 1_000;
      }
    }
    try {
      const capacity = Math.max(0, maxConnections - active.size);
      if (capacity > 0) {
        const claims = await backend.claim(workerId, leaseSeconds, capacity);
        for (const connection of claims) {
          if (signal.aborted || active.has(connection.connectionId)) continue;
          const task = runClaimedConnection({
            backend,
            connectTimeoutMs,
            connection,
            inactivityTimeoutMs,
            leaseSeconds,
            onEvent,
            persistIntervalMs,
            random,
            signal,
            webSocketFactory,
            workerId
          }).finally(() => active.delete(connection.connectionId));
          active.set(connection.connectionId, task);
        }
      }
    } catch {
      // A transient database outage must not tear down healthy source sockets.
    }
    await abortableDelay(claimIntervalMs, signal);
  }
  await Promise.allSettled(active.values());
}

async function runClaimedConnection({
  backend,
  connectTimeoutMs,
  connection,
  inactivityTimeoutMs,
  leaseSeconds,
  onEvent,
  persistIntervalMs,
  random,
  signal,
  webSocketFactory,
  workerId
}: {
  backend: LedScoresConnectorBackend;
  connectTimeoutMs: number;
  connection: ClaimedLedScoresConnection;
  inactivityTimeoutMs: number;
  leaseSeconds: number;
  onEvent: (event: LedScoresConnectorEvent) => void;
  persistIntervalMs: number;
  random: () => number;
  signal: AbortSignal;
  webSocketFactory: (url: string) => WebSocket;
  workerId: string;
}) {
  const detector = new LedScoresGoalDetector();
  const persistence = {
    lastInvalidAt: 0,
    lastSuppressedAt: 0,
    lastTouchAt: 0
  };
  let attempt = 0;
  let releaseReason = "worker_shutdown";
  try {
    while (!signal.aborted) {
      try {
        if (connection.endpointUrl !== createLedScoresUrl(connection.clubSlug)) {
          throw new Error("ledscores_endpoint_not_allowlisted");
        }
        if (attempt > 0) detector.markReconnected();
        await consumeSocket({
          backend,
          connectTimeoutMs,
          connection,
          detector,
          inactivityTimeoutMs,
          isReconnect: attempt > 0,
          leaseSeconds,
          onEvent,
          persistIntervalMs,
          persistence,
          signal,
          webSocketFactory,
          workerId
        });
        if (signal.aborted) break;
        attempt += 1;
        onEvent({ connectionId: connection.connectionId, outcome: "reconnecting" });
        await backend.recordState({
          connectionId: connection.connectionId,
          detail: { attempt, message: "Websocket verbroken; gecontroleerde reconnect gepland." },
          eventType: "reconnecting",
          healthStatus: "reconnecting",
          severity: "warning",
          workerId
        });
        await abortableDelay(reconnectDelayMs(attempt, random), signal);
      } catch (error) {
        if (error instanceof LeaseLostError) {
          releaseReason = "lease_lost";
          onEvent({ connectionId: connection.connectionId, outcome: "lease_lost" });
          break;
        }
        if (signal.aborted) break;
        attempt += 1;
        const code = safeErrorCode(error);
        onEvent({
          connectionId: connection.connectionId,
          errorCode: code,
          outcome: "disconnected"
        });
        try {
          const owned = await backend.recordState({
            connectionId: connection.connectionId,
            detail: { code, message: "LED Scores-verbinding tijdelijk niet beschikbaar." },
            eventType: "connection_error",
            healthStatus: "error",
            severity: "error",
            workerId
          });
          if (!owned) throw new LeaseLostError();
        } catch (recordError) {
          if (recordError instanceof LeaseLostError) break;
        }
        await abortableDelay(reconnectDelayMs(attempt, random), signal);
      }
    }
  } finally {
    await backend.release(connection.connectionId, workerId, releaseReason);
  }
}

async function consumeSocket({
  backend,
  connectTimeoutMs,
  connection,
  detector,
  inactivityTimeoutMs,
  isReconnect,
  leaseSeconds,
  onEvent,
  persistIntervalMs,
  persistence,
  signal,
  webSocketFactory,
  workerId
}: {
  backend: LedScoresConnectorBackend;
  connectTimeoutMs: number;
  connection: ClaimedLedScoresConnection;
  detector: LedScoresGoalDetector;
  inactivityTimeoutMs: number;
  isReconnect: boolean;
  leaseSeconds: number;
  onEvent: (event: LedScoresConnectorEvent) => void;
  persistIntervalMs: number;
  persistence: {
    lastInvalidAt: number;
    lastSuppressedAt: number;
    lastTouchAt: number;
  };
  signal: AbortSignal;
  webSocketFactory: (url: string) => WebSocket;
  workerId: string;
}) {
  const socket = webSocketFactory(connection.endpointUrl);
  let messageQueue = Promise.resolve();
  let settled = false;
  await new Promise<void>((resolve, reject) => {
    let inactivityTimer: ReturnType<typeof setTimeout> | null = null;
    const connectTimer = setTimeout(() => {
      finish(new Error("ledscores_connect_timeout"));
      try { socket.close(4000, "connect timeout"); } catch { /* noop */ }
    }, Math.max(25, connectTimeoutMs));
    const resetInactivityTimer = () => {
      if (inactivityTimer) clearTimeout(inactivityTimer);
      inactivityTimer = setTimeout(() => {
        finish(new Error("ledscores_message_timeout"));
        try { socket.close(4000, "message timeout"); } catch { /* noop */ }
      }, Math.max(50, inactivityTimeoutMs));
    };
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(connectTimer);
      if (inactivityTimer) clearTimeout(inactivityTimer);
      clearInterval(leaseTimer);
      signal.removeEventListener("abort", abort);
      void messageQueue.finally(() => error ? reject(error) : resolve());
    };
    const abort = () => {
      try { socket.close(1000, "worker draining"); } catch { /* noop */ }
      finish();
    };
    const leaseTimer = setInterval(() => {
      void backend.renew(connection.connectionId, workerId, leaseSeconds)
        .then((owned) => {
          if (!owned) {
            finish(new LeaseLostError());
            try { socket.close(4001, "lease lost"); } catch { /* noop */ }
          }
        })
        .catch(() => {
          finish(new LeaseLostError());
          try { socket.close(1011, "lease renewal failed"); } catch { /* noop */ }
        });
    }, Math.max(5_000, Math.floor(leaseSeconds * 500)));
    socket.addEventListener("open", () => {
      clearTimeout(connectTimer);
      resetInactivityTimer();
      messageQueue = messageQueue.then(async () => {
        const owned = await backend.recordState({
          connectionId: connection.connectionId,
          detail: { message: isReconnect
            ? "Read-only websocketverbinding hersteld."
            : "Read-only websocketverbinding geopend." },
          eventType: isReconnect ? "reconnected" : "connected",
          healthStatus: "connected",
          severity: "info",
          workerId
        });
        if (!owned) throw new LeaseLostError();
        onEvent({ connectionId: connection.connectionId, outcome: "connected" });
      }).catch((error) => finish(asError(error)));
    }, { once: true });
    socket.addEventListener("message", (event) => {
      resetInactivityTimer();
      messageQueue = messageQueue
        .then(() => handleMessage({
          backend,
          connection,
          detector,
          event,
          onEvent,
          persistIntervalMs,
          persistence,
          workerId
        }))
        .catch((error) => finish(asError(error)));
    });
    socket.addEventListener("close", () => {
      onEvent({ connectionId: connection.connectionId, outcome: "disconnected" });
      finish();
    }, { once: true });
    socket.addEventListener("error", () => {
      try { socket.close(1011, "transport error"); } catch { /* noop */ }
    }, { once: true });
    signal.addEventListener("abort", abort, { once: true });
  });
}

async function handleMessage({
  backend,
  connection,
  detector,
  event,
  onEvent,
  persistIntervalMs,
  persistence,
  workerId
}: {
  backend: LedScoresConnectorBackend;
  connection: ClaimedLedScoresConnection;
  detector: LedScoresGoalDetector;
  event: MessageEvent;
  onEvent: (event: LedScoresConnectorEvent) => void;
  persistIntervalMs: number;
  persistence: {
    lastInvalidAt: number;
    lastSuppressedAt: number;
    lastTouchAt: number;
  };
  workerId: string;
}) {
  let status: LedScoresStatus;
  try {
    if (typeof event.data === "string" || event.data instanceof ArrayBuffer) {
      status = parseLedScoresMessage(event.data);
    } else {
      throw new LedScoresProtocolError(
        "LEDSCORES_MESSAGE_INVALID",
        "LED Scores gaf een niet-ondersteund berichttype terug."
      );
    }
  } catch (error) {
    const code = safeErrorCode(error);
    const now = Date.now();
    if (now - persistence.lastInvalidAt >= 30_000) {
      persistence.lastInvalidAt = now;
      await backend.recordState({
        connectionId: connection.connectionId,
        detail: { code, message: "Ongeldig extern scorebericht onderdrukt." },
        eventType: "invalid_message",
        healthStatus: "connected",
        invalidMessage: true,
        severity: "warning",
        workerId
      });
      onEvent({ connectionId: connection.connectionId, errorCode: code, outcome: "invalid_message" });
    }
    return;
  }
  const observation = detector.observe({
    connectionId: connection.connectionId,
    mappings: connection.mappings,
    status
  });
  const now = Date.now();
  if (
    observation.kind === "baseline"
    || observation.kind === "goal"
    || now - persistence.lastTouchAt >= persistIntervalMs
  ) {
    const owned = await backend.touch(connection.connectionId, workerId, status);
    if (!owned) throw new LeaseLostError();
    persistence.lastTouchAt = now;
  }
  if (observation.kind === "baseline") {
    await backend.recordState({
      baseline: status,
      connectionId: connection.connectionId,
      detail: {
        awayScore: status.awayScore,
        awayTeamId: status.awayTeamId,
        homeScore: status.homeScore,
        homeTeamId: status.homeTeamId,
        message: "Veilige baseline vastgelegd; bestaande score niet afgespeeld.",
        reason: observation.reason
      },
      eventType: "baseline_established",
      healthStatus: "connected",
      severity: "info",
      sourceMessageAt: status.updatedAt,
      workerId
    });
    return;
  }
  if (observation.kind !== "goal") {
    if (
      observation.reason !== "no_score_change"
      && now - persistence.lastSuppressedAt >= 30_000
    ) {
      persistence.lastSuppressedAt = now;
      await backend.recordState({
        connectionId: connection.connectionId,
        detail: {
          message: "Scoreovergang veilig onderdrukt.",
          reason: observation.reason
        },
        eventType: "goal_suppressed",
        healthStatus: "connected",
        severity: "warning",
        sourceMessageAt: status.updatedAt,
        workerId
      });
      onEvent({ connectionId: connection.connectionId, outcome: "goal_suppressed" });
    }
    return;
  }
  const deliveryCount = await backend.dispatch(
    connection,
    workerId,
    observation.goal
  );
  onEvent({
    connectionId: connection.connectionId,
    deliveryCount,
    outcome: deliveryCount > 0 ? "goal_dispatched" : "goal_suppressed"
  });
}

function parseClaimedConnection(value: unknown): ClaimedLedScoresConnection {
  if (!isRecord(value)) throw new Error("ledscores_claim_invalid");
  const connectionId = requiredString(value.connection_id, "connectionId");
  const tenantId = requiredString(value.tenant_id, "tenantId");
  const clubSlug = requiredString(value.club_slug, "clubSlug");
  const endpointUrl = requiredString(value.endpoint_url, "endpointUrl");
  if (!Array.isArray(value.mappings)) throw new Error("ledscores_claim_invalid");
  const mappings = value.mappings.map((mapping) => {
    if (!isRecord(mapping)) throw new Error("ledscores_claim_invalid");
    const side = requiredString(mapping.side, "side");
    if (side !== "own" && side !== "opponent") throw new Error("ledscores_claim_invalid");
    return {
      side: side as "own" | "opponent",
      teamKey: requiredString(mapping.teamKey, "teamKey"),
      teamName: requiredString(mapping.teamName, "teamName")
    };
  });
  if (endpointUrl !== createLedScoresUrl(clubSlug)) {
    throw new Error("ledscores_claim_endpoint_invalid");
  }
  return { clubSlug, connectionId, endpointUrl, mappings, tenantId };
}

function reconnectDelayMs(attempt: number, random: () => number) {
  const ceiling = Math.min(30_000, 500 * 2 ** Math.min(6, Math.max(0, attempt - 1)));
  return Math.floor(ceiling * (0.75 + random() * 0.5));
}

async function abortableDelay(milliseconds: number, signal: AbortSignal) {
  if (signal.aborted) return;
  await new Promise<void>((resolve) => {
    const timer = setTimeout(done, milliseconds);
    function done() {
      clearTimeout(timer);
      signal.removeEventListener("abort", done);
      resolve();
    }
    signal.addEventListener("abort", done, { once: true });
  });
}

class LeaseLostError extends Error {
  constructor() {
    super("ledscores_lease_lost");
    this.name = "LeaseLostError";
  }
}

function safeErrorCode(error: unknown) {
  if (error instanceof LedScoresProtocolError) return error.code;
  if (error instanceof Error && /^[a-zA-Z0-9_:-]{2,80}$/.test(error.message)) {
    return error.message;
  }
  return "ledscores_unavailable";
}

function asError(error: unknown) {
  return error instanceof Error ? error : new Error("ledscores_unavailable");
}

function requiredString(value: unknown, field: string) {
  if (typeof value !== "string" || !value) {
    throw new Error(`ledscores_claim_invalid_${field}`);
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
