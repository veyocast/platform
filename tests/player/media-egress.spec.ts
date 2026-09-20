import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:https";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { parseByteRangeHeader } from "../../apps/player/app/_lib/media-range";
import { getPlayerManifestForToken, type PlayerManifestEnvelope } from "../../apps/player/app/_lib/player-manifest";

const playerURL = process.env.PLAYER_BASE_URL ?? `http://127.0.0.1:${process.env.PLAYER_PORT ?? 3106}`;
const media = readFileSync("apps/player/public/lg-probe/h264-baseline-aac.mp4");
const checksum = createHash("sha256").update(media).digest("hex");
test.use({ ignoreHTTPSErrors: true });
const warmLoops = Math.max(10, Math.min(10000, Number(process.env.EGRESS_WARM_LOOPS) || 100));
const realtime = process.env.EGRESS_REALTIME === "1";
const recordBaseline = process.env.EGRESS_RECORD_BASELINE === "1";

for (const runtime of ["browser", "static-lg"] as const) {
  test(`${runtime}: one cold HTTPS transfer, 100 warm loops, token rotation and reboot`, async ({ page }, testInfo) => {
    test.setTimeout(Math.max(150_000, warmLoops * (realtime ? 6000 : 1500)));
    const directory = mkdtempSync(join(tmpdir(), "veyocast-egress-tls-"));
    execFileSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", join(directory, "key.pem"),
      "-out", join(directory, "cert.pem"), "-days", "1", "-subj", "/CN=localhost"], { stdio: "ignore" });
    let bytesSent = 0;
    const activeReleases = new Set<string>();
    const requests: Array<{ method: string; range: string | null; status: number; bytes: number }> = [];
    const server = createServer({ key: readFileSync(join(directory, "key.pem")), cert: readFileSync(join(directory, "cert.pem")) }, (request, response) => {
      const range = request.headers.range;
      const parsed = range ? parseByteRangeHeader(range, media.length) : null;
      const status = parsed ? parsed.ok ? 206 : 416 : 200;
      const body = parsed ? parsed.ok ? media.subarray(parsed.range.start, parsed.range.end + 1) : Buffer.alloc(0) : media;
      response.writeHead(status, { "content-type": "video/mp4", "content-length": body.length,
        "cache-control": "no-store", "access-control-allow-origin": "*", "accept-ranges": "bytes",
        ...(parsed ? { "content-range": parsed.ok ? `bytes ${parsed.range.start}-${parsed.range.end}/${media.length}` : `bytes */${media.length}` } : {}) });
      const count = request.method === "HEAD" ? 0 : body.length;
      bytesSent += count; requests.push({ method: request.method!, range: range ?? null, status, bytes: count });
      response.end(request.method === "HEAD" ? undefined : body);
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("fixture server missing");
    try {
      const source = `https://127.0.0.1:${address.port}/video.mp4`;
      // Build the fixture locally so this test can verify a deployed staging
      // runtime without demo access, credentials or writes to its database.
      const lookup = getPlayerManifestForToken("demo-online");
      if (!lookup.ok) throw new Error("local demo manifest unavailable");
      const baseline = lookup.body;
      const envelope: PlayerManifestEnvelope = { ...baseline, manifest: { ...baseline.manifest,
        items: [{ ...baseline.manifest.items[0]!, id: "egress-video", kind: "video", durationSeconds: 1,
          source: { url: `${source}?token=cold`, mimeType: "video/mp4", bytes: media.length, checksumSha256: checksum } }] } };
      await page.addInitScript(() => {
        localStorage.setItem("veyocast.player.deviceToken", "a".repeat(48));
        localStorage.setItem("veyocast.player.installationCredential", "i".repeat(48));
      });
      await page.route("**/api/player/installation", (route) => route.fulfill({ json: { ok: true, bound: true, installationCredential: "i".repeat(48) } }));
      await page.route("**/api/player/realtime*", (route) => route.fulfill({ status: 204 }));
      await page.route("**/api/player/commands*", (route) => route.fulfill({ json: { ok: true, commands: [] } }));
      await page.route("**/api/player/heartbeat", (route) => {
        const heartbeat = route.request().postDataJSON();
        if (heartbeat.activeReleaseId) activeReleases.add(heartbeat.activeReleaseId);
        return route.fulfill({ json: { ok: true } });
      });
      await page.route("**/api/player/manifest*", (route) => route.fulfill({ json: envelope }));
      await page.goto(`${playerURL}${runtime === "static-lg" ? "/lg/legacy" : "/"}`);
      const video = () => page.locator(runtime === "static-lg" ? "#media-root > video" : "video").last();
      await expect.poll(() => video().evaluate((v: HTMLVideoElement) => v.currentTime), { timeout: 20_000 }).toBeGreaterThan(0);
      const coldBytes = bytesSent;
      if (!recordBaseline) expect(coldBytes).toBe(media.length);
      for (let loop = 0; loop < warmLoops; loop += 1) {
        const marker = String(loop);
        await video().evaluate((element: HTMLVideoElement, options) => {
          element.dataset.egressLoop = options.marker;
          if (!options.realtime) {
            element.currentTime = Math.max(0, element.duration - 0.04);
            element.playbackRate = 4;
          }
        }, { marker, realtime });
        await expect.poll(() => video().evaluate((v: HTMLVideoElement) => v.dataset.egressLoop), { timeout: 4_000 }).not.toBe(marker);
        await expect.poll(() => video().evaluate((v: HTMLVideoElement) => v.currentTime)).toBeGreaterThan(0);
        if (!recordBaseline) expect(bytesSent).toBe(coldBytes);
      }
      envelope.manifest.releaseId = "18600000-0000-4000-8000-000000000001";
      envelope.manifest.manifestHash = "d".repeat(64);
      envelope.manifest.version += 1;
      envelope.device.desiredReleaseId = envelope.manifest.releaseId;
      envelope.fetchedAt = new Date(Date.now() + 3_600_000).toISOString();
      envelope.manifest.items[0]!.source.url = `${source}?token=rotated`;
      await page.evaluate(() => window.dispatchEvent(new Event("online")));
      await page.reload();
      await expect.poll(() => video().evaluate((v: HTMLVideoElement) => v.currentTime), { timeout: 15_000 }).toBeGreaterThan(0);
      await expect.poll(() => activeReleases.has(envelope.manifest.releaseId), { timeout: 15_000 }).toBe(true);
      if (!recordBaseline) expect(bytesSent).toBe(coldBytes);
      if (!recordBaseline) expect(requests).toEqual([{ method: "GET", range: null, status: 200, bytes: media.length }]);
      const accounting = JSON.stringify({ runtime, recordBaseline, hardware: "desktop-chromium-fixture",
        uniqueContentBytes: media.length, coldBytes, warmLoops, realtime, warmAdditionalPayloadBytes: bytesSent - coldBytes, requests }, null, 2);
      const evidencePath = testInfo.outputPath("media-payload-accounting.json");
      writeFileSync(evidencePath, accounting);
      await testInfo.attach("media-payload-accounting", { path: evidencePath, contentType: "application/json" });
    } finally {
      server.closeAllConnections(); await new Promise<void>((resolve) => server.close(() => resolve()));
      rmSync(directory, { force: true, recursive: true });
    }
  });
}
