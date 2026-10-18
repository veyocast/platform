import { createHash } from "node:crypto";
import { expect, test } from "@playwright/test";

const playerURL = `http://127.0.0.1:${process.env.PLAYER_PORT ?? 3106}`;

test("eerste download en verificatie zijn echt; een volgende download bedekt geen LKG", async ({ page }) => {
  const image = '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"><rect width="320" height="180" fill="#147a6d"/></svg>';
  const nextImage = image.replace("#147a6d", "#53497d");
  const bytes = Buffer.byteLength(image);
  const sha = (body: string) => createHash("sha256").update(body).digest("hex");
  const id = (n: number) => `23000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
  let publishNext = false;
  let releaseManifest!: () => void;
  let releaseDownload!: () => void;
  let releaseNextDownload!: () => void;
  let nextDownloadStarted = false;
  const manifestHeld = new Promise<void>(resolve => { releaseManifest = resolve; });
  const downloadHeld = new Promise<void>(resolve => { releaseDownload = resolve; });
  const nextHeld = new Promise<void>(resolve => { releaseNextDownload = resolve; });
  await page.addInitScript(({ bytes }) => {
    localStorage.setItem("veyocast.player.deviceToken", "s".repeat(48));
    const digest = crypto.subtle.digest.bind(crypto.subtle);
    let held = false;
    Object.defineProperty(crypto.subtle, "digest", { configurable: true, value: (algorithm: AlgorithmIdentifier, input: BufferSource) => {
      if (input.byteLength !== bytes || held) return digest(algorithm, input);
      held = true;
      return new Promise<ArrayBuffer>((resolve, reject) => {
        (window as Window & { releaseStatusVerification?: () => void }).releaseStatusVerification = () => { void digest(algorithm, input).then(resolve, reject); };
      });
    } });
  }, { bytes });
  await page.route("**/api/player/installation", route => route.fulfill({ json: { bound: true, installationCredential: "i".repeat(48), ok: true } }));
  await page.route("**/api/player/heartbeat", route => route.fulfill({ json: { ok: true } }));
  await page.route("**/api/player/releases/*/ack", route => route.fulfill({ json: { ok: true } }));
  await page.route("**/api/player/commands*", route => route.fulfill({ json: { commands: [] } }));
  await page.route("**/api/player/goal-events*", route => route.fulfill({ json: { events: [] } }));
  await page.route("**/api/player/manifest*", async route => {
    await manifestHeld;
    const version = publishNext ? 2 : 1;
    const checksum = sha(publishNext ? nextImage : image);
    await route.fulfill({ json: {
      state: "PLAYING", fetchedAt: new Date().toISOString(),
      target: { revision: String(version), publicationId: id(900 + version), configRevision: "1", assignmentSource: "default", committedAt: new Date().toISOString() },
      device: { id: id(100), screenId: id(200), screenName: "Eigen React-statusfixture", activeReleaseId: id(version), desiredReleaseId: id(version) },
      manifest: { schemaVersion: 1, tenantId: id(300), playlistId: id(10), releaseId: id(version), version, label: "Veilige publicatie", manifestHash: checksum,
        publishedAt: new Date().toISOString(), totalDurationSeconds: 3, totalBytes: bytes,
        items: [{ id: id(20 + version), kind: "image", title: `Eigen lokaal beeld ${version}`, durationSeconds: 3, fitMode: "contain", muted: true,
          source: { url: `/__react-status/${version}.svg`, bytes, mimeType: "image/svg+xml", checksumSha256: checksum } }] },
      diagnostics: { syncStatus: "online", lastSuccessfulSyncAt: new Date().toISOString(), nextSyncReason: "controlled status acceptance" }
    } });
  });
  await page.route("**/__react-status/1.svg", async route => { await downloadHeld; await route.fulfill({ contentType: "image/svg+xml", body: image }); });
  await page.route("**/__react-status/2.svg", async route => { nextDownloadStarted = true; await nextHeld; await route.fulfill({ contentType: "image/svg+xml", body: nextImage }); });
  try {
    await page.goto(playerURL);
    await expect(page.locator("main[data-sync-player-stage=boot]")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Je verhaal komt tot leven.", exact: true })).toBeVisible();
    releaseManifest();
    await expect(page.locator("main[data-sync-player-stage=download]")).toBeVisible();
    await expect(page.getByRole("heading", { name: "We zetten alles klaar.", exact: true })).toBeVisible();
    await expect(page.getByRole("progressbar", { name: "Publicatie voorbereiden", exact: true })).not.toHaveAttribute("aria-valuenow");
    await expect(page.getByLabel("Release playback")).toHaveCount(0);
    releaseDownload();
    await expect(page.locator("main[data-sync-player-stage=verify]")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Nog één laatste controle.", exact: true })).toBeVisible();
    await expect(page.getByLabel("Release playback")).toHaveCount(0);
    await page.evaluate(() => { (window as Window & { releaseStatusVerification?: () => void }).releaseStatusVerification?.(); });
    await expect(page.getByRole("img", { name: "Eigen lokaal beeld 1", exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(page.locator("main[data-sync-player-stage]")).toHaveCount(0);
    publishNext = true;
    await page.evaluate(() => window.dispatchEvent(new Event("online")));
    await expect.poll(() => nextDownloadStarted, { timeout: 8_000 }).toBe(true);
    await expect(page.getByRole("img", { name: "Eigen lokaal beeld 1", exact: true })).toBeVisible();
    await expect(page.locator("main[data-sync-player-stage]")).toHaveCount(0);
    releaseNextDownload();
    await expect(page.getByRole("img", { name: "Eigen lokaal beeld 2", exact: true })).toBeVisible({ timeout: 10_000 });
  } finally {
    releaseManifest(); releaseDownload(); releaseNextDownload();
  }
});
