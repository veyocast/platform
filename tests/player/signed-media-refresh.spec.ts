import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { expect, test } from "@playwright/test";

import type { PlayerManifestEnvelope } from "../../apps/player/app/_lib/player-manifest";

const playerURL = `http://127.0.0.1:${process.env.PLAYER_PORT ?? 3106}`;

test.use({ serviceWorkers: "block" });

test("refreshes an expired signed LG video URL for an unchanged cached release", async ({
  page
}) => {
  test.setTimeout(60_000);
  const response = await page.request.get(
    `${playerURL}/api/player/manifest?deviceToken=demo-online`
  );
  const baseline = (await response.json()) as PlayerManifestEnvelope;
  const mediaBytes = await readFile(
    resolve("apps/player/demo-assets/demoveyo.mp4")
  );
  const checksum = createHash("sha256").update(mediaBytes).digest("hex");
  const releaseId = "77777777-7777-4777-8777-777777777777";
  const expiredEnvelope: PlayerManifestEnvelope = {
    ...baseline,
    device: {
      ...baseline.device,
      activeReleaseId: releaseId,
      desiredReleaseId: releaseId
    },
    fetchedAt: "2026-07-30T19:00:00.000Z",
    manifest: {
      ...baseline.manifest,
      items: [
        {
          durationSeconds: 10,
          fitMode: "contain",
          id: "cached-signed-video",
          kind: "video",
          muted: true,
          source: {
            bytes: mediaBytes.byteLength,
            checksumSha256: checksum,
            mimeType: "video/mp4",
            url: "/signed/expired.mp4"
          },
          title: "Cached signed video"
        }
      ],
      manifestHash: "7".repeat(64),
      releaseId,
      totalBytes: mediaBytes.byteLength,
      totalDurationSeconds: 10,
      version: 7
    }
  };
  const freshEnvelope: PlayerManifestEnvelope = {
    ...expiredEnvelope,
    fetchedAt: "2026-07-30T21:00:00.000Z",
    manifest: {
      ...expiredEnvelope.manifest,
      items: expiredEnvelope.manifest.items.map((item) => ({
        ...item,
        source: {
          ...item.source,
          url: "/signed/fresh.mp4"
        }
      }))
    }
  };
  let serveFreshManifest = false;

  await page.route("**/api/player/manifest", (route) =>
    route.fulfill({
      body: JSON.stringify(
        serveFreshManifest ? freshEnvelope : expiredEnvelope
      ),
      contentType: "application/json"
    })
  );
  await page.route("**/signed/expired.mp4", (route) =>
    route.fulfill({ body: mediaBytes, contentType: "video/mp4" })
  );
  await page.route("**/signed/fresh.mp4", (route) =>
    route.fulfill({ body: mediaBytes, contentType: "video/mp4" })
  );

  await page.goto(
    `${playerURL}/lg?deviceToken=demo-online&durationMs=10000&syncMs=250`
  );
  await expect(page.getByTestId("player-video")).toHaveAttribute(
    "src",
    "/signed/expired.mp4"
  );

  serveFreshManifest = true;
  await page.reload();

  await expect(page.getByTestId("player-video")).toHaveAttribute(
    "src",
    "/signed/fresh.mp4",
    { timeout: 5_000 }
  );
});
