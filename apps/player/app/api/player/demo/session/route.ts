import { NextResponse, type NextRequest } from "next/server";

import {
  canUsePlayerDemo,
  issuePlayerDemoSession,
  isValidPlayerDemoCode,
  playerDemoCookieName
} from "../../../../_lib/player-demo-auth";

export async function POST(request: NextRequest) {
  if (!canUsePlayerDemo()) return unavailable();

  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (
    (Number.isFinite(contentLength) && contentLength > maxRequestBytes) ||
    contentLength < 0
  ) {
    return requestTooLarge();
  }
  const rawBody = await request.text().catch(() => "");
  if (new TextEncoder().encode(rawBody).byteLength > maxRequestBytes) {
    return requestTooLarge();
  }
  const body = parseRequestBody(rawBody);
  if (!isValidPlayerDemoCode(body?.code)) {
    return NextResponse.json(
      {
        error: {
          cause: "De democode is niet geldig.",
          effect: "De reviewdemo is niet gestart.",
          recovery: "Controleer de code en probeer opnieuw."
        }
      },
      { headers: noStoreHeaders(), status: 401 }
    );
  }

  const session = issuePlayerDemoSession();
  if (!session) return unavailable();

  const response = NextResponse.json(
    { demoUrl: "/demo", ok: true },
    { headers: noStoreHeaders() }
  );
  response.cookies.set(playerDemoCookieName, session.value, {
    httpOnly: true,
    maxAge: session.maxAge,
    path: "/",
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production"
  });
  return response;
}

export async function DELETE() {
  if (!canUsePlayerDemo()) return unavailable();

  const response = NextResponse.json(
    { ok: true },
    { headers: noStoreHeaders() }
  );
  response.cookies.set(playerDemoCookieName, "", {
    httpOnly: true,
    maxAge: 0,
    path: "/",
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production"
  });
  return response;
}

const maxRequestBytes = 256;

function parseRequestBody(rawBody: string) {
  try {
    return JSON.parse(rawBody) as { code?: unknown };
  } catch {
    return null;
  }
}

function requestTooLarge() {
  return NextResponse.json(
    {
      error: {
        cause: "De demoaanvraag is te groot.",
        effect: "De reviewdemo is niet gestart.",
        recovery: "Voer alleen de korte reviewcode in."
      }
    },
    { headers: noStoreHeaders(), status: 413 }
  );
}

function unavailable() {
  return NextResponse.json(
    { error: "Reviewdemo niet beschikbaar." },
    { headers: noStoreHeaders(), status: 404 }
  );
}

function noStoreHeaders() {
  return {
    "Cache-Control": "no-store",
    "Referrer-Policy": "no-referrer"
  };
}
