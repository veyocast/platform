import { localStorageTransportDiagnosticsKey } from "./player-storage";

export const playerConnectivityEventName = "veyocast:connectivity";

export type PlayerConnectivityEvent = CustomEvent<{ online: boolean }>;

export type PlayerTransportDiagnostic = {
  at: string;
  code?: string;
  method: string;
  onlineHint: boolean | null;
  outcome: "abort" | "error" | "exception" | "response" | "timeout";
  path: string;
  playerState?: string;
  stage?: string;
  status: number | null;
  transport: "browser" | "fetch" | "xhr";
};

let lastKnownOriginConnectivity: boolean | null = null;
const maximumTransportDiagnostics = 20;
const legacyPlayerRequestTimeoutMs = 15_000;

export function reportPlayerConnectivity(online: boolean) {
  if (typeof window === "undefined") return;
  lastKnownOriginConnectivity = online;
  window.dispatchEvent(
    new CustomEvent(playerConnectivityEventName, { detail: { online } })
  );
}

export function readPlayerConnectivity() {
  if (lastKnownOriginConnectivity !== null) {
    return lastKnownOriginConnectivity;
  }
  // Embedded webOS browsers can report navigator.onLine=false while the
  // current HTTPS origin remains reachable. Only an actual Player-origin
  // request may mark the Player offline.
  return true;
}

export async function fetchPlayerOrigin(
  input: RequestInfo | URL,
  init?: RequestInit
) {
  if (shouldUseLegacyPlayerTransport(input)) {
    return requestPlayerOriginWithXhr(input, init);
  }

  try {
    const response = await fetch(input, init);
    recordPlayerTransportDiagnostic({
      outcome: "response",
      status: response.status,
      transport: "fetch"
    }, input, init);
    reportPlayerConnectivity(true);
    return response;
  } catch (error) {
    recordPlayerTransportDiagnostic({
      outcome: isAbortError(error) ? "abort" : "error",
      status: null,
      transport: "fetch"
    }, input, init);
    reportPlayerConnectivity(false);
    throw error;
  }
}

export function readLatestPlayerTransportDiagnostic() {
  return readPlayerTransportDiagnostics()[0] ?? null;
}

export function formatPlayerTransportDiagnostic(
  diagnostic: PlayerTransportDiagnostic | null
) {
  if (!diagnostic) return "Nog geen API-aanvraag geregistreerd";
  const time = diagnostic.at.slice(11, 19);
  const result =
    diagnostic.outcome === "response"
      ? `HTTP ${diagnostic.status ?? 0}`
      : diagnostic.outcome.toUpperCase();
  const onlineHint =
    diagnostic.onlineHint === null
      ? "browserhint onbekend"
      : diagnostic.onlineHint
        ? "browserhint online"
        : "browserhint offline";
  return `${time} · ${diagnostic.transport.toUpperCase()} · ${diagnostic.method} ${diagnostic.path} · ${result} · ${onlineHint}`;
}

export function shouldUseLegacyPlayerTransport(
  input: RequestInfo | URL,
  userAgent = typeof navigator === "undefined" ? "" : navigator.userAgent,
  pathname = typeof window === "undefined" ? "" : window.location.pathname
) {
  if (!isSameOriginPlayerApiRequest(input)) return false;
  return (
    pathname === "/lg" ||
    pathname.startsWith("/lg/") ||
    /web0s|webos|netcast|lg browser|\blge\b/i.test(userAgent)
  );
}

function requestPlayerOriginWithXhr(
  input: RequestInfo | URL,
  init?: RequestInit
) {
  return new Promise<Response>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const method = init?.method ?? "GET";
    const url = requestUrl(input);
    let settled = false;

    function finish(
      outcome: PlayerTransportDiagnostic["outcome"],
      error?: Error
    ) {
      if (settled) return;
      settled = true;
      recordPlayerTransportDiagnostic(
        {
          outcome,
          status: outcome === "response" ? xhr.status : null,
          transport: "xhr"
        },
        input,
        init
      );
      if (outcome !== "response") {
        reportPlayerConnectivity(false);
        reject(error ?? new Error(`PLAYER_XHR_${outcome.toUpperCase()}`));
        return;
      }

      const headers = new Headers();
      for (const name of ["cache-control", "content-type", "retry-after"]) {
        const value = xhr.getResponseHeader(name);
        if (value) headers.set(name, value);
      }
      const body =
        xhr.status === 204 || xhr.status === 205 ? null : xhr.responseText;
      const response = new Response(body, {
        headers,
        status: xhr.status,
        statusText: xhr.statusText
      });
      reportPlayerConnectivity(true);
      resolve(response);
    }

    try {
      xhr.open(method, url, true);
      xhr.timeout = legacyPlayerRequestTimeoutMs;
      applyXhrHeaders(xhr, init?.headers);
      xhr.onload = () => {
        if (xhr.status > 0) {
          finish("response");
        } else {
          finish("error", new Error("PLAYER_XHR_STATUS_ZERO"));
        }
      };
      xhr.onerror = () => finish("error");
      xhr.ontimeout = () => finish("timeout");
      xhr.onabort = () => finish("abort");
      const signal = init?.signal;
      if (signal) {
        if (signal.aborted) {
          xhr.abort();
          finish("abort");
          return;
        }
        signal.addEventListener("abort", () => xhr.abort(), { once: true });
      }
      xhr.send((init?.body as XMLHttpRequestBodyInit | null | undefined) ?? null);
    } catch (error) {
      finish(
        "error",
        error instanceof Error ? error : new Error("PLAYER_XHR_SETUP_FAILED")
      );
    }
  });
}

function applyXhrHeaders(xhr: XMLHttpRequest, headers: HeadersInit | undefined) {
  if (!headers) return;
  if (Array.isArray(headers)) {
    for (const [name, value] of headers) xhr.setRequestHeader(name, value);
    return;
  }
  if (typeof Headers === "function" && headers instanceof Headers) {
    headers.forEach((value, name) => xhr.setRequestHeader(name, value));
    return;
  }
  for (const [name, value] of Object.entries(headers)) {
    if (value !== undefined) xhr.setRequestHeader(name, String(value));
  }
}

function isSameOriginPlayerApiRequest(input: RequestInfo | URL) {
  if (typeof window === "undefined") return false;
  try {
    const url = new URL(requestUrl(input), window.location.href);
    return (
      url.origin === window.location.origin &&
      url.pathname.startsWith("/api/player/")
    );
  } catch {
    return false;
  }
}

function requestUrl(input: RequestInfo | URL) {
  if (typeof input === "string") return input;
  const request = input as { href?: string; url?: string };
  return request.href ?? request.url ?? String(input);
}

function recordPlayerTransportDiagnostic(
  result: Pick<PlayerTransportDiagnostic, "outcome" | "status" | "transport">,
  input: RequestInfo | URL,
  init?: RequestInit
) {
  if (typeof window === "undefined") return;
  const diagnostic: PlayerTransportDiagnostic = {
    at: new Date().toISOString(),
    method: (init?.method ?? "GET").toUpperCase(),
    onlineHint:
      typeof navigator === "undefined" ? null : navigator.onLine,
    outcome: result.outcome,
    path: safeRequestPath(input),
    status: result.status,
    transport: result.transport
  };
  try {
    window.localStorage.setItem(
      localStorageTransportDiagnosticsKey,
      JSON.stringify(
        [diagnostic, ...readPlayerTransportDiagnostics()].slice(
          0,
          maximumTransportDiagnostics
        )
      )
    );
  } catch {
    // Diagnostics are best-effort and never block playback or pairing.
  }
}

function readPlayerTransportDiagnostics() {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(localStorageTransportDiagnosticsKey) ?? "[]"
    ) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isPlayerTransportDiagnostic);
  } catch {
    return [];
  }
}

function isPlayerTransportDiagnostic(
  value: unknown
): value is PlayerTransportDiagnostic {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<PlayerTransportDiagnostic>;
  return (
    typeof candidate.at === "string" &&
    typeof candidate.method === "string" &&
    (candidate.onlineHint === null ||
      typeof candidate.onlineHint === "boolean") &&
    (candidate.outcome === "abort" ||
      candidate.outcome === "error" ||
      candidate.outcome === "exception" ||
      candidate.outcome === "response" ||
      candidate.outcome === "timeout") &&
    typeof candidate.path === "string" &&
    (candidate.status === null || typeof candidate.status === "number") &&
    (candidate.transport === "browser" ||
      candidate.transport === "fetch" ||
      candidate.transport === "xhr")
  );
}

function safeRequestPath(input: RequestInfo | URL) {
  try {
    const url = new URL(
      requestUrl(input),
      typeof window === "undefined" ? "https://player.invalid" : window.location.href
    );
    return url.pathname;
  } catch {
    return "onbekend";
  }
}

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === "AbortError";
}
