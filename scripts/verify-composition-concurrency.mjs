import { execFileSync, spawn } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";
import { URL } from "node:url";

const container = process.env.VEYOCAST_COMPOSITION_GATE_CONTAINER ?? "supabase_db_veyocast-platform";
if (!(process.env.GITHUB_ACTIONS === "true" && container === "supabase_db_veyocast-platform")
  && !/^supabase_db_veyocast-s\d+$/u.test(container)) {
  throw new Error("Composition concurrency requires an explicitly isolated local database.");
}
const statusArgs = ["exec", "supabase", "status", "--output", "json"];
if (process.env.VEYOCAST_COMPOSITION_GATE_DB_WORKDIR) statusArgs.push("--workdir", process.env.VEYOCAST_COMPOSITION_GATE_DB_WORKDIR);
const status = JSON.parse(execFileSync("pnpm", statusArgs, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }));
const api = new URL(status.API_URL);
if (api.protocol !== "http:" || !["127.0.0.1", "localhost"].includes(api.hostname)) throw new Error("A disposable loopback API is required.");
function sql(query) {
  return execFileSync("docker", ["exec", "-i", container, "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-At"], { input: query, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }).trim();
}
function session(query) {
  const child = spawn("docker", ["exec", "-i", container, "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-At"], { stdio: ["pipe", "pipe", "pipe"] });
  let output = "", error = "";
  child.stdout.on("data", chunk => { output += chunk; });
  child.stderr.on("data", chunk => { error += chunk; });
  const done = new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("close", code => code === 0 ? resolve(output) : reject(new Error(`Local composition session failed (${code}): ${error}`)));
  });
  child.stdin.end(query);
  return { done, output: () => output };
}
const actor = randomUUID(), tenant = randomUUID(), screen = randomUUID(), playlist = randomUUID(), asset = randomUUID(), device = randomUUID();
const tokenHash = randomBytes(32).toString("hex");
const configuration = JSON.stringify({ schemaVersion: 1, orientation: "landscape", layout: "full", mainWidthPercent: 70, bottomHeightPercent: 20, zones: [{ id: "main", playlistId: playlist }] });
// Database-only fixtures have explicit synthetic byte metadata. They prove
// transaction/lock behavior, never Storage verification or visible TV playback.
const setup = sql(`begin;
insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at,raw_app_meta_data,raw_user_meta_data)values('${actor}','authenticated','authenticated','composition-${actor}@veyocast.test','local-db-fixture',now(),now(),now(),'{}','{}');
insert into public.profiles(id,display_name)values('${actor}','Composition concurrency fixture');
insert into public.tenants(id,name,slug,screen_limit)values('${tenant}','Composition concurrency fixture','composition-${tenant}',2);
insert into public.tenant_settings(tenant_id)values('${tenant}');
insert into public.tenant_memberships(tenant_id,user_id,role)values('${tenant}','${actor}','tenant_owner');
insert into public.media_assets(id,tenant_id,kind,title,original_file_name,mime_type,status,storage_path,file_size_bytes,checksum_sha256,width,height)values('${asset}','${tenant}','image','Synthetic database fixture','fixture.webp','image/webp','ready','tenants/${tenant}/assets/${asset}/original.webp',2048,repeat('a',64),1920,1080);
insert into public.media_variants(tenant_id,asset_id,variant_type,storage_path,mime_type,file_size_bytes,checksum_sha256,width,height)select tenant_id,id,'original',storage_path,mime_type,file_size_bytes,checksum_sha256,width,height from public.media_assets where id='${asset}';
insert into public.playlists(id,tenant_id,name,created_by,updated_by)values('${playlist}','${tenant}','Concurrency playlist','${actor}','${actor}');
insert into public.screens(id,tenant_id,name)values('${screen}','${tenant}','Concurrency target');
insert into public.player_devices(id,tenant_id,screen_id,token_hash,paired_at)values('${device}','${tenant}','${screen}','${tokenHash}',now());
set local role authenticated;select set_config('request.jwt.claim.sub','${actor}',true);
select public.mutate_playlist_batch_v1('${playlist}',0,'[{"operation":"add_media","clientId":"${randomUUID()}","mediaAssetId":"${asset}","durationSeconds":15}]','${randomUUID()}');
select public.publish_playlist_to_targets_v3('${playlist}',(select revision from public.playlists where id='${playlist}'),array['${screen}'::uuid],'Disposable lock proof','${randomUUID()}');
select public.save_screen_composition_draft_v1('${screen}',0,'${configuration}','${randomUUID()}');
select public.publish_screen_composition_v1('${screen}',1,'${randomUUID()}');
reset role;
select jsonb_build_object('compositionId',composition_id,'targetRevision',target_revision)from public.screens where id='${screen}';commit;`);
const initial = JSON.parse(setup.split("\n").findLast(line => line.startsWith("{") && line.includes("targetRevision")));
const started = Date.now();
const publisher = session(`begin;set local statement_timeout='8s';set local application_name='s191-composition-publisher';set local role authenticated;select set_config('request.jwt.claim.sub','${actor}',true);select id from public.screens where id='${screen}'for update;select 'publisher_screen_locked';select pg_sleep(3);select public.publish_screen_composition_v1('${screen}',1,'${randomUUID()}');commit;`);
const markerDeadline = Date.now() + 5_000;
while (!publisher.output().includes("publisher_screen_locked")) {
  if (Date.now() >= markerDeadline) throw new Error("Publisher lock readiness timed out.");
  await delay(25);
}
const acknowledge = session(`begin;set local statement_timeout='8s';set local application_name='s191-composition-ack';set local role service_role;select set_config('request.jwt.claim.role','service_role',true);select public.acknowledge_player_composition_v1('${tokenHash}','${initial.compositionId}',${initial.targetRevision});commit;`);
let observedLockWait = false;
for (let attempt = 0; attempt < 20; attempt++) {
  observedLockWait = sql("select exists(select 1 from pg_stat_activity where application_name='s191-composition-ack'and wait_event_type='Lock')") === "t";
  if (observedLockWait) break;
  await delay(50);
}
const [published, acknowledged] = await Promise.all([publisher.done, acknowledge.done]);
if (!observedLockWait || !published.includes('"outcome": "published"') || !acknowledged.split("\n").includes("f")) throw new Error("Real overlap or stale acknowledgement behavior was not proved.");
const after = JSON.parse(sql(`select jsonb_build_object('compositionId',composition_id,'targetRevision',target_revision,'activeCompositionId',(select active_composition_id from public.player_devices where id='${device}'))from public.screens where id='${screen}'`));
if (after.compositionId === initial.compositionId || after.targetRevision <= initial.targetRevision || after.activeCompositionId !== null) throw new Error("Newer target or unconfirmed active composition was corrupted.");
const currentAcknowledgement = sql(`begin;set local role service_role;select set_config('request.jwt.claim.role','service_role',true);select public.acknowledge_player_composition_v1('${tokenHash}','${after.compositionId}',${after.targetRevision});commit;`);
if (!currentAcknowledgement.split("\n").includes("t")) throw new Error("The current verified target could not be acknowledged.");
const evidence = { schemaVersion: 1, scope: "Disposable database concurrency; synthetic media metadata; no Storage/provider/visible-frame claim", observedConcurrentLockWait: true, publisherOutcome: "published", staleAcknowledgement: false, currentAcknowledgement: true, initialTargetRevision: initial.targetRevision, finalTargetRevision: after.targetRevision, elapsedMs: Date.now() - started };
const output = process.env.COMPOSITION_EVIDENCE_DIRECTORY ?? join(process.env.RUNNER_TEMP ?? "/tmp", "publisher-evidence");
mkdirSync(output, { recursive: true });
writeFileSync(join(output, "composition-concurrency.json"), `${JSON.stringify(evidence, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(evidence)}\n`);
