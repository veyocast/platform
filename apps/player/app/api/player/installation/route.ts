import { createHash, randomBytes } from "node:crypto";

import { NextResponse } from "next/server";

import {
  createPlayerAnonClient,
  isLivePlayerConfigured
} from "../../../_lib/player-supabase";

const maximumRequestBytes = 256;

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (
    contentLength < 0 ||
    (Number.isFinite(contentLength) && contentLength > maximumRequestBytes)
  ) {
    return installationFailure("INSTALLATION_REQUEST_INVALID", 413);
  }

  const rawBody = await request.text().catch(() => "");
  if (new TextEncoder().encode(rawBody).byteLength > maximumRequestBytes) {
    return installationFailure("INSTALLATION_REQUEST_INVALID", 413);
  }

  const installationId = normalizeInstallationId(parseBody(rawBody)?.installationId);
  if (!installationId) {
    return installationFailure("INSTALLATION_REQUEST_INVALID", 400);
  }

  const existingCredential = normalizeCredential(
    request.headers.get("x-veyocast-installation-credential")
  );
  const deviceOrPendingCredential = normalizeCredential(getBearerToken(request));
  const newCredential = randomBytes(32).toString("base64url");

  if (!isLivePlayerConfigured()) {
    return noStore({
      bound: Boolean(deviceOrPendingCredential),
      installationCredential: existingCredential ?? newCredential,
      live: false,
      ok: true
    });
  }

  const supabase = createPlayerAnonClient();
  if (!supabase) {
    return installationFailure("INSTALLATION_API_UNAVAILABLE", 503);
  }

  const { data, error } = await supabase.rpc("register_player_installation_v1", {
    p_device_or_pending_token_hash: deviceOrPendingCredential
      ? sha256(deviceOrPendingCredential)
      : null,
    p_existing_credential_hash: existingCredential
      ? sha256(existingCredential)
      : null,
    p_new_credential_hash: sha256(newCredential),
    p_public_identifier_hash: sha256(installationId)
  });
  const result = parseInstallationResult(data);

  if (error) {
    return installationFailure("INSTALLATION_API_UNAVAILABLE", 503);
  }
  if (!result.ok) {
    const status =
      result.code === "INSTALLATION_REVOKED"
        ? 410
        : result.code === "INSTALLATION_NOT_FOUND"
          ? 404
          : 401;
    return installationFailure(
      result.code ?? "INVALID_INSTALLATION_CREDENTIAL",
      status
    );
  }

  return noStore({
    bound: Boolean(result.boundDeviceId),
    installationCredential:
      result.created || result.credentialRotated
        ? newCredential
        : existingCredential,
    installationId: result.installationId,
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

function normalizeCredential(value: string | null) {
  const normalized = value?.trim();
  return normalized && /^[A-Za-z0-9_-]{20,200}$/.test(normalized)
    ? normalized
    : null;
}

function normalizeInstallationId(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return /^[a-f0-9-]{20,80}$/.test(normalized) ? normalized : null;
}

function parseBody(value: string) {
  try {
    return JSON.parse(value) as { installationId?: unknown };
  } catch {
    return null;
  }
}

function parseInstallationResult(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {
      boundDeviceId: null,
      code: null,
      created: false,
      credentialRotated: false,
      installationId: null,
      ok: false
    };
  }
  const result = value as Record<string, unknown>;
  return {
    boundDeviceId:
      typeof result.boundDeviceId === "string" ? result.boundDeviceId : null,
    code: typeof result.code === "string" ? result.code : null,
    created: result.created === true,
    credentialRotated: result.credentialRotated === true,
    installationId:
      typeof result.installationId === "string" ? result.installationId : null,
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

function installationFailure(code: string, status: number) {
  const cause =
    code === "INSTALLATION_REVOKED"
      ? "Deze Playerinstallatie is ingetrokken."
      : code === "INSTALLATION_CREDENTIAL_REQUIRED"
        ? "De installatiecredential ontbreekt of is beschadigd."
        : code === "INSTALLATION_NOT_FOUND"
          ? "De Playerinstallatie bestaat niet meer."
          : code === "INSTALLATION_REQUEST_INVALID"
            ? "De installatieaanvraag is ongeldig."
            : "De installatieservice is tijdelijk niet beschikbaar.";
  return NextResponse.json(
    {
      error: {
        cause,
        code,
        effect: "De schermbinding en lokale last-known-good release blijven behouden.",
        recovery: "De Player probeert dit begrensd opnieuw."
      },
      ok: false
    },
    {
      headers: { "Cache-Control": "no-store" },
      status
    }
  );
}
