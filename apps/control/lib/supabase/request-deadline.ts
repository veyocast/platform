export const controlLoginBudgetMs = 15_000;
export const controlMiddlewareBudgetMs = 5_000;
export const controlSessionBodyLimitBytes = 1_048_576;

function unavailableError() {
  return new DOMException("CONTROL_REQUEST_UNAVAILABLE", "AbortError");
}

// This envelope is an internal SDK cancellation result, never a provider status.
// auth-js otherwise retries expired-cookie refresh after a transport/5xx error.
function unavailableAuthResponse() {
  return Response.json(
    { error_code: "control_auth_unavailable", code: "control_auth_unavailable", message: "CONTROL_REQUEST_UNAVAILABLE" },
    { status: 499 }
  );
}

export function createRequestDeadline(
  budgetMs = controlLoginBudgetMs,
  options: { signal?: AbortSignal; fetchImpl?: typeof fetch } = {}
) {
  const controller = new AbortController();
  const fetchImpl = options.fetchImpl ?? fetch;
  let disposed = false;
  const stop = () => controller.abort(unavailableError());
  const parentAbort = () => stop();
  options.signal?.addEventListener("abort", parentAbort, { once: true });
  if (options.signal?.aborted) stop();
  const timer = setTimeout(stop, budgetMs);

  function assertActive() {
    if (disposed || controller.signal.aborted) throw unavailableError();
  }

  async function readBody(response: Response, signal: AbortSignal) {
    if (!response.body) return new Uint8Array(0);
    const reader = response.body.getReader();
    const cancel = () => { void reader.cancel().catch(() => undefined); };
    signal.addEventListener("abort", cancel, { once: true });
    if (signal.aborted) cancel();
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (signal.aborted) throw unavailableError();
        if (done) break;
        size += value.byteLength;
        if (size > controlSessionBodyLimitBytes) {
          stop();
          cancel();
          throw unavailableError();
        }
        chunks.push(value);
      }
      const bytes = new Uint8Array(size);
      let offset = 0;
      chunks.forEach((chunk) => { bytes.set(chunk, offset); offset += chunk.byteLength; });
      return bytes;
    } finally {
      signal.removeEventListener("abort", cancel);
      reader.releaseLock();
    }
  }

  return {
    signal: controller.signal,
    assertActive,
    async run<T>(operation: () => Promise<T>): Promise<T> {
      assertActive();
      let rejectOnAbort: (() => void) | undefined;
      const aborted = new Promise<never>((_, reject) => {
        rejectOnAbort = () => reject(unavailableError());
        controller.signal.addEventListener("abort", rejectOnAbort, { once: true });
      });
      try {
        const result = await Promise.race([operation(), aborted]);
        assertActive();
        return result;
      } finally {
        if (rejectOnAbort) controller.signal.removeEventListener("abort", rejectOnAbort);
      }
    },
    async fetch(input: RequestInfo | URL, init?: RequestInit, authBaseUrl?: string) {
      const requestUrl = input instanceof Request ? input.url : String(input);
      const isAuth = Boolean(authBaseUrl && requestUrl.startsWith(`${authBaseUrl}/`));
      if (disposed || controller.signal.aborted) {
        if (isAuth) return unavailableAuthResponse();
        throw unavailableError();
      }
      const linked = new AbortController();
      const signals = [...new Set([
        controller.signal,
        input instanceof Request ? input.signal : undefined,
        init?.signal
      ].filter((signal): signal is AbortSignal => Boolean(signal)))];
      const abort = () => linked.abort(unavailableError());
      signals.forEach((signal) => {
        signal.addEventListener("abort", abort, { once: true });
        if (signal.aborted) abort();
      });
      try {
        if (linked.signal.aborted) throw unavailableError();
        const response = await fetchImpl(input, { ...init, signal: linked.signal });
        // Finish real body IO before returning headers to the SDK. Keeping only
        // a timeout around fetch() would leave held json() bodies unbounded.
        if (isAuth && response.status >= 500) {
          stop();
          void response.body?.cancel().catch(() => undefined);
          return unavailableAuthResponse();
        }
        const bytes = await readBody(response, linked.signal);
        if (linked.signal.aborted) throw unavailableError();
        if (isAuth) {
          // A malformed Auth body is retryable in auth-js too.
          if (response.status !== 204) JSON.parse(new TextDecoder().decode(bytes));
        }
        const buffered = new Response(response.status === 204 || response.status === 205 || response.status === 304 ? null : bytes, {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers
        });
        Object.defineProperties(buffered, {
          url: { value: response.url },
          redirected: { value: response.redirected },
          type: { value: response.type }
        });
        return buffered;
      } catch {
        if (isAuth) {
          stop();
          return unavailableAuthResponse();
        }
        // AbortError prevents PostgREST's automatic network retry. It also
        // prevents caller-controlled abort reasons from entering SDK logs.
        stop();
        throw unavailableError();
      } finally {
        signals.forEach((signal) => signal.removeEventListener("abort", abort));
      }
    },
    dispose() {
      disposed = true;
      clearTimeout(timer);
      options.signal?.removeEventListener("abort", parentAbort);
      stop();
    }
  };
}

export type RequestDeadline = ReturnType<typeof createRequestDeadline>;
