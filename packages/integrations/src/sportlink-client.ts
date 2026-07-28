import {
  isSportlinkArticleKey, parseSportlinkArguments, type SportlinkArticleKey
} from "./sportlink-registry";

export const SPORTLINK_BASE_URL = "https://data.sportlink.com";
const transient = new Set([429, 500, 502, 503, 504]);
const maxBytes = 2_000_000;

export class SportlinkClientError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly retryable: boolean,
    readonly status: number | null = null
  ) {
    super(message);
    this.name = "SportlinkClientError";
  }
}

export class SportlinkClient {
  constructor(
    private readonly clientId: string,
    private readonly options: {
      fetchImpl?: typeof fetch; maxAttempts?: number; timeoutMs?: number;
    } = {}
  ) {
    if (!clientId.trim() || clientId.length > 512) {
      throw new SportlinkClientError("SPORTLINK_CLIENT_ID_INVALID",
        "De Sportlink Client ID ontbreekt of is ongeldig.", false);
    }
  }

  async fetchArticle(key: SportlinkArticleKey, rawArguments: unknown = {}) {
    if (!isSportlinkArticleKey(key)) {
      throw new SportlinkClientError("SPORTLINK_ARTICLE_NOT_ALLOWED",
        "Dit Sportlink-artikel is niet toegestaan.", false);
    }
    let args: Record<string, unknown>;
    try {
      args = parseSportlinkArguments(key, rawArguments);
    } catch {
      throw new SportlinkClientError("SPORTLINK_ARGUMENT_INVALID",
        "De Sportlink-filters zijn ongeldig.", false);
    }
    const correlationId = crypto.randomUUID();
    const started = Date.now();
    const attempts = Math.min(3, Math.max(1, this.options.maxAttempts ?? 3));
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        const payload = await this.request(key, args, correlationId);
        return { articleKey: key, correlationId, durationMs: Date.now() - started,
          payload, recordCount: extractSportlinkRecords(payload).length };
      } catch (error) {
        const failure = error instanceof SportlinkClientError ? error
          : new SportlinkClientError("SPORTLINK_NETWORK_ERROR",
            "Sportlink is tijdelijk niet bereikbaar.", true);
        if (!failure.retryable || attempt === attempts) throw failure;
        await new Promise((resolve) =>
          setTimeout(resolve, 200 * 2 ** (attempt - 1) + Math.floor(Math.random() * 101)));
      }
    }
    throw new SportlinkClientError("SPORTLINK_NETWORK_ERROR",
      "Sportlink is tijdelijk niet bereikbaar.", true);
  }

  async testConnection() {
    const started = Date.now();
    const [club, logo, teams] = await Promise.all([
      this.fetchArticle("clubgegevens"), this.fetchClubLogo(),
      this.fetchArticle("teams")
    ]);
    return { club, logo, teams, responseTimeMs: Date.now() - started };
  }

  async fetchClubLogo() {
    return this.requestBinary("clublogo", "image/png", 1_000_000);
  }

  private async request(key: SportlinkArticleKey, args: Record<string, unknown>, id: string) {
    const response = await this.doFetch(key, args, id);
    if (!(response.headers.get("content-type") ?? "").toLowerCase().includes("json")) {
      throw new SportlinkClientError("SPORTLINK_CONTENT_TYPE_INVALID",
        "Sportlink gaf geen JSON terug.", transient.has(response.status), response.status);
    }
    const bytes = await this.readLimitedBody(response, maxBytes);
    let payload: unknown;
    try { payload = JSON.parse(new TextDecoder().decode(bytes)); }
    catch { throw new SportlinkClientError("SPORTLINK_RESPONSE_INVALID",
      "Sportlink gaf ongeldige JSON terug.", transient.has(response.status), response.status); }
    const providerCode = readErrorCode(payload);
    if (!response.ok || providerCode) throw mapError(providerCode, response.status);
    return payload;
  }

  private async requestBinary(key: "clublogo", expected: string, maximum: number) {
    const response = await this.doFetch(key, {}, crypto.randomUUID());
    const type = response.headers.get("content-type")?.toLowerCase() ?? "";
    const bytes = await this.readLimitedBody(response, maximum);
    if (!response.ok) throw mapError(null, response.status);
    if (!type.includes(expected) || bytes.byteLength > maximum ||
      bytes.length < 8 || bytes[0] !== 0x89 || bytes[1] !== 0x50 ||
      bytes[2] !== 0x4e || bytes[3] !== 0x47) {
      throw new SportlinkClientError("SPORTLINK_LOGO_INVALID",
        "Het clublogo is geen veilige PNG.", false, response.status);
    }
    return { bytes, contentType: "image/png" as const };
  }

  private async doFetch(key: string, args: Record<string, unknown>, id: string) {
    const url = new URL(`${SPORTLINK_BASE_URL}/${key}`);
    url.searchParams.set("client_id", this.clientId);
    for (const [name, value] of Object.entries(args)) {
      if (value !== undefined && value !== null && value !== "") url.searchParams.set(name, String(value));
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(),
      Math.min(30_000, Math.max(1_000, this.options.timeoutMs ?? 8_000)));
    try {
      const response = await (this.options.fetchImpl ?? fetch)(url, {
        headers: { accept: "*/*", "x-request-id": id },
        redirect: "error", signal: controller.signal
      });
      const length = Number(response.headers.get("content-length"));
      if (Number.isFinite(length) && length > maxBytes) throw tooLarge(response.status);
      return response;
    } catch (error) {
      if (error instanceof SportlinkClientError) throw error;
      throw new SportlinkClientError(controller.signal.aborted
        ? "SPORTLINK_TIMEOUT" : "SPORTLINK_NETWORK_ERROR",
      controller.signal.aborted ? "Sportlink reageerde niet op tijd."
        : "Sportlink is tijdelijk niet bereikbaar.", true);
    } finally { clearTimeout(timer); }
  }

  private async readLimitedBody(response: Response, maximum: number) {
    const declaredLength = Number(response.headers.get("content-length"));
    if (Number.isFinite(declaredLength) && declaredLength > maximum) {
      throw tooLarge(response.status);
    }
    if (!response.body) {
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.byteLength > maximum) throw tooLarge(response.status);
      return bytes;
    }

    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let byteLength = 0;
    try {
      while (true) {
        const result = await readBodyChunk(
          reader,
          Math.min(30_000, Math.max(1_000, this.options.timeoutMs ?? 8_000))
        );
        if (result.done) break;
        byteLength += result.value.byteLength;
        if (byteLength > maximum) {
          await reader.cancel();
          throw tooLarge(response.status);
        }
        chunks.push(result.value);
      }
    } finally {
      reader.releaseLock();
    }
    const bytes = new Uint8Array(byteLength);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return bytes;
  }
}

export function extractSportlinkRecords(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) return payload.filter(isRecord);
  if (!isRecord(payload)) return [];
  for (const key of ["data", "items", "result", "records"]) {
    if (Array.isArray(payload[key])) return payload[key].filter(isRecord);
  }
  return [payload];
}
export function redactSportlinkText(value: string) {
  return value.replace(/([?&]client_id=)[^&#\s]+/gi, "$1[REDACTED]");
}
function readErrorCode(payload: unknown) {
  if (!isRecord(payload)) return null;
  const error = isRecord(payload.error) ? payload.error : payload;
  const raw = error.code ?? error.errorcode ?? error.foutcode;
  const match = String(raw ?? "").match(/4001|4002|4011|4012|4031|4041|5001/);
  return match?.[0] ?? null;
}
function mapError(code: string | null, status: number) {
  const known: Record<string, [string, string, boolean]> = {
    "4001": ["SPORTLINK_CONDITION_ERROR", "Deze gegevens zijn voor deze selectie niet beschikbaar.", false],
    "4002": ["SPORTLINK_REQUIRED_ARGUMENT_MISSING", "Een verplicht Sportlink-filter ontbreekt.", false],
    "4011": ["SPORTLINK_TOKEN_INVALID", "Het Sportlink-token is ongeldig.", false],
    "4012": ["SPORTLINK_CLIENT_ID_INVALID", "De Sportlink Client ID is ongeldig.", false],
    "4031": ["SPORTLINK_SCOPE_INSUFFICIENT", "De verbinding heeft onvoldoende rechten.", false],
    "4041": ["SPORTLINK_ARTICLE_NOT_FOUND", "Het Sportlink-artikel bestaat niet.", false],
    "5001": ["SPORTLINK_SERVER_ERROR", "Sportlink heeft tijdelijk een serverstoring.", true]
  };
  const value = code ? known[code] : undefined;
  if (value) return new SportlinkClientError(...value, status);
  return new SportlinkClientError(status === 429 ? "SPORTLINK_RATE_LIMITED"
    : transient.has(status) ? "SPORTLINK_SERVER_ERROR" : "SPORTLINK_RESPONSE_INVALID",
  status === 429 ? "Sportlink vraagt tijdelijk om minder aanvragen."
    : transient.has(status) ? "Sportlink is tijdelijk niet beschikbaar."
      : "Sportlink wees de aanvraag af.", transient.has(status), status);
}
function tooLarge(status: number) {
  return new SportlinkClientError("SPORTLINK_RESPONSE_TOO_LARGE",
    "De Sportlink-response is te groot.", false, status);
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function readBodyChunk(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  timeoutMs: number
) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      reader.read(),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => {
          void reader.cancel();
          reject(new SportlinkClientError(
            "SPORTLINK_TIMEOUT",
            "Sportlink reageerde niet op tijd.",
            true
          ));
        }, timeoutMs);
      })
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
