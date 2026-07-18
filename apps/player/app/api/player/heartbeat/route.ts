import { createHash } from "node:crypto";

import { NextResponse } from "next/server";

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
    runtimeState?: string;
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

  const { error } = await supabase.rpc("record_player_heartbeat", {
    p_active_release_id: body.activeReleaseId ?? null,
    p_app_version: "pilot-1",
    p_runtime_state: body.runtimeState,
    p_storage_quota_bytes: null,
    p_storage_used_bytes: null,
    p_sync_detail: {},
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

function getBearerToken(request: Request) {
  const authorization = request.headers.get("authorization");
  return authorization?.toLowerCase().startsWith("bearer ")
    ? authorization.slice("bearer ".length).trim()
    : null;
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}
