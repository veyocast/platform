import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import type { Page } from "@playwright/test";

import type {
  PlayerManifestEnvelope,
  PlayerManifestItem
} from "../../apps/player/app/_lib/player-manifest";

export async function routeEditorialPriceListManifest(
  page: Page,
  playerUrl: string,
  orientation: "landscape" | "portrait",
  theme: "dark" | "light"
) {
  const response = await page.request.get(
    `${playerUrl}/api/player/manifest?deviceToken=demo-online`
  );
  const baseline = await response.json() as PlayerManifestEnvelope;
  const fallback = baseline.manifest.items[0]!;
  const imageBytes = await readFile(path.resolve(
    process.cwd(),
    "apps/player/public/brand/veyocast-icon-192.png"
  ));
  const imageId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
  const sections = (["left", "right"] as const).map((column, columnIndex) => ({
    column,
    id: `section-${column}`,
    name: column === "left" ? "Dranken" : "Warme snacks",
    order: columnIndex,
    products: Array.from({ length: 16 }, (_, index) => ({
      description: index % 3 === 0 ? "Kleinere variant beschikbaar" : "Vers uit de kantine",
      formattedPrice: `€ ${(index + 2).toFixed(2).replace(".", ",")}`,
      id: `${column}-product-${index + 1}`,
      imageMediaAssetId: index % 2 === 0 ? imageId : null,
      name: index === 0
        ? "AddMoore Sportwater"
        : index === 1
          ? "Chaudfontaine mineraalwater bruisend"
          : index === 2
            ? "Verse ambachtelijke vegetarische clubsandwich deluxe"
            : column === "left" ? `Clubdrank ${index + 1}` : `Snack ${index + 1}`,
      photoVisible: index % 4 !== 3
    }))
  }));
  const item: PlayerManifestItem = {
    ...fallback,
    accessibilityName: "Dynamische prijslijst",
    displayTitle: "Prijslijst",
    durationSeconds: 10,
    dynamicTemplate: {
      assets: {
        [imageId]: {
          bytes: imageBytes.byteLength,
          checksumSha256: createHash("sha256").update(imageBytes).digest("hex"),
          mimeType: "image/png",
          url: `${playerUrl}/brand/veyocast-icon-192.png`
        }
      },
      data: {
        brand: {
          clubName: "Duindorp sv",
          logoMediaAssetId: imageId,
          primaryColor: "#FF5C20"
        },
        priceList: { sections, slidePhotoMode: "show", title: "Prijslijst" },
        type: "price_list"
      },
      orientation,
      schemaVersion: 1,
      slideType: "price_list",
      snapshotHash: "c".repeat(64),
      snapshotId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      templateSlug: `editorial-arena-prijslijst-${theme}-${orientation}`,
      templateVersionId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
    },
    id: `editorial-price-list-${theme}-${orientation}`,
    title: "Prijslijst"
  };
  const releaseId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
  await page.route("**/api/player/heartbeat", (route) => route.fulfill({
    body: JSON.stringify({ accepted: true }),
    contentType: "application/json",
    status: 200
  }));
  await page.route("**/api/player/manifest", (route) => route.fulfill({
    body: JSON.stringify({
      ...baseline,
      device: {
        ...baseline.device,
        activeReleaseId: releaseId,
        desiredReleaseId: releaseId
      },
      manifest: {
        ...baseline.manifest,
        items: [item],
        manifestHash: "d".repeat(64),
        releaseId,
        totalBytes: imageBytes.byteLength,
        totalDurationSeconds: 10,
        version: orientation === "portrait" ? 103 : 104
      }
    } satisfies PlayerManifestEnvelope),
    contentType: "application/json"
  }));
}
