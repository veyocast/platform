import process from "node:process";
import { resolve } from "node:path";
import { fileURLToPath, URLSearchParams } from "node:url";

const invalidCode = "DATABASE_CONNECTION_CONFIG_INVALID";

function positiveTimeout(value) {
  if (typeof value !== "string" || !/^[0-9]+$/.test(value)) throw new Error(invalidCode);
  const seconds = Number(value);
  if (!Number.isSafeInteger(seconds) || seconds < 1 || seconds > 120) throw new Error(invalidCode);
  return seconds;
}

// Parse only the query needed for the budget. Rebuilding the URI can change
// encoded credentials, host lists, certificate paths and other libpq options.
export function getDatabaseCliConfig(databaseUrl, pgConnectTimeout) {
  if (typeof databaseUrl !== "string" || !/^postgres(?:ql)?:\/\/\S+$/.test(databaseUrl)) {
    throw new Error(invalidCode);
  }
  const fragmentAt = databaseUrl.indexOf("#");
  const uri = fragmentAt < 0 ? databaseUrl : databaseUrl.slice(0, fragmentAt);
  const fragment = fragmentAt < 0 ? "" : databaseUrl.slice(fragmentAt);
  const queryAt = uri.indexOf("?");
  const values = new URLSearchParams(queryAt < 0 ? "" : uri.slice(queryAt + 1)).getAll("connect_timeout");
  if (values.length > 1) throw new Error(invalidCode);
  if (values.length === 1) {
    return { databaseUrl, connectTimeoutSeconds: positiveTimeout(values[0]), budgetSource: "uri" };
  }
  const connectTimeoutSeconds = pgConnectTimeout === undefined ? 45 : positiveTimeout(pgConnectTimeout);
  const budgetSource = pgConnectTimeout === undefined ? "default" : "environment";
  const separator = queryAt < 0 ? "?" : uri.endsWith("?") || uri.endsWith("&") ? "" : "&";
  return {
    databaseUrl: `${uri}${separator}connect_timeout=${connectTimeoutSeconds}${fragment}`,
    connectTimeoutSeconds,
    budgetSource
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.length !== 3 || !["--url", "--summary"].includes(process.argv[2])) throw new Error(invalidCode);
    const config = getDatabaseCliConfig(process.env.SUPABASE_DB_URL, process.env.PGCONNECT_TIMEOUT);
    if (process.argv[2] === "--url") process.stdout.write(`${config.databaseUrl}\n`);
    else process.stdout.write(`${JSON.stringify({
      event: "database_connection_budget", seconds: config.connectTimeoutSeconds, source: config.budgetSource
    })}\n`);
  } catch {
    // Never emit a URL, parser cause, environment value or stack trace.
    process.stderr.write(`${invalidCode}\n`);
    process.exitCode = 1;
  }
}
