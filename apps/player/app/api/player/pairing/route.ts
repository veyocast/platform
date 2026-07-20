import { createHash, randomBytes, randomInt } from "node:crypto";

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
    return pairingFailure("De Player-configuratie is onvolledig.", 503);
  }

  const deviceToken = randomBytes(32).toString("base64url");
  const tokenHash = sha256(deviceToken);
  const fingerprintHash = pairingFingerprint(request);

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const pairingCode = createPairingCode();
    const { data, error } = await supabase.rpc("create_pairing_session_v3", {
      p_code_hash: sha256(pairingCode),
      p_device_fingerprint_hash: fingerprintHash,
      p_token_hash: tokenHash
    });

    const result = pairingResult(data);
    if (!error && result.ok) {
      return noStore({
        deviceToken,
        expiresAt: result.expiresAt,
        live: true,
        pairingCode: formatPairingCode(pairingCode)
      });
    }

    if (!error && result.code === "RATE_LIMITED") {
      return pairingFailure(
        "Er zijn te veel koppelcodes voor deze Player aangevraagd.",
        429,
        "Wacht tien minuten en vernieuw daarna de Player."
      );
    }

    if (error?.code !== "23505") {
      return pairingFailure("De pairingsessie kon niet veilig worden gemaakt.", 503);
    }
  }

  return pairingFailure("Er kon geen unieke koppelcode worden gereserveerd.", 503);
}

function createPairingCode() {
  return Array.from(
    { length: 6 },
    () => pairingAlphabet[randomInt(pairingAlphabet.length)]
  ).join("");
}

function formatPairingCode(code: string) {
  return `${code.slice(0, 3)} ${code.slice(3)}`;
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function pairingFingerprint(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const clientAddress =
    request.headers.get("cf-connecting-ip")?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    forwarded ||
    "unknown";
  const userAgent = request.headers.get("user-agent")?.trim() || "unknown";
  return sha256(`${clientAddress.slice(0, 80)}:${userAgent.slice(0, 240)}`);
}

function pairingResult(value: unknown) {
  if (!value || typeof value !== "object") {
    return { code: null, expiresAt: null, ok: false };
  }
  const result = value as { code?: unknown; expiresAt?: unknown; ok?: unknown };
  return {
    code: typeof result.code === "string" ? result.code : null,
    expiresAt:
      typeof result.expiresAt === "string"
        ? result.expiresAt
        : new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    ok: result.ok === true
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
  cause: string,
  status: number,
  recovery = "Controleer Supabase en vernieuw daarna de Player."
) {
  return NextResponse.json(
    {
      error: {
        cause,
        effect: "De Player kan nu geen veilige tijdelijke koppelcode tonen.",
        recovery
      }
    },
    {
      headers: {
        "Cache-Control": "no-store"
      },
      status
    }
  );
}
