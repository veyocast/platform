import { NextResponse } from "next/server";

import {
  hashPlayerCredential,
  readPlayerBearerToken
} from "../../../../_lib/player-ledscores-server";
import { createPlayerAdminClient } from "../../../../_lib/player-supabase";

const maximumRequestBytes = 512;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  const token = readPlayerBearerToken(request);
  if (!token) return failure("INVALID_DEVICE_TOKEN", 401);
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > maximumRequestBytes) {
    return failure("ACK_REQUEST_TOO_LARGE", 413);
  }
  const raw = await request.text().catch(() => "");
  if (new TextEncoder().encode(raw).byteLength > maximumRequestBytes) {
    return failure("ACK_REQUEST_TOO_LARGE", 413);
  }
  const body = parseBody(raw);
  if (!body) return failure("ACK_REQUEST_INVALID", 400);
  let admin: ReturnType<typeof createPlayerAdminClient>;
  try { admin = createPlayerAdminClient(); }
  catch { return failure("PLAYER_REALTIME_UNAVAILABLE", 503); }
  const result = await admin.rpc("ack_ledscores_player_delivery_v1", {
    p_delivery_id: body.deliveryId,
    p_detail: body.detail,
    p_status: body.status,
    p_token_hash: hashPlayerCredential(token)
  });
  if (result.error) return failure("ACK_FAILED", 503);
  if (result.data !== true) return failure("DELIVERY_NOT_FOUND", 404);
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}

function parseBody(value: string) {
  try {
    const body = JSON.parse(value) as Record<string, unknown>;
    const deliveryId = typeof body.deliveryId === "string" && uuidPattern.test(body.deliveryId)
      ? body.deliveryId
      : null;
    const status = typeof body.status === "string" && ["received", "rendered", "skipped", "failed"].includes(body.status)
      ? body.status
      : null;
    const detail = typeof body.detail === "string" ? body.detail.replace(/[\r\n]+/g, " ").slice(0, 300) : null;
    return deliveryId && status ? { deliveryId, detail, status } : null;
  } catch { return null; }
}
function failure(code: string, status: number) { return NextResponse.json({ error: { code }, ok: false }, { headers: { "Cache-Control": "no-store" }, status }); }
