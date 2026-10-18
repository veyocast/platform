import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {existsSync, readFileSync, statSync, writeFileSync} from "node:fs";
import {createServer} from "node:http";
import {createRequire} from "node:module";

assert.equal(process.env.VEYOCAST_S227_LOCAL_ACCEPTANCE, "1");
assert.equal(process.cwd(), "/home/codex/repos/castivo-s227");
const configPath = "/home/codex/.local/state/veyocast-s226/local-status.json", authPath = "/tmp/veyocast-s226-qa-auth-state.json", path = "/tmp/veyocast-s227-native-series-valid-checkpoint.json";
for (const file of [configPath, authPath]) assert.equal(statSync(file).mode & 0o777, 0o600);
const config = JSON.parse(readFileSync(configPath, "utf8")), state = JSON.parse(readFileSync(authPath, "utf8")), parent = JSON.parse(readFileSync("/tmp/veyocast-s227-native-api-checkpoint.json", "utf8"));
assert.equal(config.API_URL, "http://127.0.0.1:57621"); assert.equal(parent.completed, true);
const require = createRequire(`${process.cwd()}/apps/control/package.json`), {createServerClient} = require("@supabase/ssr");
const auth = createServerClient(config.API_URL, config.ANON_KEY, {cookies: {getAll: () => state.cookies, setAll: () => undefined}});
assert.equal((await auth.auth.getUser()).data.user?.id, "19170000-0000-4000-8000-000000000001");
const token = (await auth.auth.getSession()).data.session?.access_token; assert.ok(typeof token === "string");
const tenantId = "19170000-0000-4000-8000-000000000010", endpoint = "http://127.0.0.1:3250/api/mobile/v3/studio";
const headers = {Authorization: `Bearer ${token}`, "X-VeyoCast-Tenant-Id": tenantId, "Content-Type": "application/json"};
const get = async (projectId: string) => {const r = await fetch(`${endpoint}?projectId=${projectId}`, {headers, signal: AbortSignal.timeout(30000)}); assert.equal(r.status, 200); return (await r.json()).data.projects[0];};
const post = async (body: unknown) => {const r = await fetch(endpoint, {method: "POST", headers, body: JSON.stringify(body), signal: AbortSignal.timeout(30000)}); assert.equal(r.status, 200); return (await r.json()).data;};
type Command = Record<string, unknown>;
const cp: {start?: Command; startResult?: {series: {id: string; nextProjectId: string}}; duplicate?: Command; duplicateResult?: {series: {id: string; nextProjectId: string}}; remove?: Command; lossStatus?: number; completed?: boolean} = existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : {};
assert.ok(!cp.completed, "Completed acceptance is single-use."); if (existsSync(path)) assert.equal(process.env.VEYOCAST_S227_RESUME, "1");
const save = () => writeFileSync(path, JSON.stringify(cp), {mode: 0o600}); save();
const original = await get(parent.projectId);
assert.ok(original.name.startsWith(`S227 native ${parent.runId}`));
cp.start ??= {operation: "series", projectId: original.id, draftRevision: original.draftRevision, seriesId: null, seriesRevision: null, action: "add", name: null, memberIds: null, idempotencyKey: randomUUID()}; save();
cp.startResult ??= await post(cp.start); save();
const added = await get(cp.startResult!.series.nextProjectId);
cp.duplicate ??= {operation: "series", projectId: added.id, draftRevision: added.draftRevision, seriesId: added.series.id, seriesRevision: added.series.revision, action: "duplicate", name: null, memberIds: null, idempotencyKey: randomUUID()}; save();
cp.duplicateResult ??= await post(cp.duplicate); save();
const series = cp.duplicateResult!.series, duplicateId = series.nextProjectId;
assert.notEqual(duplicateId, original.id);
if (!cp.remove) {
  const duplicate = await get(duplicateId);
  assert.equal(duplicate.series.members.length, 3);
  cp.remove = {operation: "series", projectId: duplicateId, draftRevision: duplicate.draftRevision, seriesId: series.id, seriesRevision: duplicate.series.revision, action: "remove", name: null, memberIds: null, idempotencyKey: randomUUID()}; save();
}
if (!cp.lossStatus) {
  const proxy = createServer(async (request, response) => {
    try {
      const chunks = []; for await (const chunk of request) chunks.push(chunk);
      const body = Buffer.concat(chunks).toString(); assert.equal(body, JSON.stringify(cp.remove));
      const result = await fetch(endpoint, {method: "POST", headers, body, signal: AbortSignal.timeout(30000)});
      await result.arrayBuffer(); cp.lossStatus = result.status; save(); response.destroy();
    } catch {response.destroy();}
  });
  await new Promise<void>((resolve, reject) => {proxy.once("error", reject); proxy.listen(3251, "127.0.0.1", resolve);});
  try {await assert.rejects(fetch("http://127.0.0.1:3251", {method: "POST", headers, body: JSON.stringify(cp.remove), signal: AbortSignal.timeout(35000)}));}
  finally {await new Promise<void>(resolve => proxy.close(() => resolve()));}
}
assert.equal(cp.lossStatus, 200);
const archived = await fetch(`${endpoint}?projectId=${duplicateId}`, {headers, signal: AbortSignal.timeout(30000)});
assert.equal(archived.status, 404);
const removed = await post(cp.remove);
assert.equal(removed.outcome, "applied"); assert.ok(removed.series.projectIds.includes(original.id));
assert.equal(removed.series.projectIds.length, 2);
const repeatedDuplicate = await post(cp.duplicate);
assert.equal(repeatedDuplicate.series.nextProjectId, duplicateId);
const current = await get(original.id);
assert.equal(current.series.members.length, 2);
const stale = await post({...cp.remove, projectId: original.id, draftRevision: current.draftRevision, action: "rename", name: "Verouderde reeksopdracht", idempotencyKey: randomUUID()});
assert.equal(stale.outcome, "conflict");
const projects = await auth.from("studio_projects").select("id,status").eq("tenant_id", tenantId).ilike("name", `S227 native ${parent.runId}%`);
assert.equal(projects.error, null); assert.equal(projects.data.length, 3);
const report = {status: "PASS", checkedAt: new Date().toISOString(), scope: "Real local AAL2 V3 series add then duplicate; response destroyed after remove/archiving commit; identical command recovers receipt despite detail404. No native hardware or hosted claim.", originalProjectId: original.id, duplicateProjectId: duplicateId, seriesId: series.id, lostRemoveHttpStatus: cp.lossStatus, archivedDetailHttpStatus: archived.status, recoveredNextProjectId: removed.series.nextProjectId, duplicateReplayPreservesId: true, projectCountAfterReplay: projects.data.length, staleSeriesCommandOutcome: stale.outcome};
writeFileSync("execution/evidence/native-sync-v3-series-real-services.json", JSON.stringify(report, null, 2) + "\n");
cp.completed = true; save(); console.log(JSON.stringify(report));
