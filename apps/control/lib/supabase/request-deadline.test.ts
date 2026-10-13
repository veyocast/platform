import { createServer, type Server } from "node:http";
import type { Socket } from "node:net";

import { afterEach, describe, expect, it, vi } from "vitest";

import { createRequestDeadline, controlSessionBodyLimitBytes } from "./request-deadline";

const cleanup: (() => void | Promise<void>)[] = [];
afterEach(async () => {
  vi.useRealTimers();
  await Promise.all(cleanup.splice(0).map((close) => close()));
});

async function heldResponse(oversized = false) {
  const sockets = new Set<Socket>();
  let headersSeen!: () => void;
  let bodyClosed!: () => void;
  const headers = new Promise<void>((resolve) => { headersSeen = resolve; });
  const closed = new Promise<void>((resolve) => { bodyClosed = resolve; });
  const server = createServer((_, response) => {
    response.writeHead(200, { "Content-Type": "application/json" });
    response.write(oversized ? Buffer.alloc(controlSessionBodyLimitBytes + 1, 120) : '{"held":');
    response.once("close", bodyClosed);
    headersSeen();
  });
  server.on("connection", (socket) => {
    sockets.add(socket);
    socket.once("close", () => sockets.delete(socket));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  cleanup.push(() => closeServer(server, sockets));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("fixture address missing");
  return { url: `http://127.0.0.1:${address.port}/held`, headers, closed };
}

async function closeServer(server: Server, sockets: Set<Socket>) {
  sockets.forEach((socket) => socket.destroy());
  await new Promise<void>((resolve) => server.close(() => resolve()));
}

describe("scoped Control request deadline", () => {
  it("aborts a real native response body after headers, not merely the header promise", async () => {
    const held = await heldResponse();
    const deadline = createRequestDeadline(250);
    cleanup.push(() => deadline.dispose());
    const request = deadline.run(() => deadline.fetch(held.url));
    const rejected = expect(request).rejects.toMatchObject({ name: "AbortError", message: "CONTROL_REQUEST_UNAVAILABLE" });
    await held.headers;
    await rejected;
    await held.closed;
    expect(deadline.signal.aborted).toBe(true);
  });

  it("cancels an oversized native streaming body at the byte cap without waiting for its deadline", async () => {
    const held = await heldResponse(true);
    const deadline = createRequestDeadline(2_000);
    cleanup.push(() => deadline.dispose());
    const started = Date.now();
    await expect(deadline.fetch(held.url)).rejects.toMatchObject({ name: "AbortError", message: "CONTROL_REQUEST_UNAVAILABLE" });
    await held.closed;
    expect(Date.now() - started).toBeLessThan(1_000);
    expect(deadline.signal.aborted).toBe(true);
  });

  it.each(["scope", "request", "init"])("stops native body IO for an aborted %s signal and masks its private reason", async (source) => {
    const held = await heldResponse();
    const caller = new AbortController();
    const deadline = createRequestDeadline(2_000, { signal: source === "scope" ? caller.signal : undefined });
    cleanup.push(() => deadline.dispose());
    const input = source === "request" ? new Request(held.url, { signal: caller.signal }) : held.url;
    const request = deadline.fetch(input, source === "init" ? { signal: caller.signal } : undefined);
    const rejected = expect(request).rejects.toMatchObject({ name: "AbortError", message: "CONTROL_REQUEST_UNAVAILABLE" });
    await held.headers;
    caller.abort(new Error("PRIVATE_CALLER_REASON"));
    await rejected;
    await held.closed;
  });

  it("combines Request and init signals while retaining actual Request method/body/headers", async () => {
    const requestAbort = new AbortController();
    const initAbort = new AbortController();
    let sentSignal: AbortSignal | undefined;
    const fetchImpl = vi.fn<typeof fetch>(async (input, init) => {
      expect(input).toBeInstanceOf(Request);
      expect((input as Request).method).toBe("POST");
      expect(await (input as Request).text()).toBe("payload");
      expect((input as Request).headers.get("X-Fixture")).toBe("kept");
      sentSignal = init?.signal ?? undefined;
      return new Response("{}");
    });
    const deadline = createRequestDeadline(2_000, { fetchImpl });
    cleanup.push(() => deadline.dispose());
    await deadline.fetch(new Request("https://fixture.invalid/read", {
      method: "POST", body: "payload", headers: { "X-Fixture": "kept" }, signal: requestAbort.signal
    }), { signal: initAbort.signal });
    expect(sentSignal).not.toBe(requestAbort.signal);
    expect(sentSignal).not.toBe(initAbort.signal);
    // Completed bodies remove per-request caller listeners.
    initAbort.abort();
    expect(sentSignal?.aborted).toBe(false);
  });

  it.each(["request", "init"])("honors the %s abort even when both Request and init signals are present", async (source) => {
    const held = await heldResponse();
    const requestAbort = new AbortController();
    const initAbort = new AbortController();
    const deadline = createRequestDeadline(2_000);
    cleanup.push(() => deadline.dispose());
    const sending = deadline.fetch(new Request(held.url, { signal: requestAbort.signal }), { signal: initAbort.signal });
    const rejected = expect(sending).rejects.toMatchObject({ name: "AbortError" });
    await held.headers;
    (source === "request" ? requestAbort : initAbort).abort("PRIVATE");
    await rejected;
    await held.closed;
  });

  it("uses one total budget across requests and clears its timer on disposal", async () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response("{}"));
    const deadline = createRequestDeadline(1_000, { fetchImpl });
    await deadline.fetch("https://fixture.invalid/first");
    await vi.advanceTimersByTimeAsync(900);
    await deadline.fetch("https://fixture.invalid/second");
    await vi.advanceTimersByTimeAsync(100);
    await expect(deadline.fetch("https://fixture.invalid/third")).rejects.toMatchObject({ name: "AbortError" });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    deadline.dispose();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("closes disposed/pre-aborted scopes without starting IO or exposing a caller reason", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const caller = new AbortController();
    caller.abort("PRIVATE");
    const deadline = createRequestDeadline(1_000, { signal: caller.signal, fetchImpl });
    await expect(deadline.run(async () => "success")).rejects.toMatchObject({ message: "CONTROL_REQUEST_UNAVAILABLE" });
    deadline.dispose();
    await expect(deadline.fetch("https://fixture.invalid/read")).rejects.toMatchObject({ name: "AbortError" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("keeps a lookalike external Auth path outside the internal Auth-envelope scope", async () => {
    const deadline = createRequestDeadline(1_000, { fetchImpl: async () => { throw new Error("PRIVATE_TRANSPORT"); } });
    cleanup.push(() => deadline.dispose());
    await expect(deadline.fetch("https://other.invalid/auth/v1/token", undefined, "https://fixture.invalid/auth/v1"))
      .rejects.toMatchObject({ name: "AbortError", message: "CONTROL_REQUEST_UNAVAILABLE" });
  });
});
