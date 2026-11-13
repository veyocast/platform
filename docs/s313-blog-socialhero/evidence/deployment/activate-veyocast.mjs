#!/usr/bin/env node
// Operator-only recipe for the existing Auth/MFA and guarded RPC boundaries.
// Never run automatically, import a service key, or print a backend error body.
import {createHash, randomBytes, randomUUID} from 'node:crypto';
import {constants, closeSync, existsSync, fstatSync, fsyncSync, lstatSync, mkdirSync, openSync, realpathSync, unlinkSync, writeFileSync} from 'node:fs';
import {homedir} from 'node:os';
import {basename, dirname, isAbsolute, join, relative, resolve} from 'node:path';
import {StringDecoder} from 'node:string_decoder';
import {fileURLToPath} from 'node:url';

export const PROJECT = 'gjmdqsukjfhmmblnmhqd';
export const BACKEND = `https://${PROJECT}.supabase.co`;
export const ORIGIN = 'https://veyocast.nl';
export const SCOPES = Object.freeze(['capabilities:read', 'posts:read', 'media:write', 'posts:write', 'posts:publish']);
const UUID = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/iu;
const SAFE_CODES = new Set(['ABORTED', 'TTY_REQUIRED', 'INVALID_PUBLIC_KEY', 'AUTH_REJECTED', 'IDENTITY_MISMATCH', 'MFA_REQUIRED', 'API_REJECTED', 'NETWORK_UNAVAILABLE', 'DESTINATION_MISMATCH', 'OUTPUT_UNSAFE', 'HANDOFF_NOT_CONFIRMED', 'REVOCATION_UNCONFIRMED', 'ACTIVATION_FAILED']);
export class ActivationError extends Error {
  constructor(code) {super(SAFE_CODES.has(code) ? code : 'ACTIVATION_FAILED'); this.code = this.message;}
}
export function failureCode(error) {return error instanceof ActivationError ? error.code : 'ACTIVATION_FAILED';}
function fail(code) {throw new ActivationError(code);}
function claims(token) {try {return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());} catch {fail('AUTH_REJECTED');}}
export function validatePublicKey(key) {
  if (typeof key !== 'string' || key.length > 6000) fail('INVALID_PUBLIC_KEY');
  if (/^sb_publishable_[A-Za-z0-9_-]{20,}$/u.test(key)) return key;
  if (!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/u.test(key)) fail('INVALID_PUBLIC_KEY');
  let value; try {value = claims(key);} catch {fail('INVALID_PUBLIC_KEY');}
  if (value.role !== 'anon' || value.ref !== PROJECT) fail('INVALID_PUBLIC_KEY');
  return key;
}
export function backendUrl(path) {
  if (!['/auth/v1/token?grant_type=password', '/auth/v1/token?grant_type=refresh_token', '/auth/v1/user', '/auth/v1/logout?scope=local', '/rest/v1/rpc/blog_configure_site', '/rest/v1/rpc/blog_manage_token'].includes(path)
    && !/^\/auth\/v1\/factors\/[a-f0-9-]{36}\/(challenge|verify)$/iu.test(path)) fail('DESTINATION_MISMATCH');
  const url = new URL(path, BACKEND);
  if (url.origin !== BACKEND) fail('DESTINATION_MISMATCH');
  return url.href;
}

export function writeCredential(path, credential) {
  let fd, created;
  try {
    if (!isAbsolute(path) || basename(path) === '.git') fail('OUTPUT_UNSAFE');
    const parent = dirname(resolve(path));
    mkdirSync(parent, {recursive: true, mode: 0o700});
    const actualParent = realpathSync(parent), directory = lstatSync(actualParent);
    if (!directory.isDirectory() || directory.uid !== process.getuid() || (directory.mode & 0o077)) fail('OUTPUT_UNSAFE');
    for (let cursor = actualParent;; cursor = dirname(cursor)) {
      if (existsSync(join(cursor, '.git'))) fail('OUTPUT_UNSAFE');
      if (dirname(cursor) === cursor) break;
    }
    // Also reject a nested location under this checkout, including .git-less copies.
    const checkout = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
    const candidate = join(actualParent, basename(path)), rel = relative(checkout, candidate);
    if (!rel.startsWith('..') && !isAbsolute(rel)) fail('OUTPUT_UNSAFE');
    fd = openSync(candidate, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
    const stat = fstatSync(fd);
    created = {path: candidate, dev: stat.dev, ino: stat.ino};
    if (!stat.isFile() || stat.uid !== process.getuid() || (stat.mode & 0o777) !== 0o600) fail('OUTPUT_UNSAFE');
    writeFileSync(fd, `${credential}\n`, {encoding: 'utf8'}); fsyncSync(fd); closeSync(fd); fd = undefined;
    return {path: candidate, dev: stat.dev, ino: stat.ino};
  } catch {
    if (fd !== undefined) closeSync(fd);
    if (created) removeCredential(created);
    fail('OUTPUT_UNSAFE');
  }
}
export function removeCredential(file) {
  if (!file) return;
  try {
    const stat = lstatSync(file.path);
    if (!stat.isFile() || stat.dev !== file.dev || stat.ino !== file.ino || stat.uid !== process.getuid()) fail('OUTPUT_UNSAFE');
    unlinkSync(file.path);
  } catch (error) {if (error.code !== 'ENOENT') fail('OUTPUT_UNSAFE');}
}

export function hiddenPrompt(label, signal) {
  if (!process.stdin.isTTY || !process.stdout.isTTY || typeof process.stdin.setRawMode !== 'function') return Promise.reject(new ActivationError('TTY_REQUIRED'));
  return new Promise((accept, reject) => {
    let value = ''; const decoder = new StringDecoder('utf8'); const previousRaw = process.stdin.isRaw;
    const finish = (error) => {
      process.stdin.off('data', input); signal?.removeEventListener('abort', abort);
      process.stdin.setRawMode(Boolean(previousRaw)); process.stdin.pause(); process.stdout.write('\n');
      if (error) reject(error); else accept(value);
      value = '';
    };
    const abort = () => finish(new ActivationError('ABORTED'));
    const input = (chunk) => {
      for (const char of decoder.write(chunk)) {
        if (char === '\u0003' || char === '\u0004') {abort(); return;}
        if (char === '\r' || char === '\n') {finish(); return;}
        if (char === '\u007f' || char === '\b') value = [...value].slice(0, -1).join('');
        else if (char.charCodeAt(0) >= 32 && char !== '\u001b' && value.length < 6000) value += char;
      }
    };
    if (signal?.aborted) {reject(new ActivationError('ABORTED')); return;}
    // Disable terminal echo before exposing the prompt; fast paste must never
    // arrive in the small interval between prompt output and raw mode.
    process.stdin.setRawMode(true); process.stdin.on('data', input); process.stdin.resume(); process.stdout.write(label);
    signal?.addEventListener('abort', abort, {once: true});
  });
}

class Session {
  constructor(key, fetchImpl, signal) {this.key = key; this.fetch = fetchImpl; this.signal = signal;}
  async request(path, body, {cleanup = false, retry = true} = {}) {
    let response;
    try {
      response = await this.fetch(backendUrl(path), {method: body === undefined ? 'GET' : 'POST', redirect: 'error', cache: 'no-store',
        signal: !cleanup && this.signal ? AbortSignal.any([this.signal, AbortSignal.timeout(15_000)]) : AbortSignal.timeout(15_000),
        headers: {apikey: this.key, ...(this.access ? {Authorization: `Bearer ${this.access}`} : {}), 'Content-Type': 'application/json'},
        ...(body === undefined ? {} : {body: JSON.stringify(body)})});
    } catch {fail(!cleanup && this.signal?.aborted ? 'ABORTED' : 'NETWORK_UNAVAILABLE');}
    if (response.status === 401 && this.refresh && retry && path !== '/auth/v1/token?grant_type=refresh_token') {
      const refreshed = await this.request('/auth/v1/token?grant_type=refresh_token', {refresh_token: this.refresh}, {cleanup, retry: false});
      this.set(refreshed); await this.verify(true, cleanup); return this.request(path, body, {cleanup, retry: false});
    }
    if (!response.ok) fail(path.startsWith('/auth/') ? 'AUTH_REJECTED' : 'API_REJECTED');
    if (response.status === 204) return {};
    try {const text = await response.text(); if (text.length > 1_000_000) fail('API_REJECTED'); return JSON.parse(text);} catch {fail('API_REJECTED');}
  }
  set(data) {
    if (typeof data.access_token !== 'string' || typeof data.refresh_token !== 'string') fail('AUTH_REJECTED');
    this.access = data.access_token; this.refresh = data.refresh_token;
  }
  async verify(aal2 = false, cleanup = false) {
    const user = await this.request('/auth/v1/user', undefined, {cleanup, retry: false});
    if (!UUID.test(user.id) || this.userId && user.id !== this.userId || claims(this.access).sub !== user.id) fail('IDENTITY_MISMATCH');
    this.userId = user.id;
    if (aal2 && claims(this.access).aal !== 'aal2') fail('MFA_REQUIRED');
    return user;
  }
  rpc(name, body, cleanup = false) {return this.request(`/rest/v1/rpc/${name}`, body, {cleanup});}
}

function checkCapabilities(value) {
  if (value.siteId !== 'veyocast' || value.environment !== 'production' || value.contractVersion !== '1' || value.publicOrigin !== ORIGIN || value.canonicalOrigin !== ORIGIN || value.blogPath !== '/blog' || !value.permissions?.media || !value.permissions?.drafts || !value.permissions?.publish) fail('DESTINATION_MISMATCH');
}
async function capabilities(fetchImpl, credential) {
  try {
    const response = await fetchImpl(`${ORIGIN}/api/socialhero/v1/capabilities`, {redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(15_000), headers: {Authorization: `Bearer ${credential}`}});
    if (!response.ok) fail('API_REJECTED'); checkCapabilities(await response.json());
  } catch (error) {if (error instanceof ActivationError) throw error; fail('NETWORK_UNAVAILABLE');}
}

export async function activate({prompt = hiddenPrompt, report = (value) => process.stdout.write(`${JSON.stringify(value)}\n`), fetchImpl = globalThis.fetch, signal, outputPath} = {}) {
  let session, file, credential, tokenId, createAttempted = false, succeeded = false;
  const label = `socialhero-production-${randomUUID()}`;
  const expiresAt = new Date(Date.now() + 90 * 86_400_000).toISOString();
  const scope = {p_site_id: 'veyocast', p_environment: 'production'};
  try {
    const key = validatePublicKey(await prompt('Publieke anon/publishable API-key (verborgen): ', signal));
    session = new Session(key, fetchImpl, signal);
    const email = await prompt('Eigen beheer-e-mailadres (verborgen): ', signal);
    const password = await prompt('Eigen wachtwoord (verborgen): ', signal);
    session.set(await session.request('/auth/v1/token?grant_type=password', {email, password}));
    const user = await session.verify();
    const factors = (user.factors ?? []).filter(f => f.factor_type === 'totp' && f.status === 'verified' && UUID.test(f.id));
    if (!factors.length) fail('MFA_REQUIRED');
    report({step: 'mfa', verifiedTotpFactors: factors.length});
    const index = factors.length === 1 ? 0 : Number(await prompt(`TOTP-factornummer 1–${factors.length} (volgorde van eigen Auth-account): `, signal)) - 1;
    if (!Number.isSafeInteger(index) || !factors[index]) fail('MFA_REQUIRED');
    const factor = factors[index].id;
    const challenge = await session.request(`/auth/v1/factors/${factor}/challenge`, {factorId: factor});
    if (!UUID.test(challenge.id)) fail('AUTH_REJECTED');
    const code = await prompt('Actuele authenticatorcode (verborgen): ', signal);
    if (!/^\d{6}$/u.test(code)) fail('MFA_REQUIRED');
    session.set(await session.request(`/auth/v1/factors/${factor}/verify`, {challenge_id: challenge.id, code}));
    await session.verify(true);
    await session.rpc('blog_configure_site', {...scope, p_public_origin: ORIGIN});
    credential = randomBytes(48).toString('base64url');
    const path = outputPath ?? await prompt('Nieuw absoluut pad buiten iedere repository, in een private map (verborgen; leeg = veilige standaard): ', signal);
    file = writeCredential(path || join(homedir(), '.local/state/veyocast-activation', `${label}.txt`), credential);
    createAttempted = true;
    const registered = await session.rpc('blog_manage_token', {...scope, p_action: 'create', p_token_id: null,
      p_token_hash: createHash('sha256').update(credential).digest('hex'), p_label: label, p_scopes: [...SCOPES], p_expires_at: expiresAt});
    if (!UUID.test(registered.id)) fail('API_REJECTED'); tokenId = registered.id;
    await capabilities(fetchImpl, credential);
    report({step: 'handoff', credentialFile: file.path, mode: '0600', tokenId, label, expiresAt,
      instruction: 'Open dit private bestand lokaal en plak de credential uitsluitend in SocialHero Website en blog. Sla op en test alleen-lezen. Deel niets in chat/logs. Het tijdelijke bestand wordt na bevestiging verwijderd.'});
    if (await prompt('Typ GEREED na succesvolle opslag én geverifieerde SocialHero-verbinding, anders wordt ingetrokken: ', signal) !== 'GEREED') fail('HANDOFF_NOT_CONFIRMED');
    await capabilities(fetchImpl, credential);
    removeCredential(file); file = undefined; succeeded = true;
    const result = {status: 'activated_by_operator', siteId: 'veyocast', environment: 'production', publicOrigin: ORIGIN, tokenId, label, scopes: [...SCOPES], expiresAt};
    report(result); return result;
  } catch (error) {
    let revoked = !createAttempted;
    if (session && createAttempted) {
      try {
        const rows = await session.rpc('blog_manage_token', {...scope, p_action: 'list'}, true);
        const matches = Array.isArray(rows) ? rows.filter(row => row.label === label) : [];
        if (matches.length !== 1 || tokenId && matches[0].id !== tokenId) fail('REVOCATION_UNCONFIRMED');
        tokenId = matches[0].id;
        if (!UUID.test(tokenId)) fail('REVOCATION_UNCONFIRMED');
        if (!matches[0].revokedAt) await session.rpc('blog_manage_token', {...scope, p_action: 'revoke', p_token_id: tokenId}, true);
        const after = await session.rpc('blog_manage_token', {...scope, p_action: 'list'}, true);
        revoked = Array.isArray(after) && after.some(row => row.id === tokenId && Boolean(row.revokedAt));
      } catch {revoked = false;}
    }
    if (revoked) {removeCredential(file); file = undefined;}
    if (!revoked) {
      report({status: 'operator_recovery_required', code: 'REVOCATION_UNCONFIRMED', tokenId: tokenId ?? null, label, credentialFile: file?.path ?? null,
        instruction: 'Geen succesvolle activering. Bewaar het private bestand; controleer en revoke deze exacte registratie met een echte AAL2-sessie. Er zijn geen credentialwaarden gelogd.'});
      fail('REVOCATION_UNCONFIRMED');
    }
    throw new ActivationError(failureCode(error));
  } finally {
    credential = undefined;
    if (session?.access) {
      try {await session.request('/auth/v1/logout?scope=local', {}, {cleanup: true, retry: false});}
      catch {report({step: 'logout', status: 'unconfirmed', activationCompleted: succeeded});}
    }
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.umask(0o077);
  if (process.argv.length !== 2 || !process.stdin.isTTY || !process.stdout.isTTY) {
    process.stderr.write('TTY_REQUIRED: start interactief zonder argumenten; deel geen secrets in chat/logs.\n'); process.exitCode = 1;
  } else {
    const controller = new AbortController(); const abort = () => controller.abort();
    process.once('SIGINT', abort); process.once('SIGTERM', abort);
    try {await activate({signal: controller.signal});}
    catch (error) {process.stderr.write(`${failureCode(error)}: activering niet voltooid; gebruik de niet-geheime herstelstatus.\n`); process.exitCode = 1;}
    finally {process.off('SIGINT', abort); process.off('SIGTERM', abort);}
  }
}
