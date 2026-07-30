import { createHash } from "node:crypto";

import { NextResponse } from "next/server";

import {
  createPlayerAnonClient,
  isLivePlayerConfigured
} from "../../../../_lib/player-supabase";

const maximumRequestBytes = 512;

export async function POST(request: Request) {
  const deviceToken = getBearerToken(request);
  const installationCredential = normalizeCredential(
    request.headers.get("x-veyocast-installation-credential")
  );
  if (
    (!deviceToken || !/^[A-Za-z0-9_-]{20,200}$/.test(deviceToken)) &&
    !installationCredential
  ) {
    return recoveryFailure(
      "INVALID_DEVICE_CREDENTIAL",
      401,
      "De tijdelijke pairingcredential ontbreekt of is beschadigd."
    );
  }

  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (
    contentLength < 0 ||
    (Number.isFinite(contentLength) && contentLength > maximumRequestBytes)
  ) {
    return recoveryFailure(
      "RECOVERY_REQUEST_INVALID",
      413,
      "De herstelmelding is groter dan toegestaan."
    );
  }

  const rawBody = await request.text().catch(() => "");
  if (new TextEncoder().encode(rawBody).byteLength > maximumRequestBytes) {
    return recoveryFailure(
      "RECOVERY_REQUEST_INVALID",
      413,
      "De herstelmelding is groter dan toegestaan."
    );
  }
  const body = parseBody(rawBody);
  const installationId = normalizeInstallationId(body?.installationId);
  const mode = body?.mode === "hard" ? "hard" : body?.mode === "soft" ? "soft" : null;
  if (!installationId || !mode) {
    return recoveryFailure(
      "RECOVERY_REQUEST_INVALID",
      400,
      "De herstelmelding bevat geen geldige installatiecontext."
    );
  }

  if (!isLivePlayerConfigured()) {
    return noStore({
      cancelledPendingPairing: false,
      code: "RECOVERY_ACCEPTED",
      live: false,
      ok: true
    });
  }

  const supabase = createPlayerAnonClient();
  if (!supabase) {
    return recoveryFailure(
      "PAIRING_RECOVERY_UNAVAILABLE",
      503,
      "De herstelservice is tijdelijk niet beschikbaar."
    );
  }

  const { data, error } = await supabase.rpc("recover_player_pairing_v3", {
    p_installation_credential_hash: installationCredential
      ? sha256(installationCredential)
      : null,
    p_installation_id_hash: sha256(installationId),
    p_pending_token_hash:
      deviceToken && /^[A-Za-z0-9_-]{20,200}$/.test(deviceToken)
        ? sha256(deviceToken)
        : null,
    p_recovery_mode: mode
  });
  const result = parseRecoveryResult(data);

  if (!error && result.code === "RECOVERY_CREDENTIAL_INVALID") {
    return recoveryFailure(
      "RECOVERY_CREDENTIAL_INVALID",
      401,
      "De herstelcredential is ongeldig of hoort niet bij deze installatie."
    );
  }
  if (error || !result.ok) {
    return recoveryFailure(
      "PAIRING_RECOVERY_UNAVAILABLE",
      503,
      "De oude pairingpoging kon nu niet op de server worden ingetrokken."
    );
  }

  return noStore({
    cancelledPendingPairing: result.cancelledPendingPairing,
    bindingState: result.bindingState,
    code: "RECOVERY_ACCEPTED",
    live: true,
    ok: true
  });
}

function getBearerToken(request: Request) {
  const authorization = request.headers.get("authorization");
  return authorization?.toLowerCase().startsWith("bearer ")
    ? authorization.slice("bearer ".length).trim()
    : null;
}

function normalizeInstallationId(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return /^[a-f0-9-]{20,80}$/.test(normalized) ? normalized : null;
}

function normalizeCredential(value: string | null) {
  const normalized = value?.trim();
  return normalized && /^[A-Za-z0-9_-]{20,200}$/.test(normalized)
    ? normalized
    : null;
}

function parseBody(value: string) {
  try {
    return JSON.parse(value) as {
      installationId?: unknown;
      mode?: unknown;
    };
  } catch {
    return null;
  }
}

function parseRecoveryResult(value: unknown) {
  if (!value || typeof value !== "object") {
    return {
      bindingState: null,
      cancelledPendingPairing: false,
      code: null,
      ok: false
    };
  }
  const result = value as {
    cancelledPendingPairing?: unknown;
    bindingState?: unknown;
    code?: unknown;
    ok?: unknown;
  };
  return {
    bindingState:
      result.bindingState === "PAIRED" || result.bindingState === "UNPAIRED"
        ? result.bindingState
        : null,
    cancelledPendingPairing: result.cancelledPendingPairing === true,
    code: typeof result.code === "string" ? result.code : null,
    ok: result.ok === true
  };
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function noStore(body: object) {
  return NextResponse.json(body, {
    headers: {
      "Cache-Control": "no-store"
    }
  });
}

function recoveryFailure(code: string, status: number, cause: string) {
  return NextResponse.json(
    {
      error: {
        cause,
        code,
        effect: "Lokaal herstel gaat door; de servermelding kan later worden herhaald.",
        recovery: "Laat de Player na herstel opnieuw verbinding maken."
      },
      ok: false
    },
    {
      headers: {
        "Cache-Control": "no-store"
      },
      status
    }
  );
}
