import "server-only";

import { createHash } from "node:crypto";

import type { createPlayerAdminClient } from "./player-supabase";

export const ledScoresSseHeaders = {
  "Cache-Control": "no-cache, no-store, no-transform",
  "Connection": "keep-alive",
  "Content-Type": "text/event-stream; charset=utf-8",
  "X-Accel-Buffering": "no"
} as const;

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
        normalizeAndSignConfig(admin, config)
      ))
    : [];
  const pendingDeliveries = Array.isArray(result.data.pendingDeliveries)
    ? result.data.pendingDeliveries.slice(0, 5)
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

export function encodeSseEvent(event: string, value: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(value)}\n\n`;
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
    || !["configuration", "goal"].includes(String(value.message_kind))
    || !isRecord(value.payload)
  ) return null;
  return {
    alertVersionId,
    executeAt,
    expiresAt,
    id,
    kind: String(value.message_kind) as "configuration" | "goal",
    payload: value.payload,
    screenId
  };
}

async function normalizeAndSignConfig(
  admin: ReturnType<typeof createPlayerAdminClient>,
  value: unknown
) {
  if (!isRecord(value)) return null;
  const alertVersionId = uuid(value.alertVersionId);
  const alertId = uuid(value.alertId);
  const checksum = hash(value.checksum);
  if (!alertVersionId || !alertId || !checksum || !isRecord(value.config)) return null;
  const assets = Array.isArray(value.assets)
    ? value.assets.slice(0, 10)
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
  return {
    alertId,
    alertVersionId,
    assets: signedAssets.filter((asset): asset is NonNullable<typeof asset> => Boolean(asset)),
    checksum,
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
