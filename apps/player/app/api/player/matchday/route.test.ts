import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const fixture = vi.hoisted(() => ({ rpc: vi.fn(), unavailable: false }));
vi.mock("../../../_lib/player-supabase", () => ({ createPlayerAdminClient: () => {
  if (fixture.unavailable) throw Error("private configuration and credential");
  return { rpc: fixture.rpc };
} }));
import { GET, POST } from "./route";

const id = (number: number) => `30000000-0000-4000-8000-${String(number).padStart(12, "0")}`;
const token = "paired-matchday-device-token", requestId = id(10);
const capability = "matchday-expiry-v1";
const window = { publication_id: id(4), target_id: id(5), window_id: id(12), content_hash: "a".repeat(64), starts_at: "2026-11-09T11:00:00Z", expires_at: "2026-11-09T13:00:00Z", server_time: "2026-11-09T12:00:00Z", fallback_release_id: id(11), fallback_data_key: "fallback:1", fallback_composition: null, unsupported_release_id: id(11), unsupported_data_key: "ordinary:1", unsupported_composition: null };
const target = () => ({ tenant_id: id(1), device_id: id(2), screen_id: id(3), device_status: "paired", screen_status: "online", matchday_window: structuredClone(window) });
const action = () => ({ schemaVersion: 1, deliveryId: id(8), actionId: id(7), runbookId: id(6), publicationId: id(4), targetId: id(5), screenId: id(3), deviceId: id(2), actionRevision: 3, contentHash: "b".repeat(64), startsAt: "2026-11-09T11:55:00Z", expiresAt: "2026-11-09T12:20:00Z", matchId: id(9), matchCode: "official-20935947", homeTeamName: "Eigen vereniging", awayTeamName: "Tegenstander", kind: "field", field: "2" });
const offer = () => ({ schemaVersion: 1, requestId, serverTime: "2026-11-09T12:00:00Z", deviceId: id(2), screenId: id(3), publicationId: id(4) as string | null, actions: [action()] });
const ack = () => ({ schemaVersion: 1, requestId, deliveryId: id(8), actionId: id(7), runbookId: id(6), publicationId: id(4), targetId: id(5), actionRevision: 3, contentHash: "b".repeat(64), phase: "rendered", reportedAt: "2026-11-09T12:00:01Z", activeReleaseId: id(11), reasonCode: null });
const receipt = () => ({ accepted: true, replayed: false, deliveryId: id(8), phase: "rendered" });
function request(method = "GET", body: unknown = ack(), query = `requestId=${requestId}&publicationId=${id(4)}`, headers: Record<string, string> = {}) {
  return new Request(`https://player.veyocast.test/api/player/matchday?${query}`, {
    method, headers: { Authorization: `Bearer ${token}`, "X-VeyoCast-Matchday": capability, "Content-Type": "application/json", ...headers },
    ...(method === "POST" ? { body: typeof body === "string" ? body : JSON.stringify(body) } : {})
  });
}
function provide(data: unknown = offer(), bootstrap: unknown = target()) {
  fixture.rpc.mockImplementation(async (name: string) => ({ data: name === "get_player_effective_target_v1" ? bootstrap : data, error: null }));
}
function privateResponse(response: Response) {
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(response.headers.get("vary")).toBe("Authorization, X-VeyoCast-Matchday");
}
beforeEach(() => { fixture.rpc.mockReset(); fixture.unavailable = false; provide(); });

describe("device-bound matchday action API", () => {
  it.each(["GET", "POST"])("rejects absent credentials or unsupported capability before RPC (%s)", async method => {
    const handler = method === "GET" ? GET : POST;
    expect((await handler(request(method, ack(), undefined, { Authorization: "" }))).status).toBe(401);
    expect((await handler(request(method, ack(), undefined, { Authorization: "Bearer short" }))).status).toBe(401);
    expect((await handler(request(method, ack(), undefined, { "X-VeyoCast-Matchday": "" }))).status).toBe(412);
    expect(fixture.rpc).not.toHaveBeenCalled();
  });
  it.each([
    `requestId=wrong&publicationId=${id(4)}`, `publicationId=${id(4)}`, `requestId=${requestId}&requestId=${id(11)}`,
    `requestId=${requestId}&publicationId=${id(4)}&publicationId=${id(4)}`, `requestId=${requestId}&publicationId=invalid`,
    `requestId=${requestId}&screenId=${id(99)}`, `requestId=${requestId}&tenantId=${id(99)}`
  ])("rejects malformed, duplicate or caller-claimed scope query without RPC: %s", async query => {
    expect((await GET(request("GET", null, query))).status).toBe(400); expect(fixture.rpc).not.toHaveBeenCalled();
  });
  it("passes only credential hashes and exact scoped nonce; returns a private strict DTO", async () => {
    const response = await GET(request()); expect(response.status).toBe(200); expect(await response.json()).toEqual(offer()); privateResponse(response);
    const hash = createHash("sha256").update(token).digest("hex");
    expect(fixture.rpc.mock.calls).toEqual([
      ["get_player_effective_target_v1", { p_token_hash: hash }],
      ["get_player_matchday_actions_s300_v1", { p_token_hash: hash, p_publication_ids: [id(4)], p_request_id: requestId }]
    ]);
    expect(JSON.stringify(fixture.rpc.mock.calls)).not.toContain(token);
  });
  it.each(["requestId", "deviceId", "screenId", "publicationId"] as const)("rejects a response correlated to another %s", async key => {
    const data = offer(); data[key] = id(99); provide(data);
    const response = await GET(request()); expect(response.status).toBe(503); expect(await response.text()).not.toContain(id(99)); privateResponse(response);
  });
  it.each(["deviceId", "screenId", "publicationId", "targetId"] as const)("rejects an issued action for another %s", async key => {
    const data = offer(); data.actions[0]![key] = id(99); provide(data);
    expect((await GET(request())).status).toBe(503);
  });
  it.each(["expired", "future", "too-long", "duplicate", "same-object", "bad-hash", "raw-provider"])("rejects invalid action facts without exposing them: %s", async kind => {
    const data = offer();
    if (kind === "expired") data.actions[0]!.expiresAt = data.serverTime;
    if (kind === "future") data.actions[0]!.startsAt = "2026-11-09T12:01:00Z";
    if (kind === "too-long") data.actions[0]!.startsAt = "2026-11-06T12:00:00Z";
    if (kind === "duplicate") data.actions.push(action());
    if (kind === "same-object") data.actions.push({ ...action(), actionId: id(98), deliveryId: id(99) });
    if (kind === "bad-hash") data.actions[0]!.contentHash = "not-a-hash";
    if (kind === "raw-provider") Object.assign(data.actions[0]!, { rawProvider: "private source response" });
    provide(data); const response = await GET(request()); expect(response.status).toBe(503); expect(await response.text()).not.toContain("private source response");
  });
  it("allows a live overlay across a shorter phase boundary within the same publication", async () => {
    const bootstrap = target(); bootstrap.matchday_window.expires_at = "2026-11-09T12:05:00Z";
    provide(offer(), bootstrap); expect((await GET(request())).status).toBe(200);
  });
  it("accepts authorized empty responses without a temporary window and with no requested publication", async () => {
    const data = { ...offer(), publicationId: null, actions: [] }, bootstrap = { ...target(), matchday_window: null };
    provide(data, bootstrap); const response = await GET(request("GET", null, `requestId=${requestId}`));
    expect(response.status).toBe(200); expect(await response.json()).toEqual(data);
    expect(fixture.rpc).toHaveBeenLastCalledWith("get_player_matchday_actions_s300_v1", expect.objectContaining({ p_publication_ids: [] }));
  });
  it("never accepts nonempty actions when no publication or matching temporary target is active", async () => {
    expect((await GET(request("GET", null, `requestId=${requestId}`))).status).toBe(503);
    provide(offer(), { ...target(), matchday_window: null }); expect((await GET(request())).status).toBe(503);
    const bootstrap = target(); bootstrap.matchday_window.publication_id = id(99); provide(offer(), bootstrap); expect((await GET(request())).status).toBe(503);
  });
  it("rejects missing, unpaired and disabled target credentials without querying action data", async () => {
    for (const bootstrap of [null, { ...target(), device_status: "pending" }, { ...target(), screen_status: "disabled" }]) {
      fixture.rpc.mockClear(); provide(offer(), bootstrap); expect((await GET(request())).status).toBe(401); expect(fixture.rpc).toHaveBeenCalledTimes(1);
    }
  });
  it("treats malformed bootstrap data as recoverable rather than revoking a valid credential", async () => {
    provide(offer(), { ...target(), tenant_id: "malformed" });
    expect((await GET(request())).status).toBe(503); expect(fixture.rpc).toHaveBeenCalledTimes(1);
  });
  it("keeps ended/expired removal ACKs device-issued and nonce-preserving without a current-window gate", async () => {
    const input = { ...ack(), phase: "restored", reasonCode: "EXPIRED" }, output = { ...receipt(), replayed: true, phase: "restored" };
    provide(output); const response = await POST(request("POST", input)); expect(response.status).toBe(200); expect(await response.json()).toEqual(output); privateResponse(response);
    expect(fixture.rpc).toHaveBeenCalledExactlyOnceWith("ack_player_matchday_action_s300_v1", { p_token_hash: createHash("sha256").update(token).digest("hex"), p_input: input });
  });
  it.each(["received", "prepared", "rendered", "restored", "skipped", "failed"])("preserves the exact ACK phase without promoting frame evidence: %s", async phase => {
    const input = { ...ack(), phase }; provide({ ...receipt(), phase }); const response = await POST(request("POST", input));
    expect(response.status).toBe(200); expect((await response.json()).phase).toBe(phase);
    expect(fixture.rpc.mock.calls[0]![1].p_input).toEqual(input);
  });
  it.each([
    { ...ack(), actionRevision: 0 }, { ...ack(), contentHash: "bad" }, { ...ack(), phase: "heartbeat" },
    { ...ack(), tenantId: id(99) }, { ...ack(), deviceId: id(99) }, { ...ack(), screenId: id(99) }
  ])("rejects malformed or caller-claimed ACK scope before any RPC", async input => {
    expect((await POST(request("POST", input))).status).toBe(400); expect(fixture.rpc).not.toHaveBeenCalled();
  });
  it("bounds ACK bytes even without a truthful content-length and rejects malformed JSON", async () => {
    expect((await POST(request("POST", ack(), undefined, { "Content-Length": "4097" }))).status).toBe(413);
    expect((await POST(request("POST", JSON.stringify("é".repeat(2100))))).status).toBe(413);
    expect((await POST(request("POST", "{"))).status).toBe(400); expect(fixture.rpc).not.toHaveBeenCalled();
  });
  it.each([undefined, "1"])("cancels an oversized chunked ACK at the byte limit with declared length %s", async declared => {
    let pulls = 0;
    const cancel = vi.fn(), chunks = [new Uint8Array(2048).fill(32), new Uint8Array(2049).fill(32)];
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) { pulls++; if (chunks.length) controller.enqueue(chunks.shift()!); else throw Error("must not read past the bound"); },
      cancel
    }, { highWaterMark: 0 });
    const headers: Record<string, string> = { Authorization: `Bearer ${token}`, "X-VeyoCast-Matchday": capability };
    if (declared !== undefined) headers["Content-Length"] = declared;
    const input = new Request("https://player.veyocast.test/api/player/matchday", { method: "POST", headers, body: stream, duplex: "half" } as RequestInit & { duplex: "half" });
    expect((await POST(input)).status).toBe(413); expect(cancel).toHaveBeenCalledOnce(); expect(pulls).toBe(2); expect(fixture.rpc).not.toHaveBeenCalled();
  });
  it("accepts a valid chunked ACK through the same strict identity contract", async () => {
    const bytes = new TextEncoder().encode(JSON.stringify(ack())), chunks = [bytes.subarray(0, 7), bytes.subarray(7)];
    const stream = new ReadableStream<Uint8Array>({ pull(controller) { if (chunks.length) controller.enqueue(chunks.shift()!); else controller.close(); } }, { highWaterMark: 0 });
    const input = new Request("https://player.veyocast.test/api/player/matchday", { method: "POST", headers: { Authorization: `Bearer ${token}`, "X-VeyoCast-Matchday": capability }, body: stream, duplex: "half" } as RequestInit & { duplex: "half" });
    provide(receipt()); expect((await POST(input)).status).toBe(200); expect(fixture.rpc.mock.calls[0]![1].p_input).toEqual(ack());
  });
  it.each([{ ...receipt(), deliveryId: id(99) }, { ...receipt(), phase: "prepared" }, { ...receipt(), debug: "private credential" }])("rejects an unrelated or malformed receipt without returning private fields", async output => {
    provide(output); const response = await POST(request("POST")); expect(response.status).toBe(503); expect(await response.text()).not.toContain("private credential");
  });
  it("returns an issued rejected receipt as conflict rather than accepted proof", async () => {
    const output = { ...receipt(), accepted: false }; provide(output); const response = await POST(request("POST")); expect(response.status).toBe(409); expect(await response.json()).toEqual(output);
  });
  it.each([["42501", 401], ["22023", 400], ["40001", 409], ["23505", 409], ["57014", 503]] as const)("maps RPC code %s to a safe status without reflecting provider/credential errors", async (code, status) => {
    fixture.rpc.mockResolvedValue({ data: null, error: { code, message: `private ${token} source and stack` } });
    for (const handler of [GET, POST]) { const response = await handler(request(handler === GET ? "GET" : "POST")); expect(response.status).toBe(status); expect(await response.text()).not.toContain(token); privateResponse(response); }
  });
  it("fails recoverably when admin configuration or transport is unavailable", async () => {
    fixture.unavailable = true; expect((await GET(request())).status).toBe(503); expect((await POST(request("POST"))).status).toBe(503);
    fixture.unavailable = false; fixture.rpc.mockRejectedValue(Error("private database endpoint")); expect((await GET(request())).status).toBe(503); expect((await POST(request("POST"))).status).toBe(503);
  });
});
