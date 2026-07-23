import { NextResponse, type NextRequest } from "next/server";

import {
  acceptsPlayerDemoSession,
  playerDemoCookieName
} from "../../../../_lib/player-demo-auth";
import { loadPlayerDemoManifest } from "../../../../_lib/player-demo-manifest";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = request.cookies.get(playerDemoCookieName)?.value;
  if (!acceptsPlayerDemoSession(session)) {
    return NextResponse.json(
      { error: "Reviewdemo niet beschikbaar." },
      {
        headers: { "Cache-Control": "no-store" },
        status: 404
      }
    );
  }

  const manifest = await loadPlayerDemoManifest();
  return NextResponse.json(manifest, {
    headers: { "Cache-Control": "no-store" }
  });
}

