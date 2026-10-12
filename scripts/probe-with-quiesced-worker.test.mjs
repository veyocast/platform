import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { chmod, mkdir, mkdtemp, readFile, rename, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, delimiter, dirname, join } from "node:path";
import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";
import { test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const script = join(dirname(fileURLToPath(import.meta.url)), "probe-with-quiesced-worker.sh");
const revision = "a".repeat(40), tenant = "11111111-1111-1111-1111-111111111111", worker = "b".repeat(64);
const privateValue = "PRIVATE_DOCKER_OR_NODE_CREDENTIAL";
const realNode = process.execPath;

async function fixture(scenario = "success") {
  const root = await mkdtemp(join(tmpdir(), "quiesced-worker-test-")), bin = join(root, "bin");
  await mkdir(bin, { mode: 0o700 });
  const traceFile = join(root, "trace.jsonl"), stateFile = join(root, "state.json");
  await writeFile(traceFile, "", { mode: 0o600 });
  await writeFile(stateFile, JSON.stringify({ running: true, stops: 0, starts: 0 }), { mode: 0o600 });
  const common = `const fs=require('node:fs');const log=(value)=>fs.appendFileSync(process.env.FIXTURE_TRACE,JSON.stringify(value)+'\\n');`;
  const docker = `#!${realNode}
${common}
const args=process.argv.slice(2),kind=args[0],scenario=process.env.FIXTURE_SCENARIO;
const state=JSON.parse(fs.readFileSync(process.env.FIXTURE_STATE,'utf8'));
const save=()=>fs.writeFileSync(process.env.FIXTURE_STATE,JSON.stringify(state));
log({kind:'docker',args});
const fail=(code=39)=>{process.stderr.write(${JSON.stringify(privateValue)});process.exit(code)};
if(kind==='ps'){
 if(scenario==='ps-fail')fail();
 if(scenario==='ps-hang'){setInterval(()=>{},1000);return;}
 if(scenario==='missing')return;
 if(scenario==='multiple'){process.stdout.write(${JSON.stringify(worker + "\n" + "c".repeat(64))});return;}
 if(scenario==='malformed-id'){process.stdout.write('PRIVATE_INVALID_ID');return;}
 process.stdout.write(${JSON.stringify(worker)});return;
}
if(kind==='inspect'){
 if(scenario==='identity-fail'&&state.stops===0)fail();
 if(args[2]==='{{.State.Running}}'){
  if(scenario==='restore-inspect-fail'&&state.starts>0)fail();
  process.stdout.write(String(state.running));return;
 }
 const image=scenario==='wrong-image'?'unowned-image':${JSON.stringify("veyocast-media-worker:" + revision)};
 const project=scenario==='wrong-label'?'veyocast-unowned-worker':'veyocast-'+process.env.FIXTURE_TARGET+'-worker';
 const running=scenario==='not-running'?false:state.running;
 process.stdout.write(${JSON.stringify(worker)}+'|'+image+'|'+running+'|'+project+'|media-worker');return;
}
if(kind==='stop'){
 state.stops++;save();
 if(scenario==='stop-fail-first'&&state.stops===1){state.running=true;save();fail(42);}
 if(scenario==='restore-stop-fail'){state.running=true;save();fail(42);}
 const stop=()=>{state.running=false;save();process.stdout.write(${JSON.stringify(worker)});};
 if(scenario==='stop-delay'&&state.stops===1){setTimeout(stop,250);return;}
 stop();return;
}
if(kind==='start'){
 state.starts++;save();
 if(scenario==='restore-start-fail')fail(39);
 const start=()=>{state.running=true;save();process.stdout.write(${JSON.stringify(worker)});};
 if(scenario==='restore-delay'){setTimeout(start,250);return;}
 start();return;
}
fail();
`;
  const node = `#!${realNode}
${common}
const{spawn}=require('node:child_process');const args=process.argv.slice(2);
log({kind:'probe',pid:process.pid,args,environmentPreserved:process.env.SUPABASE_DB_URL===${JSON.stringify(privateValue)}&&process.env.SUPABASE_SERVICE_ROLE_KEY===${JSON.stringify(privateValue)}});
process.stderr.write(${JSON.stringify(privateValue)});
if(['probe-hang','deadline','probe-ignore-term','restore-delay'].includes(process.env.FIXTURE_SCENARIO)){
 const child=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore'});
 log({kind:'descendant',pid:child.pid});
 process.on('SIGTERM',()=>{log({kind:'probe-term'});if(process.env.FIXTURE_SCENARIO!=='probe-ignore-term')process.exit(143)});
 setInterval(()=>{},1000);return;
}
process.stdout.write(JSON.stringify({event:'fixture_probe',code:'SAFE'}));
process.exit(Number(process.env.FIXTURE_PROBE_EXIT));
`;
  for (const [name, value] of [["docker", docker], ["node", node]]) {
    const path = join(bin, name); await writeFile(path, value, { mode: 0o700 }); await chmod(path, 0o700);
  }
  if (scenario === "deadline") {
    await writeFile(join(bin, "sleep"), `#!${realNode}\n${common}\nconst seconds=Number(process.argv[2]);log({kind:'sleep',seconds});setTimeout(()=>{},[190,80].includes(seconds)?100:seconds*1000);\n`, { mode: 0o700 });
  }
  if (scenario === "foreign-lock-owner") {
    await writeFile(join(bin, "stat"), `#!${realNode}\nprocess.stdout.write(${JSON.stringify(`${process.getuid() === 0 ? 1 : 0} 700`)});\n`, { mode: 0o700 });
  }
  const env = { ...process.env, PATH: `${bin}${delimiter}${process.env.PATH}`, GITHUB_REF: "refs/heads/main",
    QUIESCED_PROBE_JOB_STARTED_AT: String(Math.floor(Date.now() / 1000)),
    FIXTURE_TRACE: traceFile, FIXTURE_STATE: stateFile, FIXTURE_SCENARIO: scenario, FIXTURE_TARGET: "production", FIXTURE_PROBE_EXIT: "0",
    SUPABASE_DB_URL: privateValue, SUPABASE_SERVICE_ROLE_KEY: privateValue };
  const children = [];
  return { root, env, children,
    trace: async () => (await readFile(traceFile, "utf8")).split("\n").filter(Boolean).map((line) => JSON.parse(line)),
    state: async () => JSON.parse(await readFile(stateFile, "utf8")),
    async close() {
      for (const child of children) if (child.exitCode === null && child.signalCode === null) child.kill("SIGTERM");
      await Promise.all(children.map((child) => child.finished));
      await rm(root, { recursive: true, force: true });
    }
  };
}
function launch(f, args = ["publication", "production", revision, tenant], extraEnv = {}) {
  const child = spawn("bash", [script, ...args], { env: { ...f.env, ...extraEnv }, stdio: ["ignore", "pipe", "pipe"] });
  let stdout = "", stderr = "";
  child.stdout.on("data", (part) => { stdout += part; }); child.stderr.on("data", (part) => { stderr += part; });
  child.finished = new Promise((resolve, reject) => {
    child.once("error", reject); child.once("close", (code, signal) => resolve({ code, signal, stdout, stderr }));
  });
  f.children.push(child); return child;
}
async function reached(f, predicate) {
  for (let poll = 0; poll < 300; poll++) { const trace = await f.trace(); if (predicate(trace)) return trace; await delay(10); }
  throw new Error("controlled_fixture_phase_not_reached");
}
async function alive(pid) {
  try { const value = await readFile(`/proc/${pid}/stat`, "utf8"); return value.slice(value.lastIndexOf(")") + 2).split(" ")[0] !== "Z"; }
  catch { return false; }
}
function privateOutput(result) {
  for (const value of [privateValue, worker, "PRIVATE_INVALID_ID", "unowned-image"]) assert.equal((result.stdout + result.stderr).includes(value), false);
}
function dockerCalls(trace, kind) { return trace.filter((item) => item.kind === "docker" && item.args[0] === kind); }

for (const selector of ["publication", "runtime"]) {
  test(`${selector} uses only the fixed reviewed entrypoint and restores the same worker on success`, async () => {
    const f = await fixture();
    try {
      const result = await launch(f, [selector, "production", revision, tenant]).finished;
      assert.equal(result.code, 0); assert.equal(result.signal, null); privateOutput(result);
      const trace = await f.trace(), probe = trace.find((item) => item.kind === "probe");
      assert.equal(basename(probe.args[0]), selector === "publication" ? "probe-publication-runtime.mjs" : "probe-runtime-database.mjs");
      assert.deepEqual(probe.args.slice(1), ["production", revision, tenant]); assert.equal(probe.environmentPreserved, true);
      assert.equal(dockerCalls(trace, "stop").length, 1); assert.deepEqual(dockerCalls(trace, "stop")[0].args.slice(1), ["--time", "20", worker]);
      assert.deepEqual(dockerCalls(trace, "start").map((item) => item.args), [["start", worker]]);
      assert.equal((await f.state()).running, true); assert.match(result.stderr, /PROBE_WORKER_RESTORED/);
    } finally { await f.close(); }
  });
}

test("staging discovery is bound to its exact Compose project", async () => {
  const f = await fixture();
  try {
    const result = await launch(f, ["runtime", "staging", revision, tenant], { FIXTURE_TARGET: "staging" }).finished;
    assert.equal(result.code, 0); privateOutput(result);
    const trace = await f.trace(); assert.ok(dockerCalls(trace, "ps")[0].args.includes("label=com.docker.compose.project=veyocast-staging-worker"));
    assert.equal((await f.state()).running, true);
  } finally { await f.close(); }
});

test("every invalid selector, environment, SHA, tenant or trusted-main scope rejects before Docker", async () => {
  const f = await fixture();
  try {
    for (const args of [[], ["arbitrary", "production", revision, tenant], ["runtime", "invalid", revision, tenant],
      ["runtime", "production", revision.toUpperCase(), tenant], ["runtime", "production", "$(PRIVATE_COMMAND)", tenant],
      ["runtime", "production", revision, "' OR true; --"], ["runtime", "production", revision, tenant, "extra"]]) {
      const result = await launch(f, args).finished; assert.equal(result.code, 2); assert.match(result.stderr, /PROBE_SCOPE_INVALID/); privateOutput(result);
    }
    const result = await launch(f, undefined, { GITHUB_REF: "refs/pull/1/merge" }).finished;
    assert.equal(result.code, 2); assert.deepEqual(await f.trace(), []); privateOutput(result);
  } finally { await f.close(); }
});

test("missing job start time rejects before discovery or worker mutation", async () => {
  const f = await fixture(); delete f.env.QUIESCED_PROBE_JOB_STARTED_AT;
  try {
    const result = await launch(f).finished; assert.equal(result.code, 1); assert.match(result.stderr, /PROBE_JOB_BUDGET_UNPROVEN/); privateOutput(result);
    assert.deepEqual(await f.trace(), []); assert.equal((await f.state()).running, true);
  } finally { await f.close(); }
});

test("invalid job start times reject before discovery without evaluating caller text", async () => {
  const f = await fixture();
  try {
    for (const value of ["", "0", "0001234567", "-1", "1e9", "99999999999", "$(PRIVATE_COMMAND)", "1+1"]) {
      const result = await launch(f, undefined, { QUIESCED_PROBE_JOB_STARTED_AT: value }).finished;
      assert.equal(result.code, 1); assert.match(result.stderr, /PROBE_JOB_BUDGET_UNPROVEN/); privateOutput(result);
    }
    assert.deepEqual(await f.trace(), []); assert.equal((await f.state()).running, true);
  } finally { await f.close(); }
});

test("a future job start time cannot authorize any stop, start or diagnostic", async () => {
  const f = await fixture();
  try {
    const result = await launch(f, undefined, { QUIESCED_PROBE_JOB_STARTED_AT: String(Math.floor(Date.now() / 1000) + 3600) }).finished;
    assert.equal(result.code, 1); assert.match(result.stderr, /PROBE_JOB_BUDGET_UNPROVEN/); privateOutput(result);
    const trace = await f.trace(); assert.equal(dockerCalls(trace, "stop").length, 0); assert.equal(dockerCalls(trace, "start").length, 0);
    assert.equal(trace.some((item) => item.kind === "probe"), false); assert.equal((await f.state()).running, true);
  } finally { await f.close(); }
});

for (const [selector, ceiling] of [["publication", 190], ["runtime", 80]]) {
  test(`${selector} rejects a real stale job timestamp before arming any worker mutation`, async () => {
    const f = await fixture();
    try {
      const age = 300 - (ceiling + 60) + 2;
      const result = await launch(f, [selector, "production", revision, tenant], { QUIESCED_PROBE_JOB_STARTED_AT: String(Math.floor(Date.now() / 1000) - age) }).finished;
      assert.equal(result.code, 1); assert.match(result.stderr, /PROBE_JOB_BUDGET_INSUFFICIENT/); privateOutput(result);
      const trace = await f.trace(); assert.equal(dockerCalls(trace, "stop").length, 0); assert.equal(dockerCalls(trace, "start").length, 0);
      assert.equal(trace.some((item) => item.kind === "probe"), false); assert.equal((await f.state()).running, true);
    } finally { await f.close(); }
  });

  test(`${selector} accepts a real elapsed setup only while its operation plus 60-second reserve fits`, async () => {
    const f = await fixture();
    try {
      const age = 300 - (ceiling + 60) - 10;
      const result = await launch(f, [selector, "production", revision, tenant], { QUIESCED_PROBE_JOB_STARTED_AT: String(Math.floor(Date.now() / 1000) - age) }).finished;
      assert.equal(result.code, 0); privateOutput(result);
      assert.equal(dockerCalls(await f.trace(), "stop").length, 1); assert.equal(dockerCalls(await f.trace(), "start").length, 1);
      assert.equal((await f.state()).running, true);
    } finally { await f.close(); }
  });
}

test("foreign lock-directory ownership rejects before any Docker or diagnostic call", async () => {
  const f = await fixture("foreign-lock-owner");
  try {
    const result = await launch(f).finished; assert.equal(result.code, 1); assert.match(result.stderr, /PROBE_LOCK_UNPROVEN/); privateOutput(result);
    assert.deepEqual(await f.trace(), []);
  } finally { await f.close(); }
});

test("a symlink lock cannot redirect writes into another file", async () => {
  const f = await fixture(), lockRoot = `/tmp/veyocast-quiesced-worker-${process.getuid()}`, lock = join(lockRoot, "staging.lock"), backup = join(f.root, "owned-lock-inode"), target = join(f.root, "private-target");
  let moved = false;
  try {
    await mkdir(lockRoot, { recursive: true, mode: 0o700 });
    try { await writeFile(lock, "", { flag: "wx", mode: 0o600 }); } catch (error) { if (error.code !== "EEXIST") throw error; }
    await rename(lock, backup); moved = true; await writeFile(target, privateValue, { mode: 0o600 }); await symlink(target, lock);
    const result = await launch(f, ["runtime", "staging", revision, tenant], { FIXTURE_TARGET: "staging" }).finished;
    assert.equal(result.code, 1); assert.match(result.stderr, /PROBE_LOCK_UNPROVEN/); privateOutput(result);
    assert.equal(await readFile(target, "utf8"), privateValue); assert.deepEqual(await f.trace(), []);
  } finally {
    if (moved) { await rm(lock, { force: true }); await rename(backup, lock); }
    await f.close();
  }
});

for (const scenario of ["ps-fail", "missing", "multiple", "malformed-id", "identity-fail", "wrong-image", "wrong-label", "not-running"]) {
  test(`${scenario} cannot stop, restart or invoke a diagnostic for an unproven worker`, async () => {
    const f = await fixture(scenario);
    try {
      const result = await launch(f).finished; assert.equal(result.code, 1); privateOutput(result);
      const trace = await f.trace(); assert.equal(dockerCalls(trace, "stop").length, 0); assert.equal(dockerCalls(trace, "start").length, 0);
      assert.equal(trace.some((item) => item.kind === "probe"), false);
    } finally { await f.close(); }
  });
}

test("a hanging Docker discovery is actually bounded and never mutates a worker", { timeout: 6000 }, async () => {
  const f = await fixture("ps-hang");
  try {
    const started = Date.now(), result = await launch(f).finished;
    assert.equal(result.code, 1); assert.ok(Date.now() - started < 5000); privateOutput(result);
    assert.match(result.stderr, /PROBE_WORKER_READ_FAILED/); assert.equal(dockerCalls(await f.trace(), "start").length, 0);
  } finally { await f.close(); }
});

test("diagnostic failure exit stays unchanged after successful restoration", async () => {
  const f = await fixture();
  try {
    const result = await launch(f, undefined, { FIXTURE_PROBE_EXIT: "17" }).finished;
    assert.equal(result.code, 17); assert.match(result.stderr, /PROBE_WORKER_RESTORED/); privateOutput(result);
    assert.equal((await f.state()).running, true);
  } finally { await f.close(); }
});

test("failed first stop completes the daemon drain before one same-container restoration", async () => {
  const f = await fixture("stop-fail-first");
  try {
    const result = await launch(f).finished; assert.equal(result.code, 1); privateOutput(result);
    const trace = await f.trace(); assert.equal(dockerCalls(trace, "stop").length, 2); assert.equal(dockerCalls(trace, "start").length, 1);
    assert.equal(trace.some((item) => item.kind === "probe"), false); assert.equal((await f.state()).running, true);
    assert.match(result.stderr, /PROBE_WORKER_STOP_FAILED/); assert.match(result.stderr, /PROBE_WORKER_RESTORED/);
  } finally { await f.close(); }
});

for (const scenario of ["restore-start-fail", "restore-inspect-fail", "restore-stop-fail"]) {
  test(`${scenario} cannot report success and masks Docker failure details`, async () => {
    const f = await fixture(scenario);
    try {
      const result = await launch(f).finished; assert.equal(result.code, 1); assert.match(result.stderr, /PROBE_WORKER_RESTORE_FAILED/); privateOutput(result);
      assert.equal(dockerCalls(await f.trace(), "start").length, 1); assert.doesNotMatch(result.stderr, /PROBE_WORKER_RESTORED"/);
    } finally { await f.close(); }
  });
}

test("restoration failure retains the original nonzero diagnostic exit", async () => {
  const f = await fixture("restore-start-fail");
  try {
    const result = await launch(f, undefined, { FIXTURE_PROBE_EXIT: "19" }).finished;
    assert.equal(result.code, 19); assert.match(result.stderr, /PROBE_WORKER_RESTORE_FAILED/); privateOutput(result);
  } finally { await f.close(); }
});

for (const [signal, code] of [["SIGINT", 130], ["SIGTERM", 143]]) {
  test(`actual ${signal} restores before cancelling the owned hanging Node and descendant`, { skip: process.platform !== "linux", timeout: 8000 }, async () => {
    const f = await fixture("probe-hang");
    try {
      const child = launch(f), started = await reached(f, (trace) => trace.some((item) => item.kind === "descendant"));
      const probe = started.find((item) => item.kind === "probe"), descendant = started.find((item) => item.kind === "descendant");
      assert.equal(await alive(probe.pid), true); assert.equal(await alive(descendant.pid), true); assert.equal(child.kill(signal), true);
      const result = await child.finished; assert.equal(result.code, code); assert.equal(result.signal, null); privateOutput(result);
      const trace = await f.trace(), restore = trace.findIndex((item) => item.kind === "docker" && item.args[0] === "start"), cancelled = trace.findIndex((item) => item.kind === "probe-term");
      assert.ok(restore >= 0 && cancelled > restore); assert.equal((await f.state()).running, true);
      assert.equal(await alive(probe.pid), false); assert.equal(await alive(descendant.pid), false);
      assert.equal(dockerCalls(trace, "start").length, 1);
    } finally { await f.close(); }
  });
}

test("a second TERM cannot interrupt same-worker restoration or replace the original INT exit", { timeout: 8000 }, async () => {
  const f = await fixture("restore-delay");
  try {
    const child = launch(f); await reached(f, (trace) => trace.some((item) => item.kind === "descendant")); child.kill("SIGINT");
    await reached(f, (trace) => dockerCalls(trace, "start").length === 1); assert.equal(child.kill("SIGTERM"), true);
    const result = await child.finished; assert.equal(result.code, 130); privateOutput(result);
    assert.equal((await f.state()).running, true); assert.equal(dockerCalls(await f.trace(), "start").length, 1);
    assert.match(result.stderr, /PROBE_WORKER_RESTORED/);
  } finally { await f.close(); }
});

test("actual cancellation during the first stop completes it before same-ID restoration", { timeout: 8000 }, async () => {
  const f = await fixture("stop-delay");
  try {
    const child = launch(f); await reached(f, (trace) => dockerCalls(trace, "stop").length === 1); child.kill("SIGTERM");
    const result = await child.finished; assert.equal(result.code, 143); privateOutput(result);
    assert.equal((await f.state()).running, true); const trace = await f.trace();
    assert.equal(dockerCalls(trace, "stop").length, 2); assert.deepEqual(dockerCalls(trace, "start").map((item) => item.args), [["start", worker]]);
    assert.equal(trace.some((item) => item.kind === "probe"), false);
  } finally { await f.close(); }
});

test("nonblocking host lock prevents a second diagnostic from stopping or restoring the first worker", { timeout: 8000 }, async () => {
  const first = await fixture("probe-hang"), second = await fixture();
  try {
    const owner = launch(first); await reached(first, (trace) => trace.some((item) => item.kind === "descendant"));
    const rejected = await launch(second, ["runtime", "production", revision, tenant]).finished;
    assert.equal(rejected.code, 75); assert.match(rejected.stderr, /PROBE_QUIESCE_BUSY/); assert.deepEqual(await second.trace(), []); privateOutput(rejected);
    owner.kill("SIGTERM"); assert.equal((await owner.finished).code, 143); assert.equal((await first.state()).running, true);
  } finally { await first.close(); await second.close(); }
});

for (const [selector, ceiling] of [["publication", 190], ["runtime", 80]]) {
  test(`${selector} owned operation deadline restores first, keeps failure124 and preserves its fixed ceiling`, { timeout: 8000 }, async () => {
    const f = await fixture("deadline");
    try {
      const result = await launch(f, [selector, "production", revision, tenant]).finished;
      assert.equal(result.code, 124); assert.match(result.stderr, /PROBE_OPERATION_TIMEOUT/); privateOutput(result);
      assert.equal((await f.state()).running, true); const trace = await f.trace(); assert.ok(trace.some((item) => item.kind === "sleep" && item.seconds === ceiling));
      const restore = trace.findIndex((item) => item.kind === "docker" && item.args[0] === "start"), cancelled = trace.findIndex((item) => item.kind === "probe-term");
      assert.ok(restore >= 0 && cancelled > restore);
    } finally { await f.close(); }
  });
}

test("an unresponsive owned Node still stops with its descendant after worker restoration", { skip: process.platform !== "linux", timeout: 8000 }, async () => {
  const f = await fixture("probe-ignore-term");
  try {
    const child = launch(f), started = await reached(f, (trace) => trace.some((item) => item.kind === "descendant"));
    child.kill("SIGTERM"); const result = await child.finished; assert.equal(result.code, 143); privateOutput(result);
    assert.equal((await f.state()).running, true);
    for (const item of started.filter((item) => ["probe", "descendant"].includes(item.kind))) assert.equal(await alive(item.pid), false);
  } finally { await f.close(); }
});

test("helper cancellation restores first and the real runtime CLI stops its separately owned SQL group", { skip: process.platform !== "linux", timeout: 8000 }, async () => {
  const f = await fixture(), project = "abcdefghijklmnopqrst", hook = join(f.root, "fetch-hook.mjs");
  let ownedSql;
  try {
    // Run the actual fixed entrypoint; only its network and pinned CLI are fixtures.
    await rm(join(f.root, "bin", "node"));
    await writeFile(hook, `import {appendFileSync} from 'node:fs';
const log=(value)=>appendFileSync(process.env.FIXTURE_TRACE,JSON.stringify(value)+'\\n');
if(process.argv[1]?.endsWith('probe-runtime-database.mjs')){
 log({kind:'actual-runtime',pid:process.pid});
 process.on('SIGTERM',()=>log({kind:'actual-runtime-term'}));
}
globalThis.fetch=async(url)=>{
 const phase=url.endsWith('/rest/v1/')?'gateway':url.includes('/rest/v1/tenants?')?'rest':'health';
 log({kind:'actual-fetch',phase});
 if(phase==='gateway')return new Response(${JSON.stringify(privateValue)},{status:401});
 if(phase==='rest')return Response.json([{id:${JSON.stringify(tenant)},status:'active'}]);
 return Response.json({environment:'production',revision:${JSON.stringify(revision)},service:url.includes('player')?'player':'control',status:'ok'});
};
`, { mode: 0o600 });
    await writeFile(join(f.root, "bin", "pnpm"), `#!${realNode}
const fs=require('node:fs'),{spawn}=require('node:child_process');
process.stdin.resume();process.stdin.on('end',()=>{
 const child=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore'});
 fs.appendFileSync(process.env.FIXTURE_TRACE,JSON.stringify({kind:'actual-sql',pid:process.pid,descendant:child.pid})+'\\n');
 process.stderr.write(${JSON.stringify(privateValue)});setInterval(()=>{},1000);
});
`, { mode: 0o700 });
    const child = launch(f, ["runtime", "production", revision, tenant], {
      NODE_OPTIONS: `--import=${pathToFileURL(hook).href}`, RUNNER_TEMP: f.root,
      SUPABASE_PROJECT_REF: project, NEXT_PUBLIC_SUPABASE_URL: `https://${project}.supabase.co/`,
      SUPABASE_DB_URL: `postgresql://fixture:fixture@db.${project}.supabase.co:5432/postgres?sslmode=verify-full`,
      SUPABASE_SERVICE_ROLE_KEY: "sb_secret_fixture_test_only"
    });
    const started = await reached(f, (trace) => trace.some((item) => item.kind === "actual-sql"));
    ownedSql = started.find((item) => item.kind === "actual-sql");
    assert.equal(await alive(ownedSql.pid), true); assert.equal(await alive(ownedSql.descendant), true);
    assert.equal(child.kill("SIGTERM"), true);
    const result = await child.finished; assert.equal(result.code, 143); assert.equal(result.signal, null); privateOutput(result);
    const trace = await f.trace(), restore = trace.findIndex((item) => item.kind === "docker" && item.args[0] === "start"), cancelled = trace.findIndex((item) => item.kind === "actual-runtime-term");
    assert.ok(restore >= 0 && cancelled > restore); assert.equal((await f.state()).running, true);
    assert.equal(trace.some((item) => item.kind === "actual-fetch" && item.phase === "rest"), false);
    assert.equal(await alive(ownedSql.pid), false); assert.equal(await alive(ownedSql.descendant), false);
    const report = JSON.parse(result.stdout); assert.equal(report.code, "PROBE_CANCELLED"); assert.equal(report.verdict, "UNPROVEN");
    assert.deepEqual(JSON.parse(await readFile(join(f.root, "runtime-database-probe.json"), "utf8")), report);
    assert.doesNotMatch(result.stdout + result.stderr, /sb_secret_fixture_test_only|postgresql:|fixture:fixture/);
  } finally {
    // A failed assertion must not leave the fixture's detached SQL session behind.
    if (ownedSql) { try { process.kill(-ownedSql.pid, "SIGKILL"); } catch { /* Already stopped by the actual adapter. */ } }
    await f.close();
  }
});
