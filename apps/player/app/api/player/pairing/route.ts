import { createHash } from "node:crypto";

import { NextResponse } from "next/server";

import {
  createPlayerAnonClient,
  isLivePlayerConfigured
} from "../../../_lib/player-supabase";

const pairingAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export async function POST(request: Request) {
  if (!isLivePlayerConfigured()) {
    return noStore({
      live: false,
      pairingCode: "VYO 482"
    });
  }

  const supabase = createPlayerAnonClient();
  if (!supabase) {
    return pairingFailure(
      "PAIRING_API_UNAVAILABLE",
      "De Player-configuratie is onvolledig.",
      503
    );
  }

  const installationCredential = normalizeOpaqueCredential(
    request.headers.get("x-veyocast-installation-credential")
  );
  const requestNonce = normalizeRequestNonce(
    request.headers.get("x-veyocast-pairing-request")
  );
  if (!installationCredential || !requestNonce) {
    return pairingFailure(
      "INVALID_INSTALLATION_CREDENTIAL",
      "De installatiecredential of idempotentiesleutel ontbreekt.",
      401,
      "Registreer de Playerinstallatie opnieuw zonder de schermbinding te verwijderen."
    );
  }

  const deviceToken = deterministicDeviceToken(
    requestNonce,
    installationCredential
  );
  const tokenHash = sha256(deviceToken);
  for (let codeAttempt = 0; codeAttempt < 4; codeAttempt += 1) {
    const pairingCode = createPairingCode(requestNonce, codeAttempt);
    const { data, error } = await supabase.rpc("create_pairing_session_v5", {
      p_code_hash: sha256(pairingCode),
      p_installation_credential_hash: sha256(installationCredential),
      p_request_nonce_hash: sha256(requestNonce),
      p_token_hash: tokenHash
    });

    const result = pairingResult(data);
    if (!error && result.ok) {
      return noStore({
        deviceToken,
        expiresAt: result.expiresAt,
        live: true,
        pairingCode: formatPairingCode(pairingCode),
        reused: result.reused
      });
    }

    // A six-character public code can collide. The request nonce remains the
    // idempotency key while a deterministic attempt suffix selects the same
    // alternative code again after a lost response.
    if (error?.code === "23505" && codeAttempt < 3) {
      continue;
    }

    if (!error && result.code === "RATE_LIMITED") {
      const retryAfterSeconds = result.retryAfterSeconds ?? 600;
      return pairingFailure(
        "PAIRING_RATE_LIMITED",
        "Er zijn te veel koppelcodes voor deze Player aangevraagd.",
        429,
        "De Player vraagt automatisch een nieuwe code aan; vernieuwen is niet nodig.",
        retryAfterSeconds
      );
    }

    if (!error && result.code === "INVALID_INSTALLATION_CREDENTIAL") {
      return pairingFailure(
        "INVALID_INSTALLATION_CREDENTIAL",
        "De installatiecredential is ongeldig of ingetrokken.",
        401,
        "Registreer de installatie opnieuw en vraag daarna automatisch een nieuwe code aan."
      );
    }

    break;
  }

  return pairingFailure(
    "PAIRING_API_UNAVAILABLE",
    "De pairingsessie kon niet veilig worden gemaakt.",
    503
  );
}

function createPairingCode(requestNonce: string, attempt: number) {
  const bytes = createHash("sha256")
    .update(`code:${attempt}:${requestNonce}`)
    .digest();
  return Array.from(
    { length: 6 },
    (_, index) => pairingAlphabet[bytes[index]! % pairingAlphabet.length]
  ).join("");
}

function formatPairingCode(code: string) {
  return `${code.slice(0, 3)} ${code.slice(3)}`;
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function deterministicDeviceToken(
  requestNonce: string,
  installationCredential: string
) {
  return createHash("sha256")
    .update(`device:${requestNonce}:${installationCredential}`)
    .digest("base64url");
}

function normalizeOpaqueCredential(value: string | null) {
  const normalized = value?.trim();
  return normalized && /^[A-Za-z0-9_-]{20,200}$/.test(normalized)
    ? normalized
    : null;
}

function normalizeRequestNonce(value: string | null) {
  const normalized = value?.trim().toLowerCase();
  return normalized && /^[a-f0-9-]{20,80}$/.test(normalized)
    ? normalized
    : null;
}

function pairingResult(value: unknown) {
  if (!value || typeof value !== "object") {
    return { code: null, expiresAt: null, ok: false, retryAfterSeconds: null };
  }
  const result = value as {
    code?: unknown;
    expiresAt?: unknown;
    ok?: unknown;
    reused?: unknown;
    retryAfterSeconds?: unknown;
  };
  const retryAfterSeconds =
    typeof result.retryAfterSeconds === "number" &&
    Number.isFinite(result.retryAfterSeconds)
      ? Math.min(600, Math.max(1, Math.ceil(result.retryAfterSeconds)))
      : null;
  return {
    code: typeof result.code === "string" ? result.code : null,
    expiresAt:
      typeof result.expiresAt === "string"
        ? result.expiresAt
        : new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    ok: result.ok === true,
    reused: result.reused === true,
    retryAfterSeconds
  };
}

function noStore(body: object) {
  return NextResponse.json(body, {
    headers: {
      "Cache-Control": "no-store"
    }
  });
}

function pairingFailure(
  code: string,
  cause: string,
  status: number,
  recovery = "Controleer Supabase en vernieuw daarna de Player.",
  retryAfterSeconds?: number
) {
  return NextResponse.json(
    {
      error: {
        cause,
        code,
        effect: "De Player kan nu geen veilige tijdelijke koppelcode tonen.",
        recovery
      },
      ...(retryAfterSeconds ? { retryAfterSeconds } : {})
    },
    {
      headers: {
        "Cache-Control": "no-store",
        ...(retryAfterSeconds
          ? { "Retry-After": String(retryAfterSeconds) }
          : {})
      },
      status
    }
  );
}
