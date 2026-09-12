import "server-only";

import { createHash } from "node:crypto";

import {
  goalOverlayConfigurationSchema,
  ledScoresCanvasAssetIds,
  ledScoresCanvasMaximumAssets,
  safeParseLedScoresCanvasExperience,
  type LedScoresCanvasMomentKey
} from "@veyocast/contracts";

import type { createPlayerAdminClient } from "./player-supabase";

export const ledScoresSseHeaders = {
  "Cache-Control": "no-cache, no-store, no-transform",
  "Connection": "keep-alive",
  "Content-Type": "text/event-stream; charset=utf-8",
  "X-Accel-Buffering": "no"
} as const;

export const ledScoresConfigAssetRefreshMs = 45 * 60 * 1_000;

export function createSerializedLedScoresStreamQueue(
  onFailure?: (error: unknown) => void
) {
  let tail = Promise.resolve();
  return (operation: () => void | Promise<void>) => {
    const current = tail.then(operation);
    tail = current.catch((error) => {
      try { onFailure?.(error); } catch { /* diagnostics must not stop the queue */ }
    });
    return tail;
  };
}

export function readPlayerBearerToken(request: Request) {
  const authorization = request.headers.get("authorization");
  const token = authorization?.toLowerCase().startsWith("bearer ")
    ? authorization.slice("bearer ".length).trim()
    : null;
  return token && /^[A-Za-z0-9_-]{20,200}$/.test(token) ? token : null;
}

export function hashPlayerCredential(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export async function loadLedScoresPlayerBootstrap(
  admin: ReturnType<typeof createPlayerAdminClient>,
  tokenHash: string
) {
  const result = await admin.rpc("get_ledscores_player_bootstrap_v1", {
    p_token_hash: tokenHash
  });
  if (result.error || !isRecord(result.data)) {
    throw new Error("LEDSCORES_BOOTSTRAP_UNAVAILABLE");
  }
  if (result.data.authorized !== true) {
    return { authorized: false as const, enabled: false as const };
  }
  const screenId = uuid(result.data.screenId);
  const tenantId = uuid(result.data.tenantId);
  const deviceId = uuid(result.data.deviceId);
  if (!screenId || !tenantId || !deviceId) {
    throw new Error("LEDSCORES_BOOTSTRAP_INVALID");
  }
  if (result.data.enabled !== true) {
    return {
      authorized: true as const,
      configs: [],
      deviceId,
      enabled: false as const,
      pendingDeliveries: [],
      screenId,
      tenantId
    };
  }
  const configs = Array.isArray(result.data.configs)
    ? await Promise.all(result.data.configs.slice(0, 50).map((config) =>
        normalizeAndSignConfig(admin, config, tenantId)
      ))
    : [];
  const pendingDeliveries = Array.isArray(result.data.pendingDeliveries)
    ? result.data.pendingDeliveries.slice(0, 20)
      .map(normalizeLedScoresDelivery)
      .filter((delivery): delivery is NonNullable<typeof delivery> => Boolean(delivery))
    : [];
  return {
    authorized: true as const,
    configs: configs.filter((config): config is NonNullable<typeof config> => Boolean(config)),
    deviceId,
    enabled: true as const,
    pendingDeliveries,
    screenId,
    tenantId
  };
}

export async function loadLedScoresMatchPlayerBootstrap(
  admin: ReturnType<typeof createPlayerAdminClient>,
  tokenHash: string
) {
  const result = await admin.rpc("get_ledscores_match_player_bootstrap_v1", {
    p_token_hash: tokenHash
  });
  if (result.error || !isRecord(result.data)) {
    throw new Error("LEDSCORES_MATCH_BOOTSTRAP_UNAVAILABLE");
  }
  if (result.data.authorized !== true) {
    return { authorized: false as const, enabled: false as const };
  }
  const screenId = uuid(result.data.screenId);
  const tenantId = uuid(result.data.tenantId);
  if (!screenId || !tenantId) {
    throw new Error("LEDSCORES_MATCH_BOOTSTRAP_INVALID");
  }
  if (result.data.enabled !== true) {
    return {
      authorized: true as const,
      bindings: [],
      enabled: false as const,
      pendingDeliveries: [],
      screenId,
      tenantId
    };
  }
  const bindings = Array.isArray(result.data.bindings)
    ? result.data.bindings.slice(0, 50).flatMap((binding) => {
        const parsed = normalizeLedScoresMatchBinding(binding);
        return parsed ? [parsed] : [];
      })
    : [];
  const pendingDeliveries = Array.isArray(result.data.pendingDeliveries)
    ? result.data.pendingDeliveries.slice(0, 10)
      .map(normalizeLedScoresDelivery)
      .filter((delivery): delivery is NonNullable<typeof delivery> =>
        delivery?.kind === "goal_enrichment" ||
        delivery?.kind === "match_overlay"
      )
    : [];
  return {
    authorized: true as const,
    bindings,
    enabled: true as const,
    pendingDeliveries,
    screenId,
    tenantId
  };
}

export function encodeSseEvent(event: string, value: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(value)}\n\n`;
}

export function ledScoresRealtimeBootstrapPayload({
  configs,
  matchBindings,
  screenId,
  serverTime
}: {
  configs: readonly unknown[];
  matchBindings: readonly unknown[];
  screenId: string;
  serverTime: string;
}) {
  return { configs, matchBindings, screenId, serverTime };
}

export function normalizeLedScoresDelivery(value: unknown) {
  if (!isRecord(value)) return null;
  const id = uuid(value.id);
  const screenId = uuid(value.screen_id);
  const alertVersionId = uuid(value.alert_version_id);
  const executeAt = timestamp(value.execute_at);
  const expiresAt = timestamp(value.expires_at);
  if (
    !id
    || !screenId
    || !executeAt
    || !expiresAt
    || ![
      "configuration",
      "goal",
      "goal_enrichment",
      "match_overlay"
    ].includes(String(value.message_kind))
    || !isRecord(value.payload)
  ) return null;
  return {
    alertVersionId,
    executeAt,
    expiresAt,
    id,
    kind: String(value.message_kind) as
      | "configuration"
      | "goal"
      | "goal_enrichment"
      | "match_overlay",
    payload: value.payload,
    screenId
  };
}

export function orderLedScoresPendingDeliveries(
  ...groups: ReadonlyArray<
    ReadonlyArray<NonNullable<ReturnType<typeof normalizeLedScoresDelivery>>>
  >
) {
  return groups.flatMap((group) => group).map((delivery, index) => ({
    delivery,
    index
  })).sort((left, right) =>
    Date.parse(left.delivery.executeAt) - Date.parse(right.delivery.executeAt)
    || left.index - right.index
  ).map(({ delivery }) => delivery);
}

export function shouldAttachLedScoresConfigAssets(
  kind: NonNullable<ReturnType<typeof normalizeLedScoresDelivery>>["kind"]
) {
  return kind === "goal" || kind === "match_overlay";
}

export function shouldRefreshLedScoresConfigAssets(
  lastRefreshAt: number,
  now = Date.now()
) {
  return !Number.isFinite(lastRefreshAt) ||
    now - lastRefreshAt >= ledScoresConfigAssetRefreshMs;
}

export function attachLedScoresCanvasSceneToDelivery(
  delivery: NonNullable<ReturnType<typeof normalizeLedScoresDelivery>>,
  configs: readonly unknown[]
) {
  const safePayload = { ...delivery.payload };
  delete safePayload.scene;
  delete safePayload.goalOverlay;
  delete safePayload.homeLogo;
  delete safePayload.awayLogo;
  const sanitized = { ...delivery, payload: safePayload };
  if (!delivery.alertVersionId) return sanitized;
  const config = configs.find((candidate) =>
    isRecord(candidate) &&
    uuid(candidate.alertVersionId) === delivery.alertVersionId
  );
  if (!isRecord(config) || !isRecord(config.config)) return sanitized;
  const goalConfiguration = goalOverlayConfigurationSchema.safeParse(config.config.goalOverlay);
  if (delivery.kind === "goal" && goalConfiguration.success) {
    const teams = Array.isArray(config.teams) ? config.teams : [];
    const team = (key: unknown) => teams.find((item) => isRecord(item) &&
      item.connectionId === delivery.payload.connectionId && item.teamKey === key);
    const home = team(delivery.payload.homeTeamKey);
    const away = team(delivery.payload.awayTeamKey);
    return { ...sanitized, payload: {
      ...safePayload, goalOverlay: goalConfiguration.data,
      homeLogo: isRecord(home) ? home.logoAssetId : null,
      awayLogo: isRecord(away) ? away.logoAssetId : null
    } };
  }
  const experience = safeParseLedScoresCanvasExperience(
    config.config.canvasExperience
  );
  if (!experience.success) return sanitized;
  const availableAssetIds = new Set(
    Array.isArray(config.assets)
      ? config.assets.flatMap((asset) =>
          isRecord(asset) && uuid(asset.mediaAssetId)
            ? [String(asset.mediaAssetId)]
            : []
        )
      : []
  );
  if (ledScoresCanvasAssetIds(experience.data).some(
    (mediaAssetId) => !availableAssetIds.has(mediaAssetId)
  )) return sanitized;
  const moment = ledScoresCanvasMomentForDelivery(delivery);
  return moment
    ? {
        ...sanitized,
        payload: {
          ...safePayload,
          scene: experience.data.scenes[moment]
        }
      }
    : sanitized;
}

export function ledScoresCanvasMomentForDelivery(
  delivery: NonNullable<ReturnType<typeof normalizeLedScoresDelivery>>
): LedScoresCanvasMomentKey | null {
  if (delivery.kind === "goal") {
    return delivery.payload.scoringSide === "own"
      ? "goalOwn"
      : delivery.payload.scoringSide === "opponent"
        ? "goalOpponent"
        : delivery.payload.scoringSide === "unknown"
          ? "goalUnknown"
          : null;
  }
  if (delivery.kind !== "match_overlay") return null;
  if (delivery.payload.overlayKind === "lineup") {
    return delivery.payload.side === "home"
      ? "lineupHome"
      : delivery.payload.side === "away"
        ? "lineupAway"
        : null;
  }
  if (delivery.payload.overlayKind === "half_time") return "halfTime";
  if (delivery.payload.overlayKind === "match_end") return "matchEnd";
  if (delivery.payload.overlayKind === "match_start") return "matchStart";
  return null;
}

export function normalizeLedScoresMatchStateRow(value: unknown) {
  if (!isRecord(value) || !isRecord(value.state_json)) return null;
  const connectionId = uuid(value.connection_id);
  const stateSequence = boundedInteger(value.state_sequence, 1, Number.MAX_SAFE_INTEGER);
  const sourceObservedAt = timestamp(value.source_observed_at);
  const staleAfterSeconds = boundedInteger(value.stale_after_seconds, 3, 120);
  if (!connectionId || stateSequence === null || !sourceObservedAt ||
    staleAfterSeconds === null) return null;
  return {
    connectionId,
    sourceObservedAt,
    staleAfterSeconds,
    state: value.state_json,
    stateSequence
  };
}

export async function hydrateLedScoresDeliveryProviderPhotos(
  admin: ReturnType<typeof createPlayerAdminClient>,
  delivery: NonNullable<ReturnType<typeof normalizeLedScoresDelivery>>,
  tenantId?: string
) {
  const hydrated = await hydrateProviderPhotos(admin, delivery);
  if (!tenantId || !["goal", "goal_enrichment"].includes(delivery.kind)) return hydrated;
  try {
    // Resolve identity through the tenant-owned event, never through a name.
    const eventId = uuid(delivery.payload.eventId);
    if (!eventId) return hydrated;
    const event = await admin.from("ledscores_goal_events").select("connection_id,scoring_team_key").eq("tenant_id", tenantId).eq("id", eventId).maybeSingle();
    if (!event.data) return hydrated;
    const sourcePlayer = isRecord(delivery.payload.player) ? delivery.payload.player : null;
    if (!sourcePlayer || typeof sourcePlayer.providerPlayerId !== "string") return hydrated;
    const player = await admin.from("ledscores_player_identities").select("manual_photo_media_asset_id").eq("tenant_id", tenantId).eq("connection_id", event.data.connection_id).eq("provider_team_key", event.data.scoring_team_key).eq("provider_player_key", sourcePlayer.providerPlayerId).eq("active", true).maybeSingle();
    if (!player.data?.manual_photo_media_asset_id) return hydrated;
    const asset = await admin.from("media_assets").select("storage_bucket,storage_path,mime_type").eq("tenant_id", tenantId).eq("id", player.data.manual_photo_media_asset_id).eq("kind", "image").eq("status", "ready").is("deleted_at", null).maybeSingle();
    const media = asset.data;
    if (!media || media.storage_bucket !== "tenant-media" || !media.storage_path.startsWith(`tenants/${tenantId}/assets/`) || !["image/jpeg", "image/png", "image/webp"].includes(media.mime_type)) return hydrated;
    const signed = await admin.storage.from("tenant-media").createSignedUrl(media.storage_path, 3600);
    if (!signed.data?.signedUrl) return hydrated;
    return { ...hydrated, payload: { ...hydrated.payload, player: { ...(isRecord(hydrated.payload.player) ? hydrated.payload.player : {}), photoUrl: signed.data.signedUrl } } };
  } catch { return hydrated; }
}

async function hydrateProviderPhotos(
  admin: ReturnType<typeof createPlayerAdminClient>,
  delivery: NonNullable<ReturnType<typeof normalizeLedScoresDelivery>>
) {
  if (delivery.kind !== "goal" && delivery.kind !== "goal_enrichment" &&
    delivery.kind !== "match_overlay") return delivery;
  const requestedIds = collectProviderPhotoIds(delivery.payload);
  if (!requestedIds.length) return delivery;
  let result;
  try {
    result = await admin
      .from("provider_asset_versions")
      .select("id, storage_bucket, storage_path, mime_type, file_size_bytes, checksum_sha256, provider_asset_cache!inner(provider, entity_type, asset_role)")
      .in("id", requestedIds);
  } catch {
    return stripProviderPhotoIds(delivery);
  }
  if (result.error) return stripProviderPhotoIds(delivery);
  const signedById = new Map<string, string>();
  await Promise.all((result.data ?? []).map(async (row) => {
    const id = uuid(row.id);
    const path = safeProviderStoragePath(row.storage_path);
    const mimeType = safeProviderPhotoMimeType(row.mime_type);
    const checksum = hash(row.checksum_sha256);
    const bytes = boundedInteger(row.file_size_bytes, 1, 8_000_000);
    const cache = isRecord(row.provider_asset_cache)
      ? row.provider_asset_cache
      : null;
    if (!id || !requestedIds.includes(id) || row.storage_bucket !== "provider-assets" ||
      !path || !mimeType || !checksum || bytes === null || !cache ||
      cache.provider !== "ledscores" || cache.entity_type !== "player" ||
      cache.asset_role !== "player_photo") return;
    let signed;
    try {
      signed = await admin.storage.from("provider-assets")
        .createSignedUrl(path, 3_600);
    } catch {
      return;
    }
    if (!signed.error && signed.data?.signedUrl &&
      /^https?:\/\//.test(signed.data.signedUrl)) {
      signedById.set(id, signed.data.signedUrl);
    }
  }));
  return {
    ...delivery,
    payload: hydratePayloadPlayers(delivery.payload, signedById)
  };
}

function normalizeLedScoresMatchBinding(value: unknown) {
  if (!isRecord(value)) return null;
  const connectionId = uuid(value.connectionId);
  const dynamicSnapshotId = uuid(value.dynamicSnapshotId);
  const stateSequence = boundedInteger(value.stateSequence, 0, Number.MAX_SAFE_INTEGER);
  const sourceObservedAt = value.sourceObservedAt === null
    ? null
    : timestamp(value.sourceObservedAt);
  const staleAfterSeconds = boundedInteger(value.staleAfterSeconds, 3, 120);
  if (!connectionId || !dynamicSnapshotId || stateSequence === null ||
    staleAfterSeconds === null || !isRecord(value.state) ||
    (value.sourceObservedAt !== null && !sourceObservedAt)) return null;
  return {
    configuration: isRecord(value.configuration) ? value.configuration : {},
    connectionId,
    dynamicSnapshotId,
    sourceObservedAt,
    staleAfterSeconds,
    state: value.state,
    stateSequence
  };
}

function collectProviderPhotoIds(payload: Record<string, unknown>) {
  const values = [payload.player, payload.scorer];
  if (Array.isArray(payload.lineup)) values.push(...payload.lineup.slice(0, 24));
  if (Array.isArray(payload.players)) values.push(...payload.players.slice(0, 24));
  const ids = new Set<string>();
  for (const value of values) {
    if (!isRecord(value)) continue;
    const id = uuid(value.photoProviderAssetVersionId);
    if (id) ids.add(id);
  }
  return [...ids].slice(0, 24);
}

function stripProviderPhotoIds(
  delivery: NonNullable<ReturnType<typeof normalizeLedScoresDelivery>>
) {
  return { ...delivery, payload: hydratePayloadPlayers(delivery.payload, new Map()) };
}

function hydratePayloadPlayers(
  payload: Record<string, unknown>,
  signedById: ReadonlyMap<string, string>
) {
  const next = { ...payload };
  for (const key of ["player", "scorer"] as const) {
    if (isRecord(payload[key])) next[key] = hydratePlayer(payload[key], signedById);
  }
  if (Array.isArray(payload.lineup)) {
    next.lineup = payload.lineup.slice(0, 24).map((player) =>
      isRecord(player) ? hydratePlayer(player, signedById) : player
    );
  }
  if (Array.isArray(payload.players)) {
    next.players = payload.players.slice(0, 24).map((player) =>
      isRecord(player) ? hydratePlayer(player, signedById) : player
    );
  }
  return next;
}

function hydratePlayer(
  player: Record<string, unknown>,
  signedById: ReadonlyMap<string, string>
) {
  const { photoProviderAssetVersionId: _privateVersionId, ...publicPlayer } = player;
  const id = uuid(_privateVersionId);
  const photoUrl = id ? signedById.get(id) ?? null : null;
  return { ...publicPlayer, ...(photoUrl ? { photoUrl } : {}) };
}

async function normalizeAndSignConfig(
  admin: ReturnType<typeof createPlayerAdminClient>,
  value: unknown,
  tenantId: string
) {
  if (!isRecord(value)) return null;
  const alertVersionId = uuid(value.alertVersionId);
  const alertId = uuid(value.alertId);
  const checksum = hash(value.checksum);
  if (!alertVersionId || !alertId || !checksum || !isRecord(value.config)) return null;
  const assets = Array.isArray(value.assets)
    ? value.assets.slice(0, ledScoresCanvasMaximumAssets)
    : [];
  const signedAssets = await Promise.all(assets.map(async (asset) => {
    if (!isRecord(asset)) return null;
    const mediaAssetId = uuid(asset.mediaAssetId);
    const bucket = safeStorageName(asset.bucket);
    const path = safeStoragePath(asset.path);
    const assetChecksum = hash(asset.checksum);
    const mimeType = safeMimeType(asset.mimeType);
    if (!mediaAssetId || !bucket || !path || !assetChecksum || !mimeType) return null;
    const signed = await admin.storage.from(bucket).createSignedUrl(path, 3_600);
    if (signed.error || !signed.data.signedUrl) return null;
    return {
      checksum: assetChecksum,
      mediaAssetId,
      mimeType,
      url: signed.data.signedUrl
    };
  }));
  const teamRows = goalOverlayConfigurationSchema.safeParse(value.config.goalOverlay).success
    ? await admin.from("ledscores_goal_overlay_version_teams")
        .select("connection_id,provider_team_key,logo_provider_asset_version_id")
        .eq("tenant_id", tenantId).eq("alert_version_id", alertVersionId).limit(1000)
    : { data: [], error: null };
  const logoIds = [...new Set((teamRows.data ?? []).map((team) => team.logo_provider_asset_version_id).filter(Boolean))];
  const logos = logoIds.length ? await admin.from("provider_asset_versions")
    .select("id,storage_bucket,storage_path,checksum_sha256,mime_type")
    .in("id", logoIds) : { data: [], error: null };
  const teamAssets = (await Promise.all((logos.data ?? []).map(async (logo) => {
    if (!logo.storage_path.startsWith(`tenants/${tenantId}/assets/`) || logo.storage_bucket !== "provider-assets") return null;
    try {
      const signed = await admin.storage.from("provider-assets").createSignedUrl(logo.storage_path, 3600);
      return signed.data?.signedUrl ? { mediaAssetId: logo.id, checksum: logo.checksum_sha256, mimeType: logo.mime_type, url: signed.data.signedUrl } : null;
    } catch { return null; }
  }))).filter((asset) => asset !== null);
  return {
    alertId,
    alertVersionId,
    assets: signedAssets.filter((asset): asset is NonNullable<typeof asset> => Boolean(asset)),
    checksum,
    teamAssets,
    teams: (teamRows.data ?? []).map((team) => ({ connectionId: team.connection_id, teamKey: team.provider_team_key, logoAssetId: team.logo_provider_asset_version_id })),
    config: value.config,
    durationMs: boundedInteger(value.durationMs, 2_000, 30_000) ?? 8_000,
    priority: boundedInteger(value.priority, 0, 1_000) ?? 0,
    underlayPolicy: value.underlayPolicy === "pause" ? "pause" as const : "continue" as const
  };
}

function safeStorageName(value: unknown) {
  return typeof value === "string" && /^[a-z0-9][a-z0-9_-]{1,62}$/.test(value)
    ? value
    : null;
}
function safeStoragePath(value: unknown) {
  return typeof value === "string"
    && value.length <= 500
    && /^tenants\/[0-9a-f-]{36}\/assets\/[0-9a-f-]{36}\/[A-Za-z0-9._/-]+$/i.test(value)
    && !value.includes("..")
    ? value
    : null;
}
function safeProviderStoragePath(value: unknown) {
  return typeof value === "string"
    && value.length <= 500
    && /^[A-Za-z0-9][A-Za-z0-9._/-]{0,499}$/.test(value)
    && !value.includes("..")
    && !value.includes("//")
    ? value
    : null;
}
function safeProviderPhotoMimeType(value: unknown) {
  return typeof value === "string" && /^(image\/(jpeg|png|webp))$/.test(value)
    ? value
    : null;
}
function safeMimeType(value: unknown) {
  return typeof value === "string" && /^(image\/(jpeg|png|webp)|video\/mp4)$/.test(value)
    ? value
    : null;
}
function uuid(value: unknown) {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    ? value
    : null;
}
function hash(value: unknown) { return typeof value === "string" && /^[a-f0-9]{64}$/.test(value) ? value : null; }
function timestamp(value: unknown) { return typeof value === "string" && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : null; }
function boundedInteger(value: unknown, minimum: number, maximum: number) { const number = Number(value); return Number.isInteger(number) && number >= minimum && number <= maximum ? number : null; }
function isRecord(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
