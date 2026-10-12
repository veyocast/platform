import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { spawn } from "node:child_process";
import { EventEmitter } from "node:events";
import { chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { clearTimeout, setTimeout } from "node:timers";
import { fileURLToPath, URL } from "node:url";
import { createPublicationSqlAdapter, executePublicationQuery } from "./publication-database-query.mjs";

const secret = "PRIVATE_HOSTILE_DETAIL";
const uri = `postgres://private-user:${secret}@db.private.invalid:5432/postgres?sslmode=verify-full&connect_timeout=45`;
const sql = "SELECT private_fixture;\n";
const input = (changes = {}) => ({ phase: "inventory_report", databaseUrl: uri, sql, timeoutMs: 60_000, ...changes });
const passed = (stdout = "[]", changes = {}) => ({ ok: true, stdout, stdoutBytes: Buffer.byteLength(stdout), stderrBytes: 0, exitCode: 0, exitSignal: null, ...changes });
const privateOutput = (value) => {
  const encoded = JSON.stringify(value);
  for (const text of [secret, uri, sql, "private_fixture", "RAW_ERROR_CAUSE"]) assert.equal(encoded.includes(text), false);
};
async function failure(result, expected, changes = {}) {
  const diagnostics = [];
  let fault;
  try { await executePublicationQuery(input(changes), { executeSql: async () => result, onDiagnostic: (value) => diagnostics.push(value) }); }
  catch (error) { fault = error; }
  assert.equal(fault?.diagnostic?.failureCategory, expected);
  assert.equal(diagnostics.length, 1); assert.deepEqual(diagnostics[0], fault.diagnostic);
  assert.equal(fault.message, fault.code); assert.equal(fault.cause, undefined);
  privateOutput(fault); privateOutput(diagnostics);
  return fault;
}
function fakeAdapter() {
  let child, captured, killed, written;
  const adapter = createPublicationSqlAdapter({ spawnImpl: (file, args, options) => {
    captured = { file, args, options }; child = new EventEmitter(); child.pid = 123;
    for (const key of ["stdin", "stdout", "stderr"]) child[key] = new EventEmitter();
    child.stdin.end = (value) => { written = value; }; return child;
  }, killImpl: (pid, signal) => { killed = { pid, signal }; } });
  return { adapter, get child() { return child; }, get captured() { return captured; }, get killed() { return killed; }, get written() { return written; } };
}

test("all five reviewed phases return rows and emit only a safe successful diagnostic", async () => {
  for (const phase of ["tenant_lookup", "schema_presence", "inventory_report", "refresh_command", "cutover_command"]) {
    const diagnostics = []; let received;
    const rows = [{ private_value: secret }];
    assert.deepEqual(await executePublicationQuery(input({ phase }), { executeSql: async (value) => {
      received = value; return passed(JSON.stringify(rows));
    }, onDiagnostic: (value) => diagnostics.push(value) }), rows);
    assert.equal(received.databaseUrl, uri); assert.equal(received.sql, sql); assert.equal(received.timeoutMs, 60_000);
    assert.equal(diagnostics.length, 1); assert.equal(diagnostics[0].phase, phase);
    assert.equal(diagnostics[0].status, "passed"); assert.equal(diagnostics[0].code, "PUBLICATION_DATABASE_QUERY_SUCCEEDED");
    assert.equal(diagnostics[0].failureCategory, null); privateOutput(diagnostics);
  }
});

test("malformed phase/configuration values fail closed before execution without reflecting them", async () => {
  for (const changes of [...[undefined, null, "", secret, "inventory_report " + secret, 1, {}].map(phase => ({ phase })),
    ...[0, 59_999, 130_001, Number.NaN, Number.POSITIVE_INFINITY, "60000", secret].map(timeoutMs => ({ timeoutMs })),
    { databaseUrl: { message: secret } }, { sql: { message: secret } }]) {
    let calls = 0;
    await assert.rejects(executePublicationQuery(input(changes), { executeSql: async () => { calls++; return passed(); },
      onDiagnostic: () => { calls++; } }), (error) => {
      assert.equal(error.code, "PUBLICATION_DATABASE_QUERY_CONFIG_INVALID"); assert.equal(error.diagnostic, undefined); privateOutput(error); return true;
    });
    assert.equal(calls, 0);
  }
});

test("native adapter keeps exact CLI flags, URI, stdin and detached group, and kills residual children on success", async () => {
  const fixture = fakeAdapter(); const pending = fixture.adapter(input());
  fixture.child.stdout.emit("data", Buffer.from("[]")); fixture.child.stderr.emit("data", Buffer.from(secret));
  fixture.child.emit("close", 0, null); const result = await pending;
  assert.equal(fixture.captured.file, "pnpm");
  assert.deepEqual(fixture.captured.args, ["exec", "supabase", "db", "query", "--db-url", uri, "--agent", "no", "--output-format", "json"]);
  assert.equal(fixture.captured.options.detached, true); assert.deepEqual(fixture.captured.options.stdio, ["pipe", "pipe", "pipe"]);
  assert.equal(fixture.written, sql); assert.deepEqual(fixture.killed, { pid: -123, signal: "SIGKILL" });
  assert.equal(result.ok, true); assert.equal(result.stdout, "[]"); assert.equal(result.stderr, undefined); assert.equal(result.stderrBytes, Buffer.byteLength(secret));
});

test("normal 60–130 s limits are supplied unchanged to the deadline timer", async () => {
  for (const timeoutMs of [60_000, 65_000, 130_000]) {
    let expectedTimer; const child = new EventEmitter(); child.pid = 123;
    for (const key of ["stdin", "stdout", "stderr"]) child[key] = new EventEmitter(); child.stdin.end = () => {};
    const adapter = createPublicationSqlAdapter({ spawnImpl: () => child, killImpl: () => {},
      setTimeoutImpl: (callback, value) => { expectedTimer = value; return setTimeout(callback, 1); }, clearTimeoutImpl: clearTimeout });
    const result = await adapter(input({ timeoutMs })); assert.equal(expectedTimer, timeoutMs); assert.equal(result.timedOut, true);
    await failure(result, "PROCESS_TIMEOUT");
  }
});

test("stdout accepts its existing 4 MiB boundary; overflow and discarded stderr each stop their owned group", async () => {
  for (const [stream, count, expected] of [["stdout", 4 * 1024 * 1024 + 1, "STDOUT_LIMIT"], ["stderr", 65_537, "STDERR_LIMIT"]]) {
    const fixture = fakeAdapter(); const pending = fixture.adapter(input()); fixture.child[stream].emit("data", Buffer.alloc(count));
    const result = await pending; assert.equal(result.ok, false); assert.deepEqual(fixture.killed, { pid: -123, signal: "SIGKILL" });
    assert.equal(result.stdout, ""); assert.equal(result.stderr, undefined); await failure(result, expected);
  }
  const fixture = fakeAdapter(); const pending = fixture.adapter(input());
  fixture.child.stdout.emit("data", Buffer.from("[" + " ".repeat(4 * 1024 * 1024 - 2) + "]"));
  fixture.child.emit("close", 0); const result = await pending;
  assert.equal(result.stdoutBytes, 4 * 1024 * 1024); assert.equal(result.ok, true);
  assert.deepEqual(await executePublicationQuery(input(), { executeSql: async () => result }), []);
});

test("hostile thrown spawn and emitted stream errors expose only the fixed stage", async () => {
  const adapter = createPublicationSqlAdapter({ spawnImpl: () => { throw Object.assign(new Error(uri), { code: secret, cause: secret }); } });
  await failure(await adapter(input()), "PROCESS_SPAWN_FAILED");
  for (const stream of ["stdin", "stdout", "stderr"]) {
    const fixture = fakeAdapter(); const pending = fixture.adapter(input());
    fixture.child[stream].emit("error", Object.assign(new Error(secret), { code: uri, cause: "RAW_ERROR_CAUSE" }));
    await failure(await pending, "PROCESS_IO_FAILED"); assert.deepEqual(fixture.killed, { pid: -123, signal: "SIGKILL" });
  }
  const fault = await assert.rejects(executePublicationQuery(input(), { executeSql: async () => { throw new Error(secret); } }), /PUBLICATION_DATABASE_SPAWN_FAILED/);
  assert.equal(fault, undefined);
});

test("native asynchronous spawn failure and abort are separately classified and safely cleaned up", async () => {
  const fixture = fakeAdapter(); const pending = fixture.adapter(input());
  fixture.child.emit("error", Object.assign(new Error(secret), { code: secret })); await failure(await pending, "PROCESS_SPAWN_FAILED");
  const controller = new globalThis.AbortController(); const abortFixture = fakeAdapter();
  const aborted = abortFixture.adapter(input({ signal: controller.signal })); controller.abort(new Error(secret));
  await failure(await aborted, "PROCESS_ABORTED"); assert.deepEqual(abortFixture.killed, { pid: -123, signal: "SIGKILL" });
  let calls = 0; const noSpawn = createPublicationSqlAdapter({ spawnImpl: () => { calls++; throw new Error(secret); } });
  await failure(await noSpawn(input({ signal: controller.signal })), "PROCESS_ABORTED"); assert.equal(calls, 0);
});

test("safe exit code/signal remain distinct from successful malformed responses", async () => {
  for (const exitCode of [1, 9, 255]) {
    const fault = await failure(passed("[]", { ok: false, exitCode }), "PROCESS_EXIT_FAILED"); assert.equal(fault.diagnostic.exitCode, exitCode);
  }
  const signalFault = await failure(passed(secret, { ok: false, exitCode: null, exitSignal: "SIGSEGV" }), "PROCESS_SIGNALLED");
  assert.equal(signalFault.diagnostic.exitSignal, "SIGSEGV");
  for (const exitCode of [secret, -1, 256, {}]) {
    const fault = await failure(passed(secret, { ok: false, exitCode, exitSignal: secret }), "PROCESS_EXIT_FAILED");
    assert.equal(fault.diagnostic.exitCode, null); assert.equal(fault.diagnostic.exitSignal, null);
  }
  for (const stdout of [secret, "null", JSON.stringify({ message: secret }), JSON.stringify({ error: { code: secret, message: uri } })]) {
    await failure(passed(stdout), "QUERY_RESPONSE_INVALID");
  }
  await failure(null, "PROCESS_RESULT_INVALID");
});

test("only reviewed CLI stages and exact full connect messages are retained; hostile detail is discarded", async () => {
  for (const [message, category] of [["failed to connect to postgres: SqlError: PgClient: Failed to connect", "SQL_CLIENT_CONNECT_FAILED"],
    ["failed to connect to postgres: SqlError: PgClient: Connection timed out", "SQL_CLIENT_DEADLINE"],
    ["failed to connect to postgres: SqlError: Failed to acquire connection", "SQL_POOL_ACQUIRE_FAILED"],
    ["failed to connect to postgres: SqlError: PgClient: Connection timed out " + secret, "UNKNOWN"], [uri, "UNKNOWN"]]) {
    const fault = await failure(passed(JSON.stringify({ error: { code: "LegacyDbConnectError", message,
      cause: { code: "28P01", message: secret }, stdout: uri, stderr: secret } }), { ok: false, exitCode: 1 }), "CLI_CONNECT_FAILED");
    assert.equal(fault.diagnostic.cliFailureCategory, category); assert.equal(fault.diagnostic.databaseCode, undefined);
  }
  const known = await failure(passed(JSON.stringify({ error: { code: "LegacyDbQueryExecError", message: uri, databaseCode: "57014", cause: secret } }),
    { ok: false, exitCode: 1 }), "CLI_QUERY_FAILED");
  assert.equal(known.diagnostic.databaseCode, "57014"); assert.equal(known.diagnostic.cliFailureCategory, undefined);
  const hostile = await failure(passed(JSON.stringify({ error: { code: "LegacyDbQueryExecError", message: secret, databaseCode: secret, sqlState: uri,
    cause: { sqlState: "57014", message: secret } } }), { ok: false, exitCode: 1 }), "CLI_QUERY_FAILED");
  assert.equal(hostile.diagnostic.databaseCode, undefined);
});

test("unknown process cleanup errors are safe failures; already-ended owned groups are successful", async () => {
  for (const code of [secret, "ESRCH"]) {
    const child = new EventEmitter(); child.pid = 123;
    for (const key of ["stdin", "stdout", "stderr"]) child[key] = new EventEmitter(); child.stdin.end = () => {};
    const adapter = createPublicationSqlAdapter({ spawnImpl: () => child, killImpl: () => { throw Object.assign(new Error(uri), { code, cause: secret }); } });
    const pending = adapter(input()); child.stdout.emit("data", Buffer.from("[]")); child.emit("close", 0);
    const result = await pending;
    if (code === "ESRCH") assert.deepEqual(await executePublicationQuery(input(), { executeSql: async () => result }), []);
    else await failure(result, "PROCESS_CLEANUP_FAILED");
  }
  const timeout = await failure(passed("", { ok: false, timedOut: true, cleanupFailed: true }), "PROCESS_TIMEOUT");
  assert.equal(timeout.diagnostic.cleanupFailed, true);
});

const alive = async (pid) => {
  try { const value = await readFile(`/proc/${pid}/stat`, "utf8"); return value.slice(value.lastIndexOf(")") + 2).split(" ")[0] !== "Z"; }
  catch { return false; }
};
test("actual Linux deadline kills the pnpm-shaped wrapper and its real descendant, counting zombies as terminated", { skip: process.platform !== "linux" }, async () => {
  const directory = await mkdtemp(join(tmpdir(), "veyocast-publication-group-test-")); let wrapperPid, descendantPid;
  try {
    const pidPath = join(directory, "descendant.json");
    const fixture = "const{spawn}=require('node:child_process');const fs=require('node:fs');const c=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore'});fs.writeFileSync(process.argv[1],JSON.stringify({pid:c.pid}));setInterval(()=>{},1000);";
    const adapter = createPublicationSqlAdapter({ spawnImpl: (_file, _args, options) => {
      const child = spawn(process.execPath, ["-e", fixture, pidPath], options); wrapperPid = child.pid; return child;
    }, setTimeoutImpl: (callback, requestedBudget) => {
      assert.equal(requestedBudget, 60_000); return setTimeout(callback, 500);
    } });
    const pending = adapter(input());
    for (let poll = 0; poll < 100; poll++) {
      try { descendantPid = JSON.parse(await readFile(pidPath, "utf8")).pid; break; } catch { await delay(5); }
    }
    assert.equal(Number.isInteger(descendantPid), true); assert.equal(await alive(descendantPid), true);
    const result = await pending; await failure(result, "PROCESS_TIMEOUT");
    for (let poll = 0; poll < 100 && (await alive(wrapperPid) || await alive(descendantPid)); poll++) await delay(5);
    assert.equal(await alive(wrapperPid), false); assert.equal(await alive(descendantPid), false);
  } finally {
    if (Number.isInteger(wrapperPid)) { try { process.kill(-wrapperPid, "SIGKILL"); } catch { /* Fixture group already ended. */ } }
    await rm(directory, { recursive: true, force: true });
  }
});

test("actual CLI inventory awaits tenant/schema/report phases and safely identifies the previously generic failing phase", async () => {
  const directory = await mkdtemp(join(tmpdir(), "veyocast-publication-cli-test-"));
  const tenant = "7526e17f-c819-431c-a05d-4ef5f16ea1c0";
  try {
    const fixture = `#!${process.execPath}\nlet sql='';process.stdin.on('data',x=>sql+=x);process.stdin.on('end',()=>{let rows;if(sql.startsWith('select id,name,status from public.tenants'))rows=[{id:'${tenant}',name:'Fixture Club',status:'active'}];else if(sql.includes('to_regclass'))rows=[{available:true}];else if(process.env.FIXTURE_FAILURE==='yes'){process.stdout.write(JSON.stringify({error:{code:'LegacyDbQueryExecError',message:'${secret}',cause:'${secret}'}}));process.stderr.write('${secret}');process.exitCode=9;return;}else rows=[{report:{playlists:[],screens:[],legacyPending:0,retention:{},observedAt:'2026-10-12T00:00:00Z'}}];process.stdout.write(JSON.stringify(rows));});\n`;
    const pnpm = join(directory, "pnpm"); await writeFile(pnpm, fixture); await chmod(pnpm, 0o700);
    for (const fixtureFailure of ["no", "yes"]) {
      const child = spawn(process.execPath, [fileURLToPath(new URL("./current-publication-maintenance.mjs", import.meta.url))], {
        env: { ...process.env, PATH: directory + ":" + process.env.PATH, PUBLICATION_OPERATION: "inventory", TARGET_ENVIRONMENT: "production",
          TENANT_NAME: "Fixture Club", EXPECTED_RELEASE_SHA: "a".repeat(40), OPERATOR: "github:fixture", REASON: "Synthetic process diagnostic test",
          GITHUB_REF: "refs/heads/main", SUPABASE_DB_URL: uri, EXPECTED_TENANT_ID: tenant, RUNNER_TEMP: directory, OBSERVATION_SECONDS: "0", FIXTURE_FAILURE: fixtureFailure },
        stdio: ["ignore", "pipe", "pipe"]
      });
      const stdout = [], stderr = []; child.stdout.on("data", chunk => stdout.push(chunk)); child.stderr.on("data", chunk => stderr.push(chunk));
      const exitCode = await new Promise((resolve, reject) => { child.on("error", reject); child.on("close", resolve); });
      const output = Buffer.concat(stdout).toString("utf8"), errors = Buffer.concat(stderr).toString("utf8");
      privateOutput({ output, errors });
      const diagnostics = output.split("\n").filter(line => line.startsWith('{"event":"publication_database_query"')).map(line => JSON.parse(line));
      if (fixtureFailure === "no") {
        assert.equal(exitCode, 0); assert.deepEqual(diagnostics.map(value => [value.phase, value.status]), [["tenant_lookup", "passed"], ["schema_presence", "passed"], ["inventory_report", "passed"], ["inventory_report", "passed"]]);
        assert.equal(JSON.parse(await readFile(join(directory, "publication-after.json"), "utf8")).operation, "inventory");
      } else {
        assert.equal(exitCode, 1); assert.equal(diagnostics.at(-1).phase, "inventory_report");
        assert.equal(diagnostics.at(-1).failureCategory, "CLI_QUERY_FAILED"); assert.equal(diagnostics.at(-1).exitCode, 9);
        assert.equal(errors.includes("PUBLICATION_DATABASE_QUERY_FAILED"), true);
      }
    }
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("actual CLI SIGINT/SIGTERM preserve exit codes, kill wrapper/descendant and never launch the next query", { skip: process.platform !== "linux" }, async () => {
  for (const [signal, expectedExitCode] of [["SIGINT", 130], ["SIGTERM", 143]]) {
    const directory = await mkdtemp(join(tmpdir(), "veyocast-publication-cancel-test-"));
    const tenant = "7526e17f-c819-431c-a05d-4ef5f16ea1c0"; let child, wrapperPid, descendantPid;
    try {
      const fixture = `#!${process.execPath}\nconst fs=require('node:fs');let sql='';process.stdin.on('data',x=>sql+=x);process.stdin.on('end',()=>{let rows,phase;if(sql.startsWith('select id,name,status from public.tenants')){rows=[{id:'${tenant}',name:'Fixture Club',status:'active'}];phase='tenant_lookup';}else if(sql.includes('to_regclass')){rows=[{available:true}];phase='schema_presence';}else phase='inventory_report';fs.appendFileSync(process.env.FIXTURE_PHASES,phase+'\\n');if(rows){process.stdout.write(JSON.stringify(rows));return;}const c=require('node:child_process').spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore'});fs.writeFileSync(process.env.FIXTURE_PIDS,JSON.stringify({wrapper:process.pid,descendant:c.pid}));setInterval(()=>{},1000);});\n`;
      const pnpm = join(directory, "pnpm"), pidPath = join(directory, "pids.json"), phasePath = join(directory, "phases.txt");
      await writeFile(pnpm, fixture); await chmod(pnpm, 0o700);
      child = spawn(process.execPath, [fileURLToPath(new URL("./current-publication-maintenance.mjs", import.meta.url))], {
        env: { ...process.env, PATH: directory + ":" + process.env.PATH, PUBLICATION_OPERATION: "inventory", TARGET_ENVIRONMENT: "production",
          TENANT_NAME: "Fixture Club", EXPECTED_RELEASE_SHA: "a".repeat(40), OPERATOR: "github:fixture", REASON: "Synthetic signal cleanup test",
          GITHUB_REF: "refs/heads/main", SUPABASE_DB_URL: uri, EXPECTED_TENANT_ID: tenant, RUNNER_TEMP: directory, OBSERVATION_SECONDS: "0",
          FIXTURE_PHASES: phasePath, FIXTURE_PIDS: pidPath }, stdio: ["ignore", "pipe", "pipe"]
      });
      const stdout = [], stderr = []; child.stdout.on("data", chunk => stdout.push(chunk)); child.stderr.on("data", chunk => stderr.push(chunk));
      const closed = new Promise((resolve, reject) => { child.on("error", reject); child.on("close", (code, exitedSignal) => resolve({ code, signal: exitedSignal })); });
      for (let poll = 0; poll < 200; poll++) {
        try { const pids = JSON.parse(await readFile(pidPath, "utf8")); wrapperPid = pids.wrapper; descendantPid = pids.descendant; break; }
        catch { await delay(5); }
      }
      assert.equal(Number.isInteger(wrapperPid), true); assert.equal(Number.isInteger(descendantPid), true);
      assert.equal(await alive(wrapperPid), true); assert.equal(await alive(descendantPid), true);
      child.kill(signal); const result = await closed;
      assert.deepEqual(result, { code: expectedExitCode, signal: null });
      for (let poll = 0; poll < 100 && (await alive(wrapperPid) || await alive(descendantPid)); poll++) await delay(5);
      assert.equal(await alive(wrapperPid), false); assert.equal(await alive(descendantPid), false);
      assert.equal(await readFile(phasePath, "utf8"), "tenant_lookup\nschema_presence\ninventory_report\n");
      const output = Buffer.concat(stdout).toString("utf8"), errors = Buffer.concat(stderr).toString("utf8"); privateOutput({ output, errors });
      assert.equal(errors, "");
      const diagnostics = output.split("\n").filter(line => line.startsWith('{"event":"publication_database_query"')).map(line => JSON.parse(line));
      assert.equal(diagnostics.at(-1).phase, "inventory_report"); assert.equal(diagnostics.at(-1).failureCategory, "PROCESS_ABORTED");
      assert.equal(diagnostics.at(-1).cleanupFailed, false); assert.equal(output.includes("PUBLICATION_OPERATION_INTERRUPTED"), true);
      await assert.rejects(readFile(join(directory, "publication-after.json")), { code: "ENOENT" });
    } finally {
      if (child && await alive(child.pid)) child.kill("SIGKILL");
      if (Number.isInteger(wrapperPid)) { try { process.kill(-wrapperPid, "SIGKILL"); } catch { /* Fixture group already ended. */ } }
      await rm(directory, { recursive: true, force: true });
    }
  }
});
