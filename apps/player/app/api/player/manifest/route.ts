import { NextResponse } from "next/server";

import { getPlayerManifestForToken } from "../../../_lib/player-manifest";

function getBearerToken(request: Request) {
  const authorization = request.headers.get("authorization");

  if (!authorization?.toLowerCase().startsWith("bearer ")) {
    return null;
  }

  return authorization.slice("bearer ".length);
}

export function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const token =
    requestUrl.searchParams.get("deviceToken") ?? getBearerToken(request);
  const lookup = getPlayerManifestForToken(token);

  return NextResponse.json(lookup.body, {
    status: lookup.status,
    headers: {
      "Cache-Control": "no-store"
    }
  });
}
