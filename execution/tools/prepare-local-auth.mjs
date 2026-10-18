import { Buffer } from "node:buffer";
import process from "node:process";
import { URL } from "node:url";
import { execFileSync } from "node:child_process";
import { createHmac } from "node:crypto";
import { chmodSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

if (process.env.VEYOCAST_S226_LOCAL_ACCEPTANCE !== "1") throw new Error("LOCAL_ACCEPTANCE_OPT_IN_REQUIRED");

// This helper can only authenticate the dedicated, disposable QA identity.
// It never reads production configuration and prints no keys, tokens or TOTP secret.
const { fetch, AbortSignal } = globalThis;
const statusPath = "/tmp/veyocast-s226-local-status.json";
const outputPath = "/tmp/veyocast-s226-qa-auth-state.json";
const qaUser = "19170000-0000-4000-8000-000000000001";
const qaTenant = "19170000-0000-4000-8000-000000000010";
function assert(value, code) { if (!value) throw new Error(code); }
function base32Bytes(secret) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"; let bits = "";
  for (const character of secret.toUpperCase().replace(/=+$/u, "")) { const value = alphabet.indexOf(character); assert(value >= 0, "LOCAL_QA_TOTP_INVALID"); bits += value.toString(2).padStart(5, "0"); }
  return Buffer.from(Array.from({ length: Math.floor(bits.length / 8) }, (_, index) => Number.parseInt(bits.slice(index * 8, index * 8 + 8), 2)));
}
function totp(secret) {
  const counter = Buffer.alloc(8); counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30_000)));
  const digest = createHmac("sha1", base32Bytes(secret)).update(counter).digest(); const offset = digest[digest.length - 1] & 15;
  return String((digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).padStart(6, "0");
}
async function run() {
  assert(process.cwd() === "/home/codex/repos/castivo-s226", "LOCAL_QA_WORKTREE_REQUIRED");
  assert((statSync(statusPath).mode & 0o777) === 0o600, "LOCAL_QA_STATUS_MODE_REQUIRED");
  const status = JSON.parse(readFileSync(statusPath, "utf8"));
  const api = new URL(status.API_URL); const database = new URL(status.DB_URL);
  assert(api.protocol === "http:" && api.hostname === "127.0.0.1" && api.port === "57621" && api.pathname === "/", "LOCAL_QA_API_REQUIRED");
  assert(database.hostname === "127.0.0.1" && database.port === "57622", "LOCAL_QA_DATABASE_REQUIRED");
  const container = execFileSync("docker", ["inspect", "--format", '{{.Name}} {{ index .Config.Labels "com.supabase.cli.project" }}', "supabase_db_veyocast-s226"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 10_000 }).trim();
  assert(container === "/supabase_db_veyocast-s226 veyocast-s226", "LOCAL_QA_CONTAINER_REQUIRED");
  assert(typeof status.ANON_KEY === "string" && status.ANON_KEY.length > 20, "LOCAL_QA_PUBLIC_KEY_REQUIRED");
  const require = createRequire(resolve("apps/control/package.json")); const { createServerClient } = require("@supabase/ssr");
  const cookies = new Map();
  const client = createServerClient(api.origin, status.ANON_KEY, {
    global: { fetch(input, init) { const target = new URL(typeof input === "string" ? input : input.url ?? String(input)); assert(target.origin === api.origin, "LOCAL_QA_FETCH_ORIGIN_REQUIRED"); return fetch(input, { ...init, signal: init?.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(30_000)]) : AbortSignal.timeout(30_000) }); } },
    cookies: { getAll: () => [...cookies.values()], setAll: values => { for (const cookie of values) cookies.set(cookie.name, cookie); } }
  });
  const signIn = await client.auth.signInWithPassword({ email: "sites-qa@veyocast.test", password: "veyocast-local" });
  assert(!signIn.error && signIn.data.user?.id === qaUser, "LOCAL_QA_SIGN_IN_FAILED");
  const factors = await client.auth.mfa.listFactors();
  assert(!factors.error, "LOCAL_QA_MFA_LIST_FAILED");
  const existing = factors.data.all.filter(factor => factor.factor_type === "totp" && factor.status === "verified");
  assert(existing.length <= 1, "LOCAL_QA_MFA_IDENTITY_AMBIGUOUS");
  let factorId, factorSecret;
  if (existing.length === 1) {
    // Reuse this exact owned local identity after a /tmp restart. Auth correctly
    // requires AAL2 before enrolling an additional factor. Never reset its MFA.
    const saved = JSON.parse(execFileSync("docker", ["exec", "supabase_db_veyocast-s226", "psql", "-U", "postgres", "-Atc",
      `select json_build_object('id',id,'secret',secret) from auth.mfa_factors where user_id='${qaUser}' and id='${existing[0].id}' and status='verified' and factor_type='totp';`
    ], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 10_000 }).trim());
    assert(saved.id === existing[0].id && /^[A-Z2-7]{16,128}$/u.test(saved.secret), "LOCAL_QA_EXISTING_FACTOR_INVALID");
    factorId = saved.id; factorSecret = saved.secret;
  } else {
    const enrollment = await client.auth.mfa.enroll({ factorType: "totp", friendlyName: `Sites disposable local QA ${Date.now()}` });
    assert(!enrollment.error && enrollment.data?.id && enrollment.data.totp?.secret, "LOCAL_QA_MFA_ENROLL_FAILED");
    factorId = enrollment.data.id; factorSecret = enrollment.data.totp.secret;
  }
  const challenge = await client.auth.mfa.challenge({ factorId });
  assert(!challenge.error && challenge.data?.id, "LOCAL_QA_MFA_CHALLENGE_FAILED");
  const verified = await client.auth.mfa.verify({ factorId, challengeId: challenge.data.id, code: totp(factorSecret) });
  assert(!verified.error && verified.data?.access_token && verified.data.refresh_token, "LOCAL_QA_MFA_VERIFY_FAILED");
  const setSession = await client.auth.setSession({ access_token: verified.data.access_token, refresh_token: verified.data.refresh_token });
  assert(!setSession.error && setSession.data.user?.id === qaUser, "LOCAL_QA_SESSION_FAILED");
  const assurance = await client.auth.mfa.getAuthenticatorAssuranceLevel(); const user = await client.auth.getUser();
  assert(!assurance.error && assurance.data.currentLevel === "aal2" && !user.error && user.data.user?.id === qaUser, "LOCAL_QA_AAL2_REQUIRED");
  const membership = await client.from("tenant_memberships").select("tenant_id").eq("tenant_id", qaTenant).eq("user_id", qaUser).maybeSingle();
  assert(!membership.error && membership.data?.tenant_id === qaTenant, "LOCAL_QA_TENANT_REQUIRED");
  const releases = await client.from("playlist_releases").select("id,version,playlist:playlists(name)").eq("tenant_id", qaTenant).limit(1);
  assert(!releases.error, "LOCAL_QA_RELEASE_RELATION_FAILED");
  process.stdout.write(JSON.stringify({ check: "mobile-release-relation", status: "PASS", role: "authenticated", tenantScoped: true, rows: releases.data.length }) + "\n");
  const state = { cookies: [...cookies.values()].filter(cookie => cookie.value).map(cookie => ({ name: cookie.name, value: cookie.value, domain: "127.0.0.1", path: "/", expires: -1, httpOnly: cookie.options?.httpOnly ?? false, secure: false, sameSite: "Lax" })), origins: [] };
  assert(state.cookies.length > 0, "LOCAL_QA_SSR_COOKIES_REQUIRED");
  writeFileSync(outputPath, JSON.stringify(state), { mode: 0o600 }); chmodSync(outputPath, 0o600);
  process.stdout.write(JSON.stringify({ outcome: "ready", assuranceLevel: "aal2", identity: "dedicated-local-qa", cookieCount: state.cookies.length, storageState: outputPath, mode: "0600" }) + "\n");
}
run().catch(error => { const code = error instanceof Error && /^LOCAL_QA_[A-Z_]+$/u.test(error.message) ? error.message : "LOCAL_QA_PREPARATION_FAILED"; process.stderr.write(code + "\n"); process.exitCode = 1; });
