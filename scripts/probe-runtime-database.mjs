import { spawn } from "node:child_process";
import { Buffer } from "node:buffer";
import { constants } from "node:fs";
import { open } from "node:fs/promises";
import { join } from "node:path";
import { performance } from "node:perf_hooks";
import process from "node:process";
import { clearTimeout, setTimeout } from "node:timers";
import { fileURLToPath, pathToFileURL, URL, URLSearchParams } from "node:url";
import { getDatabaseCliConfig } from "./database-cli-config.mjs";

const MAX_BODY = 65_536;
const ENDPOINT_QUERY_KEYS = new Set(["host", "hostaddr", "port", "user", "dbname", "database", "service", "servicefile", "reference"]);
const ENDPOINT_ENV_KEYS = ["PGHOST", "PGHOSTADDR", "PGPORT", "PGUSER", "PGDATABASE", "PGSERVICE", "PGSERVICEFILE"];
const PG_CODES = new Set(["08001", "08006", "28P01", "28000", "42501", "57014", "53300", "57P01", "57P02", "57P03", "3D000", "42P01"]);
// CLI 2.109.1 interpolates SqlError.toString(), which retains the reviewed
// reason message but erases its driver cause. Exact matches identify that
// client stage only; they cannot establish a network, TLS or server cause.
const CLI_CONNECT_FAILURES = new Map([
  ["failed to connect to postgres: SqlError: PgClient: Failed to connect", "SQL_CLIENT_CONNECT_FAILED"],
  ["failed to connect to postgres: SqlError: PgClient: Connection timed out", "SQL_CLIENT_DEADLINE"],
  ["failed to connect to postgres: SqlError: Failed to acquire connection", "SQL_POOL_ACQUIRE_FAILED"]
]);
class ProbeFault extends Error { constructor(code) { super(code); this.code = code; } }
const elapsed = (start) => Math.max(0, Math.round(performance.now() - start));
const unsafeCharacters = (value) => [...value].some((character) => character.charCodeAt(0) <= 32 || character.charCodeAt(0) === 127);
const exactKeys = (value, keys) => value && typeof value === "object" && !Array.isArray(value)
  && Object.keys(value).sort().join(",") === keys.sort().join(",");

/** Preserve every URI byte except the explicit acquisition-budget value. */
export function diagnosticDatabaseConfig(databaseUrl, pgConnectTimeout, expectedProjectRef, environment = {}) {
  if (typeof databaseUrl !== "string" || databaseUrl.length > 16_384 || unsafeCharacters(databaseUrl) || databaseUrl.includes("#")) throw new ProbeFault("SECRET_CONFIG_INVALID");
  let parsed;
  try { parsed = new URL(databaseUrl); } catch { throw new ProbeFault("SECRET_CONFIG_INVALID"); }
  if (!["postgres:", "postgresql:"].includes(parsed.protocol) || !/^[a-z0-9]{20}$/.test(expectedProjectRef ?? "")
    || ENDPOINT_ENV_KEYS.some((key) => environment[key])
    || [...parsed.searchParams.keys()].some((key) => ENDPOINT_QUERY_KEYS.has(key.toLowerCase()))) throw new ProbeFault("SECRET_CONFIG_INVALID");
  let user, database;
  try { user = decodeURIComponent(parsed.username); database = decodeURIComponent(parsed.pathname.slice(1)); }
  catch { throw new ProbeFault("SECRET_CONFIG_INVALID"); }
  const port = parsed.port || "5432";
  const direct = parsed.hostname === `db.${expectedProjectRef}.supabase.co` && port === "5432" && user.length > 0;
  const pooler = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.pooler\.supabase\.com$/.test(parsed.hostname)
    && ["5432", "6543"].includes(port) && user === `postgres.${expectedProjectRef}`;
  if ((!direct && !pooler) || database !== "postgres") throw new ProbeFault("SECRET_CONFIG_INVALID");
  // Supavisor's options can route by project reference. Keep other options
  // byte-identical, but never accept a different or ambiguous reference.
  const routingOptions = parsed.searchParams.has("options") ? parsed.searchParams.getAll("options") : environment.PGOPTIONS ? [environment.PGOPTIONS] : [];
  for (const options of routingOptions) {
    for (const option of options.split(",")) {
      if (/reference\s*=/i.test(option) && option !== `reference=${expectedProjectRef}`) throw new ProbeFault("SECRET_CONFIG_INVALID");
    }
  }
  let normal;
  try { normal = getDatabaseCliConfig(databaseUrl, pgConnectTimeout); } catch { throw new ProbeFault("SECRET_CONFIG_INVALID"); }
  let prepared = normal.databaseUrl;
  if (normal.connectTimeoutSeconds !== 45) {
    const index = prepared.indexOf("?");
    prepared = prepared.slice(0, index + 1) + prepared.slice(index + 1).split("&").map((part) => {
      const query = new URLSearchParams(part);
      if ([...query.keys()][0] !== "connect_timeout") return part;
      return `${part.split("=")[0]}=45`;
    }).join("&");
  }
  return { databaseUrl: prepared, normalBudgetSeconds: normal.connectTimeoutSeconds,
    normalBudgetSource: normal.budgetSource, diagnosticBudgetSeconds: 45, budgetOverridden: normal.connectTimeoutSeconds !== 45 };
}

export function tenantReadSql(tenantId) {
  if (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(tenantId ?? "")) throw new ProbeFault("SCOPE_INVALID");
  return `SELECT 1 AS database_ready, EXISTS (SELECT 1 FROM public.tenants WHERE id = '${tenantId}'::uuid AND status = 'active') AS tenant_active;\n`;
}

export function createSqlAdapter(spawnImpl = spawn, killImpl = process.kill.bind(process)) {
  return ({ databaseUrl, sql, signal }) => new Promise((resolve) => {
    let child, timer, groupStopped = false, done = false, timedOut = false, tooLarge = false;
    let stdoutSize = 0, stderrSize = 0;
    const chunks = [];
    const stopGroup = () => {
      if (!groupStopped && Number.isInteger(child?.pid) && child.pid > 0) {
        groupStopped = true;
        try { killImpl(-child.pid, "SIGKILL"); } catch { /* Owned group already ended; never print OS errors. */ }
      }
    };
    const finish = (ok) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      signal.removeEventListener("abort", aborted);
      stopGroup();
      resolve({ ok: ok && !timedOut && !tooLarge, stdout: Buffer.concat(chunks).toString("utf8"), timedOut, tooLarge });
    };
    const aborted = () => { timedOut = true; stopGroup(); };
    if (signal.aborted) { timedOut = true; finish(false); return; }
    try {
      child = spawnImpl("pnpm", ["exec", "supabase", "db", "query", "--db-url", databaseUrl,
        "--dns-resolver", "native", "--agent", "no", "--output-format", "json"],
      { cwd: fileURLToPath(new URL("..", import.meta.url)), detached: true, stdio: ["pipe", "pipe", "pipe"] });
      child.on("error", () => finish(false));
      child.on("close", (code) => finish(code === 0));
      child.stdout.on("data", (chunk) => {
        stdoutSize += chunk.length;
        if (stdoutSize > MAX_BODY) { tooLarge = true; stopGroup(); }
        else chunks.push(Buffer.from(chunk));
      });
      // stderr is counted and discarded; no raw error is retained or emitted.
      child.stderr.on("data", (chunk) => {
        stderrSize += chunk.length;
        if (stderrSize > MAX_BODY) { tooLarge = true; stopGroup(); }
      });
      for (const stream of [child.stdin, child.stdout, child.stderr]) stream.on("error", () => finish(false));
      timer = setTimeout(() => { timedOut = true; stopGroup(); }, 52_000);
      signal.addEventListener("abort", aborted, { once: true });
      if (signal.aborted) aborted();
      child.stdin.end(sql);
    } catch { finish(false); }
  });
}

async function bounded(operation, milliseconds, code, operationSignal) {
  const controller = new globalThis.AbortController();
  let timer, rejectAbort;
  const abort = () => {
    // The active SQL adapter kills only its own detached group synchronously
    // before cancellation can return to the CLI. Never propagate private reasons.
    controller.abort();
    rejectAbort?.(new ProbeFault("PROBE_CANCELLED"));
  };
  try {
    const cancelled = new Promise((_, reject) => { rejectAbort = reject; });
    operationSignal?.addEventListener("abort", abort, { once: true });
    if (operationSignal?.aborted) abort();
    const deadline = new Promise((_, reject) => {
      timer = setTimeout(() => { controller.abort(); reject(new ProbeFault(code)); }, milliseconds);
    });
    return await Promise.race([cancelled, deadline, Promise.resolve().then(() => {
      if (operationSignal?.aborted) throw new ProbeFault("PROBE_CANCELLED");
      return operation(controller.signal);
    })]);
  } finally {
    clearTimeout(timer);
    operationSignal?.removeEventListener("abort", abort);
  }
}

async function limitedJson(response) {
  if (Number(response.headers.get("content-length")) > MAX_BODY) { await response.body?.cancel(); throw new ProbeFault("OUTPUT_TOO_LARGE"); }
  if (!response.body) throw new ProbeFault("OUTPUT_INVALID");
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY) throw new ProbeFault("OUTPUT_TOO_LARGE");
      chunks.push(Buffer.from(value));
    }
    try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { throw new ProbeFault("OUTPUT_INVALID"); }
  } catch (error) { await reader.cancel().catch(() => {}); throw error; }
  finally { reader.releaseLock(); }
}

function reviewedDatabaseCode(value) {
  return typeof value === "string" && PG_CODES.has(value) ? value : undefined;
}
function sqlResult(result) {
  if (result.tooLarge || Buffer.byteLength(result.stdout ?? "") > MAX_BODY) return { status: "failed", code: "SQL_OUTPUT_TOO_LARGE" };
  if (result.timedOut) return { status: "failed", code: "SQL_TIMEOUT" };
  let data;
  try { data = JSON.parse(result.stdout); } catch { return { status: "failed", code: "SQL_OUTPUT_INVALID" }; }
  // SQLSTATEs come only from explicitly named fields. The exact reviewed CLI
  // messages below produce fixed stage categories, never any message text.
  // Never scan causes, arbitrary nested objects or stderr for SQLSTATEs.
  if (data?.error?.code === "LegacyDbConnectError" || data?.error?.code === "LegacyDbQueryExecError") {
    const databaseCode = reviewedDatabaseCode(data.error.databaseCode) ?? reviewedDatabaseCode(data.error.sqlState);
    return { status: "failed", code: data.error.code === "LegacyDbConnectError" ? "SQL_CONNECT_FAILED" : "SQL_QUERY_FAILED",
      ...(data.error.code === "LegacyDbConnectError" ? { cliFailureCategory: CLI_CONNECT_FAILURES.get(data.error.message) ?? "UNKNOWN" } : {}),
      ...(databaseCode ? { databaseCode } : {}) };
  }
  if (!result.ok) return { status: "failed", code: "SQL_EXEC_FAILED" };
  if (!Array.isArray(data) || data.length !== 1 || !exactKeys(data[0], ["database_ready", "tenant_active"])
    || data[0].database_ready !== 1 || data[0].tenant_active !== true) return { status: "failed", code: "SQL_SCOPE_UNPROVEN" };
  return { status: "passed", code: "SQL_READY", databaseReady: true, tenantActive: true };
}

/** Injected adapters support synthetic tests; they do not prove a live CLI. */
export async function probeRuntimeDatabase({ environment = process.env, targetEnvironment, expectedRuntimeSha, tenantId }, {
  fetchImpl = globalThis.fetch, executeSql = createSqlAdapter(), now = () => new Date(),
  healthDeadlineMs = 5_000, gatewayDeadlineMs = 5_000, sqlDeadlineMs = 52_000, restDeadlineMs = 10_000, operationSignal
} = {}) {
  const started = performance.now();
  let scope;
  const report = (code, details = {}, exitCode = 1) => ({ exitCode, report: {
    schemaVersion: 1, event: "runtime_database_probe", mode: "read_only_fixed_tenant_checks",
    observedAt: now().toISOString(), verdict: code === "DATABASE_READY" ? "DATABASE_READY" : "UNPROVEN", code,
    ...(scope ? { scope } : {}), elapsedMs: elapsed(started), ...details
  } });
  try {
    if (environment.GITHUB_REF !== "refs/heads/main" || !["staging", "production"].includes(targetEnvironment)
      || !/^[0-9a-f]{40}$/.test(expectedRuntimeSha ?? "") || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(tenantId ?? "")
      || !/^[a-z0-9]{20}$/.test(environment.SUPABASE_PROJECT_REF ?? "")
      || environment.NEXT_PUBLIC_SUPABASE_URL !== `https://${environment.SUPABASE_PROJECT_REF}.supabase.co/` && environment.NEXT_PUBLIC_SUPABASE_URL !== `https://${environment.SUPABASE_PROJECT_REF}.supabase.co`
      || (operationSignal !== undefined && !(operationSignal instanceof globalThis.AbortSignal))
      || ![[healthDeadlineMs, 5_000], [gatewayDeadlineMs, 5_000], [sqlDeadlineMs, 52_000], [restDeadlineMs, 10_000]].every(([value, max]) => Number.isInteger(value) && value > 0 && value <= max)) {
      return report("SCOPE_INVALID", {}, 2);
    }
    scope = { environment: targetEnvironment, runtimeSha: expectedRuntimeSha, tenantId };
    if (operationSignal?.aborted) return report("PROBE_CANCELLED");
    const prefix = targetEnvironment === "staging" ? "staging-" : "";
    const health = [];
    for (const [service, path] of [["control", "/api/health"], ["player", "/healthz"]]) {
      const begin = performance.now();
      try {
        await bounded(async (signal) => {
          const response = await fetchImpl(`https://${prefix}${service}.veyocast.nl${path}`, { redirect: "error", signal });
          if (!response.ok) throw new ProbeFault("PUBLIC_HEALTH_READ_FAILED");
          const body = await limitedJson(response);
          if (!exactKeys(body, ["environment", "revision", "service", "status"]) || body.environment !== targetEnvironment
            || body.revision !== expectedRuntimeSha || body.service !== service || body.status !== "ok") throw new ProbeFault("PUBLIC_HEALTH_SCOPE_MISMATCH");
        }, healthDeadlineMs, "PUBLIC_HEALTH_TIMEOUT", operationSignal);
        if (operationSignal?.aborted) return report("PROBE_CANCELLED", { health });
        health.push({ service, status: "passed", elapsedMs: elapsed(begin) });
      } catch (error) {
        if (operationSignal?.aborted) return report("PROBE_CANCELLED", { health });
        const code = error instanceof ProbeFault && ["PUBLIC_HEALTH_READ_FAILED", "PUBLIC_HEALTH_SCOPE_MISMATCH", "PUBLIC_HEALTH_TIMEOUT"].includes(error.code) ? error.code : "PUBLIC_HEALTH_READ_FAILED";
        health.push({ service, status: "failed", code, elapsedMs: elapsed(begin) });
        return report(code, { health });
      }
    }
    if (operationSignal?.aborted) return report("PROBE_CANCELLED", { health });
    // No credential property is accessed until both public release checks pass.
    let config, serviceKey;
    try {
      config = diagnosticDatabaseConfig(environment.SUPABASE_DB_URL, environment.PGCONNECT_TIMEOUT, environment.SUPABASE_PROJECT_REF, environment);
      serviceKey = environment.SUPABASE_SERVICE_ROLE_KEY;
      if (typeof serviceKey !== "string" || !serviceKey || serviceKey.length > 16_384 || unsafeCharacters(serviceKey)) throw new ProbeFault("SECRET_CONFIG_INVALID");
    } catch { return report(operationSignal?.aborted ? "PROBE_CANCELLED" : "SECRET_CONFIG_INVALID", { health }, operationSignal?.aborted ? 1 : 2); }
    const budget = { normalSeconds: config.normalBudgetSeconds, normalSource: config.normalBudgetSource,
      diagnosticSeconds: 45, overridden: config.budgetOverridden, processDeadlineMs: 52_000 };
    if (operationSignal?.aborted) return report("PROBE_CANCELLED", { health, budget });
    // A gateway response (including HTTP 401) proves neither authentication
    // nor a database read. Never send credentials, read its body, or let a
    // failed gateway check prevent the independent SQL and REST attempts.
    const gatewayStart = performance.now();
    let gatewayHttpStatus = null, gateway;
    try {
      await bounded(async (signal) => {
        const response = await fetchImpl(`https://${environment.SUPABASE_PROJECT_REF}.supabase.co/rest/v1/`, {
          method: "GET", redirect: "error", signal
        });
        gatewayHttpStatus = Number.isInteger(response.status) && response.status >= 100 && response.status <= 599 ? response.status : null;
        await response.body?.cancel().catch(() => {});
        if (gatewayHttpStatus === null) throw new ProbeFault("REST_GATEWAY_READ_FAILED");
      }, gatewayDeadlineMs, "REST_GATEWAY_TIMEOUT", operationSignal);
      gateway = { status: "responded" };
    } catch (error) {
      gateway = { status: "failed", code: operationSignal?.aborted ? "PROBE_CANCELLED" : error instanceof ProbeFault && error.code === "REST_GATEWAY_TIMEOUT"
        ? "REST_GATEWAY_TIMEOUT" : "REST_GATEWAY_READ_FAILED" };
    }
    gateway.httpStatus = gatewayHttpStatus;
    gateway.elapsedMs = elapsed(gatewayStart);
    if (operationSignal?.aborted) return report("PROBE_CANCELLED", { health, budget, gateway });
    const sqlStart = performance.now();
    let sql;
    try { sql = sqlResult(await bounded((signal) => executeSql({ databaseUrl: config.databaseUrl, sql: tenantReadSql(tenantId), signal }), sqlDeadlineMs, "SQL_TIMEOUT", operationSignal)); }
    catch (error) { sql = { status: "failed", code: operationSignal?.aborted ? "PROBE_CANCELLED" : error instanceof ProbeFault && error.code === "SQL_TIMEOUT" ? "SQL_TIMEOUT" : "SQL_EXEC_FAILED" }; }
    if (operationSignal?.aborted) sql = { status: "failed", code: "PROBE_CANCELLED" };
    sql.elapsedMs = elapsed(sqlStart);
    if (operationSignal?.aborted) return report("PROBE_CANCELLED", { health, budget, gateway, sql });
    // Exactly one separate REST attempt is still useful when SQL fails.
    const restStart = performance.now();
    let httpStatus = null, rest;
    try {
      await bounded(async (signal) => {
        const response = await fetchImpl(`https://${environment.SUPABASE_PROJECT_REF}.supabase.co/rest/v1/tenants?select=id,status&id=eq.${tenantId}&limit=1`, {
          method: "GET", redirect: "error", signal, headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` }
        });
        httpStatus = Number.isInteger(response.status) && response.status >= 100 && response.status <= 599 ? response.status : null;
        const data = await limitedJson(response);
        if (!response.ok) {
          const databaseCode = reviewedDatabaseCode(data?.code);
          throw Object.assign(new ProbeFault("REST_READ_FAILED"), databaseCode ? { databaseCode } : {});
        }
        if (!Array.isArray(data) || data.length !== 1 || !exactKeys(data[0], ["id", "status"])
          || data[0].id !== tenantId || data[0].status !== "active") throw new ProbeFault("REST_SCOPE_UNPROVEN");
      }, restDeadlineMs, "REST_TIMEOUT", operationSignal);
      rest = { status: "passed", code: "REST_READY", tenantActive: true };
    } catch (error) {
      const code = operationSignal?.aborted ? "PROBE_CANCELLED" : error instanceof ProbeFault && ["REST_TIMEOUT", "REST_READ_FAILED", "REST_SCOPE_UNPROVEN"].includes(error.code) ? error.code
        : error instanceof ProbeFault && error.code === "OUTPUT_TOO_LARGE" ? "REST_OUTPUT_TOO_LARGE" : "REST_READ_FAILED";
      rest = { status: "failed", code, ...(error instanceof ProbeFault && reviewedDatabaseCode(error.databaseCode) ? { databaseCode: error.databaseCode } : {}) };
    }
    rest.httpStatus = httpStatus;
    rest.elapsedMs = elapsed(restStart);
    if (operationSignal?.aborted) return report("PROBE_CANCELLED", { health, budget, gateway, sql, rest });
    const ready = sql.status === "passed" && rest.status === "passed";
    return report(ready ? "DATABASE_READY" : "DATABASE_READ_UNPROVEN", { health, budget, gateway, sql, rest }, ready ? 0 : 1);
  } catch { return report(operationSignal?.aborted ? "PROBE_CANCELLED" : "PROBE_FAILED"); }
}

export async function writeProbeArtifact(directory, report) {
  if (!directory) return;
  const file = await open(join(directory, "runtime-database-probe.json"), constants.O_WRONLY | constants.O_CREAT | constants.O_TRUNC | constants.O_NOFOLLOW, 0o600);
  try { await file.chmod(0o600); await file.writeFile(`${JSON.stringify(report)}\n`); } finally { await file.close(); }
}

export async function runtimeProbeCli({ argv = process.argv.slice(2), environment = process.env, stdout = process.stdout, ...dependencies } = {}) {
  let result;
  try {
    result = await probeRuntimeDatabase({ environment, targetEnvironment: argv.length === 3 ? argv[0] : undefined,
      expectedRuntimeSha: argv[1], tenantId: argv[2] }, dependencies);
    try { await writeProbeArtifact(environment.RUNNER_TEMP, result.report); }
    catch { result = { exitCode: 1, report: { ...result.report, verdict: "UNPROVEN", code: "OUTPUT_WRITE_FAILED" } }; }
  } catch { result = { exitCode: 1, report: { schemaVersion: 1, event: "runtime_database_probe", verdict: "UNPROVEN", code: "PROBE_FAILED" } }; }
  try { stdout.write(`${JSON.stringify(result.report)}\n`); } catch { return 1; }
  return result.exitCode;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const controller = new globalThis.AbortController();
  let cancellationExitCode;
  const cancel = (code) => {
    if (cancellationExitCode !== undefined) return;
    cancellationExitCode = code;
    controller.abort();
  };
  process.on("SIGINT", () => cancel(130));
  process.on("SIGTERM", () => cancel(143));
  process.stdout.on("error", () => { controller.abort(); process.exit(1); });
  const exitCode = await runtimeProbeCli({ operationSignal: controller.signal });
  process.stdout.write("", () => process.exit(cancellationExitCode ?? exitCode));
}
