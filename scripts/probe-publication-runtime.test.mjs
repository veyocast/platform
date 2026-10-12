import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";
import { chmod, mkdtemp, readFile, rm, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { ReadableStream } from "node:stream/web";
import { test } from "node:test";
import { fileURLToPath, pathToFileURL, URL } from "node:url";
import { inventoryExplainSql, inventoryTemplateSha256, probePublicationRuntime, publicationProbeCli, publicationStatsSql, sanitizeInventoryPlan, sanitizePublicationStats, writePublicationProbeArtifact } from "./probe-publication-runtime.mjs";

// Synthetic transports exercise authorization, bounds and redaction, not live latency.
const sha = "a".repeat(40), tenant = "11111111-1111-1111-1111-111111111111", project = "abcdefghijklmnopqrst";
const privateValue = "PRIVATE_PROVIDER_PERSON_OR_SECRET", uri = `postgresql://private-user:p%2B%24@db.${project}.supabase.co:5432/postgres?sslmode=verify-full&sslrootcert=%2Fprivate%2Fca.pem`;
const environment = () => ({ GITHUB_REF: "refs/heads/main", SUPABASE_PROJECT_REF: project, NEXT_PUBLIC_SUPABASE_URL: `https://${project}.supabase.co`, SUPABASE_DB_URL: uri });
const input = (env = environment()) => ({ environment: env, targetEnvironment: "production", expectedRuntimeSha: sha, tenantId: tenant });
const node = (extra = {}) => ({ "Node Type": "Seq Scan", "Relation Name": "player_heartbeats", "Startup Cost": 0, "Total Cost": 100, "Plan Rows": 2000, ...extra });
const plan = () => [{ Plan: node() }];
const run = (extra = {}) => ({ connectionId: tenant, datasetGroup: "matches", enabled: true, frequency: "five_minutes",
  nextSyncAt: "2026-10-12T15:05:00+00:00", lastSuccessAt: "2026-10-12T14:50:00.123456+00:00", status: "failed",
  startedAt: "2026-10-12T15:00:00Z", finishedAt: "2026-10-12T15:01:00Z", errorCode: "SPORTLINK_SYNC_COMPLETE_TRANSPORT_FAILED", readCount: 0, changedCount: 0, skippedCount: 0, ...extra });
const stats = () => ({ tenantCounts: { snapshots: 21909, releases: 1218, publishedBindings: 53 },
  tableEstimates: ["dynamic_slide_snapshots", "dynamic_slide_versions", "playlist_releases", "published_dynamic_data", "player_heartbeats", "player_sync_events", "publisher_target_snapshots", "playlist_release_authoring_snapshots"].map((relation) => ({ relation, estimatedRows: 2000 })),
  activity: [{ state: "active", waitType: "Lock", workload: "inventory", count: 2, maxQueryAgeMs: 62000 }], activityTruncated: false,
  sportlink: { retainedConnections: 1, connectionsTruncated: false, datasets: [run()] } });
function healthFetch(capture = []) {
  return async (url, options) => {
    capture.push({ url, options });
    const service = url.includes("player") ? "player" : "control";
    return globalThis.Response.json({ environment: url.includes("staging-") ? "staging" : "production", revision: sha, service, status: "ok" });
  };
}
const rows = (data) => ({ ok: true, stdout: JSON.stringify(data) });
function sqlAdapter(capture = [], overrides = {}) {
  return async (request) => {
    capture.push(request);
    if (request.sql.startsWith("SELECT 1")) return overrides.tenant ?? rows([{ database_ready: 1, tenant_active: true }]);
    if (request.sql.startsWith("EXPLAIN")) return overrides.plan ?? rows([{ "QUERY PLAN": plan() }]);
    return overrides.stats ?? rows([{ report: stats() }]);
  };
}
function privateOutput(result) {
  const text = JSON.stringify(result);
  for (const value of [privateValue, project, "private-user", "p%2B%24", "ca.pem", "RAW_FILTER", "RAW_SQL", "PRIVATE_INDEX", "PRIVATE_RELATION"]) assert.equal(text.includes(value), false, value);
}

test("exact healthy scope precedes three fixed read-only SQL stages and diagnostic completion is not inventory success", async () => {
  const health = [], sql = [];
  const result = await probePublicationRuntime(input(), { fetchImpl: healthFetch(health), executeSql: sqlAdapter(sql) });
  assert.equal(result.exitCode, 0); assert.equal(result.report.verdict, "DIAGNOSTIC_COMPLETE");
  assert.equal(result.report.mode, "read_only_inventory_plan_and_metadata"); assert.equal(result.report.plan.nodeCount, 1);
  assert.equal(result.report.stats.sportlink.datasets[0].errorCode, "SPORTLINK_SYNC_COMPLETE_TRANSPORT_FAILED");
  assert.equal(result.report.queryTemplateSha256, inventoryTemplateSha256); assert.equal(sql.length, 3); assert.equal(health.length, 2);
  for (const request of health) { assert.equal(request.options.headers, undefined); assert.equal(request.options.redirect, "error"); }
  for (const request of sql) { assert.equal(request.databaseUrl, uri + "&connect_timeout=45"); assert.ok(request.signal instanceof globalThis.AbortSignal); }
  assert.equal(sql[1].sql, publicationStatsSql(tenant)); assert.equal(sql[2].sql, inventoryExplainSql(tenant));
  assert.match(sql[2].sql, /^EXPLAIN \(FORMAT JSON, COSTS TRUE, VERBOSE FALSE, SUMMARY FALSE, SETTINGS FALSE\)/);
  assert.doesNotMatch(sql[2].sql, /\bANALYZE\b/i); assert.doesNotMatch(sql[1].sql, /\b(?:insert|update|delete|alter|drop|create)\b/i);
  privateOutput(result);
});

test("EXPLAIN preserves the exact checked-in inventory template and rejects tenant SQL injection", async () => {
  const template = await readFile(new URL("./sql/current-publication-inventory.sql", import.meta.url), "utf8");
  assert.equal(inventoryTemplateSha256, createHash("sha256").update(template).digest("hex"));
  assert.equal(inventoryExplainSql(tenant).split("\n").slice(1).join("\n"), template.replaceAll("__TENANT_ID__", `'${tenant}'::uuid`));
  for (const invalid of ["' OR true; --", "A".repeat(36), undefined]) {
    assert.throws(() => inventoryExplainSql(invalid), /SCOPE_INVALID/); assert.throws(() => publicationStatsSql(invalid), /SCOPE_INVALID/);
  }
  const sql = publicationStatsSql(tenant);
  assert.match(sql, /ORDER BY started_at DESC,id DESC LIMIT 1/); assert.match(sql, /LIMIT 101/); assert.match(sql, /LIMIT 100/);
  assert.match(sql, /state='active' AND query_start IS NOT NULL/); assert.match(sql, /standingFormCoverage/);
  assert.doesNotMatch(sql, /jsonb_build_object\([^;]*(?:'query'|'pid'|'worker_id'|'error_message')/);
});

test("invalid main/public scope and enlarged deadlines make no requests or secret reads", async () => {
  for (const invalid of [{ GITHUB_REF: "refs/pull/1/merge" }, { NEXT_PUBLIC_SUPABASE_URL: `https://${project}.supabase.co/?private=1` }, { SUPABASE_PROJECT_REF: "bad" }]) {
    const env = { ...environment(), ...invalid }; let calls = 0, reads = 0;
    Object.defineProperty(env, "SUPABASE_DB_URL", { get() { reads++; throw new Error(privateValue); } });
    const result = await probePublicationRuntime(input(env), { fetchImpl: async () => { calls++; }, executeSql: async () => { calls++; } });
    assert.equal(result.report.code, "SCOPE_INVALID"); assert.equal(result.exitCode, 2); assert.equal(calls, 0); assert.equal(reads, 0); privateOutput(result);
  }
  for (const options of [{ healthDeadlineMs: 5001 }, { sqlDeadlineMs: 52001 }, { sqlDeadlineMs: 0 }]) {
    let calls = 0;
    const result = await probePublicationRuntime(input(), { ...options, fetchImpl: async () => { calls++; }, executeSql: async () => { calls++; } });
    assert.equal(result.report.code, "SCOPE_INVALID"); assert.equal(calls, 0);
  }
});

test("Player wrong revision/extra health field rejects before credential access or SQL", async () => {
  for (const invalid of [{ revision: "b".repeat(40) }, { privateField: privateValue }, { service: "control" }, { status: "error" }]) {
    const env = environment(); let reads = 0, calls = 0;
    Object.defineProperty(env, "SUPABASE_DB_URL", { get() { reads++; throw new Error(privateValue); } });
    const native = healthFetch();
    const result = await probePublicationRuntime(input(env), { fetchImpl: async (url, options) => url.includes("player")
      ? globalThis.Response.json({ environment: "production", revision: sha, service: "player", status: "ok", ...invalid }) : native(url, options), executeSql: async () => { calls++; } });
    assert.equal(result.report.code, "PUBLIC_HEALTH_SCOPE_MISMATCH"); assert.equal(reads, 0); assert.equal(calls, 0); privateOutput(result);
  }
});

test("health timeout and oversized streamed response abort/cancel before credentials", async () => {
  const env = environment(); let reads = 0, aborted = false;
  Object.defineProperty(env, "SUPABASE_DB_URL", { get() { reads++; return uri; } });
  const timeout = await probePublicationRuntime(input(env), { healthDeadlineMs: 10, fetchImpl: (url, options) => {
    options.signal.addEventListener("abort", () => { aborted = true; }); return new Promise(() => {});
  } });
  assert.equal(timeout.report.code, "PUBLIC_HEALTH_TIMEOUT"); assert.equal(aborted, true); assert.equal(reads, 0);
  let canceled = false;
  const oversized = await probePublicationRuntime(input(env), { fetchImpl: async () => new globalThis.Response(new ReadableStream({ start(c) { c.enqueue(new Uint8Array(65537)); }, cancel() { canceled = true; } })) });
  assert.equal(oversized.report.code, "PUBLIC_HEALTH_READ_FAILED"); assert.equal(canceled, true); assert.equal(reads, 0);
});

test("secret project/endpoint mismatch is rejected after health and before any SQL", async () => {
  for (const invalid of [{ SUPABASE_DB_URL: uri.replace(project, "z".repeat(20)) }, { PGHOST: "PRIVATE_RELATION" }, { SUPABASE_DB_URL: uri + "&options=reference=wrong" }]) {
    let calls = 0;
    const result = await probePublicationRuntime(input({ ...environment(), ...invalid }), { fetchImpl: healthFetch(), executeSql: async () => { calls++; } });
    assert.equal(result.report.code, "SECRET_CONFIG_INVALID"); assert.equal(calls, 0); privateOutput(result);
  }
});

test("inactive/extra tenant rows and unknown scope fields never reach stats or EXPLAIN", async () => {
  for (const data of [[{ database_ready: 1, tenant_active: false }], [{ database_ready: "1", tenant_active: true }], [{ database_ready: 1, tenant_active: true, payload: privateValue }], [{ database_ready: 1, tenant_active: true }, { database_ready: 1, tenant_active: true }]]) {
    const calls = [];
    const result = await probePublicationRuntime(input(), { fetchImpl: healthFetch(), executeSql: sqlAdapter(calls, { tenant: rows(data) }) });
    assert.equal(result.report.code, "TENANT_SCOPE_UNPROVEN"); assert.equal(result.exitCode, 1); assert.equal(calls.length, 1); privateOutput(result);
  }
});

test("known CLI codes retain phase and reviewed SQLSTATE only, never raw/nested cause", async () => {
  for (const [code, expected] of [["LegacyDbConnectError", "SQL_CONNECT_FAILED"], ["LegacyDbQueryExecError", "SQL_QUERY_FAILED"]]) {
    const result = await probePublicationRuntime(input(), { fetchImpl: healthFetch(), executeSql: sqlAdapter([], { tenant: { ok: false, stdout: JSON.stringify({ error: { code, databaseCode: "57014", message: privateValue, cause: { code: "28P01", sql: "RAW_SQL" } } }) } }) });
    assert.equal(result.report.tenant.stage, "tenant_lookup"); assert.equal(result.report.tenant.code, expected); assert.equal(result.report.tenant.databaseCode, "57014"); privateOutput(result);
  }
  const unknown = await probePublicationRuntime(input(), { fetchImpl: healthFetch(), executeSql: async () => ({ ok: false, stdout: JSON.stringify({ error: { code: "LegacyDbConnectError", databaseCode: privateValue, message: "failed to connect to postgres: SqlError: PgClient: Connection timed out " + privateValue, cause: { code: "57014" } } }) }) });
  assert.equal(unknown.report.tenant.databaseCode, undefined); assert.equal(unknown.report.tenant.cliFailureCategory, "UNKNOWN"); privateOutput(unknown);
});

test("metadata timeout remains failed, aborts owned adapter and still performs bounded EXPLAIN", async () => {
  let aborted = false, calls = 0;
  const native = sqlAdapter();
  const result = await probePublicationRuntime(input(), { fetchImpl: healthFetch(), sqlDeadlineMs: 10, executeSql: (request) => {
    calls++; if (request.sql.startsWith("WITH scoped_connections")) { request.signal.addEventListener("abort", () => { aborted = true; }); return new Promise(() => {}); }
    return native(request);
  } });
  assert.equal(result.report.stats.code, "SQL_TIMEOUT"); assert.equal(result.report.stats.stage, "inventory_metadata"); assert.equal(result.report.plan.status, "passed");
  assert.equal(result.report.verdict, "UNPROVEN"); assert.equal(aborted, true); assert.equal(calls, 3); privateOutput(result);
});

test("SQL output cap and raw adapter exception never expose partial plan/error text", async () => {
  for (const failure of [{ ok: false, tooLarge: true, stdout: privateValue }, { ok: true, stdout: "x".repeat(65537) }]) {
    const result = await probePublicationRuntime(input(), { fetchImpl: healthFetch(), executeSql: sqlAdapter([], { plan: failure }) });
    assert.equal(result.report.plan.code, "SQL_OUTPUT_TOO_LARGE"); assert.equal(result.report.plan.nodes, undefined); assert.equal(result.exitCode, 1); privateOutput(result);
  }
  const result = await probePublicationRuntime(input(), { fetchImpl: healthFetch(), executeSql: () => { throw new Error(uri + privateValue); } });
  assert.equal(result.report.tenant.code, "SQL_EXEC_FAILED"); privateOutput(result);
});

test("plan filters/output/aliases/settings/index names cannot leak beyond reviewed enums", () => {
  const result = sanitizeInventoryPlan([{ Plan: node({ "Relation Name": "PRIVATE_RELATION", "Index Name": "PRIVATE_INDEX", Alias: privateValue, Filter: "RAW_FILTER", Output: ["RAW_SQL"], Plans: [node({ "Node Type": privateValue })] }), Settings: { privateValue }, "Planning Time": 1 }]);
  assert.equal(result.nodes[0].relation, "unreviewed"); assert.equal(result.nodes[0].index, "unreviewed"); assert.equal(result.nodes[1].nodeType, "unreviewed");
  assert.equal(result.nodeCount, 2); privateOutput(result);
});

test("malformed/nonfinite/unbounded/deep plans fail closed without claiming completion", () => {
  for (const value of [[], [{ Plan: null }], [{ Plan: node({ "Total Cost": -1 }) }], [{ Plan: node({ "Total Cost": Infinity }) }], [{ Plan: node({ "Plan Rows": "2000" }) }], [{ Plan: node({ Plans: {} }) }]]) assert.throws(() => sanitizeInventoryPlan(value), /PLAN_SHAPE_INVALID/);
  const deep = node(); let current = deep;
  for (let i = 0; i < 34; i++) { current.Plans = [node()]; current = current.Plans[0]; }
  assert.throws(() => sanitizeInventoryPlan([{ Plan: deep }]), /PLAN_SHAPE_INVALID/);
  assert.throws(() => sanitizeInventoryPlan([{ Plan: node({ Plans: Array.from({ length: 256 }, () => node()) }) }]), /PLAN_SHAPE_INVALID/);
});

test("metadata preserves bounded numeric workload ages and maps private enum strings without leaks", () => {
  const value = stats(); value.activity.push({ state: privateValue, waitType: privateValue, workload: privateValue, count: 3, maxQueryAgeMs: 500 });
  const result = sanitizePublicationStats(value);
  assert.equal(result.activity[0].workload, "inventory"); assert.equal(result.activity[0].maxQueryAgeMs, 62000);
  assert.deepEqual(result.activity[1], { state: "unreviewed", waitType: "unreviewed", workload: "other", count: 3, maxQueryAgeMs: 500 });
  assert.equal(result.activityScope, "database_wide_aggregated_session_state_and_wait_type"); privateOutput(result);
});

test("all new Sportlink completion categories are fixed codes; private/old unreviewed codes redact", () => {
  for (const suffix of ["TRANSPORT_FAILED", "RPC_FAILED", "INVALID_RESULT", "57014", "PGRST003", "XX000"]) {
    const value = stats(); value.sportlink.datasets[0].errorCode = "SPORTLINK_SYNC_COMPLETE_" + suffix;
    assert.equal(sanitizePublicationStats(value).sportlink.datasets[0].errorCode, "SPORTLINK_SYNC_COMPLETE_" + suffix);
  }
  const value = stats(); value.sportlink.datasets[0] = run({ errorCode: privateValue });
  const result = sanitizePublicationStats(value); assert.equal(result.sportlink.datasets[0].errorCode, "UNKNOWN_ERROR");
  assert.equal(result.sportlink.datasets[0].lastSuccessAt, "2026-10-12T14:50:00.123Z"); privateOutput(result);
  const absent = stats(); absent.sportlink.datasets[0] = run({ status: null, startedAt: null, finishedAt: null, errorCode: null, readCount: null, changedCount: null, skippedCount: null });
  assert.equal(sanitizePublicationStats(absent).sportlink.datasets[0].status, null);
});

test("duplicate/missing table estimates, impossible counts, raw timestamps and duplicate run scopes fail closed", () => {
  const mutations = [
    (v) => v.tableEstimates.pop(), (v) => v.tableEstimates[1] = v.tableEstimates[0], (v) => v.tenantCounts.snapshots = -1,
    (v) => v.activity[0].maxQueryAgeMs = Infinity, (v) => v.activity[0].query = privateValue,
    (v) => v.sportlink.datasets[0].startedAt = privateValue, (v) => v.sportlink.datasets.push(v.sportlink.datasets[0]),
    (v) => v.sportlink.retainedConnections = 0, (v) => v.sportlink.datasets[0].datasetGroup = privateValue,
    (v) => v.sportlink.datasets[0].status = null, (v) => v.sportlink.retainedConnections = 101
  ];
  for (const mutate of mutations) { const value = stats(); mutate(value); assert.throws(() => sanitizePublicationStats(value), /STATS_SHAPE_INVALID/); }
});

test("truncated connection or activity metadata cannot claim diagnostic completion", async () => {
  for (const field of ["connections", "activity"]) {
    const value = stats(); if (field === "connections") value.sportlink.connectionsTruncated = true; else value.activityTruncated = true;
    const result = await probePublicationRuntime(input(), { fetchImpl: healthFetch(), executeSql: sqlAdapter([], { stats: rows([{ report: value }]) }) });
    assert.equal(result.report.stats.status, "passed"); assert.equal(result.report.plan.status, "passed"); assert.equal(result.report.verdict, "UNPROVEN"); assert.equal(result.exitCode, 1);
  }
});

test("malformed plan response does not produce an inventory pass or leak the original row", async () => {
  const result = await probePublicationRuntime(input(), { fetchImpl: healthFetch(), executeSql: sqlAdapter([], { plan: rows([{ "QUERY PLAN": plan(), payload: privateValue }]) }) });
  assert.equal(result.report.plan.code, "PLAN_SHAPE_INVALID"); assert.equal(result.report.plan.nodes, undefined); assert.equal(result.report.queryTemplateSha256, inventoryTemplateSha256); privateOutput(result);
});

test("CLI writes only sanitized0600 artifact and invalid/output path failures stay fixed", async () => {
  const directory = await mkdtemp(join(tmpdir(), "publication-probe-")); const target = join(directory, "publication-runtime-probe.json");
  try {
    const env = { ...environment(), RUNNER_TEMP: directory }; let stdout = "";
    const exitCode = await publicationProbeCli({ argv: ["production", sha, tenant], environment: env, stdout: { write(value) { stdout += value; } }, fetchImpl: healthFetch(), executeSql: sqlAdapter() });
    assert.equal(exitCode, 0); assert.equal((await stat(target)).mode & 0o777, 0o600); privateOutput(JSON.parse(stdout));
    assert.deepEqual(JSON.parse(await readFile(target, "utf8")), JSON.parse(stdout));
    await rm(target); const other = join(directory, "private-file"); await writeFile(other, privateValue); await symlink(other, target);
    let failureOutput = "";
    const failed = await publicationProbeCli({ argv: ["production", sha, tenant], environment: env, stdout: { write(value) { failureOutput += value; } }, fetchImpl: healthFetch(), executeSql: sqlAdapter() });
    assert.equal(failed, 1); assert.equal(JSON.parse(failureOutput).code, "OUTPUT_WRITE_FAILED"); assert.equal(await readFile(other, "utf8"), privateValue); privateOutput(JSON.parse(failureOutput));
    let invalidOutput = "";
    const invalid = await publicationProbeCli({ argv: ["production", sha, tenant, "extra"], environment: environment(), stdout: { write(value) { invalidOutput += value; } }, fetchImpl: () => { throw new Error(privateValue); } });
    assert.equal(invalid, 2); assert.equal(JSON.parse(invalidOutput).code, "SCOPE_INVALID");
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("artifact refuses symlink and missing directory without embedding filesystem paths", async () => {
  await assert.rejects(writePublicationProbeArtifact("/definitely-absent-publication-probe", { code: "SAFE" }));
  assert.equal(await publicationProbeCli({ argv: [], environment: environment(), stdout: { write() { throw new Error(privateValue); } } }), 1);
});

test("already-cancelled operation reads no credentials and starts no health or SQL stage", async () => {
  const controller = new globalThis.AbortController(); controller.abort(new Error(privateValue));
  const env = environment(); let reads = 0, calls = 0;
  Object.defineProperty(env, "SUPABASE_DB_URL", { get() { reads++; throw new Error(privateValue); } });
  const result = await probePublicationRuntime(input(env), { operationSignal: controller.signal,
    fetchImpl: async () => { calls++; }, executeSql: async () => { calls++; } });
  assert.equal(result.report.code, "PROBE_CANCELLED"); assert.equal(result.exitCode, 1); assert.equal(reads, 0); assert.equal(calls, 0); privateOutput(result);
});

test("operation cancellation aborts active metadata and prevents EXPLAIN regardless of raw abort reason", async () => {
  const controller = new globalThis.AbortController(); const calls = []; let aborted = false;
  const native = sqlAdapter();
  const result = await probePublicationRuntime(input(), { operationSignal: controller.signal, fetchImpl: healthFetch(), executeSql: (request) => {
    calls.push(request.sql);
    if (request.sql.startsWith("WITH scoped_connections")) {
      request.signal.addEventListener("abort", () => { aborted = true; });
      globalThis.queueMicrotask(() => controller.abort(new Error(uri + privateValue)));
      return new Promise(() => {});
    }
    return native(request);
  } });
  assert.equal(aborted, true); assert.equal(calls.length, 2); assert.equal(result.report.code, "PROBE_CANCELLED");
  assert.equal(result.report.stats.code, "PROBE_CANCELLED"); assert.equal(result.report.plan, undefined); privateOutput(result);
});

for (const [phase, signal, exitCode] of [["inventory_metadata", "SIGTERM", 143], ["inventory_explain", "SIGINT", 130]]) {
  test(`actual Linux CLI ${signal} cancellation in ${phase} stops owned wrapper and descendant`, { skip: process.platform !== "linux", timeout: 20_000 }, async () => {
    const directory = await mkdtemp(join(tmpdir(), "publication-cli-cancel-"));
    let child, wrapperPid, descendantPid;
    const alive = async (pid) => {
      try { const value = await readFile(`/proc/${pid}/stat`, "utf8"); return value.slice(value.lastIndexOf(")") + 2).split(" ")[0] !== "Z"; }
      catch { return false; }
    };
    try {
      const marker = join(directory, "owned-pids.json"), stages = join(directory, "stages.txt"), hook = join(directory, "health-hook.mjs"), binary = join(directory, "pnpm");
      await writeFile(hook, `globalThis.fetch=async(url)=>Response.json({environment:'production',revision:${JSON.stringify(sha)},service:url.includes('player')?'player':'control',status:'ok'});\n`, { mode: 0o600 });
      await writeFile(binary, `#!/usr/bin/env node
const fs=require('node:fs');const{spawn}=require('node:child_process');let sql='';
process.stdin.setEncoding('utf8');process.stdin.on('data',part=>{sql+=part});process.stdin.on('end',()=>{
 const stage=sql.startsWith('SELECT 1')?'tenant_lookup':sql.startsWith('EXPLAIN')?'inventory_explain':'inventory_metadata';
 fs.appendFileSync(process.env.PROBE_TEST_STAGES,stage+'\\n',{mode:0o600});
 if(stage==='tenant_lookup'){process.stdout.write('[{"database_ready":1,"tenant_active":true}]',()=>process.exit(0));return;}
 if(stage===process.env.PROBE_TEST_CANCEL_PHASE){const descendant=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore'});fs.writeFileSync(process.env.PROBE_TEST_PIDS,JSON.stringify({wrapper:process.pid,descendant:descendant.pid}),{mode:0o600});setInterval(()=>{},1000);return;}
 process.stdout.write(JSON.stringify([{report:JSON.parse(process.env.PROBE_TEST_STATS)}]),()=>process.exit(0));
});\n`, { mode: 0o700 });
      await chmod(binary, 0o700);
      child = spawn(process.execPath, [fileURLToPath(new URL("./probe-publication-runtime.mjs", import.meta.url)), "production", sha, tenant], {
        env: { ...process.env, ...environment(), PATH: `${directory}${delimiter}${process.env.PATH}`, NODE_OPTIONS: `--import=${pathToFileURL(hook).href}`,
          RUNNER_TEMP: directory, PROBE_TEST_CANCEL_PHASE: phase, PROBE_TEST_PIDS: marker, PROBE_TEST_STAGES: stages, PROBE_TEST_STATS: JSON.stringify(stats()) },
        stdio: ["ignore", "pipe", "pipe"]
      });
      let stdout = ""; child.stdout.on("data", (part) => { stdout += part; }); child.stderr.resume();
      const closed = new Promise((resolve, reject) => { child.once("close", (code, terminationSignal) => resolve({ code, signal: terminationSignal })); child.once("error", reject); });
      for (let poll = 0; poll < 500; poll++) {
        try { const pids = JSON.parse(await readFile(marker, "utf8")); wrapperPid = pids.wrapper; descendantPid = pids.descendant; break; }
        catch { await delay(10); }
      }
      assert.equal(Number.isInteger(wrapperPid), true); assert.equal(Number.isInteger(descendantPid), true);
      assert.equal(await alive(wrapperPid), true); assert.equal(await alive(descendantPid), true);
      assert.equal(child.kill(signal), true);
      const terminal = await closed;
      assert.equal(terminal.code, exitCode); assert.equal(terminal.signal, null);
      for (let poll = 0; poll < 100 && (await alive(wrapperPid) || await alive(descendantPid)); poll++) await delay(10);
      assert.equal(await alive(wrapperPid), false); assert.equal(await alive(descendantPid), false);
      const report = JSON.parse(stdout); assert.equal(report.code, "PROBE_CANCELLED"); assert.equal(report.verdict, "UNPROVEN"); privateOutput(report);
      const observedStages = (await readFile(stages, "utf8")).trim().split("\n");
      assert.deepEqual(observedStages, phase === "inventory_metadata" ? ["tenant_lookup", "inventory_metadata"] : ["tenant_lookup", "inventory_metadata", "inventory_explain"]);
    } finally {
      if (child?.exitCode === null && child.signalCode === null) child.kill("SIGTERM");
      if (Number.isInteger(wrapperPid)) { try { process.kill(-wrapperPid, "SIGKILL"); } catch { /* Test-owned group already stopped. */ } }
      await rm(directory, { recursive: true, force: true });
    }
  });
}
