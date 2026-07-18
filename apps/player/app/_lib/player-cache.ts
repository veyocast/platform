import type {
  PlayerManifestEnvelope,
  PlayerManifestItem,
  PlayerReleaseManifest
} from "./player-manifest";
import { createPlayerMediaStore, type PlayerMediaStore } from "./player-media-store";

export const playerAssetCacheName = "castivo-player-assets-v1";
export const playerDatabaseName = "castivo-player-cache-v1";
export const playerActiveReleaseStoreName = "activeReleases";
export const playerPreviousReleaseStoreName = "previousReleases";

export type PlayerCachePhase = "DOWNLOADING" | "VERIFYING";

export type PlayerCacheAsset = {
  bytes: number;
  cacheKey: string;
  checksumSha256: string;
  itemId: string;
  kind: "media" | "poster";
  url: string;
};

export type CachedPlayerRelease = {
  activatedAt: string;
  assets: PlayerCacheAsset[];
  deviceToken: string;
  envelope: PlayerManifestEnvelope;
};

export type HydratedPlayerRelease = {
  assets: PlayerCacheAsset[];
  envelope: PlayerManifestEnvelope;
  objectUrls: Record<string, string>;
};

export type PlayerCacheResult =
  | {
      ok: true;
      assets: PlayerCacheAsset[];
    }
  | {
      ok: false;
      error: string;
    };

export function getCacheableAssets(
  manifest: PlayerReleaseManifest
): PlayerCacheAsset[] {
  return manifest.items.flatMap((item) => {
    const assets: PlayerCacheAsset[] = [];

    if (item.source.url) {
      assets.push(toCacheAsset(item, "media", item.source.url));
    }

    if (item.source.posterUrl) {
      assets.push(
        toCacheAsset(
          item,
          "poster",
          item.source.posterUrl,
          item.source.posterBytes,
          item.source.posterChecksumSha256
        )
      );
    }

    return assets;
  });
}

export async function preparePendingRelease({
  envelope,
  onPhase,
  store = createPlayerMediaStore(playerAssetCacheName)
}: {
  envelope: PlayerManifestEnvelope;
  onPhase?: (phase: PlayerCachePhase) => void;
  store?: PlayerMediaStore;
}): Promise<PlayerCacheResult> {
  const assets = getCacheableAssets(envelope.manifest);
  const storageCheck = await hasEnoughStorage(envelope.manifest.totalBytes);

  if (!storageCheck.ok) {
    return {
      ok: false,
      error: storageCheck.error
    };
  }

  const newPreparedKeys = new Set<string>();

  try {
    onPhase?.("DOWNLOADING");

    for (const asset of assets) {
      const existingResponse = await store.get(asset.cacheKey);

      if (existingResponse) {
        try {
          await verifyAssetBytes(asset, await existingResponse.clone().arrayBuffer());
          continue;
        } catch {
          // The checksum-keyed entry exists but is not trustworthy; refresh it.
        }
      }

      const response = await fetch(asset.url, { cache: "no-store" });

      if (!response.ok) {
        throw new Error(`asset fetch failed: ${asset.url}`);
      }

      const bytes = await response.arrayBuffer();

      onPhase?.("VERIFYING");

      await verifyAssetBytes(asset, bytes);
      await store.put(
        asset.cacheKey,
        new Response(bytes, {
          headers: {
            "Accept-Ranges": "bytes",
            "Content-Length": String(bytes.byteLength),
            "Content-Type":
              response.headers.get("Content-Type") ?? "application/octet-stream"
          }
        })
      );

      if (!existingResponse) {
        newPreparedKeys.add(asset.cacheKey);
      }
    }

    return {
      ok: true,
      assets
    };
  } catch (error) {
    await Promise.all([...newPreparedKeys].map((key) => store.delete(key)));

    return {
      ok: false,
      error: error instanceof Error ? error.message : "asset verification failed"
    };
  }
}

export async function activateRelease({
  assets,
  deviceToken,
  envelope
}: {
  assets: PlayerCacheAsset[];
  deviceToken: string;
  envelope: PlayerManifestEnvelope;
}) {
  const cachedRelease: CachedPlayerRelease = {
    activatedAt: new Date().toISOString(),
    assets,
    deviceToken,
    envelope
  };
  const database = await openPlayerDatabase();
  const transaction = database.transaction(
    [playerActiveReleaseStoreName, playerPreviousReleaseStoreName],
    "readwrite"
  );
  const store = transaction.objectStore(playerActiveReleaseStoreName);
  const previousStore = transaction.objectStore(playerPreviousReleaseStoreName);
  const currentRelease = await requestToPromise<CachedPlayerRelease | undefined>(
    store.get(deviceToken)
  );

  if (currentRelease) await requestToPromise(previousStore.put(currentRelease));
  await requestToPromise(store.put(cachedRelease));
  await transactionDone(transaction);
  database.close();

  return cachedRelease;
}

export async function readActiveRelease(deviceToken: string) {
  return readReleaseFromStore(playerActiveReleaseStoreName, deviceToken);
}

export async function readPreviousRelease(deviceToken: string) {
  return readReleaseFromStore(playerPreviousReleaseStoreName, deviceToken);
}

async function readReleaseFromStore(storeName: string, deviceToken: string) {
  const database = await openPlayerDatabase();
  const transaction = database.transaction(storeName, "readonly");
  const store = transaction.objectStore(storeName);
  const cachedRelease = await requestToPromise<CachedPlayerRelease | undefined>(
    store.get(deviceToken)
  );

  database.close();

  return cachedRelease;
}

export async function hydrateCachedRelease(
  cachedRelease: CachedPlayerRelease,
  store = createPlayerMediaStore(playerAssetCacheName)
): Promise<HydratedPlayerRelease> {
  return hydratePreparedRelease(cachedRelease, store);
}

export async function hydratePreparedRelease(
  preparedRelease: Pick<CachedPlayerRelease, "assets" | "envelope">,
  store = createPlayerMediaStore(playerAssetCacheName)
): Promise<HydratedPlayerRelease> {
  const objectUrls: Record<string, string> = {};
  const playbackUrls: Record<string, string> = {};

  for (const asset of preparedRelease.assets) {
    const resolved = await store.resolvePlaybackUrl(asset.cacheKey);
    playbackUrls[asset.cacheKey] = resolved.url;
    if (resolved.objectUrl) objectUrls[asset.cacheKey] = resolved.objectUrl;
  }

  return {
    assets: preparedRelease.assets,
    envelope: withCachedUrls(preparedRelease.envelope, playbackUrls),
    objectUrls
  };
}

export function revokeHydratedRelease(hydratedRelease: HydratedPlayerRelease) {
  for (const objectUrl of Object.values(hydratedRelease.objectUrls)) {
    URL.revokeObjectURL(objectUrl);
  }
}

export async function verifyAssetBytes(
  asset: Pick<PlayerCacheAsset, "bytes" | "checksumSha256" | "url">,
  bytes: ArrayBuffer
) {
  if (asset.bytes !== bytes.byteLength) {
    throw new Error(`asset size mismatch: ${asset.url}`);
  }

  const checksum = await sha256Hex(bytes);

  if (checksum !== asset.checksumSha256) {
    throw new Error(`asset checksum mismatch: ${asset.url}`);
  }
}

export async function sha256Hex(bytes: ArrayBuffer) {
  if (!globalThis.crypto?.subtle) {
    throw new Error("Web Crypto API is unavailable");
  }
  const digest = await crypto.subtle.digest("SHA-256", bytes);

  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function withCachedUrls(
  envelope: PlayerManifestEnvelope,
  objectUrls: Record<string, string>
): PlayerManifestEnvelope {
  const manifest = envelope.manifest;

  return {
    ...envelope,
    manifest: {
      ...manifest,
      items: manifest.items.map((item) => {
        const mediaAsset = item.source.url
          ? toCacheAsset(item, "media", item.source.url)
          : null;
        const posterAsset = item.source.posterUrl
          ? toCacheAsset(
              item,
              "poster",
              item.source.posterUrl,
              item.source.posterBytes,
              item.source.posterChecksumSha256
            )
          : null;
        const cachedMediaUrl = mediaAsset
          ? objectUrls[mediaAsset.cacheKey]
          : undefined;
        const cachedPosterUrl = posterAsset
          ? objectUrls[posterAsset.cacheKey]
          : undefined;

        return {
          ...item,
          source: {
            ...item.source,
            url: cachedMediaUrl ?? item.source.url,
            posterUrl: cachedPosterUrl ?? item.source.posterUrl
          }
        };
      })
    }
  };
}

function toCacheAsset(
  item: PlayerManifestItem,
  kind: PlayerCacheAsset["kind"],
  url: string,
  bytes = item.source.bytes,
  checksumSha256 = item.source.checksumSha256
): PlayerCacheAsset {
  return {
    bytes,
    cacheKey: `/__castivo-player-cache/${checksumSha256}`,
    checksumSha256,
    itemId: item.id,
    kind,
    url
  };
}

async function hasEnoughStorage(totalBytes: number) {
  if (!navigator.storage?.estimate) {
    return { ok: true as const };
  }

  const estimate = await navigator.storage.estimate();
  const quota = estimate.quota ?? 0;
  const usage = estimate.usage ?? 0;
  const availableBytes = quota - usage;

  if (quota > 0 && availableBytes < totalBytes) {
    return {
      ok: false as const,
      error: "not enough storage for pending release"
    };
  }

  return { ok: true as const };
}

function openPlayerDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB API is unavailable"));
      return;
    }
    const request = indexedDB.open(playerDatabaseName, 2);

    request.onupgradeneeded = () => {
      const database = request.result;

      if (!database.objectStoreNames.contains(playerActiveReleaseStoreName)) {
        database.createObjectStore(playerActiveReleaseStoreName, {
          keyPath: "deviceToken"
        });
      }
      if (!database.objectStoreNames.contains(playerPreviousReleaseStoreName)) {
        database.createObjectStore(playerPreviousReleaseStoreName, {
          keyPath: "deviceToken"
        });
      }
    };
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

function requestToPromise<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

function transactionDone(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
    transaction.oncomplete = () => resolve();
  });
}
