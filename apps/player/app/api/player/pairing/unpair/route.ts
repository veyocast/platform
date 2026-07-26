import { createHash } from "node:crypto";

import { NextResponse } from "next/server";

import {
  createPlayerAnonClient,
  isLivePlayerConfigured
} from "../../../../_lib/player-supabase";

export async function POST(request: Request) {
  const deviceToken = getBearerToken(request);
  const installationCredential = request.headers
    .get("x-veyocast-installation-credential")
    ?.trim();
  if (
    !isOpaqueCredential(deviceToken) ||
    !isOpaqueCredential(installationCredential)
  ) {
    return failure("INVALID_PLAYER_CREDENTIAL", 401);
  }
  if (!isLivePlayerConfigured()) {
    return noStore({ live: false, ok: true });
  }

  const supabase = createPlayerAnonClient();
  if (!supabase) return failure("PAIRING_API_UNAVAILABLE", 503);
  const { data, error } = await supabase.rpc(
    "unpair_player_installation_v1",
    {
      p_device_token_hash: sha256(deviceToken),
      p_installation_credential_hash: sha256(installationCredential)
    }
  );
  const result =
    data && typeof data === "object" && !Array.isArray(data)
      ? data as Record<string, unknown>
      : null;
  if (error) return failure("PAIRING_API_UNAVAILABLE", 503);
  if (result?.ok !== true) {
    return failure(
      typeof result?.code === "string"
        ? result.code
        : "INVALID_PLAYER_CREDENTIAL",
      401
    );
  }
  return noStore({ live: true, ok: true });
}

function getBearerToken(request: Request) {
  const authorization = request.headers.get("authorization");
  return authorization?.toLowerCase().startsWith("bearer ")
    ? authorization.slice("bearer ".length).trim()
    : null;
}

function isOpaqueCredential(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[A-Za-z0-9_-]{20,200}$/.test(value)
  );
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function noStore(body: object) {
  return NextResponse.json(body, {
    headers: { "Cache-Control": "no-store" }
  });
}

function failure(code: string, status: number) {
  return NextResponse.json(
    {
      error: {
        cause: "De lokale ontkoppeling kon niet volledig worden bevestigd.",
        code,
        effect: "De Player kan lokaal wel een nieuwe pairingpoging starten.",
        recovery: "Koppel de nieuwe code aan het bedoelde bestaande scherm."
      },
      ok: false
    },
    {
      headers: { "Cache-Control": "no-store" },
      status
    }
  );
}
