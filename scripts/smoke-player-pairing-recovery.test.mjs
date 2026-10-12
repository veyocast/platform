import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmod, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";
import { fileURLToPath, URL } from "node:url";
import test from "node:test";

const script = fileURLToPath(new URL("./smoke-player-pairing-recovery.sh", import.meta.url));
const fakeCurl = `#!/usr/bin/env node
const fs = require('node:fs');
const args = process.argv.slice(2), url = args.at(-1);
const phase = url.endsWith('/api/player/installation') ? 'installation'
  : url.endsWith('/api/player/pairing') ? 'pairing'
  : url.endsWith('/api/player/pairing/recover') ? 'recovery'
  : url.endsWith('/lg/recover') ? 'lg_recovery'
  : url.endsWith('/rest/v1/rpc/cleanup_player_pairing_smoke_v1') ? 'cleanup' : 'unexpected';
fs.appendFileSync(process.env.SMOKE_FIXTURE_CALLS, JSON.stringify({phase, args})+'\\n');
const fixture = JSON.parse(process.env.SMOKE_FIXTURE);
let body = phase === 'installation' ? JSON.stringify({ok:true,live:true,installationCredential:'A'.repeat(32)})
  : phase === 'pairing' ? JSON.stringify({live:true,pairingCode:'ABC DEF',deviceToken:'B'.repeat(32),expiresAt:new Date(Date.now()+60000).toISOString()})
  : phase === 'recovery' ? JSON.stringify({ok:true,live:true,cancelledPendingPairing:true,bindingState:'UNPAIRED'})
  : phase === 'lg_recovery' ? 'VeyoCast Player herstellen "/api/player/installation" "/api/player/pairing"' : 'null';
if (Object.hasOwn(fixture.responses ?? {}, phase)) body = fixture.responses[phase];
const failure = fixture.failures?.[phase];
if (failure) body = '{"message":"PRIVATE_RESPONSE_BODY","credential":"PRIVATE_TOKEN"}';
const outputAt = args.indexOf('--output');
if (outputAt >= 0) fs.writeFileSync(args[outputAt+1], body, {mode:0o600});
else process.stdout.write(body);
if (args.includes('--write-out')) process.stdout.write(String(failure?.httpStatus ?? 200).padStart(3,'0'));
if (failure) process.stderr.write('PRIVATE_TRANSPORT_ERROR PRIVATE_SERVICE_ROLE_KEY\\n');
process.exit(failure?.exitCode ?? 0);
`;

async function run(fixture = {}, overrides = {}) {
  const directory = await mkdtemp(join(tmpdir(), "veyocast-smoke-test-"));
  try {
    const curl = join(directory, "curl"), callsPath = join(directory, "calls.jsonl");
    await writeFile(curl, fakeCurl, { mode: 0o700 });
    await chmod(curl, 0o700);
    const result = spawnSync("bash", [script], {
      env: {
        PATH: `${directory}:${process.env.PATH}`, TMPDIR: directory,
        PLAYER_ORIGIN: "https://player.veyocast.nl", NEXT_PUBLIC_SUPABASE_URL: "https://supabase.test",
        SUPABASE_SERVICE_ROLE_KEY: "PRIVATE_SERVICE_ROLE_KEY", SMOKE_FIXTURE: JSON.stringify(fixture),
        SMOKE_FIXTURE_CALLS: callsPath, ...overrides
      }, encoding: "utf8", timeout: 5000
    });
    const calls = await readFile(callsPath, "utf8").then(value => value.trim().split("\n").filter(Boolean).map(JSON.parse), () => []);
    const files = await readdir(directory);
    assert.ok(!files.some(name => name.startsWith("tmp.")), "Every temporary response directory is removed.");
    assert.equal(result.error, undefined);
    assert.ok(!`${result.stdout}${result.stderr}`.includes("PRIVATE_"), "No raw response, transport error or credential reaches output.");
    const events = result.stderr.trim().split("\n").filter(Boolean).map(line => JSON.parse(line));
    return { status: result.status, stdout: result.stdout, events, calls };
  } finally { await rm(directory, { recursive: true, force: true }); }
}

test("successful live response contract executes all four checks and authenticated cleanup", async () => {
  const result = await run();
  assert.equal(result.status, 0);
  assert.deepEqual(result.events, []);
  assert.match(result.stdout, /Pairing- en LG-recovery-smoke geslaagd/);
  assert.deepEqual(result.calls.map(call => call.phase), ["installation", "pairing", "recovery", "lg_recovery", "cleanup"]);
  for (const call of result.calls) {
    assert.ok(call.args.includes("--fail-with-body"));
    assert.equal(call.args[call.args.indexOf("--connect-timeout") + 1], "10");
    assert.equal(call.args[call.args.indexOf("--max-time") + 1], "30");
    assert.equal(call.args[call.args.indexOf("--proto") + 1], "=https");
    assert.ok(call.args.includes("--tlsv1.2"));
  }
  const installation = JSON.parse(result.calls[0].args[result.calls[0].args.indexOf("--data") + 1]);
  const cleanup = JSON.parse(result.calls.at(-1).args[result.calls.at(-1).args.indexOf("--data") + 1]);
  const { createHash } = await import("node:crypto");
  assert.equal(cleanup.p_installation_id_hash, createHash("sha256").update(installation.installationId).digest("hex"));
  assert.ok(result.calls.at(-1).args.includes("Authorization: Bearer PRIVATE_SERVICE_ROLE_KEY"));
});

for (const phase of ["installation", "pairing", "recovery", "lg_recovery", "cleanup"]) {
  test(`HTTP failure records only its exact ${phase} phase and retains exit22`, async () => {
    const result = await run({ failures: { [phase]: { httpStatus: 503, exitCode: 22 } } });
    assert.equal(result.status, 22);
    assert.deepEqual(result.events, [{ event: "player_pairing_smoke_failed", phase, code: "HTTP_REQUEST_FAILED", httpStatus: 503, exitCode: 22 }]);
    assert.equal(result.calls.at(-1).phase, "cleanup");
    assert.equal(result.calls.filter(call => call.phase === phase).length, 1);
    assert.ok(!result.stdout.includes("geslaagd"));
  });
}

test("secondary cleanup failure does not replace the original failing request exit", async () => {
  const result = await run({ failures: { pairing: { httpStatus: 503, exitCode: 22 }, cleanup: { httpStatus: 0, exitCode: 28 } } });
  assert.equal(result.status, 22);
  assert.deepEqual(result.events.map(event => [event.phase, event.httpStatus, event.exitCode]), [["pairing", 503, 22], ["cleanup", 0, 28]]);
});

test("network deadline records status zero without leaking curl diagnostics", async () => {
  const result = await run({ failures: { installation: { httpStatus: 0, exitCode: 28 } } });
  assert.equal(result.status, 28);
  assert.deepEqual(result.events, [{ event: "player_pairing_smoke_failed", phase: "installation", code: "HTTP_REQUEST_FAILED", httpStatus: 0, exitCode: 28 }]);
});

for (const phase of ["installation", "pairing", "recovery"]) {
  test(`malformed ${phase} response suppresses Node input excerpts and runs cleanup`, async () => {
    const result = await run({ responses: { [phase]: "PRIVATE_TOKEN is not JSON" } });
    assert.equal(result.status, 1);
    assert.deepEqual(result.events, [{ event: "player_pairing_smoke_failed", phase, code: "RESPONSE_INVALID", httpStatus: 0, exitCode: 1 }]);
    assert.equal(result.calls.at(-1).phase, "cleanup");
  });
}

test("expired pairing still fails its existing recovery gate", async () => {
  const result = await run({ responses: { pairing: JSON.stringify({ live: true, pairingCode: "ABC DEF", deviceToken: "B".repeat(32), expiresAt: "2020-01-01T00:00:00Z" }) } });
  assert.equal(result.status, 1);
  assert.equal(result.events[0].phase, "pairing");
  assert.deepEqual(result.calls.map(call => call.phase), ["installation", "pairing", "cleanup"]);
});

test("uncancelled pending pairing still fails the recovery gate", async () => {
  const result = await run({ responses: { recovery: JSON.stringify({ ok: true, live: true, cancelledPendingPairing: false, bindingState: "UNPAIRED" }) } });
  assert.equal(result.status, 1);
  assert.equal(result.events[0].phase, "recovery");
});

for (const body of ["missing required recovery content", 'VeyoCast Player herstellen "/api/player/installation" "/api/player/pairing" /_next/private.js']) {
  test("standalone LG recovery content checks retain their original failure behavior", async () => {
    const result = await run({ responses: { lg_recovery: body } });
    assert.equal(result.status, 1);
    assert.deepEqual(result.events, [{ event: "player_pairing_smoke_failed", phase: "lg_recovery", code: "CONTENT_INVALID", httpStatus: 0, exitCode: 1 }]);
  });
}
