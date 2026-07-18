import { NextResponse } from "next/server";

import { isLivePlayerConfigured } from "../../_lib/player-supabase";

export function GET() {
  const configured = isLivePlayerConfigured();

  return NextResponse.json(
    {
      app: "player",
      appVersion: process.env.NEXT_PUBLIC_APP_VERSION?.trim() || "development",
      configured,
      deploymentSha:
        process.env.VERCEL_GIT_COMMIT_SHA?.trim() ||
        process.env.DEPLOYMENT_SHA?.trim() ||
        "local",
      pairing: configured ? "ready" : "unavailable",
      status: configured ? "ready" : "misconfigured"
    },
    {
      headers: { "Cache-Control": "no-store" },
      status: configured ? 200 : 503
    }
  );
}
