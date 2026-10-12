import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { mkdtemp, readFile, rm, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ReadableStream } from "node:stream/web";
import { test } from "node:test";
import { createSqlAdapter, diagnosticDatabaseConfig, probeRuntimeDatabase, runtimeProbeCli, tenantReadSql, writeProbeArtifact } from "./probe-runtime-database.mjs";

// Synthetic adapters verify contracts/privacy, not production CLI reachability.
const sha = "a".repeat(40), tenant = "11111111-1111-1111-1111-111111111111", project = "abcdefghijklmnopqrst";
const secret = "PRIVATE_SERVICE_KEY_DO_NOT_EMIT", uri = "postgresql://private-user:p%2B%24%40%26%2F@db.private.invalid:5432/postgres?sslmode=verify-full&sslrootcert=%2Fprivate%2Fca.pem&options=-c%20statement_timeout%3D60000";
const env = () => ({ GITHUB_REF: "refs/heads/main", SUPABASE_PROJECT_REF: project, NEXT_PUBLIC_SUPABASE_URL: `https://${project}.supabase.co/`, SUPABASE_DB_URL: uri, SUPABASE_SERVICE_ROLE_KEY: secret });
const input = (environment = env()) => ({ environment, targetEnvironment: "production", expectedRuntimeSha: sha, tenantId: tenant });
const sqlPass = async () => ({ ok: true, stdout: '[{"database_ready":1,"tenant_active":true}]' });
function fixtureFetch(rest = [{ id: tenant, status: "active" }], status = 200, capture = []) {
  return async (url, options) => {
    capture.push({ url, options });
    if (url.includes(".supabase.co/")) return globalThis.Response.json(rest, { status });
    const service = url.includes("//control.") || url.includes("//staging-control.") ? "control" : "player";
    return globalThis.Response.json({ service, status: "ok", environment: url.includes("staging-") ? "staging" : "production", revision: sha });
  };
}
function privateOutput(value) {
  const serialized = JSON.stringify(value);
  for (const forbidden of [secret, "private-user", "p%2B%24", "db.private.invalid", project, "ca.pem", "RAW_PRIVATE_ERROR"]) assert.equal(serialized.includes(forbidden), false);
}

test("synthetic scoped SQL and REST both pass; only fixed scope/results emitted", async () => {
  const capture = []; let request;
  const result = await probeRuntimeDatabase(input(), { fetchImpl: fixtureFetch(undefined, 200, capture), executeSql: async (arg) => { request = arg; return sqlPass(); } });
  assert.equal(result.exitCode, 0); assert.equal(result.report.verdict, "DATABASE_READY");
  assert.equal(request.sql, tenantReadSql(tenant)); assert.equal(request.databaseUrl, uri + "&connect_timeout=45");
  assert.equal(capture.length, 3); assert.equal(capture[0].options.headers, undefined); assert.equal(capture[1].options.headers, undefined);
  assert.equal(capture[2].url, `https://${project}.supabase.co/rest/v1/tenants?select=id,status&id=eq.${tenant}&limit=1`);
  assert.deepEqual(capture[2].options.headers, { apikey: secret, Authorization: `Bearer ${secret}` });
  assert.equal(capture[2].options.redirect, "error"); privateOutput(result);
});

test("diagnostic overrides only connect_timeout bytes; preserves TLS/credentials/options/query order", () => {
  const original = uri + "&&connect%5Ftimeout=0009&sslcert=%2Fa%2Bb.pem&sslkey=%2Fa%2Fb.key&";
  const result = diagnosticDatabaseConfig(original, "120");
  assert.equal(result.databaseUrl, uri + "&&connect%5Ftimeout=45&sslcert=%2Fa%2Bb.pem&sslkey=%2Fa%2Fb.key&");
  assert.equal(result.normalBudgetSeconds, 9); assert.equal(result.normalBudgetSource, "uri"); assert.equal(result.budgetOverridden, true);
  assert.equal(diagnosticDatabaseConfig(uri, "7").databaseUrl, uri + "&connect_timeout=45");
  assert.equal(diagnosticDatabaseConfig(uri + "&connect_timeout=045", "broken").databaseUrl, uri + "&connect_timeout=045");
  assert.equal(diagnosticDatabaseConfig(uri + "&connect_timeout=045").budgetOverridden, false);
});

test("invalid duplicate/zero timeout, fragment and control characters fail closed without echo", () => {
  for (const value of [uri + "&connect_timeout=0", uri + "&connect_timeout=9&connect_timeout=10", uri + "#private", uri + "\n", "https://private.invalid/db"]) assert.throws(() => diagnosticDatabaseConfig(value), /SECRET_CONFIG_INVALID/);
  assert.throws(() => tenantReadSql("' OR true; --"), /SCOPE_INVALID/);
});

test("non-main ref and invalid public URL scope make no requests and read no secrets", async () => {
  for (const invalid of [{ GITHUB_REF: "refs/pull/1/merge" }, { NEXT_PUBLIC_SUPABASE_URL: `https://${project}.supabase.co:443/` }, { NEXT_PUBLIC_SUPABASE_URL: `https://${project}.supabase.co/?x=1` }, { SUPABASE_PROJECT_REF: "wrong" }]) {
    const environment = { ...env(), ...invalid }; let calls = 0;
    Object.defineProperty(environment, "SUPABASE_DB_URL", { get() { throw new Error("RAW_PRIVATE_ERROR"); } });
    Object.defineProperty(environment, "SUPABASE_SERVICE_ROLE_KEY", { get() { throw new Error("RAW_PRIVATE_ERROR"); } });
    const result = await probeRuntimeDatabase(input(environment), { fetchImpl: async () => { calls++; }, executeSql: async () => { calls++; } });
    assert.equal(result.exitCode, 2); assert.equal(result.report.code, "SCOPE_INVALID"); assert.equal(calls, 0); privateOutput(result);
  }
});

test("wrong Player release rejects before reading DB URL/service key or attempting authenticated checks", async () => {
  const environment = env(); let reads = 0, calls = 0;
  for (const name of ["SUPABASE_DB_URL", "SUPABASE_SERVICE_ROLE_KEY"]) Object.defineProperty(environment, name, { get() { reads++; throw new Error("RAW_PRIVATE_ERROR"); } });
  const result = await probeRuntimeDatabase(input(environment), { fetchImpl: async (url) => globalThis.Response.json({ environment: "production", revision: url.includes("player") ? "b".repeat(40) : sha, service: url.includes("player") ? "player" : "control", status: "ok" }), executeSql: async () => { calls++; } });
  assert.equal(result.report.code, "PUBLIC_HEALTH_SCOPE_MISMATCH"); assert.equal(reads, 0); assert.equal(calls, 0); assert.equal(result.report.health.length, 2); privateOutput(result);
});

test("unresponsive public health is bounded and no secret/authenticated probe is reached", async () => {
  const environment = env(); let reads = 0;
  Object.defineProperty(environment, "SUPABASE_DB_URL", { get() { reads++; return uri; } });
  const result = await probeRuntimeDatabase(input(environment), { fetchImpl: () => new Promise(() => {}), healthDeadlineMs: 10 });
  assert.equal(result.report.code, "PUBLIC_HEALTH_TIMEOUT"); assert.equal(reads, 0);
});

test("SQL connection and query failures still perform exactly one REST read and expose reviewed codes only", async () => {
  for (const [failure, expected] of [["LegacyDbConnectError", "SQL_CONNECT_FAILED"], ["LegacyDbQueryExecError", "SQL_QUERY_FAILED"]]) {
    const capture = [];
    const result = await probeRuntimeDatabase(input(), { fetchImpl: fixtureFetch(undefined, 200, capture), executeSql: async () => ({ ok: false, stdout: JSON.stringify({ error: { code: failure, databaseCode: "57014", message: secret, cause: { code: "28P01", detail: "RAW_PRIVATE_ERROR" } } }) }) });
    assert.equal(result.exitCode, 1); assert.equal(result.report.verdict, "UNPROVEN"); assert.equal(result.report.sql.code, expected); assert.equal(result.report.sql.databaseCode, "57014"); assert.equal(result.report.rest.status, "passed"); assert.equal(capture.length, 3); privateOutput(result);
  }
});

test("unknown nested database codes and raw child failures cannot leak through reports", async () => {
  for (const response of [{ ok: false, stdout: secret }, { ok: false, stdout: JSON.stringify({ error: { code: "LegacyDbQueryExecError", databaseCode: "ABCDE", message: "57014 " + secret, cause: { code: "28P01" } } }) }]) {
    const result = await probeRuntimeDatabase(input(), { fetchImpl: fixtureFetch(), executeSql: async () => response });
    assert.equal(result.exitCode, 1); assert.equal(result.report.sql.databaseCode, undefined); privateOutput(result);
  }
});

test("tenant inactive/extra SQL row/extra fields or string database_ready cannot prove SQL scope", async () => {
  for (const data of [[{ database_ready: 1, tenant_active: false }], [{ database_ready: "1", tenant_active: true }], [{ database_ready: 1, tenant_active: true, payload: secret }], [{ database_ready: 1, tenant_active: true }, { database_ready: 1, tenant_active: true }]]) {
    const result = await probeRuntimeDatabase(input(), { fetchImpl: fixtureFetch(), executeSql: async () => ({ ok: true, stdout: JSON.stringify(data) }) });
    assert.equal(result.report.sql.code, "SQL_SCOPE_UNPROVEN"); assert.equal(result.exitCode, 1); privateOutput(result);
  }
});

test("REST wrong tenant, inactive tenant or HTTP auth failure never returns DATABASE_READY", async () => {
  for (const [data, status, code] of [[[{ id: "22222222-2222-2222-2222-222222222222", status: "active" }], 200, "REST_SCOPE_UNPROVEN"], [[{ id: tenant, status: "inactive" }], 200, "REST_SCOPE_UNPROVEN"], [{ code: "28P01", message: secret }, 401, "REST_READ_FAILED"]]) {
    const result = await probeRuntimeDatabase(input(), { fetchImpl: fixtureFetch(data, status), executeSql: sqlPass });
    assert.equal(result.report.rest.code, code); assert.equal(result.report.rest.httpStatus, status); assert.equal(result.report.sql.status, "passed"); assert.equal(result.exitCode, 1); privateOutput(result);
  }
});

test("oversized child stdout and streamed REST response are independently rejected", async () => {
  let canceled = false;
  const native = fixtureFetch();
  const result = await probeRuntimeDatabase(input(), { executeSql: async () => ({ ok: true, stdout: "x".repeat(65_537) }), fetchImpl: async (url, opts) => url.includes(".supabase.co/") ? new globalThis.Response(new ReadableStream({ start(c) { c.enqueue(new Uint8Array(65_537)); }, cancel() { canceled = true; } })) : native(url, opts) });
  assert.equal(result.report.sql.code, "SQL_OUTPUT_TOO_LARGE"); assert.equal(result.report.rest.code, "REST_OUTPUT_TOO_LARGE"); assert.equal(canceled, true); assert.equal(result.exitCode, 1);
});

test("SQL adapter deadline aborts unresolved operation and still isolates REST once", async () => {
  let aborted = false; const capture = [];
  const result = await probeRuntimeDatabase(input(), { sqlDeadlineMs: 10, fetchImpl: fixtureFetch(undefined, 200, capture), executeSql: ({ signal }) => { signal.addEventListener("abort", () => { aborted = true; }); return new Promise(() => {}); } });
  assert.equal(result.report.sql.code, "SQL_TIMEOUT"); assert.equal(aborted, true); assert.equal(capture.length, 3); assert.equal(result.report.rest.status, "passed");
});

test("REST deadline aborts request after successful SQL and preserves UNPROVEN verdict", async () => {
  let aborted = false; const native = fixtureFetch();
  const result = await probeRuntimeDatabase(input(), { executeSql: sqlPass, restDeadlineMs: 10, fetchImpl: (url, opts) => {
    if (!url.includes(".supabase.co/")) return native(url, opts);
    opts.signal.addEventListener("abort", () => { aborted = true; }); return new Promise(() => {});
  } });
  assert.equal(result.report.rest.code, "REST_TIMEOUT"); assert.equal(aborted, true); assert.equal(result.exitCode, 1);
});

test("native adapter supplies exact pinned CLI flags/stdin, 52s kill bound and 64KiB stdout/stderr cap", async () => {
  let captured, killed, written;
  const controller = new globalThis.AbortController();
  const adapter = createSqlAdapter((file, args, options, callback) => {
    captured = { file, args, options }; const child = new EventEmitter(); child.stdin = new EventEmitter();
    child.stdin.end = (sql) => { written = sql; }; child.kill = (signal) => { killed = signal; callback(Object.assign(new Error(secret), { killed: true }), secret, secret); };
    return child;
  });
  const pending = adapter({ databaseUrl: uri, sql: tenantReadSql(tenant), signal: controller.signal }); controller.abort(); const result = await pending;
  assert.equal(captured.file, "pnpm"); assert.deepEqual(captured.args, ["exec", "supabase", "db", "query", "--db-url", uri, "--dns-resolver", "native", "--agent", "no", "--output-format", "json"]);
  assert.equal(captured.options.timeout, 52_000); assert.equal(captured.options.maxBuffer, 65_536); assert.equal(captured.options.killSignal, "SIGKILL"); assert.equal(written, tenantReadSql(tenant)); assert.equal(killed, "SIGKILL"); assert.equal(result.timedOut, true);
});

test("artifact is chmod600 including preexisting broad permissions and refuses symlink", async () => {
  const directory = await mkdtemp(join(tmpdir(), "veyocast-runtime-probe-test-"));
  try {
    const path = join(directory, "runtime-database-probe.json"); await writeFile(path, "old", { mode: 0o644 });
    await writeProbeArtifact(directory, { code: "DATABASE_READY" }); assert.equal((await stat(path)).mode & 0o777, 0o600); assert.deepEqual(JSON.parse(await readFile(path)), { code: "DATABASE_READY" });
    await rm(path); await symlink(join(directory, "target"), path); await assert.rejects(writeProbeArtifact(directory, { code: "DATABASE_READY" }));
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("CLI writes one safe JSON, returns invalid-scope2 and handles artifact failures without raw error", async () => {
  const lines = []; const invalid = await runtimeProbeCli({ argv: [], environment: env(), stdout: { write: (line) => lines.push(line) } });
  assert.equal(invalid, 2); assert.equal(lines.length, 1); privateOutput(JSON.parse(lines[0]));
  const failedOutput = []; const result = await runtimeProbeCli({ argv: ["production", sha, tenant], environment: { ...env(), RUNNER_TEMP: "/missing/RAW_PRIVATE_ERROR" }, stdout: { write: (line) => failedOutput.push(line) }, fetchImpl: fixtureFetch(), executeSql: sqlPass });
  assert.equal(result, 1); assert.equal(failedOutput.length, 1); const report = JSON.parse(failedOutput[0]); assert.equal(report.code, "OUTPUT_WRITE_FAILED"); assert.equal(report.verdict, "UNPROVEN"); privateOutput(report);
});
