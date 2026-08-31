import { createClient } from "@supabase/supabase-js";
import {
  LedScoresProtocolError,
  LedScoresSemanticEventDetector,
  createLedScoresMatchIdentity,
  createLedScoresUrl,
  normalizeLedScoresTeamKey,
  parseLedScoresMessage,
  type LedScoresGoal,
  type LedScoresGoalScorerEnrichment,
  type LedScoresPlayer,
  type LedScoresSemanticEvent,
  type LedScoresSide,
  type LedScoresStatus,
  type LedScoresTeamMapping
} from "@veyocast/integrations/server";

import {
  LED_SCORES_PLAYER_PHOTO_REVALIDATE_MS,
  LedScoresPlayerAssetImporter,
  SupabaseLedScoresPlayerAssetRegistry,
  type LedScoresPlayerAssetDatabase
} from "./ledscores-player-assets";

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

export type LedScoresPlayerSnapshot = {
  active: boolean;
  name: string;
  number: number | null;
  photoProviderAssetVersionId: string | null;
  photoSourceUrl: string | null;
  playerKey: string;
  teamKey: string;
};

export type LedScoresAcceptedPlayer = {
  playerKey: string;
  teamKey: string;
};

export type LedScoresMatchOverlayType =
  | "half_time"
  | "lineup"
  | "lineup_clear"
  | "match_end"
  | "match_start";

export type LedScoresLiveMatchState = Record<string, unknown>;

type RpcClient = {
  rpc(
    functionName: string,
    parameters: Record<string, unknown>
  ): Promise<{ data: unknown; error: { code?: string } | null }>;
};

type ConnectorPersistence = {
  acceptedPlayerKeys: Set<string>;
  clockDirection: "down" | "up";
  hydratingPlayerKeys: Set<string>;
  lastInvalidAt: number;
  lastRosterFingerprint: string | null;
  lastRosterSyncAt: number;
  lastStateAt: number;
  lastStateFingerprint: string | null;
  lastSuppressedAt: number;
  lastTouchAt: number;
  playerAssetVersions: Map<string, string>;
  playerAssetSourceUrls: Map<string, string>;
  playerAssetValidatedAt: Map<string, number>;
  playerSync: Promise<void> | null;
  photoRetryAfter: Map<string, number>;
  previousStatus: LedScoresStatus | null;
  scheduledGoalPhotoKeys: Set<string>;
};

export interface LedScoresConnectorBackend {
  claim(workerId: string, leaseSeconds: number, limit: number): Promise<ClaimedLedScoresConnection[]>;
  cleanup?(): Promise<void>;
  dispatch(connection: ClaimedLedScoresConnection, workerId: string, goal: LedScoresGoal): Promise<number>;
  dispatchOverlay(input: {
    canonicalKey: string;
    connectionId: string;
    eventType: LedScoresMatchOverlayType;
    payload: Record<string, unknown>;
    sourceObservedAt: string;
    sourceUpdateId: string | null;
    workerId: string;
  }): Promise<number>;
  enrichGoal(input: {
    connectionId: string;
    enrichment: LedScoresGoalScorerEnrichment;
    workerId: string;
  }): Promise<number>;
  hydratePlayerAssets?(
    connection: ClaimedLedScoresConnection,
    players: readonly LedScoresPlayerSnapshot[]
  ): Promise<ReadonlyMap<string, string>>;
  recordState(input: {
    baseline?: Record<string, unknown>;
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
  syncPlayers(input: {
    connectionId: string;
    players: readonly LedScoresPlayerSnapshot[];
    sourceObservedAt: string;
    workerId: string;
  }): Promise<readonly LedScoresAcceptedPlayer[]>;
  touch(
    connectionId: string,
    workerId: string,
    baseline: Record<string, unknown>,
    sourceMessageAt: string
  ): Promise<boolean>;
  upsertLiveState(input: {
    connectionId: string;
    sourceObservedAt: string;
    state: LedScoresLiveMatchState;
    workerId: string;
  }): Promise<void>;
}

export class SupabaseLedScoresConnectorBackend implements LedScoresConnectorBackend {
  private readonly client: RpcClient;
  private readonly playerAssetImporter: LedScoresPlayerAssetImporter | null;

  constructor(
    supabaseUrl: string,
    serviceRoleKey: string,
    client?: RpcClient,
    playerAssetImporter?: LedScoresPlayerAssetImporter | null
  ) {
    this.client = client ?? createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    }) as unknown as RpcClient;
    this.playerAssetImporter = playerAssetImporter === undefined
      ? client
        ? null
        : new LedScoresPlayerAssetImporter(
            new SupabaseLedScoresPlayerAssetRegistry(
              createClient<LedScoresPlayerAssetDatabase>(supabaseUrl, serviceRoleKey, {
                auth: { autoRefreshToken: false, persistSession: false }
              })
            )
          )
      : playerAssetImporter;
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

  async touch(
    connectionId: string,
    workerId: string,
    baseline: Record<string, unknown>,
    sourceMessageAt: string
  ) {
    const result = await this.client.rpc("touch_ledscores_connection_v1", {
      p_baseline: baseline,
      p_connection_id: connectionId,
      p_source_message_at: sourceMessageAt,
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
      p_scoring_team_key: normalizeLedScoresTeamKey(goal.scoringTeamKey),
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

  async dispatchOverlay(
    input: Parameters<LedScoresConnectorBackend["dispatchOverlay"]>[0]
  ) {
    const result = await this.client.rpc("dispatch_ledscores_match_overlay_v1", {
      p_canonical_key: input.canonicalKey,
      p_connection_id: input.connectionId,
      p_event_type: input.eventType,
      p_payload: input.payload,
      p_source_observed_at: input.sourceObservedAt,
      p_source_update_id: input.sourceUpdateId,
      p_worker_id: input.workerId
    });
    return deliveryCountFromRpc(result, "ledscores_match_overlay_dispatch");
  }

  async enrichGoal(input: Parameters<LedScoresConnectorBackend["enrichGoal"]>[0]) {
    const number = playerNumber(input.enrichment.scorer.number);
    const result = await this.client.rpc("enrich_ledscores_goal_v1", {
      p_connection_id: input.connectionId,
      p_goal_canonical_key: input.enrichment.goalCanonicalKey,
      p_player_name: input.enrichment.scorer.name,
      p_provider_player_key: input.enrichment.scorer.id,
      p_shirt_number: number,
      p_source_observed_at: input.enrichment.sourceObservedAt,
      p_source_update_id: input.enrichment.sourceUpdateId,
      p_worker_id: input.workerId
    });
    return deliveryCountFromRpc(result, "ledscores_goal_enrichment");
  }

  async syncPlayers(input: Parameters<LedScoresConnectorBackend["syncPlayers"]>[0]) {
    const result = await this.client.rpc("sync_ledscores_players_v1", {
      p_connection_id: input.connectionId,
      p_players: input.players.map((player) => ({
        active: player.active,
        name: player.name,
        number: player.number,
        photoProviderAssetVersionId: player.photoProviderAssetVersionId,
        photoSourceUrl: player.photoSourceUrl,
        playerKey: player.playerKey,
        teamKey: player.teamKey
      })),
      p_source_observed_at: input.sourceObservedAt,
      p_worker_id: input.workerId
    });
    if (result.error) throw new Error("ledscores_player_sync_failed");
    if (!isRecord(result.data) || !Array.isArray(result.data.acceptedPlayers)) {
      throw new Error("ledscores_player_sync_invalid");
    }
    return result.data.acceptedPlayers.map((value) => {
      if (!isRecord(value)) throw new Error("ledscores_player_sync_invalid");
      return {
        playerKey: requiredString(value.playerKey, "acceptedPlayerKey"),
        teamKey: normalizeLedScoresTeamKey(requiredString(value.teamKey, "acceptedTeamKey"))
      };
    });
  }

  async hydratePlayerAssets(
    connection: ClaimedLedScoresConnection,
    players: readonly LedScoresPlayerSnapshot[]
  ): Promise<ReadonlyMap<string, string>> {
    const importer = this.playerAssetImporter;
    const candidates = players.filter((player) => player.photoSourceUrl);
    if (!importer || candidates.length === 0) return new Map<string, string>();
    const imported = await mapWithConcurrency(candidates, 4, async (player) => {
      try {
        const sourceUrl = player.photoSourceUrl;
        if (!sourceUrl) return null;
        const versionId = await importer.importPlayerPhoto({
          connectionId: connection.connectionId,
          playerKey: player.playerKey,
          sourceUrl,
          teamKey: player.teamKey,
          tenantId: connection.tenantId
        });
        return [playerAssetKey(player.teamKey, player.playerKey), versionId] as const;
      } catch {
        // Provider media is optional enrichment; identity and score stay live.
        return null;
      }
    });
    return new Map<string, string>(imported.filter(
      (entry): entry is readonly [string, string] => entry !== null
    ));
  }

  async upsertLiveState(
    input: Parameters<LedScoresConnectorBackend["upsertLiveState"]>[0]
  ) {
    const result = await this.client.rpc("upsert_ledscores_live_match_state_v1", {
      p_connection_id: input.connectionId,
      p_source_observed_at: input.sourceObservedAt,
      p_state: input.state,
      p_worker_id: input.workerId
    });
    if (result.error) throw new Error("ledscores_live_match_state_failed");
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
  const detector = new LedScoresSemanticEventDetector();
  const persistence: ConnectorPersistence = {
    acceptedPlayerKeys: new Set(),
    clockDirection: "up",
    hydratingPlayerKeys: new Set(),
    lastInvalidAt: 0,
    lastRosterFingerprint: null,
    lastRosterSyncAt: 0,
    lastStateAt: 0,
    lastStateFingerprint: null,
    lastSuppressedAt: 0,
    lastTouchAt: 0,
    playerAssetVersions: new Map(),
    playerAssetSourceUrls: new Map(),
    playerAssetValidatedAt: new Map(),
    playerSync: null,
    photoRetryAfter: new Map(),
    previousStatus: null,
    scheduledGoalPhotoKeys: new Set()
  };
  let attempt = 0;
  let releaseReason = "worker_shutdown";
  try {
    while (!signal.aborted) {
      try {
        if (connection.endpointUrl !== createLedScoresUrl(connection.clubSlug)) {
          throw new Error("ledscores_endpoint_not_allowlisted");
        }
        if (attempt > 0) {
          detector.markReconnected();
          persistence.previousStatus = null;
        }
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

function safeBaseline(status: LedScoresStatus): Record<string, unknown> {
  return {
    awayScore: status.awayScore,
    awayTeamId: teamKeyFor(status, "away"),
    displayTeam: status.displayTeam,
    endedAt: status.endedAt,
    homeScore: status.homeScore,
    homeTeamId: teamKeyFor(status, "home"),
    matchClockSeconds: status.matchClockSeconds,
    matchId: status.matchId,
    matchState: status.matchState,
    paused: status.paused,
    period: status.period,
    rest: status.rest,
    startedAt: status.startedAt,
    updateId: status.updateId,
    updatedAt: status.updatedAt
  };
}

function playerSnapshots(
  status: LedScoresStatus,
  persistence: ConnectorPersistence
) {
  const snapshots = new Map<string, LedScoresPlayerSnapshot>();
  const add = (teamKey: string, player: LedScoresPlayer) => {
    const normalizedTeamKey = normalizeLedScoresTeamKey(teamKey);
    const playerKey = player.id.trim();
    const name = normalizedPlayerName(player.name);
    if (!normalizedTeamKey || !playerKey || !name) return;
    const key = playerAssetKey(normalizedTeamKey, playerKey);
    const current = snapshots.get(key);
    if (
      player.goalImageUrl
      && persistence.playerAssetSourceUrls.has(key)
      && persistence.playerAssetSourceUrls.get(key) !== player.goalImageUrl
    ) {
      persistence.playerAssetVersions.delete(key);
      persistence.playerAssetSourceUrls.delete(key);
      persistence.playerAssetValidatedAt.delete(key);
      persistence.photoRetryAfter.delete(key);
    }
    snapshots.set(key, {
      active: player.active ?? current?.active ?? true,
      name,
      number: playerNumber(player.number),
      photoProviderAssetVersionId: persistence.playerAssetVersions.get(key) ??
        current?.photoProviderAssetVersionId ?? null,
      photoSourceUrl: player.goalImageUrl ?? current?.photoSourceUrl ?? null,
      playerKey,
      teamKey: normalizedTeamKey
    });
  };
  for (const side of ["home", "away"] as const) {
    const teamKey = teamKeyFor(status, side);
    const byId = new Map(status.lineupPlayers[side].map((player) => [player.id, player]));
    for (const id of status.selectedLineupPlayerIds[side]) {
      const selected = byId.get(id);
      if (selected) add(teamKey, selected);
    }
    for (const scorer of status.scorers[side]) add(teamKey, scorer.player);
  }
  for (const side of ["home", "away"] as const) {
    const teamKey = teamKeyFor(status, side);
    for (const player of status.lineupPlayers[side]) add(teamKey, player);
  }
  return [...snapshots.values()].slice(0, 100);
}

function priorityPhotoPlayers(
  status: LedScoresStatus,
  players: readonly LedScoresPlayerSnapshot[]
) {
  const priorityKeys = new Set<string>();
  for (const side of ["home", "away"] as const) {
    const teamKey = teamKeyFor(status, side);
    for (const id of status.selectedLineupPlayerIds[side]) {
      priorityKeys.add(playerAssetKey(teamKey, id));
    }
    for (const scorer of status.scorers[side]) {
      priorityKeys.add(playerAssetKey(teamKey, scorer.player.id));
    }
  }
  const selectedAndScorers: LedScoresPlayerSnapshot[] = [];
  const activeFallback: LedScoresPlayerSnapshot[] = [];
  for (const player of players) {
    if (!player.photoSourceUrl) continue;
    const key = playerAssetKey(player.teamKey, player.playerKey);
    if (priorityKeys.has(key)) selectedAndScorers.push(player);
    else if (player.active) activeFallback.push(player);
  }
  return [...selectedAndScorers, ...activeFallback].slice(0, 30);
}

function schedulePlayerAssetHydration({
  backend,
  connection,
  persistence,
  players,
  workerId
}: {
  backend: LedScoresConnectorBackend;
  connection: ClaimedLedScoresConnection;
  persistence: ConnectorPersistence;
  players: readonly LedScoresPlayerSnapshot[];
  workerId: string;
}) {
  const hydratePlayerAssets = backend.hydratePlayerAssets?.bind(backend);
  if (!hydratePlayerAssets) return;
  const candidates = players.filter((player) => {
    const key = playerAssetKey(player.teamKey, player.playerKey);
    const validationAge = Date.now() - (persistence.playerAssetValidatedAt.get(key) ?? 0);
    return player.photoSourceUrl
      && (
        !persistence.playerAssetVersions.has(key)
        || validationAge >= LED_SCORES_PLAYER_PHOTO_REVALIDATE_MS
      )
      && !persistence.hydratingPlayerKeys.has(key)
      && Date.now() >= (persistence.photoRetryAfter.get(key) ?? 0);
  });
  if (!candidates.length) return;
  for (const player of candidates) {
    persistence.hydratingPlayerKeys.add(playerAssetKey(player.teamKey, player.playerKey));
  }
  const previous = persistence.playerSync ?? Promise.resolve();
  const task = previous.catch(() => undefined).then(async () => {
    try {
      const imported = await hydratePlayerAssets(connection, candidates);
      const hydrated: LedScoresPlayerSnapshot[] = [];
      for (const player of candidates) {
        const key = playerAssetKey(player.teamKey, player.playerKey);
        const versionId = imported.get(key);
        if (!versionId) {
          persistence.photoRetryAfter.set(key, Date.now() + 5 * 60_000);
          continue;
        }
        hydrated.push({ ...player, photoProviderAssetVersionId: versionId });
      }
      if (hydrated.length) {
        const accepted = await backend.syncPlayers({
          connectionId: connection.connectionId,
          players: hydrated,
          sourceObservedAt: new Date().toISOString(),
          workerId
        });
        const acceptedKeys = new Set(accepted.map((player) =>
          playerAssetKey(player.teamKey, player.playerKey)
        ));
        for (const player of hydrated) {
          const key = playerAssetKey(player.teamKey, player.playerKey);
          if (!acceptedKeys.has(key)) {
            persistence.acceptedPlayerKeys.delete(key);
            persistence.photoRetryAfter.delete(key);
            continue;
          }
          if (!player.photoProviderAssetVersionId || !player.photoSourceUrl) continue;
          persistence.playerAssetVersions.set(key, player.photoProviderAssetVersionId);
          persistence.playerAssetSourceUrls.set(key, player.photoSourceUrl);
          persistence.playerAssetValidatedAt.set(key, Date.now());
          persistence.photoRetryAfter.delete(key);
        }
      }
    } catch {
      // A missing provider image never interrupts score, clock or overlays.
      for (const player of candidates) {
        persistence.photoRetryAfter.set(
          playerAssetKey(player.teamKey, player.playerKey),
          Date.now() + 60_000
        );
      }
    } finally {
      for (const player of candidates) {
        persistence.hydratingPlayerKeys.delete(
          playerAssetKey(player.teamKey, player.playerKey)
        );
      }
    }
  });
  persistence.playerSync = task;
  void task.then(() => {
    if (persistence.playerSync === task) persistence.playerSync = null;
  });
}

function scheduleGoalPhotoEnrichment({
  backend,
  connection,
  enrichment,
  persistence,
  workerId
}: {
  backend: LedScoresConnectorBackend;
  connection: ClaimedLedScoresConnection;
  enrichment: LedScoresGoalScorerEnrichment;
  persistence: ConnectorPersistence;
  workerId: string;
}) {
  if (!enrichment.scorer.goalImageUrl) return;
  const playerKey = playerAssetKey(enrichment.scoringTeamKey, enrichment.scorer.id);
  const pending = persistence.playerSync;
  if (!pending) return;
  const scheduleKey = playerAssetKey(enrichment.goalCanonicalKey, enrichment.scorer.id);
  if (persistence.scheduledGoalPhotoKeys.has(scheduleKey)) return;
  persistence.scheduledGoalPhotoKeys.add(scheduleKey);
  void pending.then(async () => {
    if (!persistence.playerAssetVersions.has(playerKey)) return;
    await backend.enrichGoal({
      connectionId: connection.connectionId,
      enrichment: {
        ...enrichment,
        sourceUpdateId: `photo:${enrichment.goalCanonicalKey}`
      },
      workerId
    });
  }).catch(() => undefined).finally(() => {
    persistence.scheduledGoalPhotoKeys.delete(scheduleKey);
  });
}

function goalEnrichment(
  goal: LedScoresGoal,
  status: LedScoresStatus
): LedScoresGoalScorerEnrichment {
  const scorer = goal.scorer;
  if (!scorer) throw new Error("ledscores_goal_scorer_missing");
  return {
    canonicalKey: goal.canonicalKey,
    goalCanonicalKey: goal.canonicalKey,
    matchIdentity: goal.matchIdentity,
    resultingScore: goal.scoreboardSide === "home" ? goal.homeScore : goal.awayScore,
    scoreboardSide: goal.scoreboardSide,
    scorer,
    scoringTeamKey: normalizeLedScoresTeamKey(goal.scoringTeamKey),
    sourceObservedAt: status.updatedAt,
    sourceUpdateId: goal.sourceUpdateId
  };
}

function updateClockDirection(
  persistence: ConnectorPersistence,
  previous: LedScoresStatus | null,
  status: LedScoresStatus
) {
  if (!previous || createLedScoresMatchIdentity(previous) !== createLedScoresMatchIdentity(status)) {
    persistence.clockDirection = "up";
    return;
  }
  if (previous.matchClockSeconds === null || status.matchClockSeconds === null) return;
  const delta = status.matchClockSeconds - previous.matchClockSeconds;
  if (delta > 0) persistence.clockDirection = "up";
  if (delta < 0) persistence.clockDirection = "down";
}

function liveStateFingerprint(
  status: LedScoresStatus,
  acceptedPlayers: readonly LedScoresPlayerSnapshot[],
  direction: "down" | "up"
) {
  const acceptedKeys = new Set(acceptedPlayers.map((player) =>
    playerAssetKey(player.teamKey, player.playerKey)
  ));
  return JSON.stringify({
    awayScore: status.awayScore,
    awayTeamId: teamKeyFor(status, "away"),
    displayTeam: status.displayTeam,
    direction,
    endedAt: status.endedAt,
    homeScore: status.homeScore,
    homeTeamId: teamKeyFor(status, "home"),
    matchId: status.matchId,
    matchState: status.matchState,
    period: status.period,
    startedAt: status.startedAt,
    timeline: matchTimeline(status, acceptedKeys)
  });
}

export function createLedScoresLiveMatchState({
  acceptedPlayers,
  connection,
  direction,
  status
}: {
  acceptedPlayers: readonly LedScoresPlayerSnapshot[];
  connection: ClaimedLedScoresConnection;
  direction: "down" | "up";
  status: LedScoresStatus;
}): LedScoresLiveMatchState {
  const acceptedKeys = new Set(acceptedPlayers.map((player) =>
    playerAssetKey(player.teamKey, player.playerKey)
  ));
  return {
    away: teamView(status, "away", connection.mappings),
    awayTeamKey: teamKeyFor(status, "away"),
    clock: status.matchClockSeconds === null
      ? null
      : {
          anchorAt: status.updatedAt,
          anchorSeconds: boundedClockSeconds(status.matchClockSeconds),
          direction,
          maxSeconds: null,
          running: status.matchState === "running"
        },
    connectionId: connection.connectionId,
    home: teamView(status, "home", connection.mappings),
    homeTeamKey: teamKeyFor(status, "home"),
    matchKey: createLedScoresMatchIdentity(status),
    periodLabel: periodLabel(status.period),
    schemaVersion: 1,
    sourceUpdateId: status.updateId ?? status.updatedAt,
    sourceUpdatedAt: status.updatedAt,
    staleAfter: 30,
    stateRevision: status.updateId ?? status.updatedAt,
    status: publicMatchStatus(status),
    timeline: matchTimeline(status, acceptedKeys)
  };
}

function matchOverlayForEvent(
  event: LedScoresSemanticEvent,
  status: LedScoresStatus,
  mappings: LedScoresTeamMapping[],
  assetVersions: ReadonlyMap<string, string>,
  acceptedPlayerKeys: ReadonlySet<string>
) {
  if (event.kind === "goal" || event.kind === "goal_scorer_enriched" ||
    event.kind === "match_rest_ended") return null;
  const commonPayload = {
    away: teamView(status, "away", mappings),
    awayTeamKey: teamKeyFor(status, "away"),
    home: teamView(status, "home", mappings),
    homeTeamKey: teamKeyFor(status, "home"),
    matchClock: displayClock(status.matchClockSeconds, status.period),
    matchKey: event.matchIdentity,
    periodLabel: periodLabel(status.period),
    schemaVersion: 1,
    sourceUpdatedAt: status.updatedAt
  };
  if (event.kind === "lineup_display_requested" ||
    event.kind === "lineup_display_switched") {
    const selectedPlayers = event.display.players.flatMap((player) => {
      const key = playerAssetKey(event.display.teamKey, player.id);
      if (!acceptedPlayerKeys.has(key)) return [];
      const serialized = publicPlayer(player, event.display.teamKey, assetVersions);
      return serialized ? [serialized] : [];
    });
    const activePlayers = status.lineupPlayers[event.display.side]
      .filter((player) => player.active === true)
      .flatMap((player) => {
        const key = playerAssetKey(event.display.teamKey, player.id);
        if (!acceptedPlayerKeys.has(key)) return [];
        const serialized = publicPlayer(player, event.display.teamKey, assetVersions);
        return serialized ? [serialized] : [];
      })
      .slice(0, 24);
    if (!selectedPlayers.length && !activePlayers.length) return null;
    return {
      canonicalKey: event.canonicalKey,
      eventType: "lineup" as const,
      payload: {
        ...commonPayload,
        activePlayers,
        selectedPlayers,
        side: event.display.side,
        teamKey: normalizeLedScoresTeamKey(event.display.teamKey)
      },
      sourceObservedAt: event.sourceObservedAt,
      sourceUpdateId: event.sourceUpdateId
    };
  }
  if (event.kind === "lineup_display_cleared") {
    return {
      canonicalKey: event.canonicalKey,
      eventType: "lineup_clear" as const,
      payload: {
        ...commonPayload,
        lineup: [],
        side: event.previousSide,
        teamKey: teamKeyFor(status, event.previousSide)
      },
      sourceObservedAt: event.sourceObservedAt,
      sourceUpdateId: event.sourceUpdateId
    };
  }
  const eventType = event.kind === "match_started"
    ? "match_start" as const
    : event.kind === "match_rest_started"
      ? "half_time" as const
      : "match_end" as const;
  return {
    canonicalKey: event.canonicalKey,
    eventType,
    payload: commonPayload,
    sourceObservedAt: event.sourceObservedAt,
    sourceUpdateId: event.sourceUpdateId
  };
}

function teamView(
  status: LedScoresStatus,
  side: LedScoresSide,
  mappings: LedScoresTeamMapping[]
) {
  const teamKey = teamKeyFor(status, side);
  const mapping = mappings.find((candidate) =>
    normalizeLedScoresTeamKey(candidate.teamKey) === teamKey
  );
  return {
    name: normalizedTeamName(mapping?.teamName) ??
      (side === "home" ? "Thuisteam" : "Uitteam"),
    score: side === "home" ? status.homeScore : status.awayScore,
    teamKey
  };
}

function publicPlayer(
  player: LedScoresPlayer,
  teamKey: string,
  assetVersions: ReadonlyMap<string, string>
) {
  const id = player.id.trim();
  const name = normalizedPlayerName(player.name);
  if (!id || !name) return null;
  const assetVersionId = assetVersions.get(playerAssetKey(teamKey, id));
  return {
    id,
    name,
    number: playerNumber(player.number),
    ...(assetVersionId
      ? { photoProviderAssetVersionId: assetVersionId }
      : {})
  };
}

function matchTimeline(status: LedScoresStatus, acceptedKeys: ReadonlySet<string>) {
  const scorers = (["home", "away"] as const).flatMap((side) =>
    status.scorers[side].map((scorer, index) => ({
      index,
      scorer,
      side,
      sortPeriod: numericPeriod(scorer.period),
      sortTime: scorer.matchClockSeconds ?? Number.MAX_SAFE_INTEGER
    }))
  ).sort((left, right) =>
    left.sortPeriod - right.sortPeriod
    || left.sortTime - right.sortTime
    || left.index - right.index
    || left.side.localeCompare(right.side)
  );
  let awayScore = 0;
  let homeScore = 0;
  const entries = scorers.map(({ scorer, side }, index) => {
    if (side === "home") {
      homeScore = Math.min(status.homeScore, Math.max(homeScore, scorer.resultingScore));
    } else {
      awayScore = Math.min(status.awayScore, Math.max(awayScore, scorer.resultingScore));
    }
    const teamKey = teamKeyFor(status, side);
    const accepted = acceptedKeys.has(playerAssetKey(teamKey, scorer.player.id));
    const playerName = accepted ? normalizedPlayerName(scorer.player.name) : null;
    return {
      awayScore,
      clockLabel: displayClock(scorer.matchClockSeconds, scorer.period),
      homeScore,
      id: `goal:${side}:${scorer.resultingScore}:${scorer.player.id}`.slice(0, 200),
      kind: "goal",
      label: playerName ? `Doelpunt ${playerName}` : "Doelpunt",
      occurredAt: timelineOccurredAt(status, scorer.matchClockSeconds, index),
      playerName,
      side
    };
  });
  return entries.slice(-30);
}

function timelineOccurredAt(
  status: LedScoresStatus,
  matchClockSeconds: number | null,
  fallbackOffset: number
) {
  const base = Date.parse(status.startedAt ?? "1970-01-01T00:00:00.000Z");
  const offset = matchClockSeconds === null
    ? fallbackOffset
    : boundedClockSeconds(matchClockSeconds);
  return new Date(base + offset * 1_000).toISOString();
}

function numericPeriod(value: string | null) {
  if (value === null) return Number.MAX_SAFE_INTEGER;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0
    ? parsed
    : Number.MAX_SAFE_INTEGER - 1;
}

function publicMatchStatus(status: LedScoresStatus) {
  if (status.matchState === "ended") return "finished";
  if (status.matchState === "rest") return "half_time";
  if (status.matchState === "paused") return "paused";
  if (status.matchState === "running") return "live";
  if (!status.startedAt) return "pre_match";
  return "unknown";
}

function periodLabel(period: string | null) {
  if (!period) return null;
  if (period === "1") return "Eerste helft";
  if (period === "2") return "Tweede helft";
  return `Periode ${period}`;
}

function displayClock(seconds: number | null, period: string | null) {
  if (seconds === null) return periodLabel(period);
  const safeSeconds = boundedClockSeconds(seconds);
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = safeSeconds % 60;
  const clock = `${minutes}:${String(remainder).padStart(2, "0")}`;
  return period ? `P${period} · ${clock}` : clock;
}

function teamKeyFor(status: LedScoresStatus, side: LedScoresSide) {
  return normalizeLedScoresTeamKey(
    side === "home" ? status.homeTeamId : status.awayTeamId
  );
}

function playerAssetKey(teamKey: string, playerKey: string) {
  return JSON.stringify([normalizeLedScoresTeamKey(teamKey), playerKey.trim()]);
}

function playerNumber(value: string | null) {
  if (value === null || !/^\d{1,3}$/.test(value.trim())) return null;
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= 0 && number <= 999
    ? number
    : null;
}

function normalizedPlayerName(value: string) {
  const name = value.trim().replace(/\s+/g, " ");
  return name ? name.slice(0, 160) : null;
}

function normalizedTeamName(value: string | undefined) {
  if (!value) return null;
  const name = value.trim().replace(/\s+/g, " ");
  return name ? name.slice(0, 160) : null;
}

function boundedClockSeconds(value: number) {
  return Math.min(359_999, Math.max(0, Math.floor(value)));
}

function deliveryCountFromRpc(
  result: { data: unknown; error: { code?: string } | null },
  operation: string
) {
  if (result.error || !isRecord(result.data)) {
    throw new Error(`${operation}_failed`);
  }
  const count = Number(result.data.deliveryCount ?? 0);
  if (!Number.isSafeInteger(count) || count < 0) {
    throw new Error(`${operation}_invalid`);
  }
  return count;
}

async function mapWithConcurrency<T, R>(
  values: readonly T[],
  concurrency: number,
  transform: (value: T) => Promise<R>
) {
  const results: R[] = [];
  const size = Math.max(1, Math.floor(concurrency));
  for (let index = 0; index < values.length; index += size) {
    const batch = await Promise.all(values.slice(index, index + size).map(transform));
    results.push(...batch);
  }
  return results;
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
  detector: LedScoresSemanticEventDetector;
  inactivityTimeoutMs: number;
  isReconnect: boolean;
  leaseSeconds: number;
  onEvent: (event: LedScoresConnectorEvent) => void;
  persistIntervalMs: number;
  persistence: ConnectorPersistence;
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
  detector: LedScoresSemanticEventDetector;
  event: MessageEvent;
  onEvent: (event: LedScoresConnectorEvent) => void;
  persistIntervalMs: number;
  persistence: ConnectorPersistence;
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
  // Provider timestamps describe when LED Scores changed the match. The RPC
  // freshness guard needs when VeyoCast actually observed this websocket
  // snapshot. A reconnect can legitimately start with an older baseline.
  const sourceObservedAt = new Date(now).toISOString();
  const semanticEvents = observation.kind === "events" ? observation.events : [];
  const goalEvents = semanticEvents.filter(
    (item): item is Extract<LedScoresSemanticEvent, { kind: "goal" }> =>
      item.kind === "goal"
  );
  // A goal has the strictest latency budget. Dispatch its score transition
  // before lease housekeeping, identity persistence, state resync or media.
  for (const event of goalEvents) {
    const scorerAccepted = event.goal.scorer
      ? persistence.acceptedPlayerKeys.has(playerAssetKey(
          event.goal.scoringTeamKey,
          event.goal.scorer.id
        ))
      : true;
    const goal = scorerAccepted
      ? event.goal
      : { ...event.goal, scorer: null, scorerName: null };
    const deliveryCount = await backend.dispatch(connection, workerId, goal);
    onEvent({
      connectionId: connection.connectionId,
      deliveryCount,
      outcome: deliveryCount > 0 ? "goal_dispatched" : "goal_suppressed"
    });
  }

  const players = playerSnapshots(status, persistence);
  const rosterFingerprint = JSON.stringify(players.map((player) => ({
    active: player.active,
    name: player.name,
    number: player.number,
    photoSourceUrl: player.photoSourceUrl,
    playerKey: player.playerKey,
    teamKey: player.teamKey
  })));
  if (
    rosterFingerprint !== persistence.lastRosterFingerprint
    || now - persistence.lastRosterSyncAt >= 60_000
  ) {
    const accepted = await backend.syncPlayers({
      connectionId: connection.connectionId,
      players,
      sourceObservedAt,
      workerId
    });
    persistence.acceptedPlayerKeys = new Set(
      accepted.map((player) => playerAssetKey(player.teamKey, player.playerKey))
    );
    persistence.lastRosterFingerprint = rosterFingerprint;
    persistence.lastRosterSyncAt = now;
  }

  const acceptedPlayers = players.filter((player) =>
    persistence.acceptedPlayerKeys.has(playerAssetKey(player.teamKey, player.playerKey))
  );
  schedulePlayerAssetHydration({
    backend,
    connection,
    persistence,
    players: priorityPhotoPlayers(status, acceptedPlayers),
    workerId
  });

  const scorerEnrichments = semanticEvents.flatMap((event) => {
    if (event.kind === "goal_scorer_enriched") return [event.enrichment];
    if (event.kind !== "goal" || !event.goal.scorer) return [];
    return [goalEnrichment(event.goal, status)];
  });
  for (const enrichment of scorerEnrichments) {
    const accepted = persistence.acceptedPlayerKeys.has(playerAssetKey(
      enrichment.scoringTeamKey,
      enrichment.scorer.id
    ));
    if (!accepted) continue;
    const deliveryCount = await backend.enrichGoal({
      connectionId: connection.connectionId,
      enrichment,
      workerId
    });
    void deliveryCount;
    scheduleGoalPhotoEnrichment({
      backend,
      connection,
      enrichment,
      persistence,
      workerId
    });
  }

  for (const semanticEvent of semanticEvents) {
    const overlay = matchOverlayForEvent(
      semanticEvent,
      status,
      connection.mappings,
      persistence.playerAssetVersions,
      persistence.acceptedPlayerKeys
    );
    if (!overlay) continue;
    const deliveryCount = await backend.dispatchOverlay({
      canonicalKey: overlay.canonicalKey,
      connectionId: connection.connectionId,
      eventType: overlay.eventType,
      payload: overlay.payload,
      sourceObservedAt: overlay.sourceObservedAt,
      sourceUpdateId: overlay.sourceUpdateId,
      workerId
    });
    void deliveryCount;
  }

  if (
    observation.kind === "baseline"
    || goalEvents.length > 0
    || now - persistence.lastTouchAt >= persistIntervalMs
  ) {
    const owned = await backend.touch(
      connection.connectionId,
      workerId,
      safeBaseline(status),
      sourceObservedAt
    );
    if (!owned) throw new LeaseLostError();
    persistence.lastTouchAt = now;
  }

  const previousStatus = persistence.previousStatus;
  updateClockDirection(persistence, previousStatus, status);
  const stateFingerprint = liveStateFingerprint(
    status,
    acceptedPlayers,
    persistence.clockDirection
  );
  const stateResyncIntervalMs = Math.min(
    15_000,
    Math.max(1_000, persistIntervalMs)
  );
  if (
    stateFingerprint !== persistence.lastStateFingerprint
    || now - persistence.lastStateAt >= stateResyncIntervalMs
  ) {
    await backend.upsertLiveState({
      connectionId: connection.connectionId,
      sourceObservedAt,
      state: createLedScoresLiveMatchState({
        acceptedPlayers,
        connection,
        direction: persistence.clockDirection,
        status
      }),
      workerId
    });
    persistence.lastStateAt = now;
    persistence.lastStateFingerprint = stateFingerprint;
  }
  persistence.previousStatus = status;

  if (observation.kind === "baseline") {
    await backend.recordState({
      baseline: safeBaseline(status),
      connectionId: connection.connectionId,
      detail: {
        awayScore: status.awayScore,
        awayTeamId: teamKeyFor(status, "away"),
        homeScore: status.homeScore,
        homeTeamId: teamKeyFor(status, "home"),
        message: "Veilige baseline vastgelegd; bestaande score niet afgespeeld.",
        reason: observation.reason
      },
      eventType: "baseline_established",
      healthStatus: "connected",
      severity: "info",
      sourceMessageAt: sourceObservedAt,
      workerId
    });
    return;
  }
  if (observation.kind === "ignored") {
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
        sourceMessageAt: sourceObservedAt,
        workerId
      });
      onEvent({ connectionId: connection.connectionId, outcome: "goal_suppressed" });
    }
    return;
  }
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
      teamKey: normalizeLedScoresTeamKey(requiredString(mapping.teamKey, "teamKey")),
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
