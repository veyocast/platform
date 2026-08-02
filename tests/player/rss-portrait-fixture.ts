import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import type { Page } from "@playwright/test";

import type {
  PlayerManifestEnvelope,
  PlayerManifestItem
} from "../../apps/player/app/_lib/player-manifest";

export async function routePortraitRssManifest(
  page: Page,
  playerUrl: string
) {
  return routeRssManifest(page, playerUrl, "portrait");
}

export async function routeLandscapeRssManifest(
  page: Page,
  playerUrl: string
) {
  return routeRssManifest(page, playerUrl, "landscape");
}

async function routeRssManifest(
  page: Page,
  playerUrl: string,
  orientation: "landscape" | "portrait"
) {
  const baselineResponse = await page.request.get(
    `${playerUrl}/api/player/manifest?deviceToken=demo-online`
  );
  const baseline = await baselineResponse.json() as PlayerManifestEnvelope;
  const [heroBytes, logoBytes] = await Promise.all([
    readFile(path.resolve(
      process.cwd(),
      "apps/player/public/brand/veyocast-icon-maskable-1024.png"
    )),
    readFile(path.resolve(
      process.cwd(),
      "apps/player/public/brand/veyocast-icon-192.png"
    ))
  ]);
  const heroUrl = "https://rss-assets.veyocast.test/article-hero.png";
  const logoUrl = "https://rss-assets.veyocast.test/provider-logo.png";
  const heroId = "66666666-6666-4666-8666-666666666666";
  const logoId = "77777777-7777-4777-8777-777777777777";
  const fallback = baseline.manifest.items[0]!;
  const item: PlayerManifestItem = {
    ...fallback,
    accessibilityName: "Dynamisch voetbalnieuws",
    displayTitle: `RSS nieuws · ${
      orientation === "portrait" ? "staand" : "liggend"
    }`,
    durationSeconds: 10,
    dynamicTemplate: {
      assets: {
        [heroId]: {
          bytes: heroBytes.byteLength,
          checksumSha256: checksum(heroBytes),
          mimeType: "image/png",
          url: heroUrl
        },
        [logoId]: {
          bytes: logoBytes.byteLength,
          checksumSha256: checksum(logoBytes),
          mimeType: "image/png",
          url: logoUrl
        }
      },
      data: {
        brand: { primaryColor: "#315cff" },
        news: {
          articles: [
            {
              author: "Sportredactie",
              externalId: "article-1",
              heroMediaAssetId: heroId,
              intro:
                "Het laatste voetbalnieuws staat klaar voor leden en bezoekers.",
              link: "https://example.com/voetbal/eerste",
              publishedAt: "2026-08-02T14:46:00.000Z",
              sourceName: "AD:voetbal",
              title: "De eerste dynamische voetbalheadline staat live"
            },
            {
              author: "Redactie",
              externalId: "article-2",
              heroMediaAssetId: heroId,
              intro: "Een tweede bericht volgt automatisch.",
              link: "https://example.com/voetbal/tweede",
              publishedAt: "2026-08-02T14:36:00.000Z",
              sourceName: "AD:voetbal",
              title: "Ook het tweede bericht gebruikt echte HTML en CSS"
            }
          ],
          providerLogoMediaAssetId: logoId,
          secondsPerSlide: 5,
          sourceName: "AD:voetbal",
          title: "Voetbalnieuws"
        },
        type: "news"
      },
      orientation,
      schemaVersion: 1,
      slideType: "news",
      snapshotHash: "a".repeat(64),
      snapshotId: "88888888-8888-4888-8888-888888888888",
      templateSlug: `news-newsroom-dark-${orientation}`,
      templateVersionId: "99999999-9999-4999-8999-999999999999"
    },
    id: `rss-${orientation}-html`,
    title: `RSS nieuws · ${
      orientation === "portrait" ? "staand" : "liggend"
    }`
  };
  const releaseId = "55555555-5555-4555-8555-555555555555";
  const manifest: PlayerManifestEnvelope = {
    ...baseline,
    device: {
      ...baseline.device,
      activeReleaseId: releaseId,
      desiredReleaseId: releaseId
    },
    manifest: {
      ...baseline.manifest,
      items: [item],
      manifestHash: "b".repeat(64),
      releaseId,
      totalBytes:
        item.source.bytes + heroBytes.byteLength + logoBytes.byteLength,
      totalDurationSeconds: 10,
      version: orientation === "portrait" ? 85 : 86
    }
  };

  await page.route(heroUrl, (route) =>
    route.fulfill({ body: heroBytes, contentType: "image/png" })
  );
  await page.route(logoUrl, (route) =>
    route.fulfill({ body: logoBytes, contentType: "image/png" })
  );
  await page.route("**/api/player/heartbeat", (route) =>
    route.fulfill({
      body: JSON.stringify({ accepted: true }),
      contentType: "application/json",
      status: 200
    })
  );
  await page.route("**/api/player/manifest", (route) =>
    route.fulfill({
      body: JSON.stringify(manifest),
      contentType: "application/json"
    })
  );
  return manifest;
}

function checksum(bytes: Buffer) {
  return createHash("sha256").update(bytes).digest("hex");
}
