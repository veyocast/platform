import { NextResponse } from "next/server";

import { isLiveSupabaseConfigured } from "../../../lib/supabase/config";

export function GET() {
  const configured = isLiveSupabaseConfigured();

  return NextResponse.json(
    {
      app: "control",
      configured,
      deploymentSha:
        process.env.VERCEL_GIT_COMMIT_SHA?.trim() ||
        process.env.DEPLOYMENT_SHA?.trim() ||
        "local",
      pairingAdministration: configured ? "ready" : "unavailable",
      status: configured ? "ready" : "misconfigured"
    },
    {
      headers: { "Cache-Control": "no-store" },
      status: configured ? 200 : 503
    }
  );
}
