import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";
import { setTimeout } from "node:timers";
import { URL } from "node:url";

// This gate owns the disposable Supabase stack from database-rls-gates.yml.
// Only the CLI's local credentials enter child-process memory; never print them.
if (process.env.GITHUB_ACTIONS !== "true") {
  throw new Error("The disposable publisher gate requires its GitHub Actions database job.");
}
const status = JSON.parse(execFileSync("pnpm", ["exec", "supabase", "status", "--output", "json"], {
  encoding: "utf8", stdio: ["ignore", "pipe", "ignore"]
}));
const api = new URL(status.API_URL);
if (api.protocol !== "http:" || !["127.0.0.1", "localhost"].includes(api.hostname)
  || typeof status.ANON_KEY !== "string" || typeof status.SERVICE_ROLE_KEY !== "string") {
  throw new Error("Publisher gate requires a verified disposable local API.");
}
// PostgREST's local JWKS cache may outlive a database reset. Verify the actual
// seeded session can read roles before launching browsers; never bypass auth.
const login = await globalThis.fetch(new URL("/auth/v1/token?grant_type=password", api), {
  method: "POST", headers: { apikey: status.ANON_KEY, "content-type": "application/json" },
  body: JSON.stringify({ email: "pilot-admin@veyocast.test", password: "veyocast-local" }),
  signal: globalThis.AbortSignal.timeout(10_000)
});
if (!login.ok) throw new Error("Disposable publisher authentication is not ready.");
const session = await login.json();
if (typeof session.access_token !== "string") throw new Error("Disposable publisher session is unavailable.");
let ready = false;
const deadline = Date.now() + 60_000;
while (Date.now() < deadline) {
  try {
    const roles = await globalThis.fetch(new URL("/rest/v1/platform_memberships?select=role&limit=1", api), {
      headers: { apikey: status.ANON_KEY, Authorization: `Bearer ${session.access_token}` },
      signal: globalThis.AbortSignal.timeout(5_000)
    });
    if (roles.ok) { ready = true; break; }
  } catch { /* Local startup/cache readiness is bounded by the deadline. */ }
  await new Promise(resolve => setTimeout(resolve, 1_000));
}
if (!ready) throw new Error("Disposable publisher role loading is not ready.");
const evidenceDirectory = join(process.env.RUNNER_TEMP ?? "/tmp", "publisher-evidence");
mkdirSync(evidenceDirectory, { recursive: true });
const result = spawnSync("pnpm", ["exec", "playwright", "test", "tests/e2e/sites-publisher-live.spec.ts", "tests/e2e/sites-media-workflows-live.spec.ts", "--project=chromium", "--workers=1"], {
  stdio: "inherit",
  env: {
    ...process.env,
    NEXT_PUBLIC_SUPABASE_URL: api.origin,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: status.ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: status.SERVICE_ROLE_KEY,
    NEXT_PUBLIC_APP_URL: "http://127.0.0.1:3103",
    VEYOCAST_LIVE_PILOT: "1",
    VEYOCAST_SITES_PLAYER_LIVE: "1",
    VEYOCAST_LOCAL_DATABASE_CONTAINER: "supabase_db_veyocast-platform",
    PLAYWRIGHT_EXTERNAL_SERVERS: "0",
    PLAYWRIGHT_TURBOPACK: "1",
    NODE_OPTIONS: "--max-old-space-size=2048",
    PLAYWRIGHT_APPS: "control,player",
    PUBLISHER_EVIDENCE_DIRECTORY: evidenceDirectory,
    MEDIA_WORKFLOW_EVIDENCE_DIRECTORY: evidenceDirectory,
    CI: "true"
  }
});
process.exit(result.status ?? 1);
