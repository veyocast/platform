import { describe, expect, it } from "vitest";

import {
  demoOnlineDeviceToken,
  findFirstPlayableItemIndex,
  findNextPlayableItem,
  getNextPlayerVisibilityChangeDelayMs,
  getPlaybackDurationMs,
  getPlayerItemPlaybackDurationMs,
  getPlayerManifestForToken,
  isPlayerManifestItemPlayable,
  resolvePlayerItemPresentation,
  type PlayerManifestItem
} from "./player-manifest";

describe("player manifest contract", () => {
  it("requires a device token before fetching a manifest", () => {
    const lookup = getPlayerManifestForToken("");

    expect(lookup.ok).toBe(false);
    expect(lookup.status).toBe(401);
    expect(lookup.body.state).toBe("UNPAIRED");
  });

  it("returns a playable demo manifest for a paired online device", () => {
    const lookup = getPlayerManifestForToken(
      demoOnlineDeviceToken,
      "2026-07-17T10:00:00.000Z"
    );

    expect(lookup.ok).toBe(true);

    if (!lookup.ok) {
      throw new Error("expected demo manifest");
    }

    expect(lookup.body.state).toBe("PLAYING");
    expect(lookup.body.device.screenName).toBe("Entree links");
    expect(lookup.body.manifest.items.map((item) => item.kind)).toEqual([
      "image",
      "video",
      "image"
    ]);
    expect(lookup.body.manifest.manifestHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("bounds test playback duration overrides", () => {
    expect(getPlaybackDurationMs({ durationSeconds: 5 }, 100)).toBe(250);
    expect(getPlaybackDurationMs({ durationSeconds: 5 }, 30_000)).toBe(10_000);
    expect(getPlaybackDurationMs({ durationSeconds: 5 })).toBe(5_000);
  });

  it("materializes legacy item defaults without changing schemaVersion 1 behavior", () => {
    const item = manifestItem();

    expect(resolvePlayerItemPresentation(item)).toEqual({
      accessibilityName: "Legacy item",
      backgroundColor: null,
      cropFocusX: 0.5,
      cropFocusY: 0.5,
      displayTitle: "Legacy item",
      enabled: true,
      transition: "cut",
      trimEndSeconds: null,
      trimStartSeconds: 0,
      visibleFrom: null,
      visibleUntil: null,
      volumePercent: 100
    });
    expect(isPlayerManifestItemPlayable(item, Date.parse("2026-07-23T12:00:00Z"))).toBe(
      true
    );
  });

  it("resolves publisher presentation fields and rejects unsafe runtime values", () => {
    expect(
      resolvePlayerItemPresentation(
        manifestItem({
          accessibilityName: "  Sponsoruiting zonder gesproken tekst  ",
          backgroundColor: "#101010",
          cropFocus: { x: 0.2, y: 0.8 },
          displayTitle: "  Sponsorblok  ",
          enabled: true,
          transition: "wipe",
          trim: { endSeconds: 14, startSeconds: 4 },
          visibility: {
            from: "2026-07-23T10:00:00.000Z",
            until: "2026-07-23T14:00:00.000Z"
          },
          volumePercent: 35
        })
      )
    ).toMatchObject({
      accessibilityName: "Sponsoruiting zonder gesproken tekst",
      backgroundColor: "#101010",
      cropFocusX: 0.2,
      cropFocusY: 0.8,
      displayTitle: "Sponsorblok",
      transition: "wipe",
      trimEndSeconds: 14,
      trimStartSeconds: 4,
      volumePercent: 35
    });

    expect(
      resolvePlayerItemPresentation(
        manifestItem({
          backgroundColor: "url(javascript:alert(1))",
          cropFocus: { x: 20, y: 0.5 },
          transition: "spin",
          trim: { endSeconds: 2, startSeconds: 4 },
          volumePercent: 140
        } as never)
      )
    ).toMatchObject({
      backgroundColor: null,
      cropFocusX: 0.5,
      transition: "cut",
      trimEndSeconds: null,
      volumePercent: 100
    });
  });

  it("skips disabled and out-of-window items in deterministic order", () => {
    const at = Date.parse("2026-07-23T12:00:00.000Z");
    const items = [
      manifestItem({ enabled: false, id: "disabled" }),
      manifestItem({
        id: "future",
        visibility: { from: "2026-07-23T13:00:00.000Z" }
      }),
      manifestItem({
        id: "active",
        visibility: {
          from: "2026-07-23T11:00:00.000Z",
          until: "2026-07-23T13:00:00.000Z"
        }
      })
    ];

    expect(findFirstPlayableItemIndex(items, at)).toBe(2);
    expect(findNextPlayableItem(items, 2, at)).toEqual({
      index: 2,
      wrapped: true
    });
    expect(getNextPlayerVisibilityChangeDelayMs(items, at)).toBe(3_600_000);
  });

  it("caps an active slot at its visibility end", () => {
    const at = Date.parse("2026-07-23T12:00:00.000Z");
    const item = manifestItem({
      durationSeconds: 30,
      visibility: { until: "2026-07-23T12:00:04.000Z" }
    });

    expect(getPlayerItemPlaybackDurationMs(item, null, at)).toBe(4_000);
  });
});

function manifestItem(
  overrides: Partial<PlayerManifestItem> = {}
): PlayerManifestItem {
  return {
    durationSeconds: 10,
    fitMode: "cover",
    id: "30000000-0000-4000-8000-000000000001",
    kind: "image",
    muted: true,
    source: {
      bytes: 12,
      checksumSha256: "a".repeat(64),
      mimeType: "image/png",
      url: "/asset.png"
    },
    title: "Legacy item",
    ...overrides
  };
}
