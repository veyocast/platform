import assert from "node:assert/strict";
import {createHash, randomUUID} from "node:crypto";
import {execFileSync} from "node:child_process";
import {readFileSync, writeFileSync, existsSync, statSync} from "node:fs";
import {createServer} from "node:http";
import {createRequire} from "node:module";
import {createSyncStudioStarter, createSyncStudioDocument} from "../../packages/studio/src/sync";
import {SupabaseStudioRenderBackend} from "../../apps/media-worker/src/studio-render-backend";
import {ResvgSharpStudioRenderer} from "../../apps/media-worker/src/studio-render-resvg";
import {runStudioRenderOnce} from "../../apps/media-worker/src/studio-render-runner";

assert.equal(process.env.VEYOCAST_S227_LOCAL_ACCEPTANCE, "1");
assert.equal(process.cwd(), "/home/codex/repos/castivo-s227");
const configPath = "/home/codex/.local/state/veyocast-s226/local-status.json", statePath = "/tmp/veyocast-s226-qa-auth-state.json", checkpointPath = "/tmp/veyocast-s227-native-api-checkpoint.json";
for (const path of [configPath, statePath]) assert.equal(statSync(path).mode & 0o777, 0o600);
const config = JSON.parse(readFileSync(configPath, "utf8")), state = JSON.parse(readFileSync(statePath, "utf8"));
assert.equal(config.API_URL, "http://127.0.0.1:57621");
const require = createRequire(`${process.cwd()}/apps/control/package.json`);
const {createServerClient} = require("@supabase/ssr");
const cookies = new Map(state.cookies.map((cookie: {name: string}) => [cookie.name, cookie]));
const auth = createServerClient(config.API_URL, config.ANON_KEY, {cookies: {getAll: () => [...cookies.values()], setAll: (values: Array<{name: string}>) => values.forEach(cookie => cookies.set(cookie.name, cookie))}});
assert.equal((await auth.auth.getUser()).data.user?.id, "19170000-0000-4000-8000-000000000001");
assert.equal((await auth.auth.mfa.getAuthenticatorAssuranceLevel()).data.currentLevel, "aal2");
const token = (await auth.auth.getSession()).data.session?.access_token;
assert.ok(typeof token === "string");
const tenantId = "19170000-0000-4000-8000-000000000010";
const headers = {Authorization: `Bearer ${token}`, "X-VeyoCast-Tenant-Id": tenantId, "Content-Type": "application/json"};
const endpoint = "http://127.0.0.1:3250/api/mobile/v3/studio";
const json = async (url: string, init?: RequestInit) => {
  assert.ok(["127.0.0.1"].includes(new URL(url).hostname));
  const response = await fetch(url, {headers, ...init, signal: AbortSignal.timeout(60000)});
  const body = await response.json();
  assert.equal(response.status, 200, JSON.stringify({status: response.status, error: body.error}));
  assert.equal(body.meta.version, "3");
  return body.data;
};
const post = (body: unknown) => json(endpoint, {method: "POST", body: JSON.stringify(body)});
type Checkpoint = {runId: string; create: Record<string, unknown>; projectId?: string; save?: Record<string, unknown>; render?: Record<string, unknown>; jobId?: string; loss?: {httpStatus: number; responseSha256: string}; completed?: boolean};
const runId = randomUUID();
const starter = createSyncStudioStarter({family: "club-story", tenantName: "Lokale native API-proef"});
starter.syncPresentation!.style.motion = "geen";
starter.syncPresentation!.name = `S227 native ${runId}`;
const document = createSyncStudioDocument(starter.syncPresentation!, 3, false);
const checkpoint: Checkpoint = existsSync(checkpointPath) ? JSON.parse(readFileSync(checkpointPath, "utf8")) : {runId, create: {operation: "create", document, idempotencyKey: randomUUID()}};
assert.ok(!checkpoint.completed, "This completed acceptance is single-use.");
if (existsSync(checkpointPath)) assert.equal(process.env.VEYOCAST_S227_RESUME, "1");
const saveCheckpoint = () => writeFileSync(checkpointPath, JSON.stringify(checkpoint), {mode: 0o600});
saveCheckpoint();
const initial = await json(endpoint);
assert.ok(initial.projects.length <= 8 && initial.templates.length === 36);
const history = async () => {const result = await auth.from("playlist_releases").select("id,playlist_id,version").eq("tenant_id", tenantId).order("id"); assert.equal(result.error, null); return createHash("sha256").update(JSON.stringify(result.data)).digest("hex");};
const historyBefore = await history();
const created = await post(checkpoint.create);
assert.equal(created.outcome, "created");
assert.equal(created.draftRevision, 0);
checkpoint.projectId ??= created.projectId;
assert.equal(checkpoint.projectId, created.projectId);
saveCheckpoint();
let detail = (await json(`${endpoint}?projectId=${checkpoint.projectId}`)).projects[0];
if (!checkpoint.save) {
  const changed = structuredClone(detail.document);
  changed.syncPresentation.title = "Werkelijk vanuit de native API opgeslagen";
  checkpoint.save = {operation: "save", projectId: checkpoint.projectId, expectedDraftRevision: detail.draftRevision, document: changed, idempotencyKey: randomUUID()};
  saveCheckpoint();
}
if (!checkpoint.loss) {
  let received = false;
  const proxy = createServer(async (request, response) => {
    try {
      const chunks = []; for await (const chunk of request) chunks.push(chunk);
      const body = Buffer.concat(chunks).toString();
      assert.equal(body, JSON.stringify(checkpoint.save));
      const actual = await fetch(endpoint, {method: "POST", headers, body, signal: AbortSignal.timeout(60000)});
      const bytes = await actual.text();
      checkpoint.loss = {httpStatus: actual.status, responseSha256: createHash("sha256").update(bytes).digest("hex")};
      saveCheckpoint(); received = true;
      response.destroy(); // The database committed, but no client receipt arrives.
    } catch {response.destroy();}
  });
  await new Promise<void>((resolve, reject) => {proxy.once("error", reject); proxy.listen(3251, "127.0.0.1", resolve);});
  try {await assert.rejects(fetch("http://127.0.0.1:3251", {method: "POST", headers, body: JSON.stringify(checkpoint.save), signal: AbortSignal.timeout(65000)}));}
  finally {await new Promise<void>(resolve => proxy.close(() => resolve()));}
  assert.ok(received);
}
assert.equal(checkpoint.loss.httpStatus, 200);
const saved = await post(checkpoint.save);
assert.equal(saved.outcome, "saved");
assert.equal(saved.draftRevision, 1);
detail = (await json(`${endpoint}?projectId=${checkpoint.projectId}`)).projects[0];
assert.equal(detail.draftRevision, 1);
assert.equal(detail.document.syncPresentation.title, "Werkelijk vanuit de native API opgeslagen");
checkpoint.render ??= {operation: "render", projectId: checkpoint.projectId, expectedDraftRevision: 1, outputKind: "png", idempotencyKey: randomUUID()};
saveCheckpoint();
const queued = await post(checkpoint.render);
assert.equal(queued.outcome, "queued");
checkpoint.jobId ??= queued.renderJobId; assert.equal(checkpoint.jobId, queued.renderJobId); saveCheckpoint();
// Worker service credentials deliberately cannot SELECT this table. Inspect only
// owned local queue metadata through its verified disposable DB, without grants.
const container = "supabase_db_veyocast-s226";
assert.equal(execFileSync("docker", ["inspect", "--format", '{{.Name}} {{index .Config.Labels "com.supabase.cli.project"}}', container], {encoding: "utf8"}).trim(), `/${container} veyocast-s226`);
const pending = JSON.parse(execFileSync("docker", ["exec", container, "psql", "-U", "postgres", "-d", "postgres", "-Atc", "select coalesce(json_agg(id),'[]'::json) from public.studio_render_jobs where status not in('completed','failed','cancelled')"], {encoding: "utf8"})) as string[];
assert.ok(pending.every(id => id === checkpoint.jobId), "An unrelated local pending job must not be claimed.");
process.env.CHROMIUM_EXECUTABLE_PATH = createRequire(`${process.cwd()}/package.json`)("@playwright/test").chromium.executablePath();
if (pending.length) {
  const result = await runStudioRenderOnce({backend: new SupabaseStudioRenderBackend(config.API_URL, config.SERVICE_ROLE_KEY), renderer: new ResvgSharpStudioRenderer(), config: {workerId: `s227-native-${checkpoint.runId}`, lockTimeoutSeconds: 900, maxAttempts: 3}});
  assert.equal(result.status, "completed");
  assert.ok("jobId" in result && result.jobId === checkpoint.jobId);
}
detail = (await json(`${endpoint}?projectId=${checkpoint.projectId}`)).projects[0];
assert.equal(detail.renderStatus, "completed");
assert.ok(detail.mediaAssetId && detail.previewUrl);
const preview = await fetch(detail.previewUrl, {signal: AbortSignal.timeout(15000)});
assert.equal(preview.status, 200);
const bytes = Buffer.from(await preview.arrayBuffer()), sha = createHash("sha256").update(bytes).digest("hex");
const exported = await auth.from("studio_exports").select("checksum_sha256").eq("tenant_id", tenantId).eq("render_job_id", checkpoint.jobId).single();
assert.equal(exported.error, null); assert.equal(exported.data.checksum_sha256, sha);
assert.equal(await history(), historyBefore);
const denied = await fetch(endpoint, {headers: {...headers, "X-VeyoCast-Tenant-Id": "19170000-0000-4000-8000-000000000099"}, signal: AbortSignal.timeout(15000)});
assert.equal(denied.status, 404);
const report = {status: "PASS", checkedAt: new Date().toISOString(), scope: "Real local AAL2 bearer→version3 API→tenant RPC/receipt recovery→private worker PNG→signed preview/SHA. No native hardware, provider or hosted claim.", projectId: checkpoint.projectId, renderJobId: checkpoint.jobId, mediaAssetId: detail.mediaAssetId, draftRevision: detail.draftRevision, injectedReceiptLoss: checkpoint.loss, replayRevision: saved.draftRevision, previewBytes: bytes.length, previewSha256: sha, immutableReleaseHistoryUnchanged: true, foreignTenantDeniedStatus: denied.status};
writeFileSync("execution/evidence/native-sync-v3-real-services.json", JSON.stringify(report, null, 2) + "\n");
checkpoint.completed = true; saveCheckpoint(); console.log(JSON.stringify(report));
