import { Buffer } from "node:buffer";
import { spawn } from "node:child_process";
import { performance } from "node:perf_hooks";
import process from "node:process";
import { clearTimeout, setTimeout } from "node:timers";
import { fileURLToPath, URL } from "node:url";

const PHASES = new Set(["tenant_lookup", "schema_presence", "inventory_report", "refresh_command", "cutover_command", "reclamation_evidence"]);
const MAX_STDOUT = 4 * 1024 * 1024;
const MAX_STDERR = 65_536;
const SIGNALS = new Set(["SIGABRT", "SIGALRM", "SIGBUS", "SIGFPE", "SIGHUP", "SIGILL", "SIGINT", "SIGKILL", "SIGPIPE", "SIGQUIT", "SIGSEGV", "SIGTERM", "SIGTRAP", "SIGXCPU", "SIGXFSZ"]);
const DATABASE_CODES = new Set(["08001", "08006", "28P01", "28000", "42501", "57014", "53300", "57P01", "57P02", "57P03", "3D000", "42P01", "40001", "40P01"]);
const CONNECT_FAILURES = new Map([
  ["failed to connect to postgres: SqlError: PgClient: Failed to connect", "SQL_CLIENT_CONNECT_FAILED"],
  ["failed to connect to postgres: SqlError: PgClient: Connection timed out", "SQL_CLIENT_DEADLINE"],
  ["failed to connect to postgres: SqlError: Failed to acquire connection", "SQL_POOL_ACQUIRE_FAILED"]
]);
const FAILURE_CODES = Object.freeze({
  PROCESS_TIMEOUT: "PUBLICATION_DATABASE_PROCESS_TIMEOUT",
  PROCESS_ABORTED: "PUBLICATION_DATABASE_PROCESS_ABORTED",
  STDOUT_LIMIT: "PUBLICATION_DATABASE_STDOUT_LIMIT",
  STDERR_LIMIT: "PUBLICATION_DATABASE_STDERR_LIMIT",
  PROCESS_SPAWN_FAILED: "PUBLICATION_DATABASE_SPAWN_FAILED",
  PROCESS_IO_FAILED: "PUBLICATION_DATABASE_IO_FAILED",
  PROCESS_CLEANUP_FAILED: "PUBLICATION_DATABASE_CLEANUP_FAILED",
  CLI_CONNECT_FAILED: "PUBLICATION_DATABASE_CONNECT_FAILED",
  CLI_QUERY_FAILED: "PUBLICATION_DATABASE_QUERY_FAILED",
  PROCESS_EXIT_FAILED: "PUBLICATION_DATABASE_EXIT_FAILED",
  PROCESS_SIGNALLED: "PUBLICATION_DATABASE_SIGNALLED",
  QUERY_RESPONSE_INVALID: "PUBLICATION_DATABASE_RESPONSE_INVALID",
  PROCESS_RESULT_INVALID: "PUBLICATION_DATABASE_OPERATION_FAILED"
});
const safeCount = (value) => Number.isSafeInteger(value) && value >= 0 ? value : 0;
const safeExitCode = (value) => Number.isInteger(value) && value >= 0 && value <= 255 ? value : null;
const safeSignal = (value) => typeof value === "string" && SIGNALS.has(value) ? value : null;

// These errors own no driver error, cause, SQL, URI or process output. Even an
// uncaught error therefore exposes only the fixed code and safe diagnostic.
class PublicationDatabaseFault extends Error {
  constructor(code, diagnostic) {
    super(code);
    this.code = code;
    if (diagnostic) this.diagnostic = diagnostic;
  }
}

function validBudget(value) {
  return Number.isInteger(value) && value >= 60_000 && value <= 130_000;
}

/** Execute only the existing pinned workspace CLI, preserving URI/TLS bytes. */
export function createPublicationSqlAdapter({ spawnImpl = spawn, killImpl = process.kill.bind(process),
  setTimeoutImpl = setTimeout, clearTimeoutImpl = clearTimeout } = {}) {
  return ({ databaseUrl, sql, timeoutMs, signal }) => new Promise((resolve) => {
    let child, timer, done = false, groupStopped = false;
    let timedOut = false, aborted = false, spawnFailed = false, ioFailed = false, cleanupFailed = false;
    let stdoutBytes = 0, stderrBytes = 0, outputLimit = null, exitCode = null, exitSignal = null;
    const chunks = [];
    const stopGroup = () => {
      if (groupStopped || !Number.isInteger(child?.pid) || child.pid <= 0) return;
      groupStopped = true;
      try { killImpl(-child.pid, "SIGKILL"); }
      catch (error) {
        // ESRCH means the owned group has already ended. No OS text is kept.
        if (error?.code !== "ESRCH") cleanupFailed = true;
      }
    };
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeoutImpl(timer);
      signal?.removeEventListener("abort", cancel);
      stopGroup();
      resolve({ ok: exitCode === 0 && !timedOut && !aborted && !outputLimit && !spawnFailed && !ioFailed && !cleanupFailed,
        stdout: Buffer.concat(chunks).toString("utf8"), stdoutBytes, stderrBytes,
        timedOut, aborted, outputLimit, spawnFailed, ioFailed, cleanupFailed, exitCode, exitSignal });
    };
    const cancel = () => { aborted = true; finish(); };
    if (!validBudget(timeoutMs) || typeof databaseUrl !== "string" || typeof sql !== "string" || process.platform !== "linux") {
      spawnFailed = true; finish(); return;
    }
    if (signal?.aborted) { cancel(); return; }
    try {
      child = spawnImpl("pnpm", ["exec", "supabase", "db", "query", "--db-url", databaseUrl,
        "--agent", "no", "--output-format", "json"],
      { cwd: fileURLToPath(new URL("..", import.meta.url)), detached: true, stdio: ["pipe", "pipe", "pipe"] });
      child.on("error", () => { spawnFailed = true; finish(); });
      child.on("close", (code, signalName) => { exitCode = safeExitCode(code); exitSignal = safeSignal(signalName); finish(); });
      child.stdout.on("data", (chunk) => {
        if (done) return;
        stdoutBytes = Math.min(Number.MAX_SAFE_INTEGER, stdoutBytes + chunk.length);
        if (stdoutBytes > MAX_STDOUT) { outputLimit = "stdout"; finish(); }
        else chunks.push(Buffer.from(chunk));
      });
      // stderr is counted and discarded, never buffered or parsed.
      child.stderr.on("data", (chunk) => {
        if (done) return;
        stderrBytes = Math.min(Number.MAX_SAFE_INTEGER, stderrBytes + chunk.length);
        if (stderrBytes > MAX_STDERR) { outputLimit = "stderr"; finish(); }
      });
      for (const stream of [child.stdin, child.stdout, child.stderr]) stream.on("error", () => { ioFailed = true; finish(); });
      timer = setTimeoutImpl(() => { timedOut = true; finish(); }, timeoutMs);
      signal?.addEventListener("abort", cancel, { once: true });
      if (signal?.aborted) { cancel(); return; }
      child.stdin.end(sql);
    } catch { spawnFailed = true; finish(); }
  });
}

function classify(result) {
  if (!result || typeof result !== "object" || typeof result.stdout !== "string") return { failureCategory: "PROCESS_RESULT_INVALID" };
  if (result.timedOut === true) return { failureCategory: "PROCESS_TIMEOUT" };
  if (result.aborted === true) return { failureCategory: "PROCESS_ABORTED" };
  if (result.outputLimit === "stdout" || Buffer.byteLength(result.stdout) > MAX_STDOUT) return { failureCategory: "STDOUT_LIMIT" };
  if (result.outputLimit === "stderr") return { failureCategory: "STDERR_LIMIT" };
  if (result.spawnFailed === true) return { failureCategory: "PROCESS_SPAWN_FAILED" };
  if (result.ioFailed === true) return { failureCategory: "PROCESS_IO_FAILED" };
  if (result.cleanupFailed === true) return { failureCategory: "PROCESS_CLEANUP_FAILED" };
  let data;
  try { data = JSON.parse(result.stdout); } catch { /* Exit status still takes precedence over malformed output. */ }
  const error = data?.error;
  if (error?.code === "LegacyDbConnectError" || error?.code === "LegacyDbQueryExecError") {
    const databaseCode = DATABASE_CODES.has(error.databaseCode) ? error.databaseCode : DATABASE_CODES.has(error.sqlState) ? error.sqlState : undefined;
    return { failureCategory: error.code === "LegacyDbConnectError" ? "CLI_CONNECT_FAILED" : "CLI_QUERY_FAILED",
      ...(error.code === "LegacyDbConnectError" ? { cliFailureCategory: CONNECT_FAILURES.get(error.message) ?? "UNKNOWN" } : {}),
      ...(databaseCode ? { databaseCode } : {}) };
  }
  if (result.ok !== true || safeExitCode(result.exitCode) !== 0) return { failureCategory: safeSignal(result.exitSignal) ? "PROCESS_SIGNALLED" : "PROCESS_EXIT_FAILED" };
  if (!Array.isArray(data)) return { failureCategory: "QUERY_RESPONSE_INVALID" };
  return { rows: data };
}

/** Only the reviewed phase/failure vocabulary can reach an operation log. */
export async function executePublicationQuery({ phase, databaseUrl, sql, timeoutMs, signal }, {
  executeSql = createPublicationSqlAdapter(), onDiagnostic = () => {}, now = () => performance.now()
} = {}) {
  if (!PHASES.has(phase) || !validBudget(timeoutMs) || typeof databaseUrl !== "string" || typeof sql !== "string") {
    throw new PublicationDatabaseFault("PUBLICATION_DATABASE_QUERY_CONFIG_INVALID");
  }
  const started = now();
  let result;
  try { result = await executeSql({ databaseUrl, sql, timeoutMs, signal }); }
  catch { result = { stdout: "", spawnFailed: true }; }
  const outcome = classify(result);
  const { failureCategory, cliFailureCategory, databaseCode } = outcome;
  const diagnostic = {
    event: "publication_database_query", phase, status: failureCategory ? "failed" : "passed",
    code: failureCategory ? FAILURE_CODES[failureCategory] : "PUBLICATION_DATABASE_QUERY_SUCCEEDED",
    failureCategory: failureCategory ?? null, elapsedMs: safeCount(Math.round(now() - started)), timeoutMs,
    stdoutBytes: safeCount(result?.stdoutBytes), stderrBytes: safeCount(result?.stderrBytes),
    exitCode: safeExitCode(result?.exitCode), exitSignal: safeSignal(result?.exitSignal),
    cleanupFailed: result?.cleanupFailed === true,
    ...(cliFailureCategory ? { cliFailureCategory } : {}), ...(databaseCode ? { databaseCode } : {})
  };
  onDiagnostic(diagnostic);
  if (failureCategory) throw new PublicationDatabaseFault(diagnostic.code, diagnostic);
  return outcome.rows;
}
