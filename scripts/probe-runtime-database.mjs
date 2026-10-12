import { execFile } from "node:child_process";
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
const PG_CODES = new Set(["08001", "08006", "28P01", "28000", "42501", "57014", "53300", "57P01", "57P02", "57P03", "3D000", "42P01"]);
class ProbeFault extends Error { constructor(code) { super(code); this.code = code; } }
const elapsed = (start) => Math.max(0, Math.round(performance.now() - start));
const unsafeCharacters = (value) => [...value].some((character) => character.charCodeAt(0) <= 32 || character.charCodeAt(0) === 127);
const exactKeys = (value, keys) => value && typeof value === "object" && !Array.isArray(value)
  && Object.keys(value).sort().join(",") === keys.sort().join(",");

/** Preserve every URI byte except the explicit acquisition-budget value. */
export function diagnosticDatabaseConfig(databaseUrl, pgConnectTimeout) {
  if (typeof databaseUrl !== "string" || databaseUrl.length > 16_384 || unsafeCharacters(databaseUrl) || databaseUrl.includes("#")) throw new ProbeFault("SECRET_CONFIG_INVALID");
  let parsed;
  try { parsed = new URL(databaseUrl); } catch { throw new ProbeFault("SECRET_CONFIG_INVALID"); }
  if (!["postgres:", "postgresql:"].includes(parsed.protocol) || !parsed.hostname) throw new ProbeFault("SECRET_CONFIG_INVALID");
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

export function createSqlAdapter(execFileImpl = execFile) {
  return ({ databaseUrl, sql, signal }) => new Promise((resolve) => {
    let child;
    const aborted = () => { child?.kill("SIGKILL"); };
    try {
      child = execFileImpl("pnpm", ["exec", "supabase", "db", "query", "--db-url", databaseUrl,
        "--dns-resolver", "native", "--agent", "no", "--output-format", "json"],
      { cwd: fileURLToPath(new URL("..", import.meta.url)), timeout: 52_000, maxBuffer: MAX_BODY, encoding: "utf8", killSignal: "SIGKILL" },
      (error, stdout) => {
        signal.removeEventListener("abort", aborted);
        resolve({ ok: !error, stdout: typeof stdout === "string" ? stdout : "",
          timedOut: signal.aborted || error?.killed === true,
          tooLarge: error?.code === "ERR_CHILD_PROCESS_STDIO_MAXBUFFER" });
      });
      signal.addEventListener("abort", aborted, { once: true });
      if (signal.aborted) aborted();
      child.stdin.on("error", () => {});
      child.stdin.end(sql);
    } catch { signal.removeEventListener("abort", aborted); child?.kill("SIGKILL"); resolve({ ok: false, stdout: "" }); }
  });
}

async function bounded(operation, milliseconds, code) {
  const controller = new globalThis.AbortController();
  let timer;
  try {
    return await Promise.race([Promise.resolve().then(() => operation(controller.signal)), new Promise((_, reject) => {
      timer = setTimeout(() => { controller.abort(); reject(new ProbeFault(code)); }, milliseconds);
    })]);
  } finally { clearTimeout(timer); }
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
  // Only explicitly named failure fields are reviewed. Never scan messages,
  // causes, arbitrary nested objects or stderr for PostgreSQL-looking strings.
  if (data?.error?.code === "LegacyDbConnectError" || data?.error?.code === "LegacyDbQueryExecError") {
    const databaseCode = reviewedDatabaseCode(data.error.databaseCode) ?? reviewedDatabaseCode(data.error.sqlState);
    return { status: "failed", code: data.error.code === "LegacyDbConnectError" ? "SQL_CONNECT_FAILED" : "SQL_QUERY_FAILED",
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
  healthDeadlineMs = 5_000, sqlDeadlineMs = 52_000, restDeadlineMs = 10_000
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
      || ![[healthDeadlineMs, 5_000], [sqlDeadlineMs, 52_000], [restDeadlineMs, 10_000]].every(([value, max]) => Number.isInteger(value) && value > 0 && value <= max)) {
      return report("SCOPE_INVALID", {}, 2);
    }
    scope = { environment: targetEnvironment, runtimeSha: expectedRuntimeSha, tenantId };
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
        }, healthDeadlineMs, "PUBLIC_HEALTH_TIMEOUT");
        health.push({ service, status: "passed", elapsedMs: elapsed(begin) });
      } catch (error) {
        const code = error instanceof ProbeFault && ["PUBLIC_HEALTH_READ_FAILED", "PUBLIC_HEALTH_SCOPE_MISMATCH", "PUBLIC_HEALTH_TIMEOUT"].includes(error.code) ? error.code : "PUBLIC_HEALTH_READ_FAILED";
        health.push({ service, status: "failed", code, elapsedMs: elapsed(begin) });
        return report(code, { health });
      }
    }
    // No credential property is accessed until both public release checks pass.
    let config, serviceKey;
    try {
      config = diagnosticDatabaseConfig(environment.SUPABASE_DB_URL, environment.PGCONNECT_TIMEOUT);
      serviceKey = environment.SUPABASE_SERVICE_ROLE_KEY;
      if (typeof serviceKey !== "string" || !serviceKey || serviceKey.length > 16_384 || unsafeCharacters(serviceKey)) throw new ProbeFault("SECRET_CONFIG_INVALID");
    } catch { return report("SECRET_CONFIG_INVALID", { health }, 2); }
    const budget = { normalSeconds: config.normalBudgetSeconds, normalSource: config.normalBudgetSource,
      diagnosticSeconds: 45, overridden: config.budgetOverridden, processDeadlineMs: 52_000 };
    const sqlStart = performance.now();
    let sql;
    try { sql = sqlResult(await bounded((signal) => executeSql({ databaseUrl: config.databaseUrl, sql: tenantReadSql(tenantId), signal }), sqlDeadlineMs, "SQL_TIMEOUT")); }
    catch (error) { sql = { status: "failed", code: error instanceof ProbeFault && error.code === "SQL_TIMEOUT" ? "SQL_TIMEOUT" : "SQL_EXEC_FAILED" }; }
    sql.elapsedMs = elapsed(sqlStart);
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
      }, restDeadlineMs, "REST_TIMEOUT");
      rest = { status: "passed", code: "REST_READY", tenantActive: true };
    } catch (error) {
      const code = error instanceof ProbeFault && ["REST_TIMEOUT", "REST_READ_FAILED", "REST_SCOPE_UNPROVEN"].includes(error.code) ? error.code
        : error instanceof ProbeFault && error.code === "OUTPUT_TOO_LARGE" ? "REST_OUTPUT_TOO_LARGE" : "REST_READ_FAILED";
      rest = { status: "failed", code, ...(error instanceof ProbeFault && reviewedDatabaseCode(error.databaseCode) ? { databaseCode: error.databaseCode } : {}) };
    }
    rest.httpStatus = httpStatus;
    rest.elapsedMs = elapsed(restStart);
    const ready = sql.status === "passed" && rest.status === "passed";
    return report(ready ? "DATABASE_READY" : "DATABASE_READ_UNPROVEN", { health, budget, sql, rest }, ready ? 0 : 1);
  } catch { return report("PROBE_FAILED"); }
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
  process.stdout.on("error", () => process.exit(1));
  const exitCode = await runtimeProbeCli();
  process.stdout.write("", () => process.exit(exitCode));
}
