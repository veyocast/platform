import type { Page } from "@playwright/test";

import type {
  PlayerManifestEnvelope,
  PlayerManifestItem
} from "../../apps/player/app/_lib/player-manifest";

export async function routeSportlinkStandingManifest(
  page: Page,
  playerUrl: string,
  orientation: "landscape" | "portrait"
) {
  const baselineResponse = await page.request.get(
    `${playerUrl}/api/player/manifest?deviceToken=demo-online`
  );
  const baseline = await baselineResponse.json() as PlayerManifestEnvelope;
  const fallback = baseline.manifest.items[0]!;
  const item: PlayerManifestItem = {
    ...fallback,
    accessibilityName: "Dynamische competitiestand",
    displayTitle: "Competitiestand",
    durationSeconds: 10,
    dynamicTemplate: {
      data: {
        brand: { primaryColor: "#315CFF" },
        sport: {
          competition: { name: "Vierde klasse" },
          items: Array.from({ length: 20 }, (_, index) => ({
            drawn: 3,
            form: index % 2 === 0
              ? ["win", "draw", "loss"]
              : ["win", "win", "draw"],
            goalDifference: 24 - index * 3,
            goalsAgainst: 15 + index * 2,
            goalsFor: 39 - index,
            id: `team-${index + 1}`,
            lost: index + 1,
            played: 18,
            points: 42 - index * 3,
            position: index + 1,
            selected: index === 1,
            teamName: index === 1
              ? "Duindorp sv"
              : `Vereniging ${index + 1}`,
            won: 14 - index
          })),
          pool: { name: "4C" },
          season: "2026/2027",
          title: "Stand"
        },
        type: "sport_standing"
      },
      orientation,
      schemaVersion: 1,
      slideType: "sport_standing",
      snapshotHash: "c".repeat(64),
      snapshotId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      templateSlug:
        `sportlink-standing-club-edition-dark-${orientation}`,
      templateVersionId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
    },
    id: `sportlink-standing-${orientation}`,
    title: "Competitiestand"
  };
  const releaseId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
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
      manifestHash: "d".repeat(64),
      releaseId,
      totalBytes: item.source.bytes,
      totalDurationSeconds: 10,
      version: orientation === "portrait" ? 90 : 91
    }
  };

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
}
