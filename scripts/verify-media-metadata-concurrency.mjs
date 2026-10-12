import { execFileSync, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";

const container = process.env.VEYOCAST_COMPOSITION_GATE_CONTAINER ?? "supabase_db_veyocast-platform";
if (!(process.env.GITHUB_ACTIONS === "true" && container === "supabase_db_veyocast-platform")
  && !/^supabase_db_veyocast-s\d+$/u.test(container)) {
  throw new Error("Media concurrency requires an explicitly isolated disposable database.");
}
function sql(query) {
  return execFileSync("docker", ["exec", "-i", container, "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-At"], {
    input: query, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"], timeout: 15_000
  }).trim();
}
function session(query) {
  const child = spawn("docker", ["exec", "-i", container, "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-At"], { stdio: ["pipe", "pipe", "pipe"] });
  let output = "", error = "";
  child.stdout.on("data", chunk => { output += chunk; });
  child.stderr.on("data", chunk => { error += chunk; });
  const done = new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("close", code => code === 0 ? resolve(output) : reject(new Error(`Disposable media session failed (${code}): ${error}`)));
  });
  child.stdin.end(query);
  return { done, output: () => output };
}
const actor = randomUUID(), tenant = randomUUID(), asset = randomUUID(), tag = randomUUID();
// Synthetic database metadata proves real locking/CAS, without a Storage,
// provider, broadcast-frame or physical-device acceptance claim.
sql(`begin;
insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at,raw_app_meta_data,raw_user_meta_data)values('${actor}','authenticated','authenticated','metadata-${actor}@veyocast.test','local-db-fixture',now(),now(),now(),'{}','{}');
insert into public.profiles(id,display_name)values('${actor}','Media concurrency fixture');
insert into public.tenants(id,name,slug)values('${tenant}','Media concurrency fixture','media-${tenant}');
insert into public.tenant_memberships(tenant_id,user_id,role)values('${tenant}','${actor}','tenant_owner');
insert into public.media_assets(id,tenant_id,kind,title,original_file_name,mime_type,status,storage_path,file_size_bytes,checksum_sha256,width,height)values('${asset}','${tenant}','image','Synthetic database fixture','fixture.webp','image/webp','ready','tenants/${tenant}/assets/${asset}/original.webp',2048,repeat('a',64),1920,1080);
insert into public.media_tags(id,tenant_id,name,created_by)values('${tag}','${tenant}','Club','${actor}');
insert into public.media_asset_tags(tenant_id,media_asset_id,tag_id,created_by)values('${tenant}','${asset}','${tag}','${actor}');commit;`);
const started = Date.now();
const editor = session(`begin;set local statement_timeout='8s';set local application_name='s191-metadata-editor';set local role authenticated;select set_config('request.jwt.claim.sub','${actor}',true);
select public.mutate_media_organization_v1('${tenant}','set_favorite','{"assetId":"${asset}","favorite":true}','${randomUUID()}');
select 'metadata_parent_locked';select pg_sleep(3);
select public.save_media_metadata_v1('${tenant}','${asset}',(select updated_at from public.media_assets where id='${asset}'),'${JSON.stringify({ title: "Saved metadata", folderId: null, tags: ["Club"], collections: [], favorite: true })}','${randomUUID()}');commit;`);
const deadline = Date.now() + 5_000;
while (!editor.output().includes("metadata_parent_locked")) {
  if (Date.now() >= deadline) throw new Error("Metadata session readiness timed out.");
  await delay(25);
}
const deletion = session(`begin;set local statement_timeout='8s';set local application_name='s191-metadata-tag-delete';set local role authenticated;select set_config('request.jwt.claim.sub','${actor}',true);
select public.mutate_media_organization_v1('${tenant}','delete_tag','{"tagId":"${tag}","expectedRevision":0}','${randomUUID()}');commit;`);
let observedAdvisoryWait = false;
for (let attempt = 0; attempt < 20; attempt++) {
  observedAdvisoryWait = sql("select exists(select 1 from pg_stat_activity where application_name='s191-metadata-tag-delete'and wait_event_type='Lock'and lower(wait_event)='advisory')") === "t";
  if (observedAdvisoryWait) break;
  await delay(50);
}
const [saved, deleted] = await Promise.all([editor.done, deletion.done]);
if (!observedAdvisoryWait || !saved.includes('"outcome": "applied"') || !deleted.includes('"outcome": "applied"')) {
  throw new Error(`Actual overlapping guarded metadata/tag commands did not both complete (advisoryWait=${observedAdvisoryWait}, editorApplied=${saved.includes('"outcome": "applied"')}, deletionApplied=${deleted.includes('"outcome": "applied"')}).`);
}
const after = JSON.parse(sql(`select jsonb_build_object('title',title,'tags',(select count(*)from public.media_asset_tags where media_asset_id='${asset}'),'favorites',(select count(*)from public.media_asset_favorites where media_asset_id='${asset}'),'checksum',checksum_sha256,'bytes',file_size_bytes)from public.media_assets where id='${asset}'`));
if (after.title !== "Saved metadata" || after.tags !== 0 || after.favorites !== 1 || after.checksum !== "a".repeat(64) || after.bytes !== 2048) {
  throw new Error("Concurrent metadata and tag deletion corrupted final state or immutable byte metadata.");
}
const evidence = { schemaVersion: 1, scope: "Two actual PostgreSQL sessions using guarded authenticated RPCs in a disposable database; synthetic byte metadata; no Storage/provider/visible-frame claim", observedAdvisoryWait, editorOutcome: "applied", deletionOutcome: "applied", finalTags: after.tags, finalFavorites: after.favorites, immutableByteMetadataPreserved: true, elapsedMs: Date.now() - started };
const output = process.env.COMPOSITION_EVIDENCE_DIRECTORY ?? join(process.env.RUNNER_TEMP ?? "/tmp", "publisher-evidence");
mkdirSync(output, { recursive: true });
writeFileSync(join(output, "media-metadata-concurrency.json"), `${JSON.stringify(evidence, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(evidence)}\n`);
