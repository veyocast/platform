import { hostname } from "node:os";

export type MediaWorkerConfig = {
  lockTimeoutSeconds: number;
  maxAttempts: number;
  pollIntervalMs: number;
  serviceRoleKey: string;
  supabaseUrl: string;
  workerId: string;
};

const workerIdPattern = /^[a-zA-Z0-9][a-zA-Z0-9:._-]{0,127}$/;

export function readMediaWorkerConfig(
  environment: NodeJS.ProcessEnv = process.env
): MediaWorkerConfig {
  const supabaseUrl = readUrl(environment.SUPABASE_URL);
  const serviceRoleKey = readServiceRoleKey(environment.SUPABASE_SERVICE_ROLE_KEY);
  const defaultWorkerId = `media-worker:${hostname()}:${process.pid}`;
  const workerId = (environment.MEDIA_WORKER_ID ?? defaultWorkerId).trim();
  if (!workerIdPattern.test(workerId)) {
    throw new WorkerConfigurationError(
      "MEDIA_WORKER_ID moet 1–128 veilige tekens bevatten."
    );
  }

  return {
    lockTimeoutSeconds: readInteger(
      environment.MEDIA_WORKER_LOCK_TIMEOUT_SECONDS,
      900,
      60,
      3_600,
      "MEDIA_WORKER_LOCK_TIMEOUT_SECONDS"
    ),
    maxAttempts: readInteger(
      environment.MEDIA_WORKER_MAX_ATTEMPTS,
      3,
      1,
      10,
      "MEDIA_WORKER_MAX_ATTEMPTS"
    ),
    pollIntervalMs: readInteger(
      environment.MEDIA_WORKER_POLL_INTERVAL_MS,
      2_000,
      250,
      60_000,
      "MEDIA_WORKER_POLL_INTERVAL_MS"
    ),
    serviceRoleKey,
    supabaseUrl,
    workerId
  };
}

export class WorkerConfigurationError extends Error {
  readonly code = "worker_configuration_invalid";

  constructor(message: string) {
    super(message);
    this.name = "WorkerConfigurationError";
  }
}

function readUrl(rawValue: string | undefined) {
  if (!rawValue) {
    throw new WorkerConfigurationError("SUPABASE_URL ontbreekt.");
  }
  try {
    const url = new URL(rawValue);
    if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error();
    return url.toString().replace(/\/$/, "");
  } catch {
    throw new WorkerConfigurationError("SUPABASE_URL is geen geldige HTTP(S)-URL.");
  }
}

function readServiceRoleKey(rawValue: string | undefined) {
  const value = rawValue?.trim();
  if (!value || /^(placeholder|change-me)$/i.test(value)) {
    throw new WorkerConfigurationError("SUPABASE_SERVICE_ROLE_KEY ontbreekt.");
  }
  if (value.startsWith("sb_publishable_")) {
    throw new WorkerConfigurationError("Een publishable key is geen service-role key.");
  }
  if (value.startsWith("sb_secret_")) return value;

  const parts = value.split(".");
  if (parts.length !== 3) {
    throw new WorkerConfigurationError("SUPABASE_SERVICE_ROLE_KEY heeft een onbekend formaat.");
  }
  try {
    const payload = JSON.parse(Buffer.from(parts[1] ?? "", "base64url").toString("utf8")) as {
      role?: unknown;
    };
    if (payload.role !== "service_role") throw new Error();
  } catch {
    throw new WorkerConfigurationError("SUPABASE_SERVICE_ROLE_KEY heeft niet de service_role.");
  }
  return value;
}

function readInteger(
  rawValue: string | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
  name: string
) {
  if (rawValue === undefined) return fallback;
  const value = Number(rawValue);
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new WorkerConfigurationError(
      `${name} moet een geheel getal tussen ${minimum} en ${maximum} zijn.`
    );
  }
  return value;
}
