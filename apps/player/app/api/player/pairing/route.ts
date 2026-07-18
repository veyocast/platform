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
  const fingerprintHash = sha256(
    `${request.headers.get("user-agent") ?? "unknown"}:${randomBytes(16).toString("hex")}`
  );

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const pairingCode = createPairingCode();
    const { error } = await supabase.rpc("create_pairing_session_v2", {
      p_code_hash: sha256(pairingCode),
      p_device_fingerprint_hash: fingerprintHash,
      p_token_hash: tokenHash
    });

    if (!error) {
      return noStore({
        deviceToken,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        live: true,
        pairingCode: formatPairingCode(pairingCode)
      });
    }

    if (error.code !== "23505") {
      return pairingFailure(`Pairingsessie kon niet worden gemaakt: ${error.message}`, 500);
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

function noStore(body: object) {
  return NextResponse.json(body, {
    headers: {
      "Cache-Control": "no-store"
    }
  });
}

function pairingFailure(cause: string, status: number) {
  return NextResponse.json(
    {
      error: {
        cause,
        effect: "De Player kan nu geen veilige tijdelijke koppelcode tonen.",
        recovery: "Controleer Supabase en vernieuw daarna de Player."
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
