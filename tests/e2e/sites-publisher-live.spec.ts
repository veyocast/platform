import { createHmac } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { expect as browserExpect, test } from "@playwright/test";

const enabled = process.env.VEYOCAST_LIVE_PILOT === "1";
const localDatabase = process.env.VEYOCAST_LOCAL_DATABASE_CONTAINER;
const verifyPlayer = process.env.VEYOCAST_SITES_PLAYER_LIVE === "1";
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");
const expect = browserExpect.configure({ timeout: 30_000 });

test.setTimeout(360_000);
test.use({ actionTimeout: 30_000 });
test.describe("Sites publisher with real local storage", () => {
  test.skip(!enabled, "Requires the explicit isolated local Supabase gate.");

  test("uploads verified images, persists order, rejects a second session and publishes immutable content", async ({ page, browser }, testInfo) => {
    if (!localDatabase || !(/^supabase_db_veyocast-s\d+$/.test(localDatabase) || (process.env.GITHUB_ACTIONS === "true" && localDatabase === "supabase_db_veyocast-platform"))) throw new Error("An explicit isolated local database container is required.");
    execFileSync("docker", ["exec", localDatabase, "psql", "-U", "postgres", "-d", "postgres", "-c", "delete from auth.mfa_factors where user_id='00000000-0000-4000-8000-000000000101'"], { stdio: "pipe" });
    await page.goto("/login");
    await page.getByLabel("E-mailadres").fill("pilot-admin@veyocast.test");
    await page.getByLabel("Wachtwoord").fill("veyocast-local");
    await page.getByRole("button", { name: "Doorgaan" }).click();
    await expect(page).toHaveURL(/\/context/, { timeout: 30_000 });
    await page.getByRole("button", { name: "Open vereniging" }).click();
    await expect(page).toHaveURL(/\/dashboard$/, { timeout: 30_000 });

    await page.goto("/auth/mfa");
    await page.getByLabel("Naam van authenticator").fill("Sites local publication gate");
    await page.getByRole("button", { name: "Nieuwe authenticator toevoegen" }).click();
    await page.getByText("Handmatige sleutel tonen").click();
    const secret = (await page.locator(".mfa-secret").textContent())?.trim();
    expect(secret).toBeTruthy();
    await page.getByLabel("Zescijferige code").fill(totp(secret!));
    await page.getByRole("button", { name: "Authenticator verifiëren" }).click();
    await expect(page).toHaveURL(/\/dashboard$/, { timeout: 30_000 });

    const prefix = `Sites ${Date.now()}`;
    for (const suffix of ["eerste", "tweede"]) {
      await page.goto("/dashboard/media?upload=1");
      await page.getByLabel("Titel voor één afbeelding", { exact: true }).fill(`${prefix} ${suffix}`);
      await page.getByLabel("Afbeeldingen", { exact: true }).setInputFiles({ buffer: png, mimeType: "image/png", name: `${suffix}.png` });
      await page.getByRole("button", { name: "Uploaden en verifiëren" }).click();
      await expect(page.getByText(`${prefix} ${suffix} is gecontroleerd`)).toBeVisible({ timeout: 30_000 });
      await page.getByRole("button", { name: "Uploadvenster sluiten" }).click();
    }

    await expect(async () => {
      await page.goto("/dashboard/media");
      await expect(page.getByRole("button").filter({ has: page.locator("strong", { hasText: `${prefix} eerste` }) })).toBeVisible({ timeout: 5_000 });
    }).toPass({ timeout: 30_000 });
    const originalMedia = mediaDatabase(`${prefix} eerste`);
    await page.getByRole("button").filter({ has: page.locator("strong", { hasText: `${prefix} eerste` }) }).click();
    const metadata = page.getByRole("dialog", { name: `${prefix} eerste`, exact: true });
    await metadata.getByLabel("Tags · gescheiden door komma’s").fill("publisher-proof,club");
    await metadata.getByLabel("Collecties · gescheiden door komma’s").fill("Publisher proof");
    await metadata.getByLabel("Favoriet beeld").check();
    await metadata.getByRole("button", { name: "Wijzigingen opslaan", exact: true }).click();
    await expect(metadata).not.toBeVisible();
    const savedMedia = mediaDatabase(`${prefix} eerste`);
    expect(savedMedia.tags).toEqual(["club", "publisher-proof"]);
    expect(savedMedia.collections).toEqual(["Publisher proof"]);
    expect(savedMedia.favorite).toBe(true);
    expect(savedMedia.bytes).toEqual(originalMedia.bytes);
    expect(savedMedia.updatedAt).not.toBe(originalMedia.updatedAt);
    await page.reload();
    await page.getByRole("button").filter({ has: page.locator("strong", { hasText: `${prefix} eerste` }) }).click();
    await expect(metadata.getByLabel("Tags · gescheiden door komma’s")).toHaveValue("club,publisher-proof");
    await expect(metadata.getByLabel("Collecties · gescheiden door komma’s")).toHaveValue("Publisher proof");
    await expect(metadata.getByLabel("Favoriet beeld")).toBeChecked();
    await metadata.getByRole("button", { name: "Mediavenster sluiten", exact: true }).click();
    persistEvidence("media-metadata-readback", { originalMedia, savedMedia });

    await page.goto("/dashboard/playlists");
    await page.getByRole("button", { name: "Nieuwe playlist", exact: true }).click();
    const create = page.getByRole("dialog", { name: "Nieuwe playlist" });
    await create.getByLabel("Playlistnaam").fill(`${prefix} publicatie`);
    await create.getByRole("button", { name: "Concept maken" }).click();
    await expect(page).toHaveURL(/\/dashboard\/playlists\/[0-9a-f-]{36}/i);
    const playlistUrl = page.url(), playlistId = new URL(playlistUrl).pathname.split("/").at(-1)!;
    const editor = page.getByRole("dialog", { name: "Playlist bewerken" });
    await expect(editor).toBeVisible();
    await editor.getByRole("button", { name: "Eerste inhoud toevoegen" }).click();
    const picker = page.getByRole("dialog", { name: "Inhoud toevoegen aan playlist" });
    await picker.getByRole("button", { name: `${prefix} tweede, selecteren`, exact: true }).click();
    await picker.getByRole("button", { name: `${prefix} eerste, selecteren`, exact: true }).click();
    await picker.getByRole("button", { name: "2 items toevoegen", exact: true }).click();
    await editor.getByRole("button", { name: "Opslaan", exact: true }).click();
    await expect(editor.getByText("Je concept is bevestigd door de server.").first()).toBeVisible({ timeout: 30_000 });
    const firstSaved = database(playlistId);
    expect(firstSaved.items.map(item => item.title)).toEqual([`${prefix} tweede`, `${prefix} eerste`]);
    expect(firstSaved.items.every(item => item.verified)).toBe(true);

    const otherContext = await browser.newContext({ storageState: await page.context().storageState() });
    const other = await otherContext.newPage();
    await other.goto(playlistUrl);
    const otherEditor = other.getByRole("dialog", { name: "Playlist bewerken" });
    await otherEditor.getByRole("button", { name: "Details", exact: true }).click();
    await otherEditor.getByLabel("Naam playlist", { exact: true }).fill(`${prefix} tweede sessie`);

    await editor.getByRole("button", { name: "Volgorde", exact: true }).click();
    await editor.getByRole("button", { name: `${prefix} eerste omhoog`, exact: true }).click();
    await editor.getByRole("button", { name: "Opslaan", exact: true }).click();
    await expect.poll(() => database(playlistId).revision).toBe(firstSaved.revision + 1);
    await otherEditor.getByRole("button", { name: "Opslaan", exact: true }).click();
    await expect(otherEditor.getByText(/Een andere sessie heeft serverversie/)).toBeVisible();
    await expect(otherEditor.getByLabel("Naam playlist", { exact: true })).toHaveValue(`${prefix} tweede sessie`);
    expect(database(playlistId).name).toBe(`${prefix} publicatie`);
    await otherContext.close();

    await page.reload();
    await expect(editor).toBeVisible();
    const persisted = database(playlistId);
    expect(persisted.items.map(item => item.title)).toEqual([`${prefix} eerste`, `${prefix} tweede`]);
    await editor.getByRole("button", { name: "Schermen kiezen en publiceren", exact: true }).click();
    const targets = page.getByRole("dialog", { name: "Playlist publiceren" });
    await targets.getByRole("checkbox", { name: /Pilot hoofdscherm/ }).check();
    await targets.getByRole("button", { name: "Publiceren", exact: true }).click();
    await expect(page).toHaveURL(/\/publish\?/);
    for (let step = 0; step < 4; step++) await page.locator(".vc-sticky-action-bar").getByRole("button", { name: "Volgende", exact: true }).click();
    const risk = page.getByRole("checkbox", { name: /begrijp|risico|bewust/i });
    if (await risk.count()) await risk.check();
    await page.getByRole("checkbox", { name: /Publiceer de actuele configuratie/ }).check();
    await page.getByRole("button", { name: "Publiceren en schermstatus volgen", exact: true }).click();
    await expect.poll(() => database(playlistId).releaseCount, { timeout: 30_000 }).toBe(1);
    const published = database(playlistId);
    expect(published.releaseItems).toBe(2);
    expect(published.assignedScreens).toBe(1);
    persistEvidence("database-readback", { playlistId, persisted, published });
    await testInfo.attach("database-readback", { body: Buffer.from(JSON.stringify({ playlistId, persisted, published }, null, 2)), contentType: "application/json" });
    if (verifyPlayer) {
      const playerContext = await browser.newContext();
      const player = await playerContext.newPage();
      const firstFrame = player.waitForResponse(response => {
        if (!response.url().endsWith("/api/player/heartbeat") || response.status() !== 200) return false;
        const body = response.request().postDataJSON() as { activeReleaseId?: string; publicationTrace?: { firstFrameAt?: string } } | null;
        return !!body?.activeReleaseId && !!body.publicationTrace?.firstFrameAt;
      }, { timeout: 90_000 });
      await player.goto(`http://127.0.0.1:${process.env.PLAYER_PORT ?? 3106}`);
      const code = (await player.getByLabel("Pairingcode").textContent())?.trim();
      expect(code).toMatch(/^[A-Z2-9]{3} [A-Z2-9]{3}$/);
      await page.goto("/dashboard/screens/new?screen=40000000-0000-4000-8000-000000000101");
      await page.getByLabel("Koppelcode", { exact: true }).fill(code!);
      await page.getByRole("button", { name: "Player veilig koppelen", exact: true }).click();
      await expect(player.getByRole("region", { name: "Release playback" })).toBeVisible({ timeout: 60_000 });
      await expect(player.getByAltText(`${prefix} eerste`, { exact: true })).toBeVisible();
      const response = await firstFrame;
      const body = response.request().postDataJSON() as { activeReleaseId: string; runtimeState: string; publicationTrace: { firstFrameAt: string } };
      expect(body.runtimeState).toBe("PLAYING");
      persistEvidence("first-frame-acknowledgement", { releaseId: body.activeReleaseId, runtimeState: body.runtimeState, firstFrameAt: body.publicationTrace.firstFrameAt, serverStatus: response.status() });
      await testInfo.attach("first-frame-acknowledgement", { body: Buffer.from(JSON.stringify({ releaseId: body.activeReleaseId, runtimeState: body.runtimeState, firstFrameAt: body.publicationTrace.firstFrameAt, serverStatus: response.status() })), contentType: "application/json" });
      await playerContext.setOffline(true);
      await expect(player.getByRole("region", { name: "Release playback" })).toBeVisible();
      await playerContext.close();
    }
  });
});

function mediaDatabase(title: string): { updatedAt: string; tags: string[]; collections: string[]; favorite: boolean; bytes: unknown } {
  if (!/^Sites \d+ eerste$/.test(title)) throw new Error("Invalid local media title.");
  const sql = `select jsonb_build_object('updatedAt',a.updated_at,'tags',coalesce((select jsonb_agg(t.name order by t.name)from public.media_asset_tags x join public.media_tags t on t.tenant_id=x.tenant_id and t.id=x.tag_id where x.tenant_id=a.tenant_id and x.media_asset_id=a.id),'[]'::jsonb),'collections',coalesce((select jsonb_agg(c.name order by c.name)from public.media_collection_items x join public.media_collections c on c.tenant_id=x.tenant_id and c.id=x.collection_id where x.tenant_id=a.tenant_id and x.media_asset_id=a.id),'[]'::jsonb),'favorite',exists(select 1 from public.media_asset_favorites f where f.tenant_id=a.tenant_id and f.media_asset_id=a.id and f.user_id='00000000-0000-4000-8000-000000000101'),'bytes',(select jsonb_agg(jsonb_build_object('path',v.storage_path,'sha256',v.checksum_sha256,'size',v.file_size_bytes)order by v.variant_type)from public.media_variants v where v.tenant_id=a.tenant_id and v.asset_id=a.id))from public.media_assets a where a.title='${title}'`;
  return JSON.parse(execFileSync("docker", ["exec", localDatabase!, "psql", "-U", "postgres", "-d", "postgres", "-At", "-c", sql], { encoding: "utf8" }).trim());
}

function database(playlistId: string): { name: string; revision: number; items: Array<{ title: string; verified: boolean }>; releaseCount: number; releaseItems: number; assignedScreens: number } {
  if (!/^[a-f0-9-]{36}$/.test(playlistId)) throw new Error("Invalid local playlist identity.");
  const sql = `select jsonb_build_object('name',p.name,'revision',p.revision,'items',coalesce((select jsonb_agg(jsonb_build_object('title',a.title,'verified',v.file_size_bytes>0 and length(v.checksum_sha256)=64)order by i.sort_order) from public.playlist_items i join public.media_assets a on a.tenant_id=i.tenant_id and a.id=i.media_asset_id join public.media_variants v on v.tenant_id=a.tenant_id and v.asset_id=a.id and v.variant_type='original' where i.playlist_id=p.id),'[]'::jsonb),'releaseCount',(select count(*)from public.playlist_releases r where r.playlist_id=p.id),'releaseItems',(select count(*)from public.playlist_release_items i join public.playlist_releases r on r.id=i.release_id where r.playlist_id=p.id),'assignedScreens',(select count(*)from public.screens s where s.default_release_id in(select id from public.playlist_releases r where r.playlist_id=p.id)))from public.playlists p where p.id='${playlistId}'`;
  return JSON.parse(execFileSync("docker", ["exec", localDatabase!, "psql", "-U", "postgres", "-d", "postgres", "-At", "-c", sql], { encoding: "utf8" }).trim());
}

function totp(secret: string) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const bits = [...secret.replace(/=|\s/g, "").toUpperCase()].map(character => { const index = alphabet.indexOf(character); if (index < 0) throw new Error("Invalid local MFA secret."); return index.toString(2).padStart(5, "0"); }).join("");
  const key = Buffer.from(bits.match(/.{8}/g)?.map(byte => Number.parseInt(byte, 2)) ?? []);
  const message = Buffer.alloc(8); message.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30_000)));
  const digest = createHmac("sha1", key).update(message).digest(), offset = digest.at(-1)! & 15;
  return String((digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).padStart(6, "0");
}

function persistEvidence(name: string, value: unknown) {
  const directory = process.env.PUBLISHER_EVIDENCE_DIRECTORY;
  if (!directory) return;
  const target = resolve(directory);
  if (!target.startsWith("/tmp/") && !target.startsWith("/dev/shm/") && !(process.env.GITHUB_ACTIONS === "true" && target.startsWith(`${process.env.RUNNER_TEMP}/`))) throw new Error("Evidence requires an explicit disposable output directory.");
  mkdirSync(target, { recursive: true });
  writeFileSync(resolve(target, `${name}.json`), `${JSON.stringify(value, null, 2)}\n`);
}
