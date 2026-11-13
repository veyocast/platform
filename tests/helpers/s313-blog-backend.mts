/** Explicit LOCAL TEST ADAPTER. Real disposable PostgreSQL/RLS; synthetic
 * Auth/JWT and file-backed Storage HTTP, not a Supabase Auth/Storage proof. */
import { spawn } from "node:child_process";
import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { chmod, mkdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const runtimeDirectory = "/tmp/s313-blog-runtime";
export const configPath = `${runtimeDirectory}/config.json`;
const injectionPath = `${runtimeDirectory}/injection.json`;
const database = "s313_blog_acceptance";
const container = "supabase_db_veyocast-s295";
const port = 9431;
const ownerId = "31300000-0000-4000-8000-000000000001";
const roleNames = ["anon", "authenticated", "service_role"] as const;
type Role = typeof roleNames[number];
type Claims = { role: Role; sub?: string; aal?: string; exp: number; iss: string; aud?: string };
export type AdapterConfig = {
  kind: "s313-local-postgres-test-adapter"; database: string; container: string; backendOrigin: string; marketingOrigin: string;
  jwtSecret: string; anonKey: string; serviceRoleKey: string; ownerAccessToken: string; siteCredential: string; ownerId: string; workerSiteCredential?: string;
  environment: "development"; siteId: "veyocast"; expiresAt: string;
  credentialVariants?: Record<"readOnly" | "revoked" | "expired" | "wrongEnvironment", string>;
};
class AdapterError extends Error {
  constructor(readonly status: number, readonly code: string) { super(code); }
}
const hash = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex");
const literal = (value: string) => { if (value.includes("\0")) throw new AdapterError(400, "INVALID_REQUEST"); return `'${value.replaceAll("'", "''")}'`; };

// The database and container are fixed; neither a request nor an environment
// variable may redirect this adapter to an existing application database.
export async function adapterQuery(sql: string, claims?: Claims): Promise<unknown> {
  if (!/^s313_blog_acceptance$/u.test(database) || container !== "supabase_db_veyocast-s295") throw new Error("Disposable database guard failed.");
  if (claims && !roleNames.includes(claims.role)) throw new AdapterError(403, "PERMISSION_DENIED");
  const context = claims ? `set local role ${claims.role};set local request.jwt.claims=${literal(JSON.stringify(claims))};set local request.jwt.claim.sub=${literal(claims.sub ?? "")};set local request.jwt.claim.role=${literal(claims.role)};set local request.jwt.claim.aal=${literal(claims.aal ?? "aal1")};` : "";
  const input = `begin;set local standard_conforming_strings=on;set local statement_timeout='15s';${context}${sql};commit;`;
  return new Promise((accept, reject) => {
    const child = spawn("docker", ["exec", "-i", container, "psql", "-X", "-qAt", "-v", "ON_ERROR_STOP=1", "-v", "VERBOSITY=verbose", "-U", "postgres", "-d", database], { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "", stderr = "";
    const timer = setTimeout(() => child.kill("SIGKILL"), 20_000);
    child.stdout.on("data", (bytes: Buffer) => { stdout += bytes.toString(); if (stdout.length > 16_000_000) child.kill("SIGKILL"); });
    child.stderr.on("data", (bytes: Buffer) => { stderr += bytes.toString(); });
    child.once("error", () => { clearTimeout(timer); reject(new AdapterError(503, "TEMPORARILY_UNAVAILABLE")); });
    child.once("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        const state = /ERROR:\s+([A-Z0-9]{5}):/u.exec(stderr)?.[1] ?? "";
        const remoteCode = /ERROR:\s+[A-Z0-9]{5}:\s+([A-Z_]+)\b/u.exec(stderr)?.[1] ?? "";
        const allowed = new Set(["INVALID_REQUEST", "INVALID_CREDENTIAL", "PERMISSION_DENIED", "NOT_FOUND", "SLUG_CONFLICT", "IDEMPOTENCY_CONFLICT", "REVISION_CONFLICT", "REVISION_REQUIRED", "INVALID_ASSET", "INVALID_MEDIA", "MEDIA_NOT_READY", "RATE_LIMITED"]);
        reject(new AdapterError(/^PT\d{3}$/u.test(state) ? Number(state.slice(2)) : state === "42501" ? 403 : state === "23505" ? 409 : 503, allowed.has(remoteCode) ? remoteCode : state === "42501" ? "PERMISSION_DENIED" : "TEMPORARILY_UNAVAILABLE"));
        return;
      }
      try { accept(JSON.parse(stdout.trim().split("\n").at(-1) || "null")); } catch { reject(new AdapterError(503, "TEMPORARILY_UNAVAILABLE")); }
    });
    child.stdin.end(input);
  });
}

export async function readAdapterConfig(): Promise<AdapterConfig> {
  const information = await stat(configPath);
  if ((information.mode & 0o077) !== 0) throw new Error("Private adapter configuration must be mode 0600.");
  const config = JSON.parse(await readFile(configPath, "utf8")) as AdapterConfig;
  if (config.kind !== "s313-local-postgres-test-adapter" || config.database !== database || config.container !== container || config.backendOrigin !== `http://127.0.0.1:${port}`) throw new Error("Private adapter configuration failed the isolated target guard.");
  return config;
}
function signJwt(secret: string, role: Role, extra: Record<string, string> = {}) {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({ iss: "s313-local-test-adapter", aud: role === "authenticated" ? "authenticated" : role, role, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 8 * 3600, ...extra })).toString("base64url");
  const signature = createHmac("sha256", secret).update(`${header}.${payload}`).digest("base64url");
  return `${header}.${payload}.${signature}`;
}
function verifyJwt(token: string, config: AdapterConfig): Claims {
  const parts = token.split(".");
  if (parts.length !== 3 || parts.some((part) => !/^[A-Za-z0-9_-]+$/u.test(part))) throw new AdapterError(401, "INVALID_CREDENTIAL");
  const [head, payload, signature] = parts as [string, string, string];
  const expected = createHmac("sha256", config.jwtSecret).update(`${head}.${payload}`).digest();
  const actual = Buffer.from(signature, "base64url");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new AdapterError(401, "INVALID_CREDENTIAL");
  let header: { alg?: string }, claims: Claims;
  try { header = JSON.parse(Buffer.from(head, "base64url").toString()); claims = JSON.parse(Buffer.from(payload, "base64url").toString()); } catch { throw new AdapterError(401, "INVALID_CREDENTIAL"); }
  if (header.alg !== "HS256" || claims.iss !== "s313-local-test-adapter" || !roleNames.includes(claims.role) || !Number.isSafeInteger(claims.exp) || claims.exp <= Date.now() / 1000 || (claims.role === "authenticated" && !/^[0-9a-f-]{36}$/u.test(claims.sub ?? ""))) throw new AdapterError(401, "INVALID_CREDENTIAL");
  return claims;
}
function requestClaims(request: IncomingMessage, config: AdapterConfig): Claims {
  const key = request.headers.apikey;
  if (typeof key !== "string" || ![config.anonKey, config.serviceRoleKey].includes(key)) throw new AdapterError(401, "INVALID_CREDENTIAL");
  verifyJwt(key, config);
  const token = /^Bearer ([A-Za-z0-9_.-]+)$/u.exec(request.headers.authorization ?? "")?.[1];
  if (!token) throw new AdapterError(401, "INVALID_CREDENTIAL");
  return verifyJwt(token, config);
}

export async function initializeAdapter() {
  process.umask(0o077);
  if (await adapterQuery("select to_jsonb(to_regclass('public.platform_blog_posts') is not null)") !== true) throw new Error("Wait for the database agent: the disposable blog schema is not ready.");
  await mkdir(runtimeDirectory, { recursive: true, mode: 0o700 });
  await chmod(runtimeDirectory, 0o700);
  let config: AdapterConfig;
  try { config = await readAdapterConfig(); } catch {
    const jwtSecret = randomBytes(48).toString("base64url");
    config = { kind: "s313-local-postgres-test-adapter", database, container, backendOrigin: `http://127.0.0.1:${port}`, marketingOrigin: "http://127.0.0.1:9313", jwtSecret, anonKey: signJwt(jwtSecret, "anon"), serviceRoleKey: signJwt(jwtSecret, "service_role"), ownerAccessToken: signJwt(jwtSecret, "authenticated", { sub: ownerId, aal: "aal2", email: "s313-redactie@test.invalid" }), siteCredential: randomBytes(36).toString("base64url"), ownerId, environment: "development", siteId: "veyocast", expiresAt: new Date(Date.now() + 8 * 3600_000).toISOString() };
    await writeFile(configPath, JSON.stringify(config), { mode: 0o600 }); await chmod(configPath, 0o600);
  }
  await adapterQuery(`insert into auth.users(id,email) values(${literal(ownerId)}::uuid,'s313-redactie@test.invalid') on conflict(id) do nothing;insert into public.profiles(id,display_name) values(${literal(ownerId)}::uuid,'S313 testredactie') on conflict(id) do nothing;insert into public.platform_memberships(user_id,role) values(${literal(ownerId)}::uuid,'platform_owner') on conflict do nothing;select 'true'::jsonb`);
  const owner = verifyJwt(config.ownerAccessToken, config);
  await adapterQuery(`select public.blog_configure_site('veyocast','development','http://127.0.0.1:9313')`, owner);
  const exists = await adapterQuery(`select to_jsonb(exists(select 1 from private.platform_blog_tokens where token_hash=${literal(hash(config.siteCredential))}))`);
  if (!exists) await adapterQuery(`select public.blog_manage_token('veyocast','development','create',p_token_hash=>${literal(hash(config.siteCredential))},p_label=>'S313 isolated SocialHero testcredential',p_scopes=>array['capabilities:read','posts:read','posts:write','posts:publish','media:write'],p_expires_at=>${literal(config.expiresAt)}::timestamptz)`, owner);
  config.workerSiteCredential ??= randomBytes(36).toString("base64url");
  config.credentialVariants ??= { readOnly: randomBytes(36).toString("base64url"), revoked: randomBytes(36).toString("base64url"), expired: randomBytes(36).toString("base64url"), wrongEnvironment: randomBytes(36).toString("base64url") };
  await writeFile(configPath, JSON.stringify(config), { mode: 0o600 }); await chmod(configPath, 0o600);
  if (!await adapterQuery(`select to_jsonb(exists(select 1 from private.platform_blog_tokens where token_hash=${literal(hash(config.workerSiteCredential))}))`)) await adapterQuery(`select public.blog_manage_token('veyocast','development','create',p_token_hash=>${literal(hash(config.workerSiteCredential))},p_label=>'S313 isolated real SocialHero worker credential',p_scopes=>array['capabilities:read','posts:read','posts:write','posts:publish','media:write'],p_expires_at=>${literal(config.expiresAt)}::timestamptz)`, owner);
  await adapterQuery(`select public.blog_configure_site('veyocast','test','http://127.0.0.1:9313')`, owner);
  for (const [variant, credential] of Object.entries(config.credentialVariants)) {
    if (await adapterQuery(`select to_jsonb(exists(select 1 from private.platform_blog_tokens where token_hash=${literal(hash(credential))}))`)) continue;
    const environment = variant === "wrongEnvironment" ? "test" : "development";
    const created = await adapterQuery(`select public.blog_manage_token('veyocast',${literal(environment)},'create',p_token_hash=>${literal(hash(credential))},p_label=>${literal(`S313 isolated ${variant} credential`)},p_scopes=>array['capabilities:read','posts:read'],p_expires_at=>${literal(config.expiresAt)}::timestamptz)`, owner) as { id: string };
    if (variant === "revoked") await adapterQuery(`select public.blog_manage_token('veyocast','development','revoke',p_token_id=>${literal(created.id)}::uuid)`, owner);
    // Expiry is a local clock fixture, stored by exact fixture UUID only.
    if (variant === "expired") await adapterQuery(`update private.platform_blog_tokens set expires_at=clock_timestamp()-interval '1 minute' where id=${literal(created.id)}::uuid;select 'true'::jsonb`);
  }
  await mkdir(`${runtimeDirectory}/objects`, { recursive: true, mode: 0o700 });
  return { kind: config.kind, database, backendOrigin: config.backendOrigin, marketingOrigin: config.marketingOrigin, configPath, secretsPrinted: false };
}

const rpcArguments: Record<string, Record<string, string>> = {
  blog_authorize_token: { p_token_hash: "text", p_site_id: "text", p_environment: "text", p_scope: "text" },
  blog_command: { p_site_id: "text", p_environment: "text", p_operation: "text", p_external_id: "text", p_payload: "jsonb", p_expected_revision: "bigint", p_idempotency_key: "text", p_token_hash: "text" },
  blog_complete_human_media: { p_site_id: "text", p_environment: "text", p_payload: "jsonb", p_idempotency_key: "text", p_actor_user_id: "uuid" },
  blog_authorize_media_upload: { p_site_id: "text", p_environment: "text" },
  get_my_platform_ticket_capabilities_v1: {}
};
const tableColumns: Record<string, Set<string>> = {
  platform_blog_publications: new Set("id external_id site_id environment revision payload slug published_at first_published_at updated_at".split(" ")),
  platform_blog_routes: new Set("id post_id site_id environment slug was_published created_at".split(" ")),
  platform_blog_assets: new Set("id site_id environment storage_path type bytes output_sha256 source_sha256 width height status created_at".split(" ")),
  platform_blog_posts: new Set("id site_id environment external_id published_revision canonical_slug first_published_at published_at".split(" ")),
  platform_blog_sites: new Set("site_id environment public_origin".split(" ")),
  profiles: new Set("id display_name avatar_url".split(" ")),
  platform_memberships: new Set("user_id role created_at".split(" "))
};
async function bodyBytes(request: IncomingMessage, max = 8 * 1024 * 1024): Promise<Buffer> {
  const chunks: Buffer[] = []; let length = 0;
  for await (const value of request) { const bytes = Buffer.from(value); length += bytes.length; if (length > max) throw new AdapterError(413, "INVALID_REQUEST"); chunks.push(bytes); }
  return Buffer.concat(chunks);
}
function jsonBody(bytes: Buffer): Record<string, unknown> {
  try { const body: unknown = JSON.parse(bytes.toString()); if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error(); return body as Record<string, unknown>; } catch { throw new AdapterError(400, "INVALID_REQUEST"); }
}
function output(response: ServerResponse, status: number, value: unknown) {
  response.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" }).end(JSON.stringify(value));
}
type Injection = { rpc?: string; operation?: string; key?: string; storageAfterWrite?: boolean; restart?: boolean; consumed?: boolean };
async function injectAfterCommit(request: IncomingMessage, target: { rpc?: string; operation?: unknown; key?: unknown; storageAfterWrite?: boolean }) {
  let injection: Injection;
  try { injection = JSON.parse(await readFile(injectionPath, "utf8")); } catch { return false; }
  if (injection.consumed || (injection.storageAfterWrite ? !target.storageAfterWrite : injection.rpc !== target.rpc || injection.operation !== target.operation || injection.key !== target.key)) return false;
  injection.consumed = true; await writeFile(injectionPath, JSON.stringify(injection), { mode: 0o600 });
  request.socket.destroy();
  if (injection.restart) setTimeout(() => process.exit(75), 10);
  return true;
}

export async function serveAdapter() {
  const config = await readAdapterConfig();
  const instance = randomUUID();
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? "/", config.backendOrigin);
      if (request.method === "GET" && url.pathname === "/_s313/health") { output(response, 200, { kind: config.kind, database, instance, syntheticAuth: true, syntheticStorageHttp: true }); return; }
      const claims = requestClaims(request, config);
      if (request.method === "POST" && url.pathname === "/_s313/inject") {
        if (claims.role !== "service_role") throw new AdapterError(403, "PERMISSION_DENIED");
        const body = jsonBody(await bodyBytes(request, 4096));
        if (Object.keys(body).some((key) => !["rpc", "operation", "key", "storageAfterWrite", "restart"].includes(key)) || (body.rpc !== "blog_command" && body.storageAfterWrite !== true)) throw new AdapterError(400, "INVALID_REQUEST");
        await writeFile(injectionPath, JSON.stringify({ ...body, consumed: false }), { mode: 0o600 }); output(response, 200, { armed: true }); return;
      }
      const rpc = /^\/rest\/v1\/rpc\/([a-z0-9_]+)$/u.exec(url.pathname)?.[1];
      if (rpc && request.method === "POST") {
        const args = rpcArguments[rpc]; if (!args) throw new AdapterError(404, "NOT_FOUND");
        const body = jsonBody(await bodyBytes(request, 350_000));
        if (Object.keys(body).some((name) => !Object.hasOwn(args, name))) throw new AdapterError(400, "INVALID_REQUEST");
        const parameters = Object.entries(body).map(([name, value]) => {
          const type = args[name]!;
          if (type === "bigint" && value !== null && (!Number.isSafeInteger(value) || Number(value) < 0)) throw new AdapterError(400, "INVALID_REQUEST");
          return `${name}=>${value === null ? "null" : literal(type === "jsonb" ? JSON.stringify(value) : String(value))}::${type}`;
        });
        const result = await adapterQuery(`select to_jsonb(public.${rpc}(${parameters.join(",")}))`, claims);
        if (await injectAfterCommit(request, { rpc, operation: body.p_operation, key: body.p_idempotency_key })) return;
        output(response, 200, result); return;
      }
      const table = /^\/rest\/v1\/([a-z0-9_]+)$/u.exec(url.pathname)?.[1];
      if (table && request.method === "GET") {
        const columns = tableColumns[table]; if (!columns) throw new AdapterError(404, "NOT_FOUND");
        const selected = (url.searchParams.get("select") ?? "*").split(",");
        if (selected.includes("*") || selected.some((column) => !columns.has(column))) throw new AdapterError(400, "INVALID_REQUEST");
        const conditions: string[] = []; let order = "", limit = 500, offset = 0;
        for (const [name, value] of url.searchParams) {
          if (name === "select") continue;
          if (name === "limit" || name === "offset") {
            if (!/^\d{1,5}$/u.test(value) || Number(value) > (name === "limit" ? 500 : 50000)) throw new AdapterError(400, "INVALID_REQUEST");
            if (name === "limit") limit = Number(value); else offset = Number(value); continue;
          }
          if (name === "order") {
            order = value.split(",").map((entry) => { const [field, direction = "asc"] = entry.split("."); if (!field || !columns.has(field) || !["asc", "desc"].includes(direction)) throw new AdapterError(400, "INVALID_REQUEST"); return `${field} ${direction}`; }).join(","); continue;
          }
          if (!columns.has(name)) throw new AdapterError(400, "INVALID_REQUEST");
          if (value.startsWith("eq.")) conditions.push(`${name}=${literal(value.slice(3))}`);
          else if (/^in\([^)]*\)$/u.test(value.slice(0, 2) === "in" ? value.replace("in.", "in") : "")) {
            const values = value.slice(4, -1).split(","); if (values.length > 100 || values.some((entry) => !/^[a-zA-Z0-9_-]{1,200}$/u.test(entry))) throw new AdapterError(400, "INVALID_REQUEST");
            conditions.push(`${name} in (${values.map(literal).join(",")})`);
          } else throw new AdapterError(400, "INVALID_REQUEST");
        }
        const result = await adapterQuery(`select coalesce(jsonb_agg(to_jsonb(q)),'[]'::jsonb) from(select ${selected.join(",")} from public.${table}${conditions.length ? ` where ${conditions.join(" and ")}` : ""}${order ? ` order by ${order}` : ""} limit ${limit} offset ${offset})q`, claims);
        if (request.headers.accept?.includes("application/vnd.pgrst.object+json")) {
          if (!Array.isArray(result) || result.length !== 1) throw new AdapterError(406, "NOT_FOUND"); output(response, 200, result[0]);
        } else output(response, 200, result); return;
      }
      const storage = /^\/storage\/v1\/object\/(authenticated\/)?platform_blog_media\/(.+)$/u.exec(url.pathname);
      if (storage) {
        const path = decodeURIComponent(storage[2]!);
        if (!/^platform\/veyocast\/development\/assets\/[0-9a-f-]{36}\/original\.(png|jpg|webp)$/u.test(path)) throw new AdapterError(404, "NOT_FOUND");
        const file = `${runtimeDirectory}/objects/${hash(path)}.bin`;
        if (request.method === "POST" && !storage[1]) {
          if (request.headers["x-upsert"] !== "false") throw new AdapterError(403, "PERMISSION_DENIED");
          const type = request.headers["content-type"] ?? ""; if (!["image/png", "image/jpeg", "image/webp"].includes(type)) throw new AdapterError(415, "INVALID_MEDIA");
          const bytes = await bodyBytes(request);
          try { await writeFile(file, bytes, { flag: "wx", mode: 0o600 }); } catch { throw new AdapterError(409, "ALREADY_EXISTS"); }
          try { await adapterQuery(`insert into storage.objects(bucket_id,name,metadata) values('platform_blog_media',${literal(path)},${literal(JSON.stringify({ size: bytes.length, mimetype: type }))}::jsonb);select 'true'::jsonb`, claims); } catch (error) { await unlink(file); throw error; }
          if (await injectAfterCommit(request, { storageAfterWrite: true })) return;
          output(response, 200, { Key: `platform_blog_media/${path}` }); return;
        }
        if (request.method === "GET" && storage[1]) {
          const asset = await adapterQuery(`select coalesce((select metadata from storage.objects where bucket_id='platform_blog_media' and name=${literal(path)}),'null'::jsonb)`, claims) as { size: number; mimetype: string } | null;
          if (!asset) throw new AdapterError(404, "NOT_FOUND");
          const bytes = await readFile(file).catch(() => { throw new AdapterError(503, "TEMPORARILY_UNAVAILABLE"); });
          if (asset.size !== bytes.length) throw new AdapterError(503, "TEMPORARILY_UNAVAILABLE");
          response.writeHead(200, { "Content-Type": asset.mimetype, "Content-Length": String(bytes.length), "Cache-Control": "private,no-store", "X-Content-Type-Options": "nosniff" }).end(bytes); return;
        }
        throw new AdapterError(405, "PERMISSION_DENIED");
      }
      if (url.pathname === "/auth/v1/user" && request.method === "GET" && claims.role === "authenticated") {
        output(response, 200, { id: claims.sub, aud: "authenticated", role: "authenticated", email: "s313-redactie@test.invalid", email_confirmed_at: "2026-11-13T00:00:00Z", app_metadata: { provider: "email", providers: ["email"] }, user_metadata: { display_name: "S313 testredactie" }, identities: [], factors: [], created_at: "2026-11-13T00:00:00Z" }); return;
      }
      throw new AdapterError(404, "NOT_FOUND");
    } catch (error) {
      const failure = error instanceof AdapterError ? error : new AdapterError(503, "TEMPORARILY_UNAVAILABLE");
      output(response, failure.status, { message: failure.code, code: failure.code, adapter: "s313-local-test-adapter" });
    }
  });
  server.requestTimeout = 30_000; server.headersTimeout = 10_000;
  await new Promise<void>((done, reject) => { server.once("error", reject); server.listen(port, "127.0.0.1", done); });
  process.stdout.write(`${JSON.stringify({ ready: true, kind: config.kind, database, origin: config.backendOrigin, instance, syntheticAuth: true, syntheticStorageHttp: true })}\n`);
  for (const signal of ["SIGINT", "SIGTERM"] as const) process.once(signal, () => { server.closeAllConnections(); server.close(() => process.exit(0)); });
}

async function main() {
  if (process.argv.includes("--init")) { process.stdout.write(`${JSON.stringify(await initializeAdapter())}\n`); return; }
  if (process.argv.includes("--supervise")) {
    let child: ReturnType<typeof spawn> | undefined; let stopping = false;
    const launch = () => {
      child = spawn(process.execPath, [...process.execArgv, fileURLToPath(import.meta.url), "--serve"], { stdio: "inherit" });
      child.once("exit", (code) => { if (code === 75 && !stopping) setTimeout(launch, 100); else process.exit(code ?? 1); });
    };
    for (const signal of ["SIGINT", "SIGTERM"] as const) process.once(signal, () => { stopping = true; child?.kill(signal); });
    launch(); return;
  }
  if (process.argv.includes("--serve")) { await serveAdapter(); return; }
  throw new Error("Use --init after schema readiness, then --supervise; no database reset/drop is provided.");
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch((error) => { process.stderr.write(`${JSON.stringify({ adapter: "s313-local-test-adapter", failed: true, code: error instanceof AdapterError ? error.code : "LOCAL_SETUP_FAILED", status: error instanceof AdapterError ? error.status : null, secretsPrinted: false })}\n`); process.exitCode = 1; });
