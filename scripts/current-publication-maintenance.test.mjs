import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { chmod, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";
import { test } from "node:test";
import { fileURLToPath, URL } from "node:url";

const tenant = "11111111-1111-1111-1111-111111111111";
const otherTenant = "22222222-2222-2222-2222-222222222222";
const sha = "a".repeat(40);
const workflowSha = "b".repeat(40);
const privateValue = "PRIVATE_SOURCE_RECORD";
const script = fileURLToPath(new URL("./current-publication-maintenance.mjs", import.meta.url));
const baseline = () => ({ schemaVersion: 1, tenantId: tenant, scopeReady: true,
  observedAt: "2026-10-12T10:00:00.000Z", since: null, windowValid: false,
  counts: { playlistReleases: 0, slideVersions: 0, snapshots: 0, publishedBindings: 0 },
  creationTimestampCounts: null, protectedCount: 0, protectedTruncated: false,
  protectedReleases: [], auditCount: 0, auditsTruncated: false, pruneAudits: [], outputTruncated: false });

async function run(overrides = {}, evidence = baseline(), options = {}) {
  const root = await mkdtemp(join(tmpdir(), "veyocast-publication-cli-"));
  await chmod(root, 0o700);
  try {
    const client = join(root, "pnpm"), mockFetch = join(root, "fetch.mjs");
    await writeFile(join(root, "evidence.json"), JSON.stringify(evidence), { mode: 0o600 });
    if (options.existingReport) {
      await writeFile(join(root, "publication-reclamation.json"), privateValue, { mode: 0o644 });
    }
    await writeFile(client, `#!${process.execPath}
import { readFileSync, appendFileSync } from 'node:fs';
let sql = ''; for await (const part of process.stdin) sql += part;
let phase, rows;
if (/select id,name,status from public.tenants/.test(sql)) {
  phase = 'tenant'; rows = [{ id: '${tenant}', name: 'Owned test tenant', status: 'active' }];
} else if (sql.includes("to_regclass('public.playlist_publications')")) {
  phase = 'schema'; rows = [{ available: true }];
} else if (/private.refresh_used_publication_sources_v1/.test(sql)) {
  phase = 'refresh'; rows = [{ result: { configurationChanged: false } }];
} else if (/private.cutover_current_publication_v1/.test(sql)) {
  phase = 'cutover'; rows = [{ result: { configurationChanged: false } }];
} else if (sql.includes('scopeReady') && sql.includes('pruneAudits')) {
  phase = 'reclamation'; rows = [{ report: JSON.parse(readFileSync(process.env.CLI_FIXTURE, 'utf8')) }];
} else {
  phase = 'inventory'; rows = [{ report: { observedAt: '2026-10-12T10:00:00.000Z',
    playlists: [{ id: '${otherTenant}', draftRevision: 1 }], screens: [], legacyPending: 0,
    theme: { timezone: 'Europe/Amsterdam', policy: { kind: 'fixed', mode: 'light' } }, retention: {} } }];
}
appendFileSync(process.env.CLI_JOURNAL, phase + '\\n');
if (phase === 'reclamation' && process.env.CLI_FAIL === 'true') {
  process.stdout.write(JSON.stringify({ error: { code: 'LegacyDbQueryExecError', databaseCode: '57014', message: '${privateValue}' } }));
  process.stderr.write('${privateValue}'); process.exitCode = 1;
} else process.stdout.write(JSON.stringify(rows));
`, { mode: 0o700 });
    await writeFile(mockFetch, `globalThis.fetch = async (url) => {
      const health = { revision: process.env.CLI_HEALTH_SHA, status: 'ok',
        service: url.includes('player') ? 'player' : 'control', environment: 'production' };
      return globalThis.Response.json(health);
    };`, { mode: 0o600 });
    const child = spawn(process.execPath, ["--import", mockFetch, script], { env: {
      ...process.env, PATH: `${root}:${process.env.PATH}`, GITHUB_REF: "refs/heads/main",
      GITHUB_SHA: workflowSha, PUBLICATION_OPERATION: "reclamation", TARGET_ENVIRONMENT: "production",
      TENANT_NAME: "Owned test tenant", EXPECTED_TENANT_ID: tenant, EXPECTED_RELEASE_SHA: sha,
      OPERATOR: "github:tester", REASON: "Owned CLI regression proof", OBSERVATION_SECONDS: "0",
      PLAYLIST_ID: "", EVIDENCE_SINCE: "", RUNNER_TEMP: root,
      SUPABASE_DB_URL: "postgresql://tester:PRIVATE_DB_PASSWORD@database.invalid/postgres?sslmode=require",
      CLI_HEALTH_SHA: options.healthSha ?? sha, CLI_FAIL: options.fail ? "true" : "false",
      CLI_FIXTURE: join(root, "evidence.json"), CLI_JOURNAL: join(root, "journal"), ...overrides
    }, stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    child.stdout.on("data", (part) => { output += part; });
    child.stderr.on("data", (part) => { output += part; });
    const exit = await new Promise((resolve, reject) => {
      child.once("error", reject); child.once("close", resolve);
    });
    const journal = await readFile(join(root, "journal"), "utf8").catch(() => "");
    const path = join(root, "publication-reclamation.json");
    const report = await readFile(path, "utf8").catch(() => null);
    const mode = report === null ? null : (await stat(path)).mode & 0o777;
    return { exit, output, journal, report: report === null ? null : JSON.parse(report), mode };
  } finally { await rm(root, { recursive: true, force: true }); }
}

test("reclamation CLI collects only fixed read observations and privately retains an unproven baseline", async () => {
  const result = await run();
  assert.equal(result.exit, 0, result.output);
  assert.equal(result.journal, "tenant\nschema\nreclamation\n");
  assert.equal(result.mode, 0o600);
  assert.equal(result.report.deploymentSha, sha);
  assert.equal(result.report.workflowSha, workflowSha);
  assert.equal(result.report.completionScope, "sanitized_read_observations_not_end_to_end_acceptance");
  assert.equal(result.report.evidence.status, "UNPROVEN");
  assert.equal(result.output.includes(privateValue), false);
  assert.equal(result.output.includes("PRIVATE_DB_PASSWORD"), false);
});

test("new invalid input rejects before a SQL request, including injection, missing tenant and write-mode options", async () => {
  for (const input of [
    { EVIDENCE_SINCE: "2026-10-12T00:00:00.000Z'; DELETE FROM public.tenants;--" },
    { EVIDENCE_SINCE: "2026-02-30T00:00:00.000Z" }, { EXPECTED_TENANT_ID: "" },
    { GITHUB_SHA: "unknown" }, { PLAYLIST_ID: otherTenant }, { OBSERVATION_SECONDS: "1" }
  ]) {
    const result = await run(input);
    assert.notEqual(result.exit, 0); assert.equal(result.journal, ""); assert.equal(result.report, null);
    assert.equal(result.output.includes("PRIVATE_DB_PASSWORD"), false);
  }
});

test("an earlier readable report is exclusively replaced with a fresh private file", async () => {
  const result = await run({}, baseline(), { existingReport: true });
  assert.equal(result.exit, 0, result.output); assert.equal(result.mode, 0o600);
  assert.equal(JSON.stringify(result.report).includes(privateValue), false);
  assert.equal(result.report.evidence.tenantId, tenant);
});

test("wrong deployed health fails before the evidence query and writes no evidence", async () => {
  const result = await run({}, baseline(), { healthSha: "c".repeat(40) });
  assert.notEqual(result.exit, 0); assert.equal(result.journal, "tenant\nschema\n");
  assert.equal(result.report, null); assert.match(result.output, /DEPLOYED_CONTROL_SHA_MISMATCH/);
});

test("foreign tenant evidence and private extra fields fail without uploading raw payload", async () => {
  for (const report of [{ ...baseline(), tenantId: otherTenant }, { ...baseline(), rawProvider: privateValue }]) {
    const result = await run({}, report);
    assert.notEqual(result.exit, 0); assert.equal(result.report, null);
    assert.equal(result.output.includes(privateValue), false);
  }
});

test("original SQL failure code and privacy survive the new fixed evidence phase", async () => {
  const result = await run({}, baseline(), { fail: true });
  assert.notEqual(result.exit, 0); assert.equal(result.report, null);
  assert.match(result.output, /PUBLICATION_DATABASE_QUERY_FAILED/);
  assert.match(result.output, /57014/); assert.equal(result.output.includes(privateValue), false);
  assert.equal(result.output.includes("PRIVATE_DB_PASSWORD"), false);
});

test("inventory, refresh and cutover retain their original command paths without an evidence query", async () => {
  for (const mode of ["inventory", "refresh", "cutover"]) {
    const result = await run({ PUBLICATION_OPERATION: mode });
    assert.equal(result.exit, 0, result.output); assert.equal(result.report, null);
    assert.equal(result.journal.includes("reclamation"), false);
    assert.equal(result.journal, `tenant\nschema\ninventory\n${mode === "inventory" ? "" : `${mode}\n`}inventory\n`);
  }
});
