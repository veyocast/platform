import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { performance } from "node:perf_hooks";
import process from "node:process";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createGithubClient, INCIDENT, recoverStuckDeploy, runCli, validateExecutionEnvironment, validatePreflight } from "./recover-stuck-deploy.mjs";

const EXECUTION_SHA = "e".repeat(40);
const NOW = Date.parse("2026-11-09T21:00:00Z");
const TOKEN = "ghs_test_fixture_not_a_real_credential";
const ROOT = "/repos/veyocast/platform";
const RUN = `${ROOT}/actions/runs/${INCIDENT.runId}`;
const SUITE = `${ROOT}/check-suites/${INCIDENT.suiteId}`;
const JOBS = `${RUN}/jobs?per_page=100`;
const MAIN = `${ROOT}/commits/main`;
const COMPARE = `${ROOT}/compare/${INCIDENT.sha}...${EXECUTION_SHA}`;

function fixture() {
  return {
    run: { id: INCIDENT.runId, check_suite_id: INCIDENT.suiteId, repository: { full_name: INCIDENT.repository }, head_repository: { full_name: INCIDENT.repository }, path: INCIDENT.workflowPath, event: "push", head_branch: "main", head_sha: INCIDENT.sha, status: "waiting", conclusion: null, created_at: "2026-11-09T17:59:53Z" },
    suite: { id: INCIDENT.suiteId, head_sha: INCIDENT.sha, head_branch: "main", status: "waiting", conclusion: null, rerequestable: true, app: { id: INCIDENT.appId, slug: INCIDENT.appSlug }, created_at: "2026-11-09T17:59:53Z" },
    jobs: { total_count: 1, jobs: [{ id: INCIDENT.jobId, run_id: INCIDENT.runId, name: "Preflight", status: "waiting", conclusion: null, steps: [], runner_id: null, runner_name: null }] },
    main: { sha: EXECUTION_SHA },
    comparison: { status: "ahead", base_commit: { sha: INCIDENT.sha }, merge_base_commit: { sha: INCIDENT.sha } }
  };
}
function environment() {
  return { GITHUB_REPOSITORY: INCIDENT.repository, GITHUB_REF: "refs/heads/main", GITHUB_EVENT_NAME: "workflow_dispatch", GITHUB_SHA: EXECUTION_SHA, RECOVER_STUCK_DEPLOY: "ROOT_NATIVE_REREQUEST", GITHUB_TOKEN: TOKEN };
}
function json(value, status = 200) {
  return new globalThis.Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } });
}
function fakeHttp({ data = fixture(), onGet, onPost } = {}) {
  const requests = [];
  const counts = new Map();
  const fetchImpl = async (url, options) => {
    const parsed = new globalThis.URL(url);
    const path = parsed.pathname + parsed.search;
    assert.equal(parsed.origin, "https://api.github.com");
    assert.equal(options.redirect, "manual");
    assert.equal(options.headers.Authorization, `Bearer ${TOKEN}`);
    assert.ok(options.signal instanceof globalThis.AbortSignal);
    assert.equal(options.body, undefined);
    requests.push({ method: options.method, path });
    if (options.method === "POST") {
      assert.equal(path, `${SUITE}/rerequest`);
      return onPost ? onPost() : new globalThis.Response(null, { status: 201 });
    }
    assert.equal(options.method, "GET");
    const count = (counts.get(path) ?? 0) + 1;
    counts.set(path, count);
    if (onGet) {
      const replacement = onGet(path, count, data);
      if (replacement !== undefined) return replacement;
    }
    const key = { [RUN]: "run", [SUITE]: "suite", [JOBS]: "jobs", [MAIN]: "main", [COMPARE]: "comparison" }[path];
    assert.ok(key, "Only the five fixed read-only endpoints may be fetched");
    return json(data[key]);
  };
  return { fetchImpl, requests, posts: () => requests.filter((x) => x.method === "POST") };
}
function execute(http, extra = {}) {
  return recoverStuckDeploy({ environment: environment(), fetchImpl: http.fetchImpl, nowMs: () => NOW, ...extra });
}

test("import and default CLI never fetch or read GitHub credentials", async () => {
  const output = [];
  const inaccessible = new Proxy({}, { get() { throw Error("ENVIRONMENT_MUST_NOT_BE_READ"); } });
  const result = await runCli([], inaccessible, { write: (line) => output.push(line), fetchImpl: () => { throw Error("NETWORK_MUST_NOT_BE_USED"); } });
  assert.equal(result.externalAccess, false);
  assert.equal(result.environmentRead, false);
  assert.equal(output.length, 1);
  const source = `const original = process.env; process.env = new Proxy(original, {get(target,key){if(String(key).startsWith('GITHUB_') || key==='RECOVER_STUCK_DEPLOY') throw Error('ENV_READ'); return Reflect.get(target,key);}}); globalThis.fetch=()=>{throw Error('NETWORK')}; await import(${JSON.stringify(new globalThis.URL("./recover-stuck-deploy.mjs", import.meta.url).href)}); process.env=original;`;
  const child = spawnSync(process.execPath, ["--input-type=module", "-e", source], { encoding: "utf8", timeout: 5_000 });
  assert.equal(child.status, 0, child.stderr);
  assert.equal(child.stdout, "");
});

test("all explicit environment guards reject before any HTTP", async () => {
  for (const [key, value] of [["GITHUB_REPOSITORY", "other/platform"], ["GITHUB_REF", "refs/pull/1/merge"], ["GITHUB_EVENT_NAME", "push"], ["RECOVER_STUCK_DEPLOY", ""], ["GITHUB_SHA", INCIDENT.sha], ["GITHUB_SHA", "invalid"], ["GITHUB_TOKEN", ""], ["GITHUB_TOKEN", `${TOKEN}\n`]]) {
    const http = fakeHttp();
    await assert.rejects(recoverStuckDeploy({ environment: { ...environment(), [key]: value }, fetchImpl: http.fetchImpl }), { name: "RecoveryFault" });
    assert.equal(http.requests.length, 0, key);
  }
  assert.throws(() => validateExecutionEnvironment(undefined), { code: "REPOSITORY_MISMATCH" });
});

test("exact waiting incident and strictly bounded age validate", () => {
  assert.equal(validatePreflight(fixture(), { nowMs: NOW, executionSha: EXECUTION_SHA }).zeroExecutedSteps, true);
  const created = Date.parse(fixture().run.created_at);
  for (const age of [INCIDENT.minimumAgeMs, INCIDENT.maximumAgeMs]) validatePreflight(fixture(), { nowMs: created + age, executionSha: EXECUTION_SHA });
  for (const age of [INCIDENT.minimumAgeMs - 1, INCIDENT.maximumAgeMs + 1, -1, Number.NaN]) assert.throws(() => validatePreflight(fixture(), { nowMs: created + age, executionSha: EXECUTION_SHA }), { name: "RecoveryFault" });
});

const mutations = [
  ["another run", (d) => { d.run.id++; }], ["another suite binding", (d) => { d.run.check_suite_id++; }],
  ["other repository", (d) => { d.run.repository.full_name = "tenant/other"; }], ["fork", (d) => { d.run.head_repository.full_name = "tenant/platform"; }],
  ["other workflow", (d) => { d.run.path = ".github/workflows/other.yml"; }], ["non-push incident", (d) => { d.run.event = "workflow_dispatch"; }],
  ["other branch", (d) => { d.run.head_branch = "feature"; }], ["other release", (d) => { d.run.head_sha = EXECUTION_SHA; }],
  ["running run", (d) => { d.run.status = "in_progress"; }], ["completed run", (d) => { d.run.conclusion = "cancelled"; }],
  ["invalid creation", (d) => { d.run.created_at = "unknown"; }], ["young suite", (d) => { d.suite.created_at = "2026-11-09T20:59:00Z"; }],
  ["other suite", (d) => { d.suite.id++; }], ["suite release", (d) => { d.suite.head_sha = EXECUTION_SHA; }], ["suite branch", (d) => { d.suite.head_branch = "feature"; }],
  ["suite completed", (d) => { d.suite.status = "completed"; }], ["suite conclusion", (d) => { d.suite.conclusion = "failure"; }],
  ["not rerequestable", (d) => { d.suite.rerequestable = false; }], ["other app ID", (d) => { d.suite.app.id++; }], ["other app slug", (d) => { d.suite.app.slug = "other"; }],
  ["additional job", (d) => { d.jobs.total_count++; }], ["hidden additional job", (d) => { d.jobs.jobs.push({}); }],
  ["other job", (d) => { d.jobs.jobs[0].id++; }], ["job run", (d) => { d.jobs.jobs[0].run_id++; }], ["other job name", (d) => { d.jobs.jobs[0].name = "Build immutable release"; }],
  ["started job", (d) => { d.jobs.jobs[0].status = "in_progress"; }], ["job conclusion", (d) => { d.jobs.jobs[0].conclusion = "success"; }],
  ["executed step", (d) => { d.jobs.jobs[0].steps.push({ name: "Set up job", status: "completed" }); }], ["unknown steps", (d) => { d.jobs.jobs[0].steps = null; }],
  ["assigned runner", (d) => { d.jobs.jobs[0].runner_id = 23; }], ["runner name", (d) => { d.jobs.jobs[0].runner_name = "veyocast-staging-01"; }],
  ["main moved", (d) => { d.main.sha = "f".repeat(40); }], ["comparison not ahead", (d) => { d.comparison.status = "diverged"; }],
  ["wrong comparison base", (d) => { d.comparison.base_commit.sha = EXECUTION_SHA; }], ["not an ancestor", (d) => { d.comparison.merge_base_commit.sha = EXECUTION_SHA; }]
];
for (const [name, mutate] of mutations) {
  test(`reject ${name} with zero POSTs`, async () => {
    const data = fixture(); mutate(data);
    const http = fakeHttp({ data });
    await assert.rejects(execute(http), { name: "RecoveryFault" });
    assert.equal(http.posts().length, 0);
  });
}

test("single native POST follows two full scope checks; 201 is not recovery proof", async () => {
  const http = fakeHttp({ onGet(path, count, data) {
    if (count === 3 && path === RUN) return json({ ...data.run, status: "queued", run_attempt: 2, private: TOKEN });
    if (count === 3 && path === SUITE) return json({ ...data.suite, status: "queued", private: TOKEN });
  } });
  const result = await execute(http);
  assert.equal(http.posts().length, 1);
  const postIndex = http.requests.findIndex((x) => x.method === "POST");
  assert.equal(postIndex, 9);
  assert.equal(http.requests.length, 13);
  assert.equal(result.httpStatus, 201);
  assert.equal(result.recoveryProven, false);
  assert.equal(result.atomicFenceAvailable, false);
  assert.equal(result.readback.run.status, "queued");
  assert.equal(result.readback.run.runAttempt, 2);
  assert.ok(!JSON.stringify(result).includes(TOKEN));
});

for (const [name, mutate] of [mutations[8], mutations[25], mutations[27], mutations[29], mutations[31], mutations[17]]) {
  test(`fresh pre-POST check catches ${name}`, async () => {
    const http = fakeHttp({ onGet(path, count, data) {
      if (count === 2) {
        const changed = globalThis.structuredClone(data); mutate(changed);
        const key = { [RUN]: "run", [SUITE]: "suite", [JOBS]: "jobs", [MAIN]: "main" }[path];
        return json(changed[key]);
      }
    } });
    await assert.rejects(execute(http), { name: "RecoveryFault" });
    assert.equal(http.posts().length, 0);
  });
}

test("redirects, changed response origin, error bodies and malformed/large JSON cannot mutate", async () => {
  for (const response of [() => new globalThis.Response(TOKEN, { status: 302, headers: { location: "https://elsewhere.invalid" } }), () => json({ message: TOKEN }, 403), () => new globalThis.Response(TOKEN, { status: 200, headers: { "content-type": "application/json" } }), () => json({ secret: TOKEN + "x".repeat(262_144) }), () => new globalThis.Response("{}", { status: 200, headers: { "content-type": "text/plain" } }), () => { const r = json({}); Object.defineProperty(r, "url", { value: "https://elsewhere.invalid" }); return r; }]) {
    const http = fakeHttp({ onGet: () => response() });
    await assert.rejects(execute(http), (error) => error.name === "RecoveryFault" && !error.message.includes(TOKEN));
    assert.equal(http.posts().length, 0);
  }
});

test("fetch and streamed body deadlines are bounded even when transport ignores abort", async () => {
  for (const fetchImpl of [() => new Promise(() => {}), async () => new globalThis.Response(new globalThis.ReadableStream({ start() {} }), { headers: { "content-type": "application/json" } })]) {
    const started = performance.now();
    await assert.rejects(recoverStuckDeploy({ environment: environment(), fetchImpl, requestTimeoutMs: 15 }), { code: "HTTP_DEADLINE" });
    assert.ok(performance.now() - started < 1_000);
  }
});

test("lost POST outcome and explicit failure are never retried", async () => {
  for (const onPost of [() => new Promise(() => {}), () => { throw Error(TOKEN); }, () => json({ message: TOKEN }, 403)]) {
    const http = fakeHttp({ onPost });
    await assert.rejects(execute(http, { requestTimeoutMs: 20 }), (error) => ["REREQUEST_OUTCOME_UNKNOWN", "HTTP_REJECTED"].includes(error.code) && !error.message.includes(TOKEN));
    assert.equal(http.posts().length, 1);
  }
  const http = fakeHttp();
  const client = createGithubClient({ token: TOKEN, fetchImpl: http.fetchImpl });
  await client.rerequest();
  await assert.rejects(client.rerequest(), { code: "REREQUEST_ALREADY_ATTEMPTED" });
  assert.equal(http.posts().length, 1);
  assert.throws(() => client.compareMain("https://elsewhere.invalid"), { code: "NEW_MAIN_SHA_REQUIRED" });
});

test("readback failure preserves only confirmed POST201 and an honest unknown recovery", async () => {
  const http = fakeHttp({ onGet(path, count) { if (count === 3 && path === RUN) return json({ message: TOKEN }, 500); } });
  const result = await execute(http);
  assert.equal(result.httpStatus, 201);
  assert.deepEqual(result.readback, { available: false, code: "HTTP_REJECTED" });
  assert.equal(result.recoveryProven, false);
  assert.equal(http.posts().length, 1);
  assert.ok(!JSON.stringify(result).includes(TOKEN));
});

test("the client itself refuses a second POST after a lost first response", async () => {
  const http = fakeHttp({ onPost: () => new Promise(() => {}) });
  const client = createGithubClient({ token: TOKEN, fetchImpl: http.fetchImpl, requestTimeoutMs: 10 });
  await assert.rejects(client.rerequest(), { code: "REREQUEST_OUTCOME_UNKNOWN" });
  await assert.rejects(client.rerequest(), { code: "REREQUEST_ALREADY_ATTEMPTED" });
  assert.equal(http.posts().length, 1);
});

test("readback attempt remains unknown unless GitHub returns a positive safe integer", async () => {
  for (const run_attempt of [undefined, 0, -1, 1.5, "2", Number.MAX_SAFE_INTEGER + 1]) {
    const http = fakeHttp({ onGet(path, count, data) {
      if (count === 3 && path === RUN) return json({ ...data.run, run_attempt });
    } });
    const result = await execute(http);
    assert.equal(result.readback.run.runAttempt, null);
    assert.equal(result.recoveryProven, false);
  }
});

test("CLI rejects arguments and emits no secret/body on a failed authenticated request", async () => {
  await assert.rejects(runCli(["--execute", "--again"], environment()), { code: "ARGUMENTS_INVALID" });
  const child = spawnSync(process.execPath, [fileURLToPath(new globalThis.URL("./recover-stuck-deploy.mjs", import.meta.url)), "--execute"], { encoding: "utf8", timeout: 5_000, env: { GITHUB_REPOSITORY: "wrong", GITHUB_TOKEN: TOKEN } });
  assert.equal(child.status, 1);
  assert.equal(child.stdout, "");
  assert.deepEqual(JSON.parse(child.stderr), { event: "native_suite_rerequest_not_confirmed", code: "REPOSITORY_MISMATCH", recoveryProven: false });
  assert.ok(!child.stderr.includes(TOKEN));
});

test("actual administrative workflow retains its narrow authority and pinned main execution", async () => {
  const source = await readFile(new globalThis.URL("../.github/workflows/recover-stuck-deploy.yml", import.meta.url), "utf8");
  assert.match(source, /\non:\n {2}workflow_dispatch:\n\npermissions:\n {2}contents: read\n {2}actions: read\n {2}checks: write\n/);
  assert.match(source, /if: github\.repository == 'veyocast\/platform' && github\.ref == 'refs\/heads\/main' && github\.event_name == 'workflow_dispatch'/);
  assert.match(source, /group: recover-stuck-deploy-42669988139\n {2}cancel-in-progress: false/);
  assert.match(source, /runs-on: ubuntu-latest\n {4}timeout-minutes: 5/);
  assert.match(source, /uses: actions\/checkout@9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0/);
  assert.match(source, /ref: \$\{\{ github\.sha \}\}\n {10}persist-credentials: false/);
  assert.match(source, /uses: actions\/setup-node@820762786026740c76f36085b0efc47a31fe5020/);
  assert.equal((source.match(/node scripts\/recover-stuck-deploy\.mjs --execute/g) ?? []).length, 1);
  assert.equal((source.match(/GITHUB_TOKEN:/g) ?? []).length, 1);
  assert.match(source, /run: node scripts\/recover-stuck-deploy\.mjs --execute\n {8}env:\n {10}GITHUB_TOKEN: \$\{\{ github\.token \}\}\n {10}RECOVER_STUCK_DEPLOY: ROOT_NATIVE_REREQUEST/);
  assert.match(source, /run: node --test scripts\/recover-stuck-deploy\.test\.mjs/);
  assert.ok(!/secrets\.|environment:|actions: write|contents: write|deploy-vps|workflow_call|pull_request|repository_dispatch|schedule:|push:/.test(source));
});
