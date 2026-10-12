import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { recoverSchemaCache, recoveryCli, schemaReloadSql } from "./recover-postgrest-schema-cache.mjs";

const project = "abcdefghijklmnopqrst";
const sha = "a".repeat(40);
const env = () => ({ GITHUB_REF: "refs/heads/main", GITHUB_SHA: "b".repeat(40),
  SUPABASE_PROJECT_REF: project, NEXT_PUBLIC_SUPABASE_URL: `https://${project}.supabase.co`,
  SUPABASE_DB_URL: `postgres://postgres.${project}:PRIVATE_PASSWORD@aws-0-eu-west-1.pooler.supabase.com:5432/postgres`,
  SUPABASE_SERVICE_ROLE_KEY: "PRIVATE_SERVICE_KEY" });
const ready = () => ({ exitCode: 0, report: { code: "DATABASE_READY", sql: { code: "SQL_READY", tenantActive: true }, rest: { code: "REST_READY", tenantActive: true } } });
const failed = () => ({ exitCode: 1, report: { code: "DATABASE_READ_UNPROVEN", sql: { code: "SQL_READY", tenantActive: true }, rest: { code: "REST_READ_FAILED", httpStatus: 503, databaseCode: "PGRST002" } } });
const notification = () => ({ ok: true, stdout: '[{"notification_count":1}]' });
const input = (environment = env()) => ({ environment, operation: "reload", expectedRuntimeSha: sha });
const privateOutput = value => assert.doesNotMatch(JSON.stringify(value), /PRIVATE_|postgres:\/\/|pg_notify|RAW_ERROR/);

test("invalid scope rejects before credential access or any requests without echo", async () => {
  for (const patch of [{ operation: "PRIVATE_INVALID_OPERATION" }, { expectedRuntimeSha: "PRIVATE_SHA" },
    { environment: { ...env(), GITHUB_REF: "refs/pull/1/merge" } }, { environment: { ...env(), GITHUB_SHA: "PRIVATE_SHA" } }]) {
    let calls = 0;
    const value = { ...input(), ...patch };
    Object.defineProperty(value.environment, "SUPABASE_DB_URL", { get() { throw new Error("PRIVATE_ACCESS"); } });
    const result = await recoverSchemaCache(value, { probe: async () => { calls++; }, executeSql: async () => { calls++; } });
    assert.equal(result.exitCode, 2); assert.equal(result.report.code, "RECOVERY_SCOPE_INVALID"); assert.equal(calls, 0); privateOutput(result);
  }
});

test("already-ready and diagnose operations never send notifications", async () => {
  for (const [operation, before, code, exit] of [["reload", ready(), "DATABASE_API_ALREADY_READY", 0],
    ["diagnose", ready(), "DATABASE_API_ALREADY_READY", 0], ["diagnose", failed(), "DATABASE_API_UNPROVEN", 1]]) {
    let notifications = 0;
    const result = await recoverSchemaCache({ ...input(), operation }, { probe: async () => before,
      executeSql: async () => { notifications++; } });
    assert.equal(result.report.code, code); assert.equal(result.exitCode, exit); assert.equal(notifications, 0);
  }
});

test("only confirmed PGRST002 with ready SQL and active tenant permits reload", async () => {
  for (const change of [r => { r.report.rest.databaseCode = "PGRST001"; }, r => { delete r.report.rest.databaseCode; },
    r => { r.report.rest.httpStatus = 504; }, r => { r.report.sql.tenantActive = false; },
    r => { r.report.sql.code = "SQL_TIMEOUT"; }, r => { delete r.report.sql; }]) {
    const before = failed(); change(before); let notifications = 0;
    const result = await recoverSchemaCache(input(), { probe: async () => before, executeSql: async () => { notifications++; } });
    assert.equal(result.exitCode, 1); assert.equal(result.report.code, "SCHEMA_CACHE_FAILURE_UNCONFIRMED"); assert.equal(notifications, 0);
  }
});

test("one tenant-guarded fixed notification precedes independent recovery read", async () => {
  const events = []; let probes = 0;
  const result = await recoverSchemaCache(input(), { probe: async (value) => {
    events.push("probe"); assert.equal(value.tenantId, "7526e17f-c819-431c-a05d-4ef5f16ea1c0");
    assert.equal(value.targetEnvironment, "production"); return ++probes === 1 ? failed() : ready();
  }, executeSql: async request => { events.push("notification"); assert.equal(request.sql, schemaReloadSql());
    assert.equal(request.signal.aborted, false); return notification(); } });
  assert.deepEqual(events, ["probe", "notification", "probe"]); assert.equal(result.exitCode, 0);
  assert.equal(result.report.code, "DATABASE_API_READ_READY"); assert.equal(result.report.action.notificationCount, 1);
  assert.equal(result.report.before.rest.httpStatus, 503); assert.equal(result.report.after.code, "DATABASE_READY"); privateOutput(result);
  assert.match(schemaReloadSql(), /WHERE EXISTS .*?/s); assert.match(schemaReloadSql(), /status='active'/);
  assert.doesNotMatch(schemaReloadSql(), /\b(?:alter|create|delete|update|insert|truncate|drop|grant)\b/i);
});

test("notification delivery without a healthy postcheck remains failed", async () => {
  let probes = 0;
  const result = await recoverSchemaCache(input(), { probe: async () => { probes++; return failed(); }, executeSql: async () => notification() });
  assert.equal(probes, 2); assert.equal(result.exitCode, 1); assert.equal(result.report.code, "SCHEMA_RELOAD_REQUESTED_API_UNPROVEN");
  assert.equal(result.report.action.notificationCount, 1); assert.equal(result.report.after.rest.databaseCode, "PGRST002");
});

test("missing tenant, malformed/large SQL output, failures and timeout cannot trigger a postcheck", async () => {
  for (const output of [{ ok: false, stdout: "PRIVATE_ERROR" }, { ok: true, stdout: '[{"notification_count":0}]' },
    { ok: true, stdout: '[{"notification_count":2}]' }, { ok: true, stdout: '[{"notification_count":1,"extra":"PRIVATE_ERROR"}]' },
    { ok: true, stdout: '[{"notification_count":0,"notification_count":1}]' },
    { ok: true, stdout: "PRIVATE_BAD_JSON" }, { ok: true, stdout: " ".repeat(65_537) },
    { ...notification(), timedOut: true }, { ...notification(), tooLarge: true }]) {
    let probes = 0;
    const result = await recoverSchemaCache(input(), { probe: async () => { probes++; return failed(); }, executeSql: async () => output });
    assert.equal(probes, 1); assert.equal(result.exitCode, 1); assert.equal(result.report.code, "SCHEMA_RELOAD_UNPROVEN"); privateOutput(result);
  }
});

test("preabort makes no requests and abort during notification is owned and fatal", async () => {
  const pre = new globalThis.AbortController(); pre.abort(); let calls = 0;
  const first = await recoverSchemaCache(input(), { operationSignal: pre.signal, probe: async () => { calls++; } });
  assert.equal(first.report.code, "RECOVERY_CANCELLED"); assert.equal(calls, 0);
  const controller = new globalThis.AbortController(); let aborted = false;
  const result = await recoverSchemaCache(input(), { operationSignal: controller.signal, probe: async () => failed(),
    executeSql: async ({ signal }) => new Promise(resolve => { signal.addEventListener("abort", () => { aborted = true; resolve({ ok: false }); }); controller.abort(); }) });
  assert.equal(aborted, true); assert.equal(result.exitCode, 1); assert.equal(result.report.code, "RECOVERY_CANCELLED");
});

test("notification deadline aborts the operation and preserves failure", async () => {
  let probes = 0; let aborted = false;
  const result = await recoverSchemaCache(input(), { notificationDeadlineMs: 5, probe: async () => { probes++; return failed(); },
    executeSql: async ({ signal }) => new Promise(resolve => signal.addEventListener("abort", () => { aborted = true; resolve({ ok: false }); })) });
  assert.equal(aborted, true); assert.equal(probes, 1); assert.equal(result.report.code, "SCHEMA_RELOAD_UNPROVEN"); assert.equal(result.exitCode, 1);
});

test("raw exceptions are sanitized and never interpreted as recovery", async () => {
  for (const failing of ["probe", "notification", "postprobe"]) {
    let probes = 0;
    const result = await recoverSchemaCache(input(), { probe: async () => { probes++;
      if (failing === "probe" || failing === "postprobe" && probes === 2) throw new Error("RAW_ERROR PRIVATE_SECRET"); return failed();
    }, executeSql: async () => { if (failing === "notification") throw new Error("RAW_ERROR PRIVATE_SECRET"); return notification(); } });
    assert.equal(result.report.code, "RECOVERY_FAILED"); assert.equal(result.exitCode, 1); privateOutput(result);
  }
});

test("CLI replaces an old readback with fresh private failure evidence", async () => {
  const directory = await mkdtemp(join(tmpdir(), "s200-recovery-"));
  try {
    const path = join(directory, "data-api-recovery.json"); await writeFile(path, "STALE_PRIVATE_DATA", { mode: 0o644 });
    const report = { schemaVersion: 1, code: "SCHEMA_RELOAD_REQUESTED_API_UNPROVEN" }; let output = "";
    const exit = await recoveryCli({ argv: ["reload", sha], environment: { ...env(), RUNNER_TEMP: directory },
      recover: async () => ({ exitCode: 1, report }), stdout: { write: text => { output += text; } } });
    assert.equal(exit, 1); assert.deepEqual(JSON.parse(await readFile(path, "utf8")), report);
    assert.equal((await stat(path)).mode & 0o777, 0o600); assert.deepEqual(JSON.parse(output), report);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
