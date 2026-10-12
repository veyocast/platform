import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { pathToFileURL } from "node:url";

import { dataApiResourcesCli, dataApiResourcesSql, probeDataApiResources, sanitizeDataApiResources } from "./probe-data-api-resources.mjs";

const tenant = "7526e17f-c819-431c-a05d-4ef5f16ea1c0", sha = "a".repeat(40), project = "abcdefghijklmnopqrst";
const roles = ["anon", "authenticated", "authenticator", "postgres", "service_role"];
const tables = ["player_heartbeats", "sportlink_birthdays", "sportlink_team_members", "sports_activities", "sports_clubs", "sports_matches", "sports_public_people", "sports_standings", "sports_teams"];
const modes = ["AccessShareLock", "RowShareLock", "RowExclusiveLock", "ShareUpdateExclusiveLock", "ShareLock", "ShareRowExclusiveLock", "ExclusiveLock", "AccessExclusiveLock"];
const env = () => ({ GITHUB_REF: "refs/heads/main", GITHUB_SHA: "b".repeat(40), SUPABASE_PROJECT_REF: project,
  NEXT_PUBLIC_SUPABASE_URL: `https://${project}.supabase.co`, SUPABASE_SERVICE_ROLE_KEY: "PRIVATE_KEY",
  SUPABASE_DB_URL: `postgres://postgres.${project}:PRIVATE_PASSWORD@aws-0-eu-west-1.pooler.supabase.com:5432/postgres` });
const input = () => ({ expectedRuntimeSha: sha, environment: env() });
const baseline = () => ({ exitCode: 1, report: { code: "DATABASE_READ_UNPROVEN", observedAt: "2026-10-12T20:00:00.000Z",
  scope: { environment: "production", runtimeSha: sha, tenantId: tenant }, health: ["control", "player"].map(service => ({ service, status: "passed", elapsedMs: 1 })),
  sql: { code: "SQL_READY", tenantActive: true }, rest: { code: "REST_READ_FAILED", httpStatus: 503, databaseCode: "PGRST002", message: "PRIVATE_ERROR" } } });
function fixture() {
  return { scopeReady: true, observedAt: "2026-10-12T20:01:00.123456+00:00", allStatsVisible: true,
    roles: roles.map(role => ({ role, present: true, visibilityKnown: true, truncated: false,
      sessions: 1, active: 0, idle: 1, idleTransaction: 0, otherState: 0, lockWait: 0, ioWait: 0, clientWait: 1, otherWait: 0, noWait: 0 })),
    heartbeatLocks: { tablePresent: true, sampledLocks: 0, truncated: false, unreviewedModes: 0, modes: modes.map(mode => ({ mode, granted: 0, waiting: 0 })) },
    heartbeatProgress: { tablePresent: true, visibilityKnown: true, truncated: false, rows: [] },
    tables: tables.map(relation => ({ relation, present: true, statsKnown: true, estimatedRows: 10, liveRowsEstimate: 10, deadRowsEstimate: 2 })),
    heartbeatIndex: { namePresent: true, onExpectedTable: true, valid: true, ready: true, btree: true, nonUnique: true, columnsExact: true, predicateExact: true, defaultOptionsExact: true },
    heartbeatMigration: { versionPresent: true } };
}
const response = (value = fixture()) => ({ ok: true, stdout: JSON.stringify([{ report: value }]) });
const privateOutput = value => assert.doesNotMatch(JSON.stringify(value), /PRIVATE_|postgres:\/\/|RAW_ERROR|pg_stat_activity|pg_get_expr/);
const dependencies = extra => ({ probe: async () => baseline(), executeSql: async () => response(), ...extra });

test("scope rejects before credential/SQL/probe access and preserves fixed output", async () => {
  for (const patch of [{ expectedRuntimeSha: "PRIVATE_SHA" }, { environment: { ...env(), GITHUB_REF: "refs/pull/1/merge" } },
    { environment: { ...env(), GITHUB_SHA: "PRIVATE_SHA" } }]) {
    const value = { ...input(), ...patch }; let calls = 0;
    Object.defineProperty(value.environment, "SUPABASE_DB_URL", { get() { throw new Error("PRIVATE_ACCESS"); } });
    const result = await probeDataApiResources(value, { probe: async () => { calls++; }, executeSql: async () => { calls++; } });
    assert.equal(result.exitCode, 2); assert.equal(result.report.code, "RESOURCE_SCOPE_INVALID"); assert.equal(calls, 0); privateOutput(result);
  }
});

test("wrong baseline tenant/runtime/environment/health/SQL never starts snapshot", async () => {
  for (const mutate of [r => { r.report.scope.tenantId = "11111111-1111-1111-1111-111111111111"; }, r => { r.report.scope.runtimeSha = "c".repeat(40); },
    r => { r.report.scope.environment = "staging"; }, r => { r.report.sql.tenantActive = false; }, r => { r.report.sql.code = "SQL_TIMEOUT"; },
    r => { r.report.health[1].status = "failed"; }, r => { r.report.health.pop(); }]) {
    const before = baseline(); mutate(before); let calls = 0;
    const result = await probeDataApiResources(input(), dependencies({ probe: async () => before, executeSql: async () => { calls++; } }));
    assert.equal(result.report.code, "RESOURCE_BASELINE_UNPROVEN"); assert.equal(result.exitCode, 1); assert.equal(calls, 0); privateOutput(result);
  }
});

test("only one bounded snapshot follows exact production scope even when REST fails", async () => {
  let probes = 0, snapshots = 0;
  const result = await probeDataApiResources(input(), dependencies({ probe: async (value, options) => {
    assert.equal(value.tenantId, tenant); assert.equal(value.targetEnvironment, "production"); assert.equal(value.expectedRuntimeSha, sha);
    assert.equal(typeof options.executeSql, "function"); probes++; return baseline();
  }, executeSql: async request => { snapshots++; assert.equal(request.sql, dataApiResourcesSql()); assert.equal(request.signal.aborted, false);
    assert.match(request.databaseUrl, /connect_timeout=45/); return response(); } }));
  assert.equal(probes, 1); assert.equal(snapshots, 1); assert.equal(result.exitCode, 0); assert.equal(result.report.code, "RESOURCE_CONTEXT_OBSERVED");
  assert.equal(result.report.verdict, "UNPROVEN"); assert.equal(result.report.baseline.rest.httpStatus, 503);
  assert.equal(result.report.metadata.heartbeatIndex.exactDefinition, true); privateOutput(result);
  assert.ok(result.report.limitations.includes("baseline_public_health_precedes_metadata_and_does_not_prove_runtime_unchanged"));
});

test("project mismatch remains closed after baseline without metadata request", async () => {
  const value = input(); value.environment.SUPABASE_DB_URL = value.environment.SUPABASE_DB_URL.replace(project, "uvwxyzabcdefghijklmn"); let calls = 0;
  const result = await probeDataApiResources(value, dependencies({ executeSql: async () => { calls++; } }));
  assert.equal(result.report.code, "RESOURCE_CONTEXT_UNPROVEN"); assert.equal(calls, 0); privateOutput(result);
});

test("fixed SQL contains exact scope, history, index and caps and no mutating commands", () => {
  const sql = dataApiResourcesSql(); assert.equal(dataApiResourcesSql("PRIVATE_ARGUMENT"), sql);
  assert.match(sql, new RegExp(`id='${tenant}'::uuid AND status='active'`));
  assert.match(sql, /version='20261012190000'/); assert.match(sql, /relname='player_heartbeats_tenant_active_release_idx'/);
  assert.match(sql, /indnkeyatts=2 AND indnatts=2 AND indexprs IS NULL/); assert.match(sql, /ARRAY\['tenant_id','active_release_id'\]/);
  assert.match(sql, /amname='btree'/); assert.match(sql, /pg_get_expr\(indpred,indrelid,false\) IN/);
  assert.match(sql, /NOT \(indisunique OR indisprimary OR indisexclusion\)/); assert.match(sql, /pid<>pg_backend_pid\(\)/);
  assert.match(sql, /LIMIT 257/); assert.match(sql, /LIMIT 17/); assert.match(sql, /pg_read_all_stats','USAGE'/);
  assert.doesNotMatch(sql, /\b(?:insert|update|delete|truncate|alter|drop|grant|notify|pg_notify|analyze|pg_sleep|pg_cancel_backend|pg_terminate_backend)\b/i);
});

test("absent tenant and malformed/extra/hostile fields fail closed without leaking", async () => {
  for (const mutate of [r => { r.scopeReady = false; }, r => { r.PRIVATE_FIELD = "PRIVATE_ROW"; },
    r => { r.roles[0].query = "PRIVATE_SQL"; }, r => { r.roles[0].role = "PRIVATE_ROLE"; }, r => { r.roles[0].active = "PRIVATE_VALUE"; },
    r => { r.tables[0].estimatedRows = 1e100; }, r => { r.tables[0].liveRowsEstimate = -1; }, r => { r.tables[0].relation = "PRIVATE_TABLE"; },
    r => { r.heartbeatIndex.predicate = "PRIVATE_PREDICATE"; }, r => { r.heartbeatMigration.versionPresent = "PRIVATE_HISTORY"; },
    r => { r.observedAt = "PRIVATE_DATE"; }, r => { r.roles[1] = r.roles[0]; }]) {
    const value = fixture(); mutate(value);
    const result = await probeDataApiResources(input(), dependencies({ executeSql: async () => response(value) }));
    assert.equal(result.report.code, "RESOURCE_CONTEXT_UNPROVEN"); assert.equal(result.exitCode, 1); privateOutput(result);
  }
});

test("invalid, truncated, duplicate-key, multirow and oversized wire output are rejected", async () => {
  const good = response().stdout;
  for (const stdout of ["PRIVATE_BAD_JSON", good.slice(0, -3), JSON.stringify([{ report: fixture() }, { report: fixture() }]),
    JSON.stringify([{ report: fixture(), private: "PRIVATE_FIELD" }]), good.replace('"scopeReady":true', '"scopeReady":false,"scopeReady":true'),
    good.replace('"scopeReady":true', '"scopeReady":false,"scope\\u0052eady":true'), " ".repeat(65_537)]) {
    const result = await probeDataApiResources(input(), dependencies({ executeSql: async () => ({ ok: true, stdout }) }));
    assert.equal(result.report.code, "RESOURCE_CONTEXT_UNPROVEN"); privateOutput(result);
  }
  for (const flag of ["timedOut", "tooLarge"]) {
    const result = await probeDataApiResources(input(), dependencies({ executeSql: async () => ({ ...response(), [flag]: true }) }));
    assert.equal(result.exitCode, 1);
  }
});

test("masked stats/missing roles, tables, estimates and absent index stay explicitly incomplete", () => {
  const value = fixture(); value.allStatsVisible = false; value.heartbeatProgress.visibilityKnown = false;
  for (const row of value.roles) { row.visibilityKnown = false; for (const key of ["sessions", "active", "idle", "idleTransaction", "otherState", "lockWait", "ioWait", "clientWait", "otherWait", "noWait"]) row[key] = null; }
  value.roles[0].present = false;
  Object.assign(value.tables[0], { present: false, statsKnown: false, estimatedRows: null, liveRowsEstimate: null, deadRowsEstimate: null });
  value.heartbeatLocks.tablePresent = false; value.heartbeatProgress.tablePresent = false;
  for (const key of Object.keys(value.heartbeatIndex)) value.heartbeatIndex[key] = key === "namePresent" ? false : null;
  value.heartbeatMigration.versionPresent = false;
  const result = sanitizeDataApiResources(value); assert.equal(result.contextComplete, false); assert.equal(result.roles[0].sessions, null);
  assert.equal(result.heartbeatIndex.exactDefinition, false); assert.equal(result.heartbeatMigration.versionPresent, false);
});

test("cap sentinels preserve sample counts and make completeness false", () => {
  const value = fixture(); Object.assign(value.roles[0], { sessions: 257, idle: 257, clientWait: 257, truncated: true });
  value.heartbeatLocks.sampledLocks = 257; value.heartbeatLocks.truncated = true; value.heartbeatLocks.modes[0].granted = 257;
  value.heartbeatProgress.rows = Array.from({ length: 17 }, () => ({ command: "CREATE INDEX", phase: "building index", lockersTotal: 0, lockersDone: 0, blocksTotal: 1, blocksDone: 0, tuplesTotal: null, tuplesDone: 0 }));
  value.heartbeatProgress.truncated = true;
  const result = sanitizeDataApiResources(value); assert.equal(result.contextComplete, false); assert.equal(result.roles[0].sessions, 257);
  const malformed = fixture(); malformed.roles[0].sessions = 258; assert.throws(() => sanitizeDataApiResources(malformed), /RESOURCE_METADATA_INVALID/);
});

test("index shape booleans do not equate name/history presence with correct valid index", () => {
  for (const key of ["onExpectedTable", "btree", "nonUnique", "columnsExact", "predicateExact", "defaultOptionsExact"]) {
    const value = fixture(); value.heartbeatIndex[key] = false; assert.equal(sanitizeDataApiResources(value).heartbeatIndex.exactDefinition, false);
  }
  const value = fixture(); value.heartbeatIndex.valid = false; value.heartbeatIndex.ready = false;
  const result = sanitizeDataApiResources(value); assert.equal(result.heartbeatIndex.valid, false); assert.equal(result.heartbeatIndex.ready, false);
  assert.equal(result.heartbeatMigration.versionPresent, true); assert.equal(result.heartbeatIndex.exactDefinition, true);
});

test("unreviewed progress phase, unknown counters and lock modes cannot imply complete context", () => {
  const value = fixture(); value.heartbeatProgress.rows = [{ command: "OTHER", phase: "OTHER", lockersTotal: null, lockersDone: 0, blocksTotal: 1, blocksDone: 2, tuplesTotal: 0, tuplesDone: 0 }];
  value.heartbeatLocks.unreviewedModes = 1; value.heartbeatLocks.sampledLocks = 1;
  assert.equal(sanitizeDataApiResources(value).contextComplete, false);
  value.heartbeatProgress.rows[0].phase = "PRIVATE_PHASE"; assert.throws(() => sanitizeDataApiResources(value), /RESOURCE_METADATA_INVALID/);
});

test("preabort, mid-baseline and active metadata abort stay fatal and prevent later requests", async () => {
  const pre = new globalThis.AbortController(); pre.abort("PRIVATE_REASON"); let calls = 0;
  const a = await probeDataApiResources(input(), dependencies({ operationSignal: pre.signal, probe: async () => { calls++; } }));
  assert.equal(a.report.code, "RESOURCE_CANCELLED"); assert.equal(calls, 0);
  const controller = new globalThis.AbortController();
  const b = await probeDataApiResources(input(), dependencies({ operationSignal: controller.signal, probe: async () => { controller.abort("PRIVATE_REASON"); return baseline(); }, executeSql: async () => { calls++; } }));
  assert.equal(b.report.code, "RESOURCE_CANCELLED"); assert.equal(calls, 0);
  const active = new globalThis.AbortController(); let aborted = false;
  const c = await probeDataApiResources(input(), dependencies({ operationSignal: active.signal, executeSql: ({ signal }) => {
    signal.addEventListener("abort", () => { aborted = true; }); active.abort("PRIVATE_REASON"); return new Promise(() => {});
  } }));
  assert.equal(c.report.code, "RESOURCE_CANCELLED"); assert.equal(aborted, true); privateOutput(c);
});

test("metadata deadline is capped and aborts an unresolved adapter without waiting52s", async () => {
  let aborted = false;
  const result = await probeDataApiResources(input(), dependencies({ metadataDeadlineMs: 5, executeSql: ({ signal }) => { signal.addEventListener("abort", () => { aborted = true; }); return new Promise(() => {}); } }));
  assert.equal(result.report.code, "RESOURCE_METADATA_TIMEOUT"); assert.equal(result.exitCode, 1); assert.equal(aborted, true);
  const invalid = await probeDataApiResources(input(), dependencies({ metadataDeadlineMs: 20_001 })); assert.equal(invalid.report.code, "RESOURCE_SCOPE_INVALID");
});

test("exceptions and hostile baseline fields never leave the fixed projection", async () => {
  const before = baseline(); before.report.PRIVATE_FIELD = "PRIVATE_VALUE"; before.report.sql.message = "PRIVATE_SQL";
  const result = await probeDataApiResources(input(), dependencies({ probe: async () => before })); privateOutput(result);
  const failed = await probeDataApiResources(input(), dependencies({ executeSql: async () => { throw new Error("RAW_ERROR PRIVATE_PASSWORD"); } }));
  assert.equal(failed.report.code, "RESOURCE_CONTEXT_UNPROVEN"); privateOutput(failed);
});

test("CLI replaces old0644 artifact with fresh0600 evidence and rejects extra args", async () => {
  const directory = await mkdtemp(join(tmpdir(), "s201-context-"));
  try {
    const path = join(directory, "data-api-resources.json"); await writeFile(path, "PRIVATE_STALE", { mode: 0o644 }); let output = "";
    const result = await probeDataApiResources(input(), dependencies());
    const exit = await dataApiResourcesCli({ argv: [sha], environment: { ...env(), RUNNER_TEMP: directory }, probe: async () => result, stdout: { write: text => { output += text; } } });
    assert.equal(exit, 0); assert.deepEqual(JSON.parse(output), result.report); assert.deepEqual(JSON.parse(await readFile(path, "utf8")), result.report);
    assert.equal((await stat(path)).mode & 0o777, 0o600); privateOutput(output);
    let calls = 0; const rejected = await dataApiResourcesCli({ argv: [sha, "PRIVATE_ARG"], probe: async () => { calls++; } });
    assert.equal(rejected, 2); assert.equal(calls, 0);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

async function alive(pid) {
  try { return !/^\d+ \(.+\) Z /.test(await readFile(`/proc/${pid}/stat`, "utf8")); } catch { return false; }
}
for (const [signal, exitCode] of [["SIGINT", 130], ["SIGTERM", 143]]) {
  test(`real Linux CLI ${signal} cancels only owned native SQL group and descendant`, { skip: process.platform !== "linux", timeout: 10_000 }, async () => {
    const directory = await mkdtemp(join(tmpdir(), "s201-native-")); let child, closed, wrapperPid, descendantPid, stdout = "", stderr = "";
    try {
      const marker = join(directory, "active.json"), script = join(directory, "cli.mjs");
      const moduleUrl = pathToFileURL(join(process.cwd(), "scripts/probe-data-api-resources.mjs")).href;
      const adapterUrl = pathToFileURL(join(process.cwd(), "scripts/probe-runtime-database.mjs")).href;
      await writeFile(script, `import {spawn} from 'node:child_process'; import {dataApiResourcesCli,probeDataApiResources} from ${JSON.stringify(moduleUrl)};
import {createSqlAdapter} from ${JSON.stringify(adapterUrl)};
const adapter=createSqlAdapter((_file,_args,options)=>spawn(process.execPath,['-e',\`const fs=require('node:fs'),{spawn}=require('node:child_process');const descendant=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore'});fs.writeFileSync(process.argv[1],JSON.stringify({wrapper:process.pid,descendant:descendant.pid}));process.stderr.write('RAW_ERROR PRIVATE_PASSWORD');setInterval(()=>{},1000);\`,${JSON.stringify(marker)}],options));
process.exitCode=await dataApiResourcesCli({argv:[${JSON.stringify(sha)}],environment:${JSON.stringify({ ...env(), RUNNER_TEMP: directory })},probe:(value,options)=>probeDataApiResources(value,{...options,probe:async()=>(${JSON.stringify(baseline())}),executeSql:adapter})});`, { mode: 0o600 });
      child = spawn(process.execPath, [script], { detached: true, stdio: ["ignore", "pipe", "pipe"] });
      child.stdout.on("data", chunk => { stdout += chunk; }); child.stderr.on("data", chunk => { stderr += chunk; });
      closed = new Promise(resolve => child.once("close", (code, terminalSignal) => resolve({ code, terminalSignal })));
      for (let i = 0; i < 300; i++) { try { const active = JSON.parse(await readFile(marker, "utf8")); wrapperPid = active.wrapper; descendantPid = active.descendant; break; } catch { await delay(10); } }
      assert.equal(Number.isInteger(wrapperPid), true); assert.equal(await alive(wrapperPid), true); assert.equal(await alive(descendantPid), true);
      assert.equal(child.kill(signal), true); assert.deepEqual(await closed, { code: exitCode, terminalSignal: null });
      for (let i = 0; i < 100 && (await alive(wrapperPid) || await alive(descendantPid)); i++) await delay(10);
      assert.equal(await alive(wrapperPid), false); assert.equal(await alive(descendantPid), false);
      const report = JSON.parse(stdout); assert.equal(report.code, "RESOURCE_CANCELLED"); assert.equal(report.verdict, "UNPROVEN"); privateOutput(report); assert.equal(stderr, "");
      assert.deepEqual(JSON.parse(await readFile(join(directory, "data-api-resources.json"), "utf8")), report);
      assert.equal((await stat(join(directory, "data-api-resources.json"))).mode & 0o777, 0o600);
    } finally {
      if (child?.exitCode === null && child.signalCode === null) { try { process.kill(-child.pid, "SIGKILL"); } catch { /* Only fixture group. */ } }
      if (Number.isInteger(wrapperPid)) { try { process.kill(-wrapperPid, "SIGKILL"); } catch { /* Only fixture SQL group. */ } }
      if (closed) await closed; await rm(directory, { recursive: true, force: true });
    }
  });
}
