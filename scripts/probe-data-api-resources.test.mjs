import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { pathToFileURL } from "node:url";

import { dataApiResourcesCli, dataApiResourcesSql, probeDataApiResources, sanitizeDataApiResources } from "./probe-data-api-resources.mjs";
import { capacityFailure } from "./supabase-capacity-metrics.mjs";

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
    heartbeatMigration: { versionPresent: true },
    lockDiagnosis: { databaseMatches: true, relationState: "MATCHED", relationClass: "TENANTS", visibilityKnown: true,
      waitersSampled: 0, waitersTruncated: false, waiters: [] } };
}
const response = (value = fixture()) => ({ ok: true, stdout: JSON.stringify([{ report: value }]) });
const privateOutput = value => assert.doesNotMatch(JSON.stringify(value), /PRIVATE_|postgres:\/\/|RAW_ERROR|pg_stat_activity|pg_get_expr/);
const dependencies = extra => ({ probe: async () => baseline(), executeSql: async () => response(), collectCapacity: async () => capacityFailure(), ...extra });

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

test("capacity credentials are reached only after all existing runtime tenant and project guards", async () => {
  for (const mutate of [value => { value.environment.GITHUB_REF = "refs/pull/228/merge"; },
    value => { value.environment.SUPABASE_DB_URL = value.environment.SUPABASE_DB_URL.replace(project, "uvwxyzabcdefghijklmn"); }]) {
    const value = input(); mutate(value); let reads = 0;
    const result = await probeDataApiResources(value, dependencies({ collectCapacity: async () => { reads++; throw new Error("PRIVATE_METRICS"); } }));
    assert.equal(reads, 0); assert.notEqual(result.exitCode, 0); privateOutput(result);
  }
  const before = baseline(); before.report.sql.tenantActive = false; let reads = 0;
  const result = await probeDataApiResources(input(), dependencies({ probe: async () => before,
    collectCapacity: async () => { reads++; throw new Error("PRIVATE_METRICS"); } }));
  assert.equal(reads, 0); assert.equal(result.report.code, "RESOURCE_BASELINE_UNPROVEN"); privateOutput(result);
});

test("one independent capacity operation preserves context when the metadata read fails", async () => {
  let reads = 0;
  const measurements = capacityFailure();
  const result = await probeDataApiResources(input(), dependencies({ executeSql: async () => { throw new Error("PRIVATE_SQL"); },
    collectCapacity: async request => {
      assert.equal(request.projectRef, project); assert.equal(request.serviceRoleKey, "PRIVATE_KEY");
      assert.equal(request.signal, undefined); reads++; return measurements;
    } }));
  assert.equal(reads, 1); assert.equal(result.report.code, "RESOURCE_CONTEXT_UNPROVEN"); assert.equal(result.exitCode, 1);
  assert.deepEqual(result.report.capacityMetrics, measurements); assert.equal(result.report.metadata, undefined); privateOutput(result);
});

test("unavailable or hostile capacity reads cannot mask metadata or leak response labels", async () => {
  for (const collectCapacity of [async () => { throw new Error("PRIVATE_RESPONSE"); }, async () => ({ PRIVATE_LABEL: "PRIVATE_KEY" })]) {
    const result = await probeDataApiResources(input(), dependencies({ collectCapacity }));
    assert.equal(result.report.code, "RESOURCE_CONTEXT_OBSERVED"); assert.equal(result.exitCode, 0);
    assert.deepEqual(result.report.capacityMetrics, capacityFailure()); assert.equal(result.report.verdict, "UNPROVEN"); privateOutput(result);
  }
});

test("operation abort cancels both independent reads and remains fatal", async () => {
  const controller = new globalThis.AbortController(); let sqlAborted = false, metricsAborted = false;
  const result = await probeDataApiResources(input(), dependencies({ operationSignal: controller.signal,
    collectCapacity: async ({ signal }) => new Promise(resolve => {
      signal.addEventListener("abort", () => { metricsAborted = true; resolve(capacityFailure("CAPACITY_ABORTED")); }, { once: true });
    }),
    executeSql: ({ signal }) => {
      signal.addEventListener("abort", () => { sqlAborted = true; }, { once: true });
      void delay(1).then(() => controller.abort("PRIVATE_REASON")); return new Promise(() => {});
    } }));
  assert.equal(result.report.code, "RESOURCE_CANCELLED"); assert.equal(result.exitCode, 1);
  assert.equal(sqlAborted, true); assert.equal(metricsAborted, true); privateOutput(result);
});

test("late exporter abort retains completed metadata while cancellation remains fatal", async () => {
  const controller = new globalThis.AbortController(); let metricsAborted = false;
  const result = await probeDataApiResources(input(), dependencies({ operationSignal: controller.signal,
    collectCapacity: async ({ signal }) => new Promise(resolve => {
      signal.addEventListener("abort", () => { metricsAborted = true; resolve(capacityFailure("CAPACITY_ABORTED")); }, { once: true });
      void delay(5).then(() => controller.abort("PRIVATE_REASON"));
    }) }));
  assert.equal(result.report.code, "RESOURCE_CANCELLED"); assert.equal(result.exitCode, 1);
  assert.equal(metricsAborted, true); assert.equal(result.report.metadata.contextComplete, true);
  assert.equal(result.report.capacityMetrics.code, "CAPACITY_ABORTED"); privateOutput(result);
});

test("fixed SQL contains exact scope, history, index and caps and no mutating commands", () => {
  const sql = dataApiResourcesSql(); assert.equal(dataApiResourcesSql("PRIVATE_ARGUMENT"), sql);
  assert.match(sql, new RegExp(`id='${tenant}'::uuid AND status='active'`));
  assert.match(sql, /version='20261012190000'/); assert.match(sql, /relname='player_heartbeats_tenant_active_release_idx'/);
  assert.match(sql, /indnkeyatts=2 AND indnatts=2 AND indexprs IS NULL/); assert.match(sql, /ARRAY\['tenant_id','active_release_id'\]/);
  assert.match(sql, /amname='btree'/); assert.match(sql, /pg_get_expr\(indpred,indrelid,false\) IN/);
  assert.match(sql, /NOT \(indisunique OR indisprimary OR indisexclusion\)/); assert.match(sql, /pid<>pg_backend_pid\(\)/);
  assert.match(sql, /LIMIT 257/); assert.match(sql, /LIMIT 17/); assert.match(sql, /pg_read_all_stats','USAGE'/);
  assert.match(sql, /oid=5 AS matches/); assert.match(sql, /oid=20982/);
  assert.match(sql, /SELECT DISTINCT blocker_pid FROM unnest\(pg_catalog\.pg_blocking_pids\(w\.pid\)\)/);
  assert.match(sql, /SELECT \* FROM eligible_waiters ORDER BY pid LIMIT 16/); assert.match(sql, /WHERE s\.position<=16/);
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
  Object.assign(value.lockDiagnosis, { visibilityKnown: false, waitersSampled: null });
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

function blockedWaiter(patch = {}) {
  return { role: "authenticator", workload: "PRUNE", lockClass: "TRANSACTION", blockersSampled: 1, blockersTruncated: false,
    blockerGroups: [{ role: "authenticator", workload: "SPORTLINK_COMPLETION", category: "classified", count: 1 }], ...patch };
}
function blockedFixture(waiters = [blockedWaiter()]) {
  const value = fixture(); value.lockDiagnosis.waiters = waiters; value.lockDiagnosis.waitersSampled = waiters.length; return value;
}

test("production OID mapping distinguishes incomparable, absent and unreviewed from a known current table", () => {
  for (const state of ["INCOMPARABLE", "ABSENT", "UNREVIEWED"]) {
    const value = fixture(); Object.assign(value.lockDiagnosis, { databaseMatches: state !== "INCOMPARABLE", relationState: state, relationClass: null });
    const result = sanitizeDataApiResources(value);
    assert.equal(result.lockDiagnosis.relationState, state); assert.equal(result.lockDiagnosis.relationClass, null);
    assert.equal(result.lockDiagnosis.complete, false); assert.equal(result.contextComplete, false); privateOutput(result);
  }
  const value = fixture(); value.lockDiagnosis.relationClass = "REFRESH_QUEUE";
  assert.equal(sanitizeDataApiResources(value).lockDiagnosis.relationClass, "REFRESH_QUEUE");
  for (const patch of [{ databaseMatches: false }, { relationClass: "PRIVATE_TABLE" }, { relationState: "ABSENT" }]) {
    const invalid = fixture(); Object.assign(invalid.lockDiagnosis, patch); assert.throws(() => sanitizeDataApiResources(invalid), /RESOURCE_METADATA_INVALID/);
  }
});

test("bounded blocker class edges retain prune/completion intersection as current hints only", async () => {
  const value = blockedFixture([blockedWaiter({ blockersSampled: 2,
    blockerGroups: [{ role: "authenticator", workload: "SPORTLINK_COMPLETION", category: "classified", count: 2 }] })]);
  const result = await probeDataApiResources(input(), dependencies({ executeSql: async () => response(value) }));
  assert.equal(result.exitCode, 0); assert.equal(result.report.code, "RESOURCE_CONTEXT_OBSERVED"); assert.equal(result.report.verdict, "UNPROVEN");
  assert.deepEqual(result.report.metadata.lockDiagnosis.waiters, value.lockDiagnosis.waiters);
  assert.equal(result.report.metadata.lockDiagnosis.unknownBlockerEdges, 0); assert.equal(result.report.metadata.lockDiagnosis.complete, true);
  assert.ok(result.report.limitations.includes("query_tokens_are_last_statement_hints_not_proof_of_active_rpc"));
  assert.ok(result.report.limitations.includes("bounded_blocker_edges_are_current_context_not_full_chains_or_deadlock_proof")); privateOutput(result);
});

test("observed storage table and published refresh completion remain fixed current classes", async () => {
  const value = blockedFixture([blockedWaiter({ workload: "PUBLISHED_REFRESH_COMPLETION",
    blockerGroups: [{ role: "authenticator", workload: "PUBLISHED_REFRESH_COMPLETION", category: "classified", count: 1 }] })]);
  value.lockDiagnosis.relationClass = "STORAGE_OBJECTS";
  const result = await probeDataApiResources(input(), dependencies({ executeSql: async () => response(value) }));
  assert.equal(result.report.code, "RESOURCE_CONTEXT_OBSERVED"); assert.equal(result.report.verdict, "UNPROVEN");
  assert.equal(result.report.metadata.lockDiagnosis.relationClass, "STORAGE_OBJECTS");
  assert.equal(result.report.metadata.lockDiagnosis.waiters[0].workload, "PUBLISHED_REFRESH_COMPLETION");
  assert.equal(result.report.metadata.lockDiagnosis.unknownBlockerEdges, 0); privateOutput(result);
  for (const mutate of [r => { r.lockDiagnosis.relationClass = "STORAGE_BUCKETS"; },
    r => { r.lockDiagnosis.waiters[0].role = "supabase_storage_admin"; },
    r => { r.lockDiagnosis.waiters[0].workload = "STORAGE_UPSERT"; },
    r => { r.lockDiagnosis.waiters[0].blockerGroups[0].workload = "PUBLISHED_REFRESH_COMPLETION_V2"; },
    r => { r.lockDiagnosis.waiters[0].blockerGroups[0].query = "PRIVATE_STORAGE_PARAMETER"; }]) {
    const invalid = globalThis.structuredClone(value); mutate(invalid);
    assert.throws(() => sanitizeDataApiResources(invalid), /RESOURCE_METADATA_INVALID/);
  }
});

test("fixed three-token hints reject prefixes and alternate versions while mixed hints stay ambiguous", () => {
  const sql = dataApiResourcesSql();
  assert.match(sql, /\('storage','objects','STORAGE_OBJECTS'\)/); assert.doesNotMatch(sql, /\('storage','buckets'/);
  assert.match(sql, /a\.workload IN \('PRUNE','SPORTLINK_COMPLETION','PUBLISHED_REFRESH_COMPLETION','MULTIPLE_HINTS'\)/);
  assert.match(sql, /a\.workload IN \('PRUNE','SPORTLINK_COMPLETION','PUBLISHED_REFRESH_COMPLETION'\) THEN 'classified'/);
  const expected = [
    ["prune_queued_publication_versions_v1", "PRUNE"], ["complete_sportlink_sync_v4", "SPORTLINK_COMPLETION"],
    ["complete_published_data_refresh_v1", "PUBLISHED_REFRESH_COMPLETION"]
  ];
  const hints = [...sql.matchAll(/WHEN query ~\* '([^']+)' THEN '([A-Z_]+)'/g)];
  assert.equal(hints.length, expected.length);
  for (let index = 0; index < hints.length; index++) {
    const [token, workload] = expected[index], pattern = new RegExp(hints[index][1], "i");
    assert.equal(hints[index][2], workload);
    for (const text of [token, `SELECT public.${token}($1)`, token.toUpperCase()]) assert.equal(pattern.test(text), true);
    for (const text of [`prefix_${token}`, `${token}_suffix`, `${token}0`, token.replace(/v\d+$/, "v99")]) assert.equal(pattern.test(text), false);
  }
  const multiple = sql.match(/WHEN \((.+)\)>1 THEN 'MULTIPLE_HINTS'/);
  assert.ok(multiple); assert.equal((multiple[1].match(/CASE WHEN query ~\*/g) ?? []).length, 3);
  for (const workload of ["PRUNE", "SPORTLINK_COMPLETION", "PUBLISHED_REFRESH_COMPLETION"]) {
    const ambiguous = blockedFixture([blockedWaiter({ workload: "MULTIPLE_HINTS", blockerGroups: [
      { role: "authenticator", workload, category: "classified", count: 1 }
    ] })]);
    assert.equal(sanitizeDataApiResources(ambiguous).lockDiagnosis.complete, false);
  }
});

test("masked visibility reports unknown counts rather than no current blockers", () => {
  const value = fixture(); value.allStatsVisible = false; value.heartbeatProgress.visibilityKnown = false;
  Object.assign(value.lockDiagnosis, { visibilityKnown: false, waitersSampled: null });
  const result = sanitizeDataApiResources(value); assert.equal(result.lockDiagnosis.unknownWaiters, null);
  assert.equal(result.lockDiagnosis.unknownBlockerEdges, null); assert.equal(result.lockDiagnosis.preparedBlockerEdges, null);
  assert.equal(result.lockDiagnosis.waitersWithoutBlockers, null); assert.equal(result.lockDiagnosis.complete, false);
  for (const patch of [{ waitersSampled: 0 }, { waitersTruncated: true }, { waiters: [blockedWaiter()] }, { visibilityKnown: true }]) {
    const invalid = globalThis.structuredClone(value); Object.assign(invalid.lockDiagnosis, patch);
    assert.throws(() => sanitizeDataApiResources(invalid), /RESOURCE_METADATA_INVALID/);
  }
});

test("prepared, outside, masked and unclassified blocker edges remain unknown", () => {
  for (const group of [{ role: "UNKNOWN", workload: "UNKNOWN", category: "prepared", count: 1 },
    { role: "UNKNOWN", workload: "PRUNE", category: "unknown", count: 1 },
    { role: "authenticator", workload: "UNKNOWN", category: "unknown", count: 1 },
    { role: "postgres", workload: "UNCLASSIFIED", category: "unknown", count: 1 },
    { role: "authenticator", workload: "MULTIPLE_HINTS", category: "unknown", count: 1 }]) {
    const value = blockedFixture([blockedWaiter({ blockerGroups: [group] })]); const result = sanitizeDataApiResources(value);
    assert.equal(result.lockDiagnosis.unknownBlockerEdges, 1); assert.equal(result.lockDiagnosis.preparedBlockerEdges, group.category === "prepared" ? 1 : 0);
    assert.equal(result.contextComplete, false); assert.equal(result.lockDiagnosis.complete, false); privateOutput(result);
  }
});

test("unclassified waiters, missing lock class and vanished blocker edges cannot manufacture completeness", () => {
  for (const patch of [{ workload: "UNKNOWN" }, { workload: "UNCLASSIFIED" }, { workload: "MULTIPLE_HINTS" }, { lockClass: "OTHER" },
    { lockClass: "UNKNOWN" }, { blockersSampled: 0, blockerGroups: [] }]) {
    const result = sanitizeDataApiResources(blockedFixture([blockedWaiter(patch)]));
    assert.equal(result.lockDiagnosis.complete, false); assert.equal(result.contextComplete, false);
    assert.equal(result.lockDiagnosis.waitersWithoutBlockers, patch.blockersSampled === 0 ? 1 : 0);
  }
});

test("waiter and distinct blocker sentinel caps preserve bounded partial observations", () => {
  const value = blockedFixture(Array.from({ length: 16 }, () => blockedWaiter()));
  value.lockDiagnosis.waitersSampled = 17; value.lockDiagnosis.waitersTruncated = true;
  const waiterCapped = sanitizeDataApiResources(value); assert.equal(waiterCapped.lockDiagnosis.waiters.length, 16);
  assert.equal(waiterCapped.lockDiagnosis.waitersSampled, 17); assert.equal(waiterCapped.lockDiagnosis.complete, false);
  const blockerCapped = sanitizeDataApiResources(blockedFixture([blockedWaiter({ blockersSampled: 17, blockersTruncated: true,
    blockerGroups: [{ role: "authenticator", workload: "SPORTLINK_COMPLETION", category: "classified", count: 16 }] })]));
  assert.equal(blockerCapped.lockDiagnosis.waiters[0].blockersSampled, 17); assert.equal(blockerCapped.lockDiagnosis.complete, false);
});

test("blocker wire rejects private identifiers, inconsistent caps, duplicate groups and forged completeness", async () => {
  for (const mutate of [r => { r.lockDiagnosis.pid = 42; }, r => { r.lockDiagnosis.relationOid = 20982; },
    r => { r.lockDiagnosis.complete = true; }, r => { r.lockDiagnosis.waiters[0].query = "PRIVATE_QUERY"; },
    r => { r.lockDiagnosis.waiters[0].transactionId = "PRIVATE_TRANSACTION"; }, r => { r.lockDiagnosis.waiters[0].role = "PRIVATE_ROLE"; },
    r => { r.lockDiagnosis.waiters[0].workload = "PRIVATE_WORKLOAD"; }, r => { r.lockDiagnosis.waiters[0].lockClass = "PRIVATE_LOCK"; },
    r => { r.lockDiagnosis.waitersSampled = 17; }, r => { r.lockDiagnosis.waitersSampled = 18; },
    r => { r.lockDiagnosis.waiters[0].blockersSampled = 17; }, r => { r.lockDiagnosis.waiters[0].blockersSampled = 18; },
    r => { r.lockDiagnosis.waiters[0].blockerGroups[0].count = 2; }, r => { r.lockDiagnosis.waiters[0].blockerGroups[0].count = true; },
    r => { r.lockDiagnosis.waiters[0].blockerGroups[0].category = "prepared"; },
    r => { r.lockDiagnosis.waiters[0].blockerGroups[0].role = "UNKNOWN"; },
    r => { r.lockDiagnosis.waiters[0].blockerGroups[0].workload = "UNCLASSIFIED"; },
    r => { const w = r.lockDiagnosis.waiters[0]; w.blockersSampled = 2; w.blockerGroups.push({ ...w.blockerGroups[0] }); }]) {
    const value = blockedFixture(); mutate(value);
    const result = await probeDataApiResources(input(), dependencies({ executeSql: async () => response(value) }));
    assert.equal(result.report.code, "RESOURCE_CONTEXT_UNPROVEN"); assert.equal(result.exitCode, 1); privateOutput(result);
  }
});

test("full retained blocker-class payload including refresh hints stays below the existing64KiB wire cap", () => {
  const groups = roles.flatMap(role => ["PRUNE", "SPORTLINK_COMPLETION", "PUBLISHED_REFRESH_COMPLETION"].map(workload => ({ role, workload, category: "classified", count: 1 })));
  groups.push({ role: "UNKNOWN", workload: "UNKNOWN", category: "prepared", count: 1 });
  const value = blockedFixture(Array.from({ length: 16 }, () => blockedWaiter({ blockersSampled: 17, blockersTruncated: true, blockerGroups: groups })));
  value.lockDiagnosis.waitersSampled = 17; value.lockDiagnosis.waitersTruncated = true;
  assert.ok(Buffer.byteLength(response(value).stdout) < 65_536);
  assert.equal(sanitizeDataApiResources(value).lockDiagnosis.unknownBlockerEdges, 16); privateOutput(sanitizeDataApiResources(value));
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
      const capacityUrl = pathToFileURL(join(process.cwd(), "scripts/supabase-capacity-metrics.mjs")).href;
      await writeFile(script, `import {spawn} from 'node:child_process'; import {dataApiResourcesCli,probeDataApiResources} from ${JSON.stringify(moduleUrl)};
import {createSqlAdapter} from ${JSON.stringify(adapterUrl)};
import {capacityFailure} from ${JSON.stringify(capacityUrl)};
const adapter=createSqlAdapter((_file,_args,options)=>spawn(process.execPath,['-e',\`const fs=require('node:fs'),{spawn}=require('node:child_process');const descendant=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore'});fs.writeFileSync(process.argv[1],JSON.stringify({wrapper:process.pid,descendant:descendant.pid}));process.stderr.write('RAW_ERROR PRIVATE_PASSWORD');setInterval(()=>{},1000);\`,${JSON.stringify(marker)}],options));
process.exitCode=await dataApiResourcesCli({argv:[${JSON.stringify(sha)}],environment:${JSON.stringify({ ...env(), RUNNER_TEMP: directory })},probe:(value,options)=>probeDataApiResources(value,{...options,probe:async()=>(${JSON.stringify(baseline())}),executeSql:adapter,collectCapacity:async()=>capacityFailure()})});`, { mode: 0o600 });
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
