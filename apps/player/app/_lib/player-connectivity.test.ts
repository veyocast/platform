import { beforeEach, describe, expect, it, vi } from "vitest";

type FakeXhrOutcome =
  | { body: string; headers?: Record<string, string>; status: number }
  | { error: true };

class FakeXmlHttpRequest {
  static outcome: FakeXhrOutcome = {
    body: JSON.stringify({ ok: true }),
    status: 200
  };
  static requests: FakeXmlHttpRequest[] = [];

  method = "";
  onabort: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onload: (() => void) | null = null;
  ontimeout: (() => void) | null = null;
  requestBody: unknown = null;
  requestHeaders: Record<string, string> = {};
  responseText = "";
  status = 0;
  statusText = "";
  timeout = 0;
  url = "";

  constructor() {
    FakeXmlHttpRequest.requests.push(this);
  }

  abort() {
    this.onabort?.();
  }

  getResponseHeader(name: string) {
    const outcome = FakeXmlHttpRequest.outcome;
    if ("error" in outcome) return null;
    return outcome.headers?.[name.toLowerCase()] ?? null;
  }

  open(method: string, url: string) {
    this.method = method;
    this.url = url;
  }

  send(body: unknown) {
    this.requestBody = body;
    queueMicrotask(() => {
      const outcome = FakeXmlHttpRequest.outcome;
      if ("error" in outcome) {
        this.onerror?.();
        return;
      }
      this.status = outcome.status;
      this.statusText = outcome.status >= 400 ? "Error" : "OK";
      this.responseText = outcome.body;
      this.onload?.();
    });
  }

  setRequestHeader(name: string, value: string) {
    this.requestHeaders[name] = value;
  }
}

function createLocalStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    removeItem: (key: string) => values.delete(key),
    setItem: (key: string, value: string) => values.set(key, value)
  };
}

function installBrowser(pathname: string, online: boolean, userAgent: string) {
  const localStorage = createLocalStorage();
  vi.stubGlobal("navigator", { onLine: online, userAgent });
  vi.stubGlobal("window", {
    dispatchEvent: vi.fn(),
    localStorage,
    location: {
      href: `https://player.veyocast.nl${pathname}`,
      origin: "https://player.veyocast.nl",
      pathname
    }
  });
  vi.stubGlobal("XMLHttpRequest", FakeXmlHttpRequest);
  return localStorage;
}

describe("player connectivity", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
    FakeXmlHttpRequest.requests = [];
    FakeXmlHttpRequest.outcome = {
      body: JSON.stringify({ ok: true }),
      headers: { "content-type": "application/json" },
      status: 200
    };
  });

  it("uses conservative XHR on /lg even when webOS reports navigator offline", async () => {
    installBrowser("/lg", false, "Mozilla/5.0 (Web0S; Linux/SmartTV)");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const {
      fetchPlayerOrigin,
      readLatestPlayerTransportDiagnostic,
      readPlayerConnectivity
    } = await import("./player-connectivity");

    const response = await fetchPlayerOrigin("/api/player/pairing", {
      headers: {
        "X-VeyoCast-Pairing-Request": "12345678901234567890"
      },
      method: "POST"
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(readPlayerConnectivity()).toBe(true);
    expect(FakeXmlHttpRequest.requests[0]).toMatchObject({
      method: "POST",
      url: "/api/player/pairing"
    });
    expect(readLatestPlayerTransportDiagnostic()).toMatchObject({
      onlineHint: false,
      outcome: "response",
      path: "/api/player/pairing",
      status: 200,
      transport: "xhr"
    });
  });

  it("keeps an HTTP service error distinct from an offline transport error", async () => {
    installBrowser("/lg", true, "Mozilla/5.0 (Web0S; Linux/SmartTV)");
    FakeXmlHttpRequest.outcome = {
      body: JSON.stringify({
        error: { code: "PAIRING_API_UNAVAILABLE" }
      }),
      status: 503
    };
    const { fetchPlayerOrigin, readPlayerConnectivity } = await import(
      "./player-connectivity"
    );

    const response = await fetchPlayerOrigin("/api/player/pairing", {
      method: "POST"
    });

    expect(response.status).toBe(503);
    expect(readPlayerConnectivity()).toBe(true);
  });

  it("marks the origin unreachable only after the XHR transport itself fails", async () => {
    installBrowser("/lg", true, "Mozilla/5.0 (Web0S; Linux/SmartTV)");
    FakeXmlHttpRequest.outcome = { error: true };
    const {
      fetchPlayerOrigin,
      readLatestPlayerTransportDiagnostic,
      readPlayerConnectivity
    } = await import("./player-connectivity");

    await expect(
      fetchPlayerOrigin("/api/player/installation", { method: "POST" })
    ).rejects.toThrow("PLAYER_XHR_ERROR");

    expect(readPlayerConnectivity()).toBe(false);
    expect(readLatestPlayerTransportDiagnostic()).toMatchObject({
      outcome: "error",
      path: "/api/player/installation",
      status: null,
      transport: "xhr"
    });
  });
});
