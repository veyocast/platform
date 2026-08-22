import { createHash } from "node:crypto";

import { sponsorPlayEventBatchSchema } from "@veyocast/contracts";
import { NextResponse } from "next/server";

import { createPlayerAnonClient, isLivePlayerConfigured } from "../../../_lib/player-supabase";

function bearerToken(request: Request) {
  const header = request.headers.get("authorization");
  return header?.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : null;
}

export async function POST(request: Request) {
  const token = bearerToken(request);
  if (!token) return problem(401, "DEVICE_TOKEN_REQUIRED");
  const parsed = sponsorPlayEventBatchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return problem(400, "INVALID_PROOF_BATCH");
  if (!isLivePlayerConfigured()) return NextResponse.json({ accepted: parsed.data.events.length });
  const anon = createPlayerAnonClient();
  if (!anon) return problem(503, "PLAYER_API_UNAVAILABLE");
  const { data, error } = await anon.rpc("record_sponsor_play_events_v1", {
    p_events: parsed.data.events,
    p_token_hash: createHash("sha256").update(token).digest("hex")
  });
  if (error) return problem(503, "PROOF_QUEUE_RETRY");
  return NextResponse.json({ accepted: Number(data ?? 0) }, { headers: { "Cache-Control": "no-store" } });
}

function problem(status: number, code: string) {
  return NextResponse.json({ error: { cause: code, effect: "De vertoning blijft lokaal in de wachtrij.", recovery: "De Player probeert de batch later opnieuw." } }, { status, headers: { "Cache-Control": "no-store" } });
}
