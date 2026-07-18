import { afterEach, describe, expect, it, vi } from "vitest";

import {
  demoOnlineDeviceToken,
  getPlayerManifestForToken,
  type PlayerManifestEnvelope
} from "./player-manifest";
import {
  getCacheableAssets,
  garbageCollectPlayerMedia,
  hydratePreparedRelease,
  playerStorageReserveBytes,
  preparePendingRelease,
  sha256Hex,
  verifyAssetBytes
} from "./player-cache";
import type { PlayerMediaStore } from "./player-media-store";

class MemoryCache {
  readonly entries = new Map<string, Response>();

  async delete(key: string) {
    return this.entries.delete(key);
  }

  async match(key: string) {
    return this.entries.get(key)?.clone();
  }

  async put(key: string, response: Response) {
    this.entries.set(key, response.clone());
  }
}

class MemoryMediaStore implements PlayerMediaStore {
  readonly entries = new Map<string, Response>();

  async delete(key: string) {
    return this.entries.delete(key);
  }
  async get(key: string) {
    return this.entries.get(key)?.clone();
  }
  async keys() {
    return [...this.entries.keys()];
  }
  async put(key: string, response: Response) {
    this.entries.set(key, response.clone());
  }
  async resolvePlaybackUrl(key: string) {
    if (!this.entries.has(key)) throw new Error(`missing ${key}`);
    return { url: key };
  }
}

describe("player cache contract", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

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

    await expect(
      verifyAssetBytes(
        {
          bytes: payload.byteLength,
          checksumSha256: "f".repeat(64),
          url: "/asset.svg"
        },
        payload.buffer
      )
    ).rejects.toThrow("asset checksum mismatch");
  });

  it("does not delete existing last-known-good assets when pending verification fails", async () => {
    const sharedPayload = new TextEncoder().encode("shared-active-asset");
    const corruptPendingPayload = new TextEncoder().encode("corrupt-pending-asset");
    const sharedChecksum = await sha256Hex(sharedPayload.buffer);
    const pendingChecksum = await sha256Hex(corruptPendingPayload.buffer);
    const sharedCacheKey = `/__castivo-player-cache/${sharedChecksum}`;
    const pendingCacheKey = `/__castivo-player-cache/${pendingChecksum}`;
    const cache = new MemoryCache();

    await cache.put(
      sharedCacheKey,
      new Response(sharedPayload, {
        headers: { "Content-Type": "image/svg+xml" }
      })
    );

    vi.stubGlobal("caches", {
      open: vi.fn().mockResolvedValue(cache)
    });
    vi.stubGlobal("navigator", {
      storage: {
        estimate: vi.fn().mockResolvedValue({ quota: 100_000_000, usage: 0 })
      }
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL | Request) => {
        const requestedUrl = String(url);
        const payload = requestedUrl.includes("pending")
          ? corruptPendingPayload
          : sharedPayload;

        return new Response(payload, {
          headers: { "Content-Type": "image/svg+xml" },
          status: 200
        });
      })
    );

    const result = await preparePendingRelease({
      envelope: createPendingEnvelope({
        pendingBytes: corruptPendingPayload.byteLength,
        pendingChecksum: "0".repeat(64),
        sharedBytes: sharedPayload.byteLength,
        sharedChecksum
      })
    });

    expect(result).toMatchObject({
      error: "asset checksum mismatch: /player-demo/pending.svg",
      ok: false
    });
    await expect(cache.match(sharedCacheKey)).resolves.toBeDefined();
    await expect(cache.match(pendingCacheKey)).resolves.toBeUndefined();
  });

  it("checks only missing bytes plus reserve and does not download when quota is unsafe", async () => {
    const sharedPayload = new TextEncoder().encode("shared-active-asset");
    const pendingPayload = new TextEncoder().encode("pending-asset");
    const sharedChecksum = await sha256Hex(sharedPayload.buffer);
    const pendingChecksum = await sha256Hex(pendingPayload.buffer);
    const store = new MemoryMediaStore();
    await store.put(
      `/__castivo-player-cache/${sharedChecksum}`,
      new Response(sharedPayload, { headers: { "Content-Type": "image/png" } })
    );
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    vi.stubGlobal("navigator", {
      storage: {
        estimate: vi.fn().mockResolvedValue({
          quota: playerStorageReserveBytes + pendingPayload.byteLength - 1,
          usage: 0
        })
      }
    });

    const result = await preparePendingRelease({
      envelope: createPendingEnvelope({
        pendingBytes: pendingPayload.byteLength,
        pendingChecksum,
        sharedBytes: sharedPayload.byteLength,
        sharedChecksum
      }),
      store
    });

    expect(result).toMatchObject({ ok: false });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(
      store.entries.get(`/__castivo-player-cache/${sharedChecksum}`)?.headers.get(
        "Content-Length"
      )
    ).toBe(String(sharedPayload.byteLength));
  });

  it("hydrates legacy cache entries with Range headers and rejects corrupt stored releases", async () => {
    const payload = new TextEncoder().encode("legacy-asset");
    const checksum = await sha256Hex(payload.buffer);
    const envelope = createPendingEnvelope({
      pendingBytes: payload.byteLength,
      pendingChecksum: checksum,
      sharedBytes: payload.byteLength,
      sharedChecksum: checksum
    });
    const assets = getCacheableAssets(envelope.manifest);
    const asset = assets[0];
    if (!asset) throw new Error("expected cacheable asset");
    const store = new MemoryMediaStore();
    await store.put(
      asset.cacheKey,
      new Response(payload, { headers: { "Content-Type": "image/png" } })
    );

    await expect(hydratePreparedRelease({ assets, envelope }, store)).resolves.toMatchObject({
      envelope: { manifest: { releaseId: envelope.manifest.releaseId } }
    });
    expect(store.entries.get(asset.cacheKey)?.headers.get("Accept-Ranges")).toBe(
      "bytes"
    );

    await store.put(asset.cacheKey, new Response("corrupt"));
    await expect(hydratePreparedRelease({ assets, envelope }, store)).rejects.toThrow(
      "missing or corrupt"
    );
  });

  it("garbage-collects only unreferenced player assets", async () => {
    const store = new MemoryMediaStore();
    await Promise.all([
      store.put("/__castivo-player-cache/active", new Response("active")),
      store.put("/__castivo-player-cache/previous", new Response("previous")),
      store.put("/__castivo-player-cache/obsolete", new Response("obsolete")),
      store.put("/unrelated", new Response("keep"))
    ]);

    const result = await garbageCollectPlayerMedia({
      releases: [
        { assets: [{ cacheKey: "/__castivo-player-cache/active" }] },
        { assets: [{ cacheKey: "/__castivo-player-cache/previous" }] }
      ] as never,
      store
    });

    expect(result.deletedKeys).toEqual(["/__castivo-player-cache/obsolete"]);
    expect(await store.keys()).toEqual([
      "/__castivo-player-cache/active",
      "/__castivo-player-cache/previous",
      "/unrelated"
    ]);
  });

  it("counts and downloads duplicate checksum assets only once", async () => {
    const payload = new TextEncoder().encode("shared-checksum");
    const checksum = await sha256Hex(payload.buffer);
    const store = new MemoryMediaStore();
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(payload, {
        headers: { "Content-Type": "image/png" },
        status: 200
      })
    );
    vi.stubGlobal("fetch", fetchSpy);
    vi.stubGlobal("navigator", {
      storage: {
        estimate: vi.fn().mockResolvedValue({ quota: 100_000_000, usage: 0 })
      }
    });

    const result = await preparePendingRelease({
      envelope: createPendingEnvelope({
        pendingBytes: payload.byteLength,
        pendingChecksum: checksum,
        sharedBytes: payload.byteLength,
        sharedChecksum: checksum
      }),
      store
    });

    expect(result).toMatchObject({ ok: true });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});

function createPendingEnvelope({
  pendingBytes,
  pendingChecksum,
  sharedBytes,
  sharedChecksum
}: {
  pendingBytes: number;
  pendingChecksum: string;
  sharedBytes: number;
  sharedChecksum: string;
}): PlayerManifestEnvelope {
  return {
    device: {
      activeReleaseId: "33333333-3333-4333-8333-333333333333",
      desiredReleaseId: "99999999-9999-4999-8999-999999999999",
      id: "55555555-5555-4555-8555-555555555555",
      screenId: "44444444-4444-4444-8444-444444444444",
      screenName: "Entree links"
    },
    diagnostics: {
      lastSuccessfulSyncAt: "2026-07-17T09:00:00.000Z",
      nextSyncReason: "desired release changed",
      syncStatus: "online"
    },
    fetchedAt: "2026-07-17T09:10:00.000Z",
    manifest: {
      items: [
        {
          durationSeconds: 5,
          fitMode: "cover",
          id: "shared-active",
          kind: "image",
          muted: true,
          source: {
            bytes: sharedBytes,
            checksumSha256: sharedChecksum,
            mimeType: "image/svg+xml",
            url: "/player-demo/shared.svg"
          },
          title: "Shared active asset"
        },
        {
          durationSeconds: 5,
          fitMode: "cover",
          id: "corrupt-pending",
          kind: "image",
          muted: true,
          source: {
            bytes: pendingBytes,
            checksumSha256: pendingChecksum,
            mimeType: "image/svg+xml",
            url: "/player-demo/pending.svg"
          },
          title: "Corrupt pending asset"
        }
      ],
      label: "Pending v4",
      manifestHash: "c".repeat(64),
      playlistId: "22222222-2222-4222-8222-222222222222",
      publishedAt: "2026-07-17T09:10:00.000Z",
      releaseId: "99999999-9999-4999-8999-999999999999",
      schemaVersion: 1,
      tenantId: "11111111-1111-4111-8111-111111111111",
      totalBytes: sharedBytes + pendingBytes,
      totalDurationSeconds: 10,
      version: 4
    },
    state: "PLAYING"
  };
}
