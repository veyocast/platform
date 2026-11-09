import { NextResponse } from "next/server";
import {
  matchdayExpiryCapability,
  playerMatchdayAckInputSchema,
  playerMatchdayAckReceiptSchema,
  playerMatchdayActionsInputSchema,
  playerMatchdayActionsResponseSchema,
  type PlayerMatchdayActionsResponse
} from "@veyocast/contracts";

import { hashPlayerCredential, readPlayerBearerToken } from "../../../_lib/player-ledscores-server";
import { readMatchdayBootstrapWindow } from "../../../_lib/player-matchday-window-server";
import { createPlayerAdminClient } from "../../../_lib/player-supabase";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const headers = { "Cache-Control": "private, no-store", Vary: "Authorization, X-VeyoCast-Matchday" };
const maximumAckBytes = 4096;
type DeviceTarget = { tenant_id: string; device_id: string; screen_id: string; device_status: string; screen_status: string; matchday_window: unknown };
function readTarget(value: unknown): DeviceTarget | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>, uuid = playerMatchdayActionsResponseSchema.shape.deviceId;
  if (![row.tenant_id, row.device_id, row.screen_id].every(value => uuid.safeParse(value).success) ||
    typeof row.device_status !== "string" || !row.device_status || typeof row.screen_status !== "string" || !row.screen_status) return null;
  return row as DeviceTarget;
}

/** Only the current verified runtime publication may request action offers.
 * The RPC repeats authorization atomically; this anchor also rejects a wrongly
 * correlated response before any of its facts reach the device. */
export async function GET(request: Request) {
  const token = readPlayerBearerToken(request);
  if (!token) return failure("INVALID_DEVICE_TOKEN", 401);
  if (!capable(request)) return failure("MATCHDAY_CAPABILITY_REQUIRED", 412);
  const query = new URL(request.url).searchParams;
  if ([...query.keys()].some(key => key !== "requestId" && key !== "publicationId") || query.getAll("requestId").length !== 1) {
    return failure("MATCHDAY_REQUEST_INVALID", 400);
  }
  const input = playerMatchdayActionsInputSchema.safeParse({ requestId: query.get("requestId"), publicationIds: query.getAll("publicationId") });
  if (!input.success) return failure("MATCHDAY_REQUEST_INVALID", 400);
  try {
    const admin = createPlayerAdminClient(), tokenHash = hashPlayerCredential(token);
    const bootstrap = await admin.rpc("get_player_effective_target_v1", { p_token_hash: tokenHash });
    if (bootstrap.error) return rpcFailure(bootstrap.error.code);
    if (bootstrap.data == null) return failure("INVALID_DEVICE_TOKEN", 401);
    const target = readTarget(bootstrap.data);
    if (!target) return failure("MATCHDAY_RESPONSE_INVALID", 503);
    if (target.device_status !== "paired" || target.screen_status === "disabled") return failure("INVALID_DEVICE_TOKEN", 401);
    const result = await admin.rpc("get_player_matchday_actions_s300_v1", {
      p_token_hash: tokenHash, p_publication_ids: input.data.publicationIds, p_request_id: input.data.requestId
    });
    if (result.error) return rpcFailure(result.error.code);
    const parsed = playerMatchdayActionsResponseSchema.safeParse(result.data);
    if (!parsed.success || parsed.data.requestId !== input.data.requestId || parsed.data.deviceId !== target.device_id || parsed.data.screenId !== target.screen_id) {
      return failure("MATCHDAY_RESPONSE_INVALID", 503);
    }
    const body = parsed.data;
    if (body.publicationId !== null && body.publicationId !== input.data.publicationIds[0] || body.publicationId === null && body.actions.length !== 0) {
      return failure("MATCHDAY_RESPONSE_INVALID", 503);
    }
    if (body.actions.length) {
      const window = readMatchdayBootstrapWindow(target.matchday_window);
      if (!window || window.publication_id !== body.publicationId || !validActions(body, window.target_id)) {
        return failure("MATCHDAY_RESPONSE_INVALID", 503);
      }
    }
    return NextResponse.json(body, { headers });
  } catch { return failure("PLAYER_API_UNAVAILABLE", 503); }
}

/** An ended/expired issued action can still acknowledge removal. The database
 * validates that exact delivery and the currently authorized restored release;
 * requiring a current temporary window here would prevent honest recovery. */
export async function POST(request: Request) {
  const token = readPlayerBearerToken(request);
  if (!token) return failure("INVALID_DEVICE_TOKEN", 401);
  if (!capable(request)) return failure("MATCHDAY_CAPABILITY_REQUIRED", 412);
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > maximumAckBytes) return failure("MATCHDAY_ACK_TOO_LARGE", 413);
  const body = await readAckBody(request);
  if (!body.ok) return failure(body.status === 413 ? "MATCHDAY_ACK_TOO_LARGE" : "MATCHDAY_ACK_INVALID", body.status);
  let value: unknown;
  try { value = JSON.parse(body.text); } catch { return failure("MATCHDAY_ACK_INVALID", 400); }
  const parsed = playerMatchdayAckInputSchema.safeParse(value);
  if (!parsed.success) return failure("MATCHDAY_ACK_INVALID", 400);
  try {
    const result = await createPlayerAdminClient().rpc("ack_player_matchday_action_s300_v1", {
      p_token_hash: hashPlayerCredential(token), p_input: parsed.data
    });
    if (result.error) return rpcFailure(result.error.code);
    const receipt = playerMatchdayAckReceiptSchema.safeParse(result.data);
    if (!receipt.success || receipt.data.deliveryId !== parsed.data.deliveryId || receipt.data.phase !== parsed.data.phase) {
      return failure("MATCHDAY_RESPONSE_INVALID", 503);
    }
    return NextResponse.json(receipt.data, { headers, status: receipt.data.accepted ? 200 : 409 });
  } catch { return failure("PLAYER_API_UNAVAILABLE", 503); }
}

/** Bound actual incoming bytes even for chunked or misdeclared requests. Do
 * not await cancellation from an untrusted stream after crossing the limit. */
async function readAckBody(request: Request): Promise<{ ok: true; text: string } | { ok: false; status: 400 | 413 }> {
  if (!request.body) return { ok: false, status: 400 };
  const reader = request.body.getReader(), decoder = new TextDecoder("utf-8", { fatal: true });
  let bytes = 0, text = "";
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) return { ok: true, text: text + decoder.decode() };
      bytes += chunk.value.byteLength;
      if (bytes > maximumAckBytes) {
        void reader.cancel().catch(() => undefined);
        return { ok: false, status: 413 };
      }
      text += decoder.decode(chunk.value, { stream: true });
    }
  } catch { return { ok: false, status: 400 }; }
  finally { reader.releaseLock(); }
}

function capable(request: Request) { return request.headers.get("X-VeyoCast-Matchday") === matchdayExpiryCapability; }
function validActions(body: PlayerMatchdayActionsResponse, targetId: string) {
  const now = Date.parse(body.serverTime), deliveries = new Set<string>(), actions = new Set<string>(), objects = new Set<string>(), runbooks = new Set<string>();
  return body.actions.every(action => {
    const start = Date.parse(action.startsAt), end = Date.parse(action.expiresAt);
    const object = `${action.matchId}:${action.kind === "field" ? "field" : "phase"}`;
    if (action.deviceId !== body.deviceId || action.screenId !== body.screenId || action.publicationId !== body.publicationId || action.targetId !== targetId ||
      !(start <= now && now < end && end - start <= 48 * 60 * 60_000) || deliveries.has(action.deliveryId) || actions.has(action.actionId) || objects.has(object)) return false;
    deliveries.add(action.deliveryId); actions.add(action.actionId); objects.add(object); runbooks.add(action.runbookId);
    return runbooks.size === 1;
  });
}
function rpcFailure(code: string | undefined) {
  if (code === "42501") return failure("INVALID_DEVICE_TOKEN", 401);
  if (code === "40001" || code === "23505") return failure("MATCHDAY_CONFLICT", 409);
  if (code === "22023") return failure("MATCHDAY_REQUEST_INVALID", 400);
  return failure("PLAYER_API_UNAVAILABLE", 503);
}
function failure(code: string, status: number) { return NextResponse.json({ error: { code }, ok: false }, { headers, status }); }
