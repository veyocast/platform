import { createServer, type IncomingMessage } from "node:http";
import type { RequestOptions } from "node:https";
import type * as HttpModule from "node:http";
import type * as HttpsModule from "node:https";
import { once } from "node:events";
import { EventEmitter } from "node:events";
import { setTimeout as delay } from "node:timers/promises";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ lookup: vi.fn(), request: vi.fn() }));
vi.mock("node:dns/promises", () => ({ lookup: mocks.lookup }));
vi.mock("node:http", async importOriginal => ({ ...await importOriginal<typeof HttpModule>(), request: mocks.request }));
vi.mock("node:https", async importOriginal => ({ ...await importOriginal<typeof HttpsModule>(), request: mocks.request }));
import { fetchSafeRssImage } from "../src/safe-image-fetch";
const { request: nativeHttpRequest } = await vi.importActual<typeof HttpModule>("node:http");

const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const publicAddress = [{ address: "8.8.8.8", family: 4 }];
afterEach(() => { mocks.lookup.mockReset(); mocks.request.mockReset(); });

describe("safe RSS image operation cancellation", () => {
  it("pre-abort prevents DNS and HTTP and masks private abort reasons", async () => {
    const controller = new AbortController(); controller.abort(new Error("PRIVATE_REASON"));
    const error = await fetchSafeRssImage("https://image.example/logo.png", 0, { signal: controller.signal }).catch(error => error);
    expect(error).toMatchObject({ code: "rss_media_aborted" }); expect(String(error)).not.toMatch(/PRIVATE_/);
    expect(mocks.lookup).not.toHaveBeenCalled(); expect(mocks.request).not.toHaveBeenCalled();
  });

  it("abandons its own DNS wait and never starts HTTP when late DNS resolves", async () => {
    let complete!: (value: typeof publicAddress) => void;
    mocks.lookup.mockImplementation(() => new Promise(resolve => { complete = resolve; }));
    const controller = new AbortController();
    const pending = fetchSafeRssImage("https://image.example/logo.png", 0, { signal: controller.signal });
    const rejection = pending.catch(error => error); controller.abort(new Error("PRIVATE_REASON"));
    expect(await rejection).toMatchObject({ code: "rss_media_aborted" });
    complete(publicAddress); await delay(0); expect(mocks.request).not.toHaveBeenCalled();
  });

  it("checks cancellation after DNS before pinned HTTP begins", async () => {
    const controller = new AbortController();
    mocks.lookup.mockImplementation(async () => { controller.abort(new Error("PRIVATE_REASON")); return publicAddress; });
    await expect(fetchSafeRssImage("https://image.example/logo.png", 0, { signal: controller.signal })).rejects.toMatchObject({ code: "rss_media_aborted" });
    expect(mocks.request).not.toHaveBeenCalled();
  });

  it.each(["http://localhost/a", "http://127.0.0.1/a", "https://name.local/a", "https://user:pass@image.example/a", "https://image.example:123/a"])("retains SSRF refusal for %s", async url => {
    mocks.lookup.mockResolvedValue([{ address: "127.0.0.1", family: 4 }]);
    await expect(fetchSafeRssImage(url)).rejects.toMatchObject({ code: "rss_media_blocked" }); expect(mocks.request).not.toHaveBeenCalled();
  });

  it("retains mixed public/private DNS refusal before HTTP", async () => {
    mocks.lookup.mockResolvedValue([...publicAddress, { address: "10.0.0.1", family: 4 }]);
    await expect(fetchSafeRssImage("https://image.example/a")).rejects.toMatchObject({ code: "rss_media_blocked" }); expect(mocks.request).not.toHaveBeenCalled();
  });

  it.each(["headers", "body"])("stops the real pinned native HTTP %s request", async stage => {
    let received!: () => void, closed!: () => void;
    const started = new Promise<void>(resolve => { received = resolve; }), ended = new Promise<void>(resolve => { closed = resolve; });
    const server = createServer((request, response) => {
      request.socket.once("close", closed);
      if (stage === "body") { response.writeHead(200, { "content-type": "image/png" }); response.write(png); }
      received();
    });
    server.listen(0, "127.0.0.1"); await once(server, "listening");
    const address = server.address(); if (!address || typeof address === "string") throw new Error("LOCAL_FIXTURE_INVALID");
    // Only the transport seam goes to loopback; production URL/DNS/SSRF/pinning are unchanged.
    mocks.lookup.mockResolvedValue(publicAddress);
    mocks.request.mockImplementation((url: URL, options: RequestOptions, callback: (response: IncomingMessage) => void) => {
      expect(url.hostname).toBe("image.example"); expect(options.servername).toBe("image.example");
      expect(options.timeout).toBe(8000); expect(typeof options.lookup).toBe("function");
      options.lookup?.("image.example", { all: false }, (error, ip, family) => { expect(error).toBeNull(); expect(ip).toBe("8.8.8.8"); expect(family).toBe(4); });
      return nativeHttpRequest(`http://127.0.0.1:${address.port}/`, { signal: options.signal }, callback);
    });
    const controller = new AbortController();
    try {
      const pending = fetchSafeRssImage("https://image.example/logo.png", 0, { signal: controller.signal }); const rejection = pending.catch(error => error);
      await started; await delay(20); controller.abort(new Error("PRIVATE_REASON"));
      const error = await rejection; expect(error).toMatchObject({ code: "rss_media_aborted" }); expect(String(error)).not.toMatch(/PRIVATE_/);
      await Promise.race([ended, delay(1000).then(() => { throw new Error("LOCAL_SOCKET_NOT_CLOSED"); })]);
      expect(mocks.request).toHaveBeenCalledTimes(1);
    } finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
  });

  it("forwards the same abort signal on a redirect and refuses HTTP after redirected DNS cancellation", async () => {
    const controller = new AbortController(); let lookups = 0;
    mocks.lookup.mockImplementation(async () => { if (++lookups === 2) controller.abort(new Error("PRIVATE_REASON")); return publicAddress; });
    mocks.request.mockImplementation((_url, options, callback) => {
      expect(options.signal).toBe(controller.signal);
      const request = new EventEmitter() as EventEmitter & { end: () => void; destroy: () => void };
      request.destroy = () => {}; request.end = () => {
        const response = new EventEmitter() as EventEmitter & { headers: object; statusCode: number; destroy: () => void };
        response.headers = { location: "https://other.example/next.png" }; response.statusCode = 302; response.destroy = () => {};
        callback(response); response.emit("end");
      }; return request;
    });
    await expect(fetchSafeRssImage("https://image.example/logo.png", 0, { signal: controller.signal })).rejects.toMatchObject({ code: "rss_media_aborted" });
    expect(mocks.lookup).toHaveBeenCalledTimes(2); expect(mocks.request).toHaveBeenCalledTimes(1);
  });

  it("preserves signature validation and declared size limits", async () => {
    mocks.lookup.mockResolvedValue(publicAddress);
    for (const tooLarge of [true, false]) {
      let destroyed = false;
      mocks.request.mockImplementation((_url, _options, callback) => {
        const request = new EventEmitter() as EventEmitter & { end: () => void; destroy: () => void };
        request.destroy = () => { destroyed = true; }; request.end = () => {
          const response = new EventEmitter() as EventEmitter & { headers: object; statusCode: number; destroy: () => void };
          response.headers = { "content-type": "image/png", ...(tooLarge ? { "content-length": "8000001" } : {}) }; response.statusCode = 200; response.destroy = () => {};
          callback(response); if (!tooLarge) { response.emit("data", Buffer.from("PRIVATE_INVALID")); response.emit("end"); }
        }; return request;
      });
      await expect(fetchSafeRssImage("https://image.example/logo.png")).rejects.toMatchObject({ code: tooLarge ? "rss_media_too_large" : "rss_media_invalid_content" });
      if (tooLarge) expect(destroyed).toBe(true);
    }
  });

  it("masks synchronous native transport errors and malformed redirect locations", async () => {
    mocks.lookup.mockResolvedValue(publicAddress);
    mocks.request.mockImplementation(() => { throw new Error("PRIVATE_NATIVE_ERROR"); });
    const nativeError = await fetchSafeRssImage("https://image.example/logo.png").catch(error => error);
    expect(nativeError).toMatchObject({ code: "rss_media_unavailable" }); expect(String(nativeError)).not.toMatch(/PRIVATE_/);
    mocks.request.mockImplementation((_url, _options, callback) => {
      const request = new EventEmitter() as EventEmitter & { end: () => void; destroy: () => void };
      request.destroy = () => {}; request.end = () => {
        const response = new EventEmitter() as EventEmitter & { headers: object; statusCode: number; destroy: () => void };
        response.headers = { location: "https://[PRIVATE_INVALID/" }; response.statusCode = 302; response.destroy = () => {};
        callback(response); response.emit("end");
      }; return request;
    });
    const redirectError = await fetchSafeRssImage("https://image.example/logo.png").catch(error => error);
    expect(redirectError).toMatchObject({ code: "rss_media_blocked" }); expect(String(redirectError)).not.toMatch(/PRIVATE_/);
  });
});
