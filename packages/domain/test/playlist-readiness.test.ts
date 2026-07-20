import { describe, expect, it } from "vitest";

import {
  evaluatePlaylistReadiness,
  type PlaylistReadinessItem
} from "../src";

const tenantId = "10000000-0000-4000-8000-000000000001";

function readyItem(
  overrides: Partial<PlaylistReadinessItem> = {}
): PlaylistReadinessItem {
  return {
    asset: {
      deleted: false,
      id: "20000000-0000-4000-8000-000000000001",
      kind: "image",
      status: "ready",
      tenantId,
      variant: {
        fileSizeBytes: 1024,
        height: 1080,
        mimeType: "image/png",
        tenantId,
        variantType: "original",
        width: 1920
      }
    },
    durationSeconds: 10,
    fitMode: "contain",
    id: "30000000-0000-4000-8000-000000000001",
    mediaAssetId: "20000000-0000-4000-8000-000000000001",
    ...overrides
  };
}

describe("playlist publication readiness", () => {
  it("accepts a player-compatible draft with stable totals", () => {
    expect(
      evaluatePlaylistReadiness({
        items: [readyItem()],
        playlistStatus: "draft",
        playlistTenantId: tenantId,
        targetOrientations: ["landscape", "portrait"]
      })
    ).toEqual({
      canPublish: true,
      itemCount: 1,
      reasons: [],
      totalBytes: 1024,
      totalDurationSeconds: 10
    });
  });

  it.each([
    ["empty", [], "PLAYLIST_EMPTY"],
    ["missing asset", [readyItem({ asset: null })], "ASSET_MISSING"],
    [
      "processing asset",
      [readyItem({ asset: { ...readyItem().asset!, status: "processing" } })],
      "ASSET_NOT_READY"
    ],
    [
      "cross-tenant asset",
      [readyItem({ asset: { ...readyItem().asset!, tenantId: "10000000-0000-4000-8000-000000000002" } })],
      "ASSET_TENANT_MISMATCH"
    ],
    [
      "missing player variant",
      [readyItem({ asset: { ...readyItem().asset!, variant: null } })],
      "PLAYER_VARIANT_MISSING"
    ],
    ["invalid duration", [readyItem({ durationSeconds: 4 })], "ITEM_DURATION_INVALID"]
  ])("returns a golden reason for %s", (_label, items, expectedCode) => {
    const result = evaluatePlaylistReadiness({
      items: items as PlaylistReadinessItem[],
      playlistStatus: "draft",
      playlistTenantId: tenantId
    });

    expect(result.canPublish).toBe(false);
    expect(result.reasons.map(({ code }) => code)).toContain(expectedCode);
  });

  it("reports every independent blocker in deterministic order", () => {
    const result = evaluatePlaylistReadiness({
      items: [readyItem({ durationSeconds: 2, fitMode: "stretch", asset: null })],
      playlistStatus: "archived",
      playlistTenantId: tenantId,
      targetOrientations: ["square"]
    });

    expect(result.reasons.map(({ code }) => code)).toEqual([
      "PLAYLIST_ARCHIVED",
      "TARGET_ORIENTATION_UNSUPPORTED",
      "ITEM_DURATION_INVALID",
      "ITEM_FIT_MODE_INVALID",
      "ASSET_MISSING"
    ]);
  });

  it("allows optional image dimensions while rejecting malformed metadata", () => {
    const withoutDimensions = readyItem({
      asset: {
        ...readyItem().asset!,
        variant: { ...readyItem().asset!.variant!, height: null, width: null }
      }
    });
    const malformedDimensions = readyItem({
      asset: {
        ...readyItem().asset!,
        variant: { ...readyItem().asset!.variant!, width: 0 }
      }
    });

    expect(evaluatePlaylistReadiness({ items: [withoutDimensions], playlistStatus: "draft", playlistTenantId: tenantId }).canPublish).toBe(true);
    expect(evaluatePlaylistReadiness({ items: [malformedDimensions], playlistStatus: "draft", playlistTenantId: tenantId }).reasons[0]?.code).toBe("VARIANT_METADATA_INVALID");
  });
});
