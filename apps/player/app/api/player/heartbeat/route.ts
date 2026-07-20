import { createHash } from "node:crypto";

import { NextResponse } from "next/server";

import { readPlayerAppVersion } from "../../../_lib/runtime-health";

import { createPlayerAnonClient } from "../../../_lib/player-supabase";

const runtimeStates = new Set([
  "READY",
  "PLAYING",
  "DOWNLOADING",
  "VERIFYING",
  "SWITCH_PENDING",
  "OFFLINE_PLAYING",
  "ERROR_RECOVERABLE"
]);

export async function POST(request: Request) {
  const deviceToken = getBearerToken(request);
  const supabase = createPlayerAnonClient();

  if (!deviceToken || !supabase) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    activeReleaseId?: string | null;
    currentItemId?: string | null;
    desiredReleaseId?: string | null;
    lastPlaybackError?: {
      action?: string;
      code?: string;
      itemId?: string;
      occurredAt?: string;
    } | null;
    networkState?: string | null;
    runtimeState?: string;
    storageQuotaBytes?: number | null;
    storageUsedBytes?: number | null;
    syncPhase?: string | null;
  } | null;

  if (!body?.runtimeState || !runtimeStates.has(body.runtimeState)) {
    return NextResponse.json(
      {
        error: "Ongeldige Player-status."
      },
      { status: 400 }
    );
  }

  const { error } = await supabase.rpc("record_player_heartbeat_v2", {
    p_active_release_id: body.activeReleaseId ?? null,
    p_app_version: readPlayerAppVersion(),
    p_capabilities: {
      manifestSchemaVersions: [1],
      releaseHashAlgorithms: ["sha256"]
    },
    p_desired_release_id: body.desiredReleaseId ?? null,
    p_platform: playerPlatform(request),
    p_runtime_state: body.runtimeState,
    p_storage_quota_bytes: safeNonNegativeInteger(body.storageQuotaBytes),
    p_storage_used_bytes: safeNonNegativeInteger(body.storageUsedBytes),
    p_sync_detail: {
      currentItemId: safeIdentifier(body.currentItemId),
      deploymentSha:
        process.env.VERCEL_GIT_COMMIT_SHA?.trim().slice(0, 120) ||
        process.env.DEPLOYMENT_SHA?.trim().slice(0, 120) ||
        "local",
      lastPlaybackError: sanitizePlaybackError(body.lastPlaybackError),
      desiredReleaseId: safeIdentifier(body.desiredReleaseId),
      networkState: body.networkState === "offline" ? "offline" : "online"
    },
    p_sync_phase: body.syncPhase ?? null,
    p_token_hash: sha256(deviceToken)
  });

  if (error) {
    return NextResponse.json(
      {
        error: "Heartbeat is geweigerd."
      },
      { status: 403 }
    );
  }

  return NextResponse.json(
    { ok: true },
    {
      headers: {
        "Cache-Control": "no-store"
      }
    }
  );
}

function playerPlatform(request: Request) {
  const clientPlatform = request.headers.get("sec-ch-ua-platform")?.replace(/["\\]/g, "").trim();
  if (clientPlatform) return clientPlatform.slice(0, 80);
  const userAgent = request.headers.get("user-agent") ?? "";
  if (/web0s|webos/i.test(userAgent)) return "LG webOS";
  return "browser";
}

function getBearerToken(request: Request) {
  const authorization = request.headers.get("authorization");
  return authorization?.toLowerCase().startsWith("bearer ")
    ? authorization.slice("bearer ".length).trim()
    : null;
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function safeIdentifier(value: string | null | undefined) {
  return value?.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 100) || null;
}

function safeNonNegativeInteger(value: number | null | undefined) {
  return Number.isSafeInteger(value) && Number(value) >= 0 ? Number(value) : null;
}

function sanitizePlaybackError(
  value:
    | {
        action?: string;
        code?: string;
        itemId?: string;
        occurredAt?: string;
      }
    | null
    | undefined
) {
  if (!value) return null;
  return {
    action: safeIdentifier(value.action),
    code: safeIdentifier(value.code),
    itemId: safeIdentifier(value.itemId),
    occurredAt: safeIsoTimestamp(value.occurredAt)
  };
}

function safeIsoTimestamp(value: string | null | undefined) {
  if (!value || value.length > 40) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}
