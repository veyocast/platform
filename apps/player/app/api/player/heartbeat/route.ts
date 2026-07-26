import { createHash } from "node:crypto";

import { NextResponse } from "next/server";

import {
  playerAutomationSyncSchema,
  screenAutomationCapabilityReportSchema,
  screenAutomationCommandReportSchema
} from "@veyocast/contracts";

import { readPlayerAppVersion } from "../../../_lib/runtime-health";

import { createPlayerAnonClient } from "../../../_lib/player-supabase";
import {
  playbackErrorSyncDetail,
  safePlayerIdentifier
} from "../../../_lib/player-heartbeat";

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
    return heartbeatFailure(
      deviceToken ? "PLAYER_API_UNAVAILABLE" : "INVALID_DEVICE_TOKEN",
      deviceToken ? 503 : 401
    );
  }

  const body = (await request.json().catch(() => null)) as {
    activeReleaseId?: string | null;
    automationCapabilities?: unknown;
    automationReport?: unknown;
    currentItemId?: string | null;
    desiredReleaseId?: string | null;
    lastPlaybackError?: {
      action?: string;
      code?: string;
      itemId?: string;
      occurredAt?: string;
      recoveredAt?: string;
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
  const automationReport = body.automationReport == null
    ? null
    : screenAutomationCommandReportSchema.safeParse(body.automationReport);
  if (automationReport && !automationReport.success) {
    return NextResponse.json(
      { error: "Ongeldige automatiseringsrapportage." },
      { status: 400 }
    );
  }
  const reportedCapabilities = body.automationCapabilities == null
    ? null
    : screenAutomationCapabilityReportSchema.safeParse(body.automationCapabilities);
  if (reportedCapabilities && !reportedCapabilities.success) {
    return NextResponse.json(
      { error: "Ongeldige Player-capabilities." },
      { status: 400 }
    );
  }

  const playbackErrorDetail = playbackErrorSyncDetail(body.lastPlaybackError);
  const tokenHash = sha256(deviceToken);

  const { error } = await supabase.rpc("record_player_heartbeat_v2", {
    p_active_release_id: body.activeReleaseId ?? null,
    p_app_version: readPlayerAppVersion(),
    p_capabilities: {
      screenAutomation: reportedCapabilities?.success
        ? reportedCapabilities.data
        : inferredAutomationCapabilities(request),
      manifestSchemaVersions: [1],
      releaseHashAlgorithms: ["sha256"]
    },
    p_desired_release_id: body.desiredReleaseId ?? null,
    p_platform: playerPlatform(request),
    p_runtime_state: body.runtimeState,
    p_storage_quota_bytes: safeNonNegativeInteger(body.storageQuotaBytes),
    p_storage_used_bytes: safeNonNegativeInteger(body.storageUsedBytes),
    p_sync_detail: {
      currentItemId: safePlayerIdentifier(body.currentItemId),
      deploymentSha:
        process.env.VERCEL_GIT_COMMIT_SHA?.trim().slice(0, 120) ||
        process.env.DEPLOYMENT_SHA?.trim().slice(0, 120) ||
        "local",
      ...playbackErrorDetail,
      desiredReleaseId: safePlayerIdentifier(body.desiredReleaseId),
      networkState: body.networkState === "offline" ? "offline" : "online"
    },
    p_sync_phase: body.syncPhase ?? null,
    p_token_hash: tokenHash
  });

  if (error) {
    const { data: credentialState, error: credentialError } =
      await supabase.rpc("inspect_player_device_credential_v1", {
        p_token_hash: tokenHash
      });
    if (credentialError) {
      return heartbeatFailure("PLAYER_API_UNAVAILABLE", 503);
    }
    const code =
      credentialState === "DEVICE_REVOKED"
        ? "DEVICE_REVOKED"
        : credentialState === "PAIRING_PENDING"
          ? "PAIRING_PENDING"
          : "INVALID_DEVICE_TOKEN";
    return heartbeatFailure(
      code,
      code === "DEVICE_REVOKED" ? 403 : code === "PAIRING_PENDING" ? 409 : 401
    );
  }

  const { data: automationData, error: automationError } = await supabase.rpc(
    "sync_player_automation_v1",
    {
      p_report: automationReport?.success ? automationReport.data : null,
      p_token_hash: tokenHash
    }
  );
  if (automationError) {
    console.error("Player-automatisering synchroniseren mislukt", {
      code: automationError.code
    });
  }
  const automation = automationError
    ? null
    : playerAutomationSyncSchema.safeParse(automationData);
  if (automation && !automation.success) {
    console.error("Player-automatisering gaf een ongeldig servercontract");
  }

  return NextResponse.json(
    {
      automation: automation?.success ? automation.data : null,
      ok: true
    },
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

function inferredAutomationCapabilities(request: Request) {
  const userAgent = request.headers.get("user-agent") ?? "";
  const isAndroidShell = /VeyoCastAndroid\//i.test(userAgent);
  const isTv = /VeyoCastFormFactor\/tv/i.test(userAgent);
  const androidVersion = userAgent.match(/Android\s+([0-9.]+)/i)?.[1];
  return {
    automationSchemaVersion: isAndroidShell ? 1 : 0,
    ...(isAndroidShell ? { formFactor: isTv ? "tv" : "general" } : {}),
    hdmiCecWakeCapability: isTv ? "probably_supported" : "unknown",
    lastAutomationExecutionAt: null,
    lastAutomationResult: null,
    lastAutomationSyncAt: null,
    ...(androidVersion ? { operatingSystem: `Android ${androidVersion}` } : {}),
    supportsBootRestore: isAndroidShell,
    supportsKeepAwake: isAndroidShell,
    supportsLocalSchedule: isAndroidShell,
    supportsScheduledWake: isAndroidShell
  };
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

function safeNonNegativeInteger(value: number | null | undefined) {
  return Number.isSafeInteger(value) && Number(value) >= 0 ? Number(value) : null;
}

function heartbeatFailure(code: string, status: number) {
  return NextResponse.json(
    {
      error: {
        cause:
          code === "DEVICE_REVOKED"
            ? "De schermcredential is ingetrokken."
            : code === "PAIRING_PENDING"
              ? "De koppelcode is nog niet geclaimd."
              : code === "INVALID_DEVICE_TOKEN"
                ? "De schermcredential is ongeldig."
                : "De Player-API is tijdelijk niet beschikbaar.",
        code,
        effect: "De Playerstatus is niet bijgewerkt.",
        recovery:
          code === "PAIRING_PENDING"
            ? "Claim de zichtbare code in Control."
            : "De Player beoordeelt automatisch of opnieuw koppelen nodig is."
      },
      ok: false
    },
    {
      headers: { "Cache-Control": "no-store" },
      status
    }
  );
}
