import { NextResponse } from "next/server";

import { getControlSession } from "../../../lib/control-session";
import { searchControlResources } from "../../../lib/control-search";

export async function GET(request: Request) {
  const session = await getControlSession();
  if (!session) return NextResponse.json({ results: [] }, { status: 401 });

  const query = new URL(request.url).searchParams.get("q") ?? "";
  const results = await searchControlResources(session, query);
  return NextResponse.json(
    { results },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}
