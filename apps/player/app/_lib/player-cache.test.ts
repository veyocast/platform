import { describe, expect, it } from "vitest";

import { demoOnlineDeviceToken, getPlayerManifestForToken } from "./player-manifest";
import { getCacheableAssets, sha256Hex, verifyAssetBytes } from "./player-cache";

describe("player cache contract", () => {
  it("extracts cacheable media and poster assets from a manifest", () => {
    const lookup = getPlayerManifestForToken(demoOnlineDeviceToken);

    if (!lookup.ok) {
      throw new Error("expected demo manifest");
    }

    const assets = getCacheableAssets(lookup.body.manifest);

    expect(assets.map((asset) => `${asset.kind}:${asset.itemId}`)).toEqual([
      "media:screen-entree",
      "poster:match-preview",
      "media:canteen-news"
    ]);
    expect(assets.every((asset) => asset.cacheKey.includes(asset.checksumSha256))).toBe(
      true
    );
  });

  it("verifies bytes by size and sha256", async () => {
    const payload = new TextEncoder().encode("castivo-cache");
    const checksumSha256 = await sha256Hex(payload.buffer);

    await expect(
      verifyAssetBytes(
        {
          bytes: payload.byteLength,
          checksumSha256,
          url: "/asset.svg"
        },
        payload.buffer
      )
    ).resolves.toBeUndefined();

    await expect(
      verifyAssetBytes(
        {
          bytes: payload.byteLength + 1,
          checksumSha256,
          url: "/asset.svg"
        },
        payload.buffer
      )
    ).rejects.toThrow("asset size mismatch");
  });
});
