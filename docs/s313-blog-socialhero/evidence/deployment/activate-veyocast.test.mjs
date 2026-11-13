import assert from 'node:assert/strict';
import {mkdtempSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync, chmodSync, existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import test from 'node:test';
import {activate, ActivationError, BACKEND, ORIGIN, PROJECT, SCOPES, backendUrl, failureCode, validatePublicKey, writeCredential, removeCredential} from './activate-veyocast.mjs';

const userId = '31300000-0000-4000-8000-000000000001';
const factorId = '31300000-0000-4000-8000-000000000002';
const tokenId = '31300000-0000-4000-8000-000000000003';
const challengeId = '31300000-0000-4000-8000-000000000004';
const key = 'sb_publishable_TEST_FIXTURE_NO_LIVE_AUTH_313';
const password = 'LOCAL-UNIT-TEST-PASSWORD-ONLY';
const otp = '123456';
const jwt = (aal = 'aal2', sub = userId, extras = {}) => `${Buffer.from('{}').toString('base64url')}.${Buffer.from(JSON.stringify({sub, aal, ...extras})).toString('base64url')}.UNIT_TEST_NOT_A_SIGNED_TOKEN`;

function fixture(t, options = {}) {
  const folder = mkdtempSync(join(tmpdir(), 'veyocast-operator-test-'));
  t.after(() => rmSync(folder, {recursive: true, force: true}));
  const file = join(folder, 'new-credential.txt');
  const calls = [], reports = [], state = {row: null, credential: null, verifyCount: 0};
  const fetchImpl = async (url, init) => {
    calls.push({url, init}); assert.ok(url.startsWith(BACKEND + '/') || url === ORIGIN + '/api/socialhero/v1/capabilities');
    assert.equal(init.redirect, 'error'); assert.equal(init.cache, 'no-store');
    const path = new URL(url).pathname + new URL(url).search;
    const body = init.body ? JSON.parse(init.body) : null;
    if (path === '/auth/v1/token?grant_type=password') {
      assert.deepEqual(body, {email: 'operator@example.test', password});
      return Response.json({access_token: jwt('aal1'), refresh_token: 'LOCAL_TEST_REFRESH'});
    }
    if (path === '/auth/v1/user') {
      state.verifyCount++;
      return Response.json({id: options.changedIdentity && state.verifyCount > 1 ? factorId : userId,
        factors: options.noFactor ? [] : [{id: factorId, factor_type: 'totp', status: 'verified'}]});
    }
    if (path.endsWith('/challenge')) {assert.deepEqual(body, {factorId}); return Response.json({id: challengeId});}
    if (path.endsWith('/verify')) {
      assert.deepEqual(body, {challenge_id: challengeId, code: otp});
      return Response.json({access_token: jwt(options.remainsAal1 ? 'aal1' : 'aal2'), refresh_token: 'LOCAL_TEST_UPGRADED_REFRESH'});
    }
    if (path === '/rest/v1/rpc/blog_configure_site') {
      assert.deepEqual(body, {p_site_id: 'veyocast', p_environment: 'production', p_public_origin: ORIGIN});
      if (options.denied) return Response.json({message: password + jwt()}, {status: 403});
      return Response.json({siteId: 'veyocast', environment: 'production', publicOrigin: ORIGIN});
    }
    if (path === '/rest/v1/rpc/blog_manage_token') {
      assert.equal(body.p_site_id, 'veyocast'); assert.equal(body.p_environment, 'production');
      if (body.p_action === 'create') {
        assert.match(body.p_token_hash, /^[a-f0-9]{64}$/u); assert.deepEqual(body.p_scopes, [...SCOPES]);
        assert.ok(Date.parse(body.p_expires_at) > Date.now() + 89 * 86400000);
        assert.ok(Date.parse(body.p_expires_at) <= Date.now() + 90 * 86400000);
        state.credential = readFileSync(file, 'utf8').trim(); assert.match(state.credential, /^[A-Za-z0-9_-]{64}$/u);
        if (!options.unknownCreate) state.row = {id: tokenId, label: body.p_label, revokedAt: null};
        if (options.afterCommitTimeout || options.unknownCreate) throw new Error(password + ' raw backend failure');
        return Response.json({id: tokenId, action: 'create'});
      }
      if (body.p_action === 'list') return Response.json(state.row ? [state.row] : []);
      if (body.p_action === 'revoke') {
        if (options.revokeUnavailable) throw new Error('raw error ' + password);
        assert.equal(body.p_token_id, tokenId); state.row.revokedAt = new Date().toISOString();
        return Response.json({id: tokenId, action: 'revoke'});
      }
    }
    if (url === ORIGIN + '/api/socialhero/v1/capabilities') {
      assert.equal(init.headers.Authorization, `Bearer ${state.credential}`);
      return Response.json({siteId: 'veyocast', environment: 'production', contractVersion: '1', blogPath: '/blog',
        publicOrigin: ORIGIN, canonicalOrigin: options.wrongOrigin ? 'https://foreign.example.test' : ORIGIN,
        permissions: {media: true, drafts: true, publish: true}});
    }
    if (path === '/auth/v1/logout?scope=local') return new Response(null, {status: 204});
    throw new Error('UNEXPECTED TEST REQUEST');
  };
  const answers = [key, 'operator@example.test', password, otp, options.cancel ? 'STOP' : 'GEREED'];
  const prompt = async (label) => {
    if (label.startsWith('Typ GEREED')) {
      assert.ok(existsSync(file)); assert.equal(statSync(file).mode & 0o777, 0o600);
    }
    return answers.shift();
  };
  const report = value => reports.push(value);
  const run = () => activate({prompt, report, fetchImpl, outputPath: file});
  const noSecrets = () => {
    const output = JSON.stringify(reports);
    for (const secret of [key, password, otp, jwt('aal1'), jwt('aal2'), 'LOCAL_TEST_UPGRADED_REFRESH', state.credential].filter(Boolean)) assert.ok(!output.includes(secret), 'Secret must not occur in operator reports');
  };
  return {run, calls, reports, state, file, noSecrets};
}

test('public-key guard rejects service credentials and foreign-project anon JWTs', () => {
  assert.equal(validatePublicKey(key), key);
  assert.equal(validatePublicKey(jwt('aal1', userId, {role: 'anon', ref: PROJECT})).split('.').length, 3);
  for (const bad of ['sb_secret_UNIT_TEST', jwt('aal2', userId, {role: 'service_role', ref: PROJECT}), jwt('aal1', userId, {role: 'anon', ref: 'foreignprojectreference'})]) assert.throws(() => validatePublicKey(bad), {code: 'INVALID_PUBLIC_KEY'});
});
test('only the fixed project, Auth operations and two exact RPC paths are reachable', () => {
  assert.equal(backendUrl('/rest/v1/rpc/blog_configure_site'), BACKEND + '/rest/v1/rpc/blog_configure_site');
  for (const path of ['https://evil.example/auth/v1/user', '//evil.example/auth/v1/user', '/rest/v1/platform_blog_tokens', '/rest/v1/rpc/other', '/auth/v1/logout?scope=global']) assert.throws(() => backendUrl(path), {code: 'DESTINATION_MISMATCH'});
});
test('credential file is private, outside repositories, and never clobbers files or follows symlinks', t => {
  const folder = mkdtempSync(join(tmpdir(), 'veyocast-operator-file-')); t.after(() => rmSync(folder, {recursive: true, force: true}));
  const path = join(folder, 'new.txt'), value = 'LOCAL-TEST-ONLY'; const file = writeCredential(path, value);
  assert.equal(statSync(path).mode & 0o777, 0o600); assert.equal(readFileSync(path, 'utf8'), value + '\n');
  assert.throws(() => writeCredential(path, 'REPLACED'), {code: 'OUTPUT_UNSAFE'}); assert.equal(readFileSync(path, 'utf8'), value + '\n');
  const link = join(folder, 'link.txt'); symlinkSync(path, link); assert.throws(() => writeCredential(link, 'REPLACED'), {code: 'OUTPUT_UNSAFE'});
  assert.throws(() => writeCredential(join(dirname(fileURLToPath(import.meta.url)), 'unsafe-token.txt'), value), {code: 'OUTPUT_UNSAFE'});
  removeCredential(file); assert.ok(!existsSync(path));
});
test('world-readable output directories and relative paths are rejected', t => {
  const folder = mkdtempSync(join(tmpdir(), 'veyocast-operator-mode-')); t.after(() => rmSync(folder, {recursive: true, force: true})); chmodSync(folder, 0o755);
  assert.throws(() => writeCredential(join(folder, 'new.txt'), 'TEST'), {code: 'OUTPUT_UNSAFE'});
  assert.throws(() => writeCredential('relative.txt', 'TEST'), {code: 'OUTPUT_UNSAFE'});
});
test('real login/MFA-shaped sequence checks identity and writes only the hash; confirmed handoff removes the file', async t => {
  const f = fixture(t); const result = await f.run(); assert.equal(result.status, 'activated_by_operator');
  assert.equal(result.tokenId, tokenId); assert.ok(!existsSync(f.file)); assert.equal(f.state.row.revokedAt, null); f.noSecrets();
  assert.ok(f.calls.some(c => c.url.endsWith('/auth/v1/logout?scope=local')));
});
test('AAL1 after verification, no TOTP factor and changed identity fail before any blog mutation', async t => {
  for (const options of [{remainsAal1: true}, {noFactor: true}, {changedIdentity: true}]) {
    const f = fixture(t, options); await assert.rejects(f.run(), ActivationError);
    assert.ok(!f.calls.some(c => c.url.includes('/rest/v1/'))); assert.ok(!existsSync(f.file)); f.noSecrets();
  }
});
test('database permission denial remains denied and never emits the backend error or registers a token', async t => {
  const f = fixture(t, {denied: true}); await assert.rejects(f.run(), {code: 'API_REJECTED'});
  assert.equal(f.state.row, null); assert.ok(!existsSync(f.file)); f.noSecrets();
});
test('failed handoff revokes the exact new credential, verifies revocation and deletes only its temporary file', async t => {
  const f = fixture(t, {cancel: true}); await assert.rejects(f.run(), {code: 'HANDOFF_NOT_CONFIRMED'});
  assert.ok(f.state.row.revokedAt); assert.ok(!existsSync(f.file)); f.noSecrets();
});
test('canonical destination mismatch revokes the created credential', async t => {
  const f = fixture(t, {wrongOrigin: true}); await assert.rejects(f.run(), {code: 'DESTINATION_MISMATCH'});
  assert.ok(f.state.row.revokedAt); assert.ok(!existsSync(f.file)); f.noSecrets();
});
test('an after-COMMIT timeout finds the unique operation label and revokes without creating a second credential', async t => {
  const f = fixture(t, {afterCommitTimeout: true}); await assert.rejects(f.run(), {code: 'NETWORK_UNAVAILABLE'});
  assert.ok(f.state.row.revokedAt); assert.ok(!existsSync(f.file));
  assert.equal(f.calls.filter(c => c.init.body && JSON.parse(c.init.body).p_action === 'create').length, 1); f.noSecrets();
});
test('unknown write or unreachable revoke preserves the private recovery file and reports no successful activation', async t => {
  for (const options of [{unknownCreate: true}, {cancel: true, revokeUnavailable: true}]) {
    const f = fixture(t, options); await assert.rejects(f.run(), {code: 'REVOCATION_UNCONFIRMED'});
    assert.ok(existsSync(f.file)); assert.equal(statSync(f.file).mode & 0o777, 0o600);
    assert.ok(f.reports.some(r => r.status === 'operator_recovery_required'));
    assert.ok(!f.reports.some(r => r.status === 'activated_by_operator')); f.noSecrets();
  }
});
test('arbitrary exceptions and non-TTY CLI invocation never print arguments or secret-bearing stack messages', () => {
  assert.equal(failureCode(new Error(password + jwt())), 'ACTIVATION_FAILED');
  const script = fileURLToPath(new URL('./activate-veyocast.mjs', import.meta.url));
  const r = spawnSync(process.execPath, [script, password], {encoding: 'utf8'});
  assert.equal(r.status, 1); assert.match(r.stderr, /TTY_REQUIRED/u); assert.ok(!r.stderr.includes(password)); assert.ok(!r.stdout.includes(password));
});
test('a real local PTY accepts hidden input without echoing its bytes', () => {
  const source = String.raw`
import json,os,pty,select,subprocess,sys,time
from pathlib import Path
master,slave=pty.openpty()
code='import {hiddenPrompt} from '+json.dumps(Path(sys.argv[2]).as_uri())+'; await hiddenPrompt("VERBORGEN: "); console.log("PTY_DONE");'
child=subprocess.Popen([sys.argv[1],'--input-type=module','-e',code],stdin=slave,stdout=slave,stderr=slave)
os.close(slave); output=b''; deadline=time.monotonic()+5
while b'VERBORGEN: ' not in output and time.monotonic()<deadline:
 if select.select([master],[],[],0.05)[0]: output+=os.read(master,4096)
assert b'VERBORGEN: ' in output
secret=b'LOCAL_PTY_SECRET_313';os.write(master,secret+b'\r')
while time.monotonic()<deadline:
 if select.select([master],[],[],0.05)[0]:
  try: output+=os.read(master,4096)
  except OSError: break
 if child.poll() is not None and b'PTY_DONE' in output: break
try: assert child.wait(timeout=1)==0
finally:
 if child.poll() is None: child.kill();child.wait()
 os.close(master)
assert secret not in output
assert b'PTY_DONE' in output
print('PTY no-echo PASS')
`;
  const r = spawnSync('python3', ['-c', source, process.execPath, fileURLToPath(new URL('./activate-veyocast.mjs', import.meta.url))], {encoding: 'utf8', timeout: 8000});
  assert.equal(r.status, 0, 'Local PTY must finish without a secret-bearing diagnostic'); assert.match(r.stdout, /PTY no-echo PASS/u);
});
