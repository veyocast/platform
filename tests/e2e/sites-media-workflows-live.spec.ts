import { execFileSync, spawnSync } from "node:child_process";
import { createHash, createHmac, randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";

import { expect as browserExpect, test, type Page } from "@playwright/test";

import { SupabaseMediaWorkerBackend } from "../../apps/media-worker/src/worker-backend";
import { readMediaWorkerConfig } from "../../apps/media-worker/src/worker-config";
import { runWorkerOnce } from "../../apps/media-worker/src/worker-runner";

const enabled = process.env.VEYOCAST_LIVE_PILOT === "1";
const container = process.env.VEYOCAST_LOCAL_DATABASE_CONTAINER;
const tenant = "10000000-0000-4000-8000-000000000101";
const actor = "00000000-0000-4000-8000-000000000101";
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");
const expect = browserExpect.configure({ timeout: 30_000 });

test.describe("Original Sites media workflows with actual private storage", () => {
  test.skip(!enabled, "Requires an explicitly isolated local Supabase gate and actual FFmpeg.");
  test.setTimeout(600_000);
  test.use({ actionTimeout: 30_000 });

  test("WF04 hundreds of assets retain selection; WF05 partial upload; WF07 real TUS resume and readiness", async ({ page, context }, testInfo) => {
    assertLocal();
    await authenticate(page);
    const prefix = `WF ${Date.now()}`;
    const uploaded: Array<{ assetId: string; title: string }> = [];
    // These are real authenticated uploads through MIME/dimension/SHA validation,
    // not fabricated database rows or mocked library responses.
    for (let start = 0; start < 240; start += 4) {
      const batch = await Promise.all(Array.from({ length: 4 }, async (_, index) => {
        const title = `${prefix} bank ${String(start + index).padStart(3, "0")}`;
        const response = await page.evaluate(async ({ title, image }) => {
          const bytes = Uint8Array.from(atob(image), character => character.charCodeAt(0));
          const body = new FormData(); body.set("title", title); body.set("media", new File([bytes], "bank.png", { type: "image/png" }));
          const response = await fetch("/api/media/images", { method: "POST", body, credentials: "same-origin", signal: AbortSignal.timeout(30_000) });
          return { status: response.status, result: await response.json() as { ok: boolean; data: { assetId: string; processing: boolean } } };
        }, { title, image: png.toString("base64") });
        expect(response.status).toBe(201);
        const result = response.result;
        expect(result.ok).toBe(true); expect(result.data.processing).toBe(false);
        return { assetId: result.data.assetId, title };
      }));
      uploaded.push(...batch);
    }
    expect(new Set(uploaded.map(item => item.assetId)).size).toBe(240);
    const bankReadback = query<{ assets: number; ready: number; verifiedOriginals: number; storedPrivateOriginals: number }>(`select jsonb_build_object('assets',count(*),'ready',count(*)filter(where a.status='ready'),'verifiedOriginals',count(*)filter(where v.file_size_bytes>0 and v.checksum_sha256~'^[a-f0-9]{64}$'),'storedPrivateOriginals',count(*)filter(where exists(select 1 from storage.objects o where o.bucket_id='tenant-media'and o.name=v.storage_path)))from public.media_assets a left join public.media_variants v on v.tenant_id=a.tenant_id and v.asset_id=a.id and v.variant_type='original'where a.tenant_id='${tenant}'and a.title like ${literal(`${prefix} bank %`)};`);
    expect(bankReadback).toEqual({ assets: 240, ready: 240, verifiedOriginals: 240, storedPrivateOriginals: 240 });
    const folderName = `${prefix} map`;
    command(`select public.mutate_media_organization_v1('${tenant}','create_folder',${json({ name: folderName, parentFolderId: null })},'${randomUUID()}');`);
    const folderId = query<string>(`select to_jsonb(id) from public.media_folders where tenant_id='${tenant}' and name=${literal(folderName)};`);
    command(`select public.bulk_organize_media_assets_v1('${tenant}',array['${uploaded[0]!.assetId}','${uploaded[1]!.assetId}']::uuid[],'move','${folderId}','${randomUUID()}');`);

    await page.goto("/dashboard/playlists");
    await page.getByRole("button", { name: "Nieuwe playlist", exact: true }).click();
    const create = page.getByRole("dialog", { name: "Nieuwe playlist" });
    await create.getByLabel("Playlistnaam").fill(`${prefix} workflow`);
    await create.getByRole("button", { name: "Concept maken" }).click();
    await expect(page).toHaveURL(/\/dashboard\/playlists\/[0-9a-f-]{36}/i);
    const playlistId = new URL(page.url()).pathname.split("/").at(-1)!;
    const editor = page.getByRole("dialog", { name: "Playlist bewerken" });
    await editor.getByRole("button", { name: "Eerste inhoud toevoegen" }).click();
    const picker = page.getByRole("dialog", { name: "Inhoud toevoegen aan playlist" });
    const firstLibrary = await library(page, () => picker.getByLabel("Inhoud zoeken").fill(prefix), { query: prefix, offset: "0" });
    expect(firstLibrary.total).toBe(240); expect(firstLibrary.media).toHaveLength(48); expect(firstLibrary.hasMore).toBe(true);
    const selectedFirst = firstLibrary.media[0]!;
    await picker.getByRole("button", { name: `${selectedFirst.name}, selecteren`, exact: true }).click();
    const nextLibrary = await library(page, () => picker.getByRole("button", { name: "Volgende pagina", exact: true }).click(), { query: prefix, offset: "48" });
    expect(nextLibrary.media).toHaveLength(48);
    expect(nextLibrary.media.some(item => item.id === selectedFirst.id)).toBe(false);
    await expect(picker.getByRole("button", { name: "1 item toevoegen", exact: true })).toBeEnabled();
    const folderLibrary = await library(page, () => picker.getByLabel("Filter op map").selectOption(folderName), { query: prefix, folderId, offset: "0" });
    expect(folderLibrary.total).toBe(2);
    await expect(picker.getByRole("button", { name: "1 item toevoegen", exact: true })).toBeEnabled();
    const selectedSecond = folderLibrary.media.find(item => item.id !== selectedFirst.id)!;
    expect(selectedSecond).toBeTruthy();
    await picker.getByRole("button", { name: `${selectedSecond.name}, selecteren`, exact: true }).click();
    await library(page, () => picker.getByLabel("Inhoud zoeken").fill(`${prefix} nonexistent`), { query: `${prefix} nonexistent`, offset: "0" });
    await expect(picker.getByRole("heading", { name: "Geen resultaten gevonden" })).toBeVisible();
    await expect(picker.getByRole("button", { name: "2 items toevoegen", exact: true })).toBeEnabled();
    await picker.getByRole("button", { name: "2 items toevoegen", exact: true }).click();
    await editor.getByRole("button", { name: "Opslaan", exact: true }).click();
    await expect.poll(() => playlist(playlistId).assetIds).toEqual([selectedFirst.id, selectedSecond.id]);
    const wf04 = { status: "PASS", actualPrivateUploads: uploaded.length, bankReadback, pagedTotal: firstLibrary.total, pageSize: firstLibrary.media.length, folderFilteredTotal: folderLibrary.total, selectedAssetIds: playlist(playlistId).assetIds, selectionPreservedAcross: ["server pagination", "folder filter", "empty search"] };

    await editor.getByRole("button", { name: "Inhoud toevoegen", exact: true }).click();
    await picker.locator('input[type="file"]').setInputFiles([
      { buffer: png, mimeType: "image/png", name: `${prefix} upload A.png` },
      { buffer: Buffer.from("invalid png content"), mimeType: "image/png", name: `${prefix} invalid.png` },
      { buffer: png, mimeType: "image/png", name: `${prefix} upload B.png` }
    ]);
    await expect(picker.getByText("2 afbeeldingen toegevoegd aan de beeldbank en geselecteerd.")).toBeVisible();
    await expect(picker.getByRole("alert")).toContainText(`${prefix} invalid.png`);
    await expect(picker.getByRole("button", { name: "2 items toevoegen", exact: true })).toBeEnabled();
    await picker.getByRole("button", { name: "2 items toevoegen", exact: true }).click();
    await editor.getByRole("button", { name: "Opslaan", exact: true }).click();
    await expect.poll(() => playlist(playlistId).assetIds.length).toBe(4);
    await page.reload();
    const partial = query<Array<{ id: string; title: string; status: string; bytes: number; sha256: string }>>(`select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'title',a.title,'status',a.status,'bytes',v.file_size_bytes,'sha256',v.checksum_sha256)),'[]'::jsonb)from public.media_assets a join public.media_variants v on v.tenant_id=a.tenant_id and v.asset_id=a.id and v.variant_type='original'where a.tenant_id='${tenant}'and a.title in(${literal(`${prefix} upload A`)},${literal(`${prefix} upload B`)});`);
    expect(partial).toHaveLength(2); expect(partial.every(item => item.status === "ready" && item.bytes > 0 && /^[a-f0-9]{64}$/.test(item.sha256))).toBe(true);
    expect(query<number>(`select to_jsonb(count(*))from public.media_assets where tenant_id='${tenant}'and title=${literal(`${prefix} invalid`)};`)).toBe(0);
    const wf05 = { status: "PASS", selectedFiles: 3, succeeded: 2, rejected: 1, persistedAfterReload: partial, playlistItemCount: playlist(playlistId).assetIds.length };

    const videoPath = resolve("apps/player/demo-assets/demoveyo.mp4");
    const videoBytes = statSync(videoPath).size;
    expect(videoBytes).toBeGreaterThan(6 * 1024 * 1024);
    await page.goto("/dashboard/media?upload=1");
    const uploadDialog = page.getByRole("dialog", { name: "Media uploaden" });
    await uploadDialog.getByRole("tab", { name: "Video", exact: true }).click();
    await uploadDialog.getByLabel("Videotitel", { exact: true }).fill(`${prefix} video`);
    await uploadDialog.getByLabel("Videobestand", { exact: true }).setInputFiles(videoPath);
    const transfers: Array<{ method: string; status: number; offset: number | null; requestOffset: number | null; location: string }> = [];
    let confirmedOffset = 0;
    page.on("response", response => {
      if (!response.url().includes("/storage/v1/upload/resumable")) return;
      const headers = response.headers(), requestHeaders = response.request().headers();
      const offset = headers["upload-offset"] ? Number(headers["upload-offset"]) : null;
      if (offset !== null && response.ok()) confirmedOffset = Math.max(confirmedOffset, offset);
      transfers.push({ method: response.request().method(), status: response.status(), offset, requestOffset: requestHeaders["upload-offset"] ? Number(requestHeaders["upload-offset"]) : null, location: new URL(headers.location ?? response.url(), response.url()).pathname });
    });
    const cdp = await context.newCDPSession(page);
    await cdp.send("Network.enable");
    await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 10, downloadThroughput: -1, uploadThroughput: 512 * 1024 });
    await uploadDialog.getByRole("button", { name: "Video uploaden", exact: true }).click();
    await expect.poll(() => confirmedOffset, { timeout: 60_000 }).toBe(6 * 1024 * 1024);
    await uploadDialog.getByRole("button", { name: "Pauzeren", exact: true }).click();
    await expect(uploadDialog.getByRole("button", { name: "Hervatten", exact: true })).toBeEnabled();
    const paused = video(`${prefix} video`);
    expect(paused.status).toBe("uploading"); expect(paused.sessionCount).toBe(1); expect(paused.jobCount).toBe(0); expect(paused.playbackVariantCount).toBe(0);
    const pausedOffset = confirmedOffset;
    await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
    await uploadDialog.getByRole("button", { name: "Hervatten", exact: true }).click();
    await expect(uploadDialog.getByText(/De video staat veilig in de verwerkingsqueue/)).toBeVisible({ timeout: 60_000 });
    expect(transfers.some(item => item.method === "HEAD" && item.status === 200 && item.offset === pausedOffset)).toBe(true);
    expect(transfers.some(item => item.method === "PATCH" && item.status === 204 && item.requestOffset === pausedOffset && item.offset === videoBytes)).toBe(true);
    const queued = video(`${prefix} video`);
    expect(queued.status).toBe("processing"); expect(queued.sessionCount).toBe(1); expect(queued.jobCount).toBe(1); expect(queued.playbackVariantCount).toBe(0);
    const beforeAttempt = playlist(playlistId);
    const blocked = tryCommand(`select public.mutate_playlist_draft_v1('${playlistId}',${beforeAttempt.revision},'add_item',${json({ mediaAssetId: queued.assetId, durationSeconds: 12, fitMode: "contain", muted: true })});`);
    expect(blocked.sqlstate).toBe("23514"); expect(playlist(playlistId)).toEqual(beforeAttempt);
    const beforeLegacyPublish = publicationState(playlistId);
    // Negative legacy-corruption fixture only: a privileged placement exists for
    // the queued video inside this transaction. The real authenticated publish
    // command must reject it. Explicit ROLLBACK removes the fixture entirely.
    const legacySql = `begin;insert into public.playlist_items(tenant_id,playlist_id,media_asset_id,sort_order,position_key,duration_seconds)select '${tenant}','${playlistId}','${queued.assetId}',coalesce(max(sort_order),0)+1,coalesce(max(position_key),0)+1024,12 from public.playlist_items where playlist_id='${playlistId}';set local role authenticated;set local request.jwt.claims='{"sub":"${actor}","role":"authenticated","aal":"aal2"}';do $negative$begin raise notice 'WF07_PUBLISH_INVOKED';perform public.publish_playlist_to_targets_v3('${playlistId}',${beforeAttempt.revision},array['40000000-0000-4000-8000-000000000101']::uuid[],'Rolled-back legacy corruption negative','${randomUUID()}');raise exception 'Unready video publication unexpectedly succeeded';exception when check_violation then raise notice 'WF07_PUBLISH_REJECTED_23514';end$negative$;rollback;`;
    const legacy = spawnSync("docker", ["exec", container!, "psql", "-U", "postgres", "-d", "postgres", "-X", "-v", "ON_ERROR_STOP=1", "-At", "-c", legacySql], { encoding: "utf8", timeout: 30_000 });
    expect(legacy.status, legacy.stderr).toBe(0);
    expect(legacy.stderr).toContain("WF07_PUBLISH_INVOKED"); expect(legacy.stderr).toContain("WF07_PUBLISH_REJECTED_23514"); expect(legacy.stdout).toContain("ROLLBACK");
    const afterLegacyPublish = publicationState(playlistId);
    expect(afterLegacyPublish).toEqual(beforeLegacyPublish);
    const legacyPublishNegative = { scope: "privileged legacy-corruption placement only inside explicitly rolled-back transaction; actual authenticated publish RPC invoked", sqlstate: "23514", explicitRollback: true, before: beforeLegacyPublish, after: afterLegacyPublish };
    await uploadDialog.getByRole("button", { name: "Uploadvenster sluiten", exact: true }).click();
    const config = readMediaWorkerConfig({ ...process.env, SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL, MEDIA_WORKER_ID: "sites-media-workflow-local" });
    const backend = new SupabaseMediaWorkerBackend(config.supabaseUrl, config.serviceRoleKey);
    const workerResult = await runWorkerOnce({ backend, config });
    expect(workerResult.status).toBe("completed");
    const ready = video(`${prefix} video`);
    expect(ready.status).toBe("ready"); expect(ready.playbackVariantCount).toBe(1); expect(ready.posterCount).toBe(1); expect(ready.jobCount).toBe(1);
    expect(ready.durationSeconds).toBeGreaterThan(0);
    expect(ready.variants.every(item => item.bytes > 0 && /^[a-f0-9]{64}$/.test(item.sha256))).toBe(true);
    await page.goto(`/dashboard/playlists/${playlistId}`);
    await editor.getByRole("button", { name: "Inhoud toevoegen", exact: true }).click();
    const readyLibrary = await library(page, () => picker.getByLabel("Inhoud zoeken").fill(`${prefix} video`), { query: `${prefix} video`, offset: "0" });
    expect(readyLibrary.media.map(item => item.id)).toEqual([ready.assetId]);
    await picker.getByRole("button", { name: `${prefix} video, selecteren`, exact: true }).click();
    await picker.getByRole("button", { name: "1 item toevoegen", exact: true }).click();
    await editor.getByRole("button", { name: "Opslaan", exact: true }).click();
    await expect.poll(() => playlist(playlistId).assetIds.length).toBe(5);
    const placementDuration = query<number>(`select to_jsonb(duration_seconds)from public.playlist_items where playlist_id='${playlistId}'and media_asset_id='${ready.assetId}';`);
    expect(placementDuration).toBe(Math.max(5, Math.ceil(ready.durationSeconds)));
    const publish = command(`select public.publish_playlist_to_targets_v3('${playlistId}',${playlist(playlistId).revision},array['40000000-0000-4000-8000-000000000101']::uuid[],'Actual media workflow gate','${randomUUID()}');`);
    const publishedVideo = query<Array<{ releaseId: string; variant: string; bytes: number; sha256: string }>>(`select coalesce(jsonb_agg(jsonb_build_object('releaseId',i.release_id,'variant',v.variant_type,'bytes',i.file_size_bytes,'sha256',i.checksum_sha256)),'[]'::jsonb)from public.playlist_release_items i join public.media_variants v on v.tenant_id=i.tenant_id and v.id=i.media_variant_id where i.playlist_id='${playlistId}'and i.media_asset_id='${ready.assetId}';`);
    expect(publishedVideo).toHaveLength(1); expect(publishedVideo[0]!.variant).toBe("player_1080p"); expect(publishedVideo[0]!.bytes).toBeGreaterThan(0);
    const toolchain = { ffmpeg: execFileSync("ffmpeg", ["-version"], { encoding: "utf8", timeout: 10_000 }).split("\n")[0], ffprobe: execFileSync("ffprobe", ["-version"], { encoding: "utf8", timeout: 10_000 }).split("\n")[0], ...(process.env.MEDIA_WORKFLOW_TOOLCHAIN_PROVENANCE ? { localPackageVerification: JSON.parse(readFileSync(process.env.MEDIA_WORKFLOW_TOOLCHAIN_PROVENANCE, "utf8")) as unknown } : {}) };
    const wf07 = { status: "PASS", sourceBytes: videoBytes, sourceSha256: createHash("sha256").update(readFileSync(videoPath)).digest("hex"), toolchain, confirmedPausedOffset: pausedOffset, transfers, paused, queued, blockedBeforeProcessing: blocked, legacyPublishNegative, workerResult, ready, placementDuration, publishedVideo, serverPublicationReceipt: publish };
    const evidence = { scope: "isolated local authenticated browser + actual private Storage/TUS + actual production media worker/FFmpeg + guarded PostgreSQL commands; no production/provider/hardware claim", timestamp: new Date().toISOString(), baseSha: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(), sourceRevision: "b1cae899af19fc39908217253094c5240d7359fc", testFileSha256: createHash("sha256").update(readFileSync("tests/e2e/sites-media-workflows-live.spec.ts")).digest("hex"), workflows: { WF04: wf04, WF05: wf05, WF07: wf07 } };
    const directory = process.env.MEDIA_WORKFLOW_EVIDENCE_DIRECTORY;
    const runnerRoot = process.env.RUNNER_TEMP && resolve(process.env.RUNNER_TEMP);
    const runnerRelative = directory && runnerRoot ? relative(runnerRoot, resolve(directory)) : null;
    const runnerEvidence = process.env.GITHUB_ACTIONS === "true" && runnerRelative !== null && runnerRelative !== ".." && !runnerRelative.startsWith("../") && !isAbsolute(runnerRelative);
    if (!directory || (!resolve(directory).startsWith("/dev/shm/") && !runnerEvidence)) throw new Error("Actual media evidence requires an explicit disposable RAM or CI output directory.");
    mkdirSync(directory, { recursive: true }); writeFileSync(resolve(directory, "media-workflow-live-readback.json"), `${JSON.stringify(evidence, null, 2)}\n`);
    await testInfo.attach("media-workflow-live-readback", { body: Buffer.from(JSON.stringify(evidence, null, 2)), contentType: "application/json" });
    await cdp.detach();
  });
});

function assertLocal() {
  const api = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "");
  const allowedContainer = container && (/^supabase_db_veyocast-s\d+$/.test(container) || (process.env.GITHUB_ACTIONS === "true" && container === "supabase_db_veyocast-platform"));
  if (api.protocol !== "http:" || !["127.0.0.1", "localhost"].includes(api.hostname) || !allowedContainer) throw new Error("An explicit isolated local database/API is required.");
}
function sql(value: string) { return execFileSync("docker", ["exec", container!, "psql", "-U", "postgres", "-d", "postgres", "-X", "-v", "ON_ERROR_STOP=1", "-v", "VERBOSITY=verbose", "-At", "-c", value], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 30_000 }).trim(); }
function query<T>(value: string): T { return JSON.parse(sql(value)) as T; }
function claims(value: string) { return `begin;set local role authenticated;set local request.jwt.claims='{"sub":"${actor}","role":"authenticated","aal":"aal2"}';${value}commit;`; }
function command(value: string) { return sql(claims(value)); }
function tryCommand(value: string): { sqlstate: string } {
  try { sql(claims(value)); throw new Error("Unready media mutation unexpectedly succeeded."); }
  catch (error) { const stderr = (error as { stderr?: Buffer }).stderr?.toString() ?? ""; const match = /ERROR:\s+(\d{5}):/.exec(stderr); if (!match) throw error; return { sqlstate: match[1]! }; }
}
function literal(value: string) { return `'${value.replaceAll("'", "''")}'`; }
function json(value: unknown) { return `${literal(JSON.stringify(value))}::jsonb`; }
function playlist(id: string) { return query<{ revision: number; assetIds: string[] }>(`select jsonb_build_object('revision',p.revision,'assetIds',coalesce((select jsonb_agg(media_asset_id order by sort_order)from public.playlist_items where playlist_id=p.id),'[]'::jsonb))from public.playlists p where p.id='${id}';`); }
function publicationState(id: string) { return query<{ draftRevision: number; draftItems: number; releases: number; publications: number; configRevision: number }>(`select jsonb_build_object('draftRevision',p.revision,'draftItems',(select count(*)from public.playlist_items where playlist_id=p.id),'releases',(select count(*)from public.playlist_releases where playlist_id=p.id),'publications',(select count(*)from public.playlist_publications where playlist_id=p.id),'configRevision',coalesce((select config_revision from public.playlist_publications where playlist_id=p.id),0))from public.playlists p where p.id='${id}';`); }
function video(title: string) { return query<{ assetId: string; status: string; durationSeconds: number; sessionCount: number; jobCount: number; playbackVariantCount: number; posterCount: number; variants: Array<{ type: string; bytes: number; sha256: string }> }>(`select jsonb_build_object('assetId',a.id,'status',a.status,'durationSeconds',a.duration_seconds,'sessionCount',(select count(*)from public.media_upload_sessions where asset_id=a.id),'jobCount',(select count(*)from public.media_processing_jobs where asset_id=a.id),'playbackVariantCount',(select count(*)from public.media_variants where asset_id=a.id and variant_type='player_1080p'),'posterCount',(select count(*)from public.media_variants where asset_id=a.id and variant_type='thumbnail'),'variants',coalesce((select jsonb_agg(jsonb_build_object('type',variant_type,'bytes',file_size_bytes,'sha256',checksum_sha256))from public.media_variants where asset_id=a.id),'[]'::jsonb))from public.media_assets a where a.tenant_id='${tenant}'and a.title=${literal(title)};`); }
async function library(page: Page, action: () => Promise<unknown>, filter: Record<string, string>) {
  const response = page.waitForResponse(item => { const url = new URL(item.url()); return url.pathname === "/api/publisher/library" && item.status() === 200 && Object.entries(filter).every(([key, value]) => url.searchParams.get(key) === value); }, { timeout: 30_000 });
  await action(); return await (await response).json() as { total: number; hasMore: boolean; media: Array<{ id: string; name: string }> };
}
async function authenticate(page: Page) {
  sql(`delete from auth.mfa_factors where user_id='${actor}';`);
  await page.goto("/login"); await page.getByLabel("E-mailadres").fill("pilot-admin@veyocast.test"); await page.getByLabel("Wachtwoord").fill("veyocast-local"); await page.getByRole("button", { name: "Doorgaan" }).click(); await expect(page).toHaveURL(/\/context/); await page.getByRole("button", { name: "Open vereniging" }).click(); await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto("/auth/mfa"); await page.getByLabel("Naam van authenticator").fill("Sites original media workflows"); await page.getByRole("button", { name: "Nieuwe authenticator toevoegen" }).click(); await page.getByText("Handmatige sleutel tonen").click(); const secret = (await page.locator(".mfa-secret").textContent())!.trim();
  const bits = [...secret.replace(/=|\s/g, "").toUpperCase()].map(character => "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567".indexOf(character).toString(2).padStart(5, "0")).join(""); const key = Buffer.from(bits.match(/.{8}/g)!.map(byte => Number.parseInt(byte, 2))); const counter = Buffer.alloc(8); counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30_000))); const digest = createHmac("sha1", key).update(counter).digest(); const offset = digest.at(-1)! & 15;
  await page.getByLabel("Zescijferige code").fill(String((digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).padStart(6, "0")); await page.getByRole("button", { name: "Authenticator verifiëren" }).click(); await expect(page).toHaveURL(/\/dashboard$/);
}
