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

async function processIdentity(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return null;
  try {
    const stat = await readFile(`/proc/${pid}/stat`, "utf8"), fields = stat.slice(stat.lastIndexOf(")") + 2).split(" ");
    return { pid, state: fields[0], parent: Number(fields[1]), group: Number(fields[2]), started: fields[19] };
  } catch { return null; }
}

async function fixture(scenario = "success", context) {
  const root = await mkdtemp(join(tmpdir(), "quiesced-worker-test-")), bin = join(root, "bin");
  await mkdir(bin, { mode: 0o700 });
  const traceFile = join(root, "trace.jsonl"), stateFile = join(root, "state.json");
  await writeFile(traceFile, "", { mode: 0o600 });
  await writeFile(stateFile, JSON.stringify({ running: true, stops: 0, starts: 0 }), { mode: 0o600 });
  const common = `const fs=require('node:fs');
const started=(pid)=>{try{const s=fs.readFileSync('/proc/'+pid+'/stat','utf8');return s.slice(s.lastIndexOf(')')+2).split(' ')[19]}catch{return null}};
const log=(value)=>{const line=JSON.stringify({...value,...(value.pid?{started:started(value.pid)}:{}),...(value.descendant?{descendantStarted:started(value.descendant)}:{})})+'\\n';for(const file of [process.env.FIXTURE_TRACE,process.env.S207_FIXTURE_PARENT_TRACE].filter(Boolean))fs.appendFileSync(file,line)};`;
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
  const children = [], owned = new Map();
  let closing = false, closePromise;
  const trace = async () => (await readFile(traceFile, "utf8")).split("\n").filter(Boolean).map((line) => JSON.parse(line));
  const remember = async (pid, kind, started) => {
    const identity = await processIdentity(pid);
    if (!identity || identity.state === "Z" || (started !== undefined && identity.started !== started)) return;
    const previous = owned.get(pid);
    if (previous && previous.started !== identity.started) return;
    owned.set(pid, { ...identity, kind: previous?.kind === "sql" ? "sql" : kind });
  };
  const captureOwned = async () => {
    for (const child of children) {
      await child.ownershipReady;
    }
    for (const item of await trace()) {
      if (["probe", "actual-runtime", "descendant"].includes(item.kind)) await remember(item.pid, "producer", item.started);
      if (["actual-sql-spawn", "actual-sql", "sql-descendant"].includes(item.kind)) {
        await remember(item.pid, "sql", item.started);
        if (item.descendant) await remember(item.descendant, "sql", item.descendantStarted);
      }
    }
    // Descendants are discovered only from this fixture's identity-checked
    // producers. This also owns a child created before its trace was written.
    const queue = [...owned.values()];
    for (let index = 0; index < queue.length; index++) {
      const parent = queue[index], current = await processIdentity(parent.pid);
      if (!current || current.started !== parent.started) continue;
      let descendants;
      try { descendants = await readFile(`/proc/${parent.pid}/task/${parent.pid}/children`, "utf8"); } catch { continue; }
      for (const value of descendants.trim().split(/\s+/).filter(Boolean)) {
        const pid = Number(value), identity = await processIdentity(pid);
        if (!identity || identity.parent !== parent.pid || owned.has(pid)) continue;
        await remember(pid, parent.kind);
        if (owned.has(pid)) queue.push(owned.get(pid));
      }
    }
  };
  const terminateOwned = async (kind) => {
    const groups = new Set();
    for (const identity of owned.values()) {
      if (identity.kind !== kind) continue;
      const current = await processIdentity(identity.pid);
      if (!current || current.state === "Z" || current.started !== identity.started || current.group !== identity.group) continue;
      // A group is ours only if its leader or another recorded member proves
      // it belongs to a launched fixture, never the surrounding test runner.
      const groupOwned = [...owned.values()].some((member) => member.pid === identity.group && member.group === identity.group);
      try {
        if (groupOwned && !groups.has(identity.group)) { groups.add(identity.group); process.kill(-identity.group, "SIGKILL"); }
        else if (!groupOwned) process.kill(identity.pid, "SIGKILL");
      } catch { /* An identity-checked owned process already stopped. */ }
    }
  };
  const result = { root, env, children, signal: context?.signal,
    trace,
    state: async () => JSON.parse(await readFile(stateFile, "utf8")),
    get closing() { return closing; },
    ownedProcessIds: () => [...owned.keys()],
    registerChild: async (child) => {
      const original = await child.ownedIdentity;
      if (original?.parent === process.pid) owned.set(child.pid, { ...original, kind: "producer" });
    },
    close() {
      if (closePromise) return closePromise;
      closing = true;
      closePromise = (async () => {
        await captureOwned();
        // Normal helper cancellation gets the first opportunity to restore
        // the worker. The fallback is fixture teardown, after safety asserts.
        for (const child of children) if (child.exitCode === null && child.signalCode === null) child.kill("SIGTERM");
        await Promise.race([Promise.allSettled(children.map((child) => child.finished)), delay(2000, undefined, { ref: false })]);
        await captureOwned();
        await terminateOwned("producer");
        // No recorded producer can start another SQL group after this point.
        await captureOwned();
        await terminateOwned("sql");
        const settleUntil = Date.now() + 500;
        while (true) {
          const active = (await Promise.all([...owned.values()].map(async (identity) => {
            const current = await processIdentity(identity.pid);
            return current && current.state !== "Z" && current.started === identity.started;
          }))).some(Boolean);
          if (!active && children.every((child) => child.fixtureClosed)) break;
          if (Date.now() >= settleUntil) throw new Error("fixture_owned_process_not_stopped");
          await delay(10);
        }
        await rm(root, { recursive: true, force: true });
      })();
      return closePromise;
    }
  };
  if (context) {
    context.after(() => result.close());
    context.signal.addEventListener("abort", () => { void result.close().catch(() => {}); }, { once: true });
  }
  return result;
}
function launch(f, args = ["publication", "production", revision, tenant], extraEnv = {}) {
  if (f.closing || f.signal?.aborted) throw new Error("controlled_fixture_cancelled");
  return trackChild(f, spawn("bash", [script, ...args], { env: { ...f.env, ...extraEnv }, detached: true, stdio: ["ignore", "pipe", "pipe"] }));
}
function trackChild(f, child) {
  child.ownedIdentity = processIdentity(child.pid);
  child.ownershipReady = f.registerChild(child);
  let stdout = "", stderr = "";
  child.stdout.on("data", (part) => { stdout += part; }); child.stderr.on("data", (part) => { stderr += part; });
  child.finished = new Promise((resolve, reject) => {
    child.once("error", reject); child.once("close", (code, signal) => { child.fixtureClosed = true; resolve({ code, signal, stdout, stderr }); });
  });
  f.children.push(child); return child;
}
async function reached(f, predicate, child) {
  for (let poll = 0; poll < 300; poll++) {
    if (f.closing || f.signal?.aborted) throw new Error("controlled_fixture_cancelled");
    const trace = await f.trace(); if (predicate(trace)) return trace;
    if (child && (child.exitCode !== null || child.signalCode !== null)) throw new Error("controlled_fixture_exited_before_phase");
    await delay(10);
  }
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

async function runtimeFixture(f, marker = "present") {
  const project = "abcdefghijklmnopqrst", hook = join(f.root, "fetch-hook.mjs");
  await rm(join(f.root, "bin", "node"));
  await writeFile(hook, `import {appendFileSync} from 'node:fs';
import childProcess from 'node:child_process';
import {syncBuiltinESMExports} from 'node:module';
import {readFileSync} from 'node:fs';
const started=(pid)=>{try{const s=readFileSync('/proc/'+pid+'/stat','utf8');return s.slice(s.lastIndexOf(')')+2).split(' ')[19]}catch{return null}};
const log=(value)=>{const line=JSON.stringify({...value,...(value.pid?{started:started(value.pid)}:{})})+'\\n';for(const file of [process.env.FIXTURE_TRACE,process.env.S207_FIXTURE_PARENT_TRACE].filter(Boolean))appendFileSync(file,line)};
if(process.argv[1]?.endsWith('probe-runtime-database.mjs')){
 log({kind:'actual-runtime',pid:process.pid});
 process.on('SIGTERM',()=>log({kind:'actual-runtime-term'}));
 const originalSpawn=childProcess.spawn;
 childProcess.spawn=function(...args){
  const child=originalSpawn.apply(this,args);
  if(args[0]==='pnpm')log({kind:'actual-sql-spawn',pid:child.pid,parent:process.pid});
  return child;
 };
 syncBuiltinESMExports();
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
const started=(pid)=>{try{const s=fs.readFileSync('/proc/'+pid+'/stat','utf8');return s.slice(s.lastIndexOf(')')+2).split(' ')[19]}catch{return null}};
const log=(value)=>{const line=JSON.stringify({...value,...(value.pid?{started:started(value.pid)}:{}),...(value.descendant?{descendantStarted:started(value.descendant)}:{})})+'\\n';for(const file of [process.env.FIXTURE_TRACE,process.env.S207_FIXTURE_PARENT_TRACE].filter(Boolean))fs.appendFileSync(file,line)};
process.stdin.resume();process.stdin.on('end',()=>{
 const child=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore'});
 log({kind:'sql-descendant',pid:child.pid,parent:process.pid});
 const marker=()=>log({kind:'actual-sql',pid:process.pid,descendant:child.pid});
 if(${JSON.stringify(marker)}==='present')marker();
 if(${JSON.stringify(marker)}==='late')setTimeout(marker,4000);
 process.stderr.write(${JSON.stringify(privateValue)});setInterval(()=>{},1000);
});
`, { mode: 0o700 });
  return {
    NODE_OPTIONS: `--import=${pathToFileURL(hook).href}`, RUNNER_TEMP: f.root,
    SUPABASE_PROJECT_REF: project, NEXT_PUBLIC_SUPABASE_URL: `https://${project}.supabase.co/`,
    SUPABASE_DB_URL: `postgresql://fixture:fixture@db.${project}.supabase.co:5432/postgres?sslmode=verify-full`,
    SUPABASE_SERVICE_ROLE_KEY: "sb_secret_fixture_test_only"
  };
}

for (const selector of ["publication", "runtime"]) {
  test(`${selector} uses only the fixed reviewed entrypoint and restores the same worker on success`, async (t) => {
    const f = await fixture("success", t);
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

test("staging discovery is bound to its exact Compose project", async (t) => {
  const f = await fixture("success", t);
  try {
    const result = await launch(f, ["runtime", "staging", revision, tenant], { FIXTURE_TARGET: "staging" }).finished;
    assert.equal(result.code, 0); privateOutput(result);
    const trace = await f.trace(); assert.ok(dockerCalls(trace, "ps")[0].args.includes("label=com.docker.compose.project=veyocast-staging-worker"));
    assert.equal((await f.state()).running, true);
  } finally { await f.close(); }
});

test("every invalid selector, environment, SHA, tenant or trusted-main scope rejects before Docker", async (t) => {
  const f = await fixture("success", t);
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

test("missing job start time rejects before discovery or worker mutation", async (t) => {
  const f = await fixture("success", t); delete f.env.QUIESCED_PROBE_JOB_STARTED_AT;
  try {
    const result = await launch(f).finished; assert.equal(result.code, 1); assert.match(result.stderr, /PROBE_JOB_BUDGET_UNPROVEN/); privateOutput(result);
    assert.deepEqual(await f.trace(), []); assert.equal((await f.state()).running, true);
  } finally { await f.close(); }
});

test("invalid job start times reject before discovery without evaluating caller text", async (t) => {
  const f = await fixture("success", t);
  try {
    for (const value of ["", "0", "0001234567", "-1", "1e9", "99999999999", "$(PRIVATE_COMMAND)", "1+1"]) {
      const result = await launch(f, undefined, { QUIESCED_PROBE_JOB_STARTED_AT: value }).finished;
      assert.equal(result.code, 1); assert.match(result.stderr, /PROBE_JOB_BUDGET_UNPROVEN/); privateOutput(result);
    }
    assert.deepEqual(await f.trace(), []); assert.equal((await f.state()).running, true);
  } finally { await f.close(); }
});

test("a future job start time cannot authorize any stop, start or diagnostic", async (t) => {
  const f = await fixture("success", t);
  try {
    const result = await launch(f, undefined, { QUIESCED_PROBE_JOB_STARTED_AT: String(Math.floor(Date.now() / 1000) + 3600) }).finished;
    assert.equal(result.code, 1); assert.match(result.stderr, /PROBE_JOB_BUDGET_UNPROVEN/); privateOutput(result);
    const trace = await f.trace(); assert.equal(dockerCalls(trace, "stop").length, 0); assert.equal(dockerCalls(trace, "start").length, 0);
    assert.equal(trace.some((item) => item.kind === "probe"), false); assert.equal((await f.state()).running, true);
  } finally { await f.close(); }
});

for (const [selector, ceiling] of [["publication", 190], ["runtime", 80]]) {
  test(`${selector} rejects a real stale job timestamp before arming any worker mutation`, async (t) => {
    const f = await fixture("success", t);
    try {
      const age = 300 - (ceiling + 60) + 2;
      const result = await launch(f, [selector, "production", revision, tenant], { QUIESCED_PROBE_JOB_STARTED_AT: String(Math.floor(Date.now() / 1000) - age) }).finished;
      assert.equal(result.code, 1); assert.match(result.stderr, /PROBE_JOB_BUDGET_INSUFFICIENT/); privateOutput(result);
      const trace = await f.trace(); assert.equal(dockerCalls(trace, "stop").length, 0); assert.equal(dockerCalls(trace, "start").length, 0);
      assert.equal(trace.some((item) => item.kind === "probe"), false); assert.equal((await f.state()).running, true);
    } finally { await f.close(); }
  });

  test(`${selector} accepts a real elapsed setup only while its operation plus 60-second reserve fits`, async (t) => {
    const f = await fixture("success", t);
    try {
      const age = 300 - (ceiling + 60) - 10;
      const result = await launch(f, [selector, "production", revision, tenant], { QUIESCED_PROBE_JOB_STARTED_AT: String(Math.floor(Date.now() / 1000) - age) }).finished;
      assert.equal(result.code, 0); privateOutput(result);
      assert.equal(dockerCalls(await f.trace(), "stop").length, 1); assert.equal(dockerCalls(await f.trace(), "start").length, 1);
      assert.equal((await f.state()).running, true);
    } finally { await f.close(); }
  });
}

test("foreign lock-directory ownership rejects before any Docker or diagnostic call", async (t) => {
  const f = await fixture("foreign-lock-owner", t);
  try {
    const result = await launch(f).finished; assert.equal(result.code, 1); assert.match(result.stderr, /PROBE_LOCK_UNPROVEN/); privateOutput(result);
    assert.deepEqual(await f.trace(), []);
  } finally { await f.close(); }
});

test("a symlink lock cannot redirect writes into another file", async (t) => {
  const f = await fixture("success", t), lockRoot = `/tmp/veyocast-quiesced-worker-${process.getuid()}`, lock = join(lockRoot, "staging.lock"), backup = join(f.root, "owned-lock-inode"), target = join(f.root, "private-target");
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
  test(`${scenario} cannot stop, restart or invoke a diagnostic for an unproven worker`, async (t) => {
    const f = await fixture(scenario, t);
    try {
      const result = await launch(f).finished; assert.equal(result.code, 1); privateOutput(result);
      const trace = await f.trace(); assert.equal(dockerCalls(trace, "stop").length, 0); assert.equal(dockerCalls(trace, "start").length, 0);
      assert.equal(trace.some((item) => item.kind === "probe"), false);
    } finally { await f.close(); }
  });
}

test("a hanging Docker discovery is actually bounded and never mutates a worker", { timeout: 6000 }, async (t) => {
  const f = await fixture("ps-hang", t);
  try {
    const started = Date.now(), result = await launch(f).finished;
    assert.equal(result.code, 1); assert.ok(Date.now() - started < 5000); privateOutput(result);
    assert.match(result.stderr, /PROBE_WORKER_READ_FAILED/); assert.equal(dockerCalls(await f.trace(), "start").length, 0);
  } finally { await f.close(); }
});

test("diagnostic failure exit stays unchanged after successful restoration", async (t) => {
  const f = await fixture("success", t);
  try {
    const result = await launch(f, undefined, { FIXTURE_PROBE_EXIT: "17" }).finished;
    assert.equal(result.code, 17); assert.match(result.stderr, /PROBE_WORKER_RESTORED/); privateOutput(result);
    assert.equal((await f.state()).running, true);
  } finally { await f.close(); }
});

test("failed first stop completes the daemon drain before one same-container restoration", async (t) => {
  const f = await fixture("stop-fail-first", t);
  try {
    const result = await launch(f).finished; assert.equal(result.code, 1); privateOutput(result);
    const trace = await f.trace(); assert.equal(dockerCalls(trace, "stop").length, 2); assert.equal(dockerCalls(trace, "start").length, 1);
    assert.equal(trace.some((item) => item.kind === "probe"), false); assert.equal((await f.state()).running, true);
    assert.match(result.stderr, /PROBE_WORKER_STOP_FAILED/); assert.match(result.stderr, /PROBE_WORKER_RESTORED/);
  } finally { await f.close(); }
});

for (const scenario of ["restore-start-fail", "restore-inspect-fail", "restore-stop-fail"]) {
  test(`${scenario} cannot report success and masks Docker failure details`, async (t) => {
    const f = await fixture(scenario, t);
    try {
      const result = await launch(f).finished; assert.equal(result.code, 1); assert.match(result.stderr, /PROBE_WORKER_RESTORE_FAILED/); privateOutput(result);
      assert.equal(dockerCalls(await f.trace(), "start").length, 1); assert.doesNotMatch(result.stderr, /PROBE_WORKER_RESTORED"/);
    } finally { await f.close(); }
  });
}

test("restoration failure retains the original nonzero diagnostic exit", async (t) => {
  const f = await fixture("restore-start-fail", t);
  try {
    const result = await launch(f, undefined, { FIXTURE_PROBE_EXIT: "19" }).finished;
    assert.equal(result.code, 19); assert.match(result.stderr, /PROBE_WORKER_RESTORE_FAILED/); privateOutput(result);
  } finally { await f.close(); }
});

for (const [signal, code] of [["SIGINT", 130], ["SIGTERM", 143]]) {
  test(`actual ${signal} restores before cancelling the owned hanging Node and descendant`, { skip: process.platform !== "linux", timeout: 8000 }, async (t) => {
    const f = await fixture("probe-hang", t);
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

test("a second TERM cannot interrupt same-worker restoration or replace the original INT exit", { timeout: 8000 }, async (t) => {
  const f = await fixture("restore-delay", t);
  try {
    const child = launch(f); await reached(f, (trace) => trace.some((item) => item.kind === "descendant")); child.kill("SIGINT");
    await reached(f, (trace) => dockerCalls(trace, "start").length === 1); assert.equal(child.kill("SIGTERM"), true);
    const result = await child.finished; assert.equal(result.code, 130); privateOutput(result);
    assert.equal((await f.state()).running, true); assert.equal(dockerCalls(await f.trace(), "start").length, 1);
    assert.match(result.stderr, /PROBE_WORKER_RESTORED/);
  } finally { await f.close(); }
});

test("actual cancellation during the first stop completes it before same-ID restoration", { timeout: 8000 }, async (t) => {
  const f = await fixture("stop-delay", t);
  try {
    const child = launch(f); await reached(f, (trace) => dockerCalls(trace, "stop").length === 1); child.kill("SIGTERM");
    const result = await child.finished; assert.equal(result.code, 143); privateOutput(result);
    assert.equal((await f.state()).running, true); const trace = await f.trace();
    assert.equal(dockerCalls(trace, "stop").length, 2); assert.deepEqual(dockerCalls(trace, "start").map((item) => item.args), [["start", worker]]);
    assert.equal(trace.some((item) => item.kind === "probe"), false);
  } finally { await f.close(); }
});

test("nonblocking host lock prevents a second diagnostic from stopping or restoring the first worker", { timeout: 8000 }, async (t) => {
  const first = await fixture("probe-hang", t), second = await fixture("success", t);
  try {
    const owner = launch(first); await reached(first, (trace) => trace.some((item) => item.kind === "descendant"));
    const rejected = await launch(second, ["runtime", "production", revision, tenant]).finished;
    assert.equal(rejected.code, 75); assert.match(rejected.stderr, /PROBE_QUIESCE_BUSY/); assert.deepEqual(await second.trace(), []); privateOutput(rejected);
    owner.kill("SIGTERM"); assert.equal((await owner.finished).code, 143); assert.equal((await first.state()).running, true);
  } finally { await first.close(); await second.close(); }
});

for (const [selector, ceiling] of [["publication", 190], ["runtime", 80]]) {
  test(`${selector} owned operation deadline restores first, keeps failure124 and preserves its fixed ceiling`, { timeout: 8000 }, async (t) => {
    const f = await fixture("deadline", t);
    try {
      const result = await launch(f, [selector, "production", revision, tenant]).finished;
      assert.equal(result.code, 124); assert.match(result.stderr, /PROBE_OPERATION_TIMEOUT/); privateOutput(result);
      assert.equal((await f.state()).running, true); const trace = await f.trace(); assert.ok(trace.some((item) => item.kind === "sleep" && item.seconds === ceiling));
      const restore = trace.findIndex((item) => item.kind === "docker" && item.args[0] === "start"), cancelled = trace.findIndex((item) => item.kind === "probe-term");
      assert.ok(restore >= 0 && cancelled > restore);
    } finally { await f.close(); }
  });
}

test("an unresponsive owned Node still stops with its descendant after worker restoration", { skip: process.platform !== "linux", timeout: 8000 }, async (t) => {
  const f = await fixture("probe-ignore-term", t);
  try {
    const child = launch(f), started = await reached(f, (trace) => trace.some((item) => item.kind === "descendant"));
    child.kill("SIGTERM"); const result = await child.finished; assert.equal(result.code, 143); privateOutput(result);
    assert.equal((await f.state()).running, true);
    for (const item of started.filter((item) => ["probe", "descendant"].includes(item.kind))) assert.equal(await alive(item.pid), false);
  } finally { await f.close(); }
});

test("helper cancellation restores first and the real runtime CLI stops its separately owned SQL group", { skip: process.platform !== "linux", timeout: 8000 }, async (t) => {
  const f = await fixture("success", t);
  try {
    // The real fixed entrypoint and native spawn remain unchanged; the hook
    // records ownership before waiting for a child's later phase marker.
    const child = launch(f, ["runtime", "production", revision, tenant], await runtimeFixture(f));
    const started = await reached(f, (trace) => trace.some((item) => item.kind === "actual-sql"), child);
    const ownedSql = started.find((item) => item.kind === "actual-sql");
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
    await f.close();
  }
});

for (const mode of ["absent-marker", "late-marker", "context-abort", "failed-assert-after-leader-exit"]) {
  const title = `native fixture ${mode} retains its failure and tears down only owned processes`;
  test(title, { skip: process.platform !== "linux", timeout: 8000 }, async (t) => {
    if (process.env.S207_FIXTURE_FAULT === mode) {
      const controller = new globalThis.AbortController();
      const f = await fixture("success", mode === "context-abort" ? { signal: controller.signal, after: (callback) => t.after(callback) } : t);
      try {
        if (mode === "failed-assert-after-leader-exit") {
          const code = `const fs=require('node:fs'),{spawn}=require('node:child_process');
const started=(pid)=>{const s=fs.readFileSync('/proc/'+pid+'/stat','utf8');return s.slice(s.lastIndexOf(')')+2).split(' ')[19]};
const child=spawn(process.execPath,['-e',"process.on('SIGTERM',()=>{});process.send('ready');setInterval(()=>{},1000)"],{stdio:['ignore','ignore','ignore','ipc']});
child.once('message',()=>{
 const line=JSON.stringify({kind:'descendant',pid:child.pid,started:started(child.pid)})+'\\n';
 for(const file of [process.env.FIXTURE_TRACE,process.env.S207_FIXTURE_PARENT_TRACE].filter(Boolean))fs.appendFileSync(file,line);
 process.exit(23);
});`;
          const producer = trackChild(f, spawn(realNode, ["-e", code], { env: f.env, detached: true, stdio: ["ignore", "pipe", "pipe"] }));
          assert.equal((await producer.finished).code, 23);
          const descendant = (await f.trace()).find((item) => item.kind === "descendant");
          assert.equal(await alive(descendant.pid), true);
          assert.fail("deliberate_fixture_assertion");
        } else {
          const env = await runtimeFixture(f, mode === "late-marker" ? "late" : "absent");
          const producer = launch(f, ["runtime", "production", revision, tenant], env);
          await reached(f, (trace) => trace.some((item) => item.kind === "sql-descendant"), producer);
          if (mode === "context-abort") controller.abort();
          // The original observer limit is unchanged. Spawn registration must
          // suffice even when the later readiness marker never arrives.
          await reached(f, (trace) => trace.some((item) => item.kind === "actual-sql"), producer);
          assert.fail("fault_fixture_unexpectedly_reached_phase");
        }
      } finally {
        await f.close();
        const stopped = !(await Promise.all(f.ownedProcessIds().map(alive))).some(Boolean);
        await writeFile(process.env.S207_FIXTURE_AUDIT, JSON.stringify({ mode, ownedStopped: stopped,
          ownedCount: f.ownedProcessIds().length, unrelatedAlive: await alive(Number(process.env.S207_UNRELATED_PID)) }), { mode: 0o600 });
      }
      return;
    }
    const outer = await fixture("success", t), audit = join(outer.root, "audit.json");
    const unrelated = spawn(realNode, ["-e", "setInterval(()=>{},1000)"], { detached: true, stdio: "ignore" });
    let runner;
    try {
      const exactTitle = `^${title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`;
      const env = { ...process.env, S207_FIXTURE_FAULT: mode, S207_FIXTURE_AUDIT: audit,
        S207_UNRELATED_PID: String(unrelated.pid), S207_FIXTURE_PARENT_TRACE: outer.env.FIXTURE_TRACE };
      // node:test marks worker processes; retaining this marker would cause
      // the native nested runner to skip execution and return a false zero.
      delete env.NODE_TEST_CONTEXT;
      runner = trackChild(outer, spawn(realNode, ["--test", `--test-name-pattern=${exactTitle}`, fileURLToPath(import.meta.url)], {
        env, detached: true, stdio: ["ignore", "pipe", "pipe"]
      }));
      const result = await runner.finished, output = result.stdout + result.stderr;
      assert.equal(result.code, 1);
      assert.match(output, mode === "failed-assert-after-leader-exit" ? /deliberate_fixture_assertion/
        : mode === "context-abort" ? /controlled_fixture_cancelled/ : /controlled_fixture_phase_not_reached/);
      const report = JSON.parse(await readFile(audit, "utf8"));
      assert.equal(report.mode, mode); assert.equal(report.ownedStopped, true); assert.ok(report.ownedCount >= 2);
      assert.equal(report.unrelatedAlive, true); assert.equal(await alive(unrelated.pid), true);
      assert.doesNotMatch(output, /PRIVATE_DOCKER_OR_NODE_CREDENTIAL|sb_secret_fixture_test_only|postgresql:|fixture:fixture/);
    } finally {
      try { await outer.close(); } finally { unrelated.kill("SIGKILL"); }
    }
  });
}
