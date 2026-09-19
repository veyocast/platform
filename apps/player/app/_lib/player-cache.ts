import type { PlayerDynamicTemplateAsset } from "@veyocast/contracts";
import type { PlayerSponsorCreative, PlayerSponsorPlan } from "@veyocast/contracts";

import type {
  PlayerManifestEnvelope,
  PlayerManifestItem,
  PlayerReleaseManifest
} from "./player-manifest";
import { resolveMonotonicPlayerEntitlement } from "./player-entitlement";
import { createPlayerMediaStore, type PlayerMediaStore } from "./player-media-store";

export const playerAssetCacheName = "veyocast-player-assets-v1";
export const playerDatabaseName = "veyocast-player-cache-v1";
export const playerActiveReleaseStoreName = "activeReleases";
export const playerPreviousReleaseStoreName = "previousReleases";
export const playerStorageReserveBytes = 16 * 1024 * 1024;
export const playerMediaAccessRefreshMs = 45 * 60 * 1_000;
const playerMaximumStorageReserveBytes = 64 * 1024 * 1024;
const playerCachePathPrefix = "/__veyocast-player-cache/";
const previousBrandNamespace = String.fromCharCode(99, 97, 115, 116, 105, 118, 111);
const previousPlayerAssetCacheName = `${previousBrandNamespace}-player-assets-v1`;
const previousPlayerDatabaseName = `${previousBrandNamespace}-player-cache-v1`;
const previousPlayerCachePathPrefix = `/__${previousBrandNamespace}-player-cache/`;
let playerStorageMigration: Promise<void> | undefined;
let preparingMediaCount = 0;
let mediaCollection: Promise<unknown> = Promise.resolve();

export type PlayerCachePhase = "DOWNLOADING" | "VERIFYING";

export type PlayerCacheAsset = {
  bytes: number;
  cacheKey: string;
  checksumSha256: string;
  itemId: string;
  kind: "dynamic" | "media" | "poster" | "sponsor";
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
  const contentAssets = manifest.items.flatMap((item) => {
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

    for (const asset of Object.values(item.dynamicTemplate?.assets ?? {})) {
      assets.push(toDynamicCacheAsset(item, asset));
      if (
        asset.posterUrl && asset.posterBytes && asset.posterChecksumSha256
      ) {
        assets.push({
          bytes: asset.posterBytes,
          cacheKey: `/__veyocast-player-cache/${asset.posterChecksumSha256}`,
          checksumSha256: asset.posterChecksumSha256,
          itemId: item.id,
          kind: "dynamic",
          url: asset.posterUrl
        });
      }
    }

    return assets;
  });
  const seen = new Set(contentAssets.map((asset) => asset.cacheKey));
  const sponsorAssets = manifest.sponsorPlan?.placements.flatMap((placement) =>
    placement.creatives.flatMap((creative) => {
      const asset = toSponsorCacheAsset(creative);
      if (seen.has(asset.cacheKey)) return [];
      seen.add(asset.cacheKey);
      return [asset];
    })
  ) ?? [];
  return [...contentAssets, ...sponsorAssets];
}

export async function preparePendingRelease({
  envelope,
  onPhase,
  signal,
  store = createPlayerMediaStore(playerAssetCacheName)
}: {
  envelope: PlayerManifestEnvelope;
  onPhase?: (phase: PlayerCachePhase) => void;
  signal?: AbortSignal;
  store?: PlayerMediaStore;
}): Promise<PlayerCacheResult> {
  if (envelope.manifest.schemaVersion !== 1) return { ok: false, error: "PLAYER_UPDATE_REQUIRED" };
  preparingMediaCount += 1;
  try {
    await mediaCollection;
    const assets = getCacheableAssets(envelope.manifest);
    const cachedAssets = await inspectCachedAssets(assets, store, signal);
    const storageCheck = await hasEnoughStorage(cachedAssets.missingBytes);

    if (!storageCheck.ok) {
      return {
        ok: false,
        error: storageCheck.error
      };
    }

    try {
      if (signal?.aborted) throw new Error("TARGET_SUPERSEDED");
      onPhase?.("DOWNLOADING");

      for (const asset of assets) {
        if (signal?.aborted) throw new Error("TARGET_SUPERSEDED");
        if (cachedAssets.validKeys.has(asset.cacheKey)) continue;

        const response = await fetch(asset.url, { cache: "no-store", signal });

        if (!response.ok) {
          throw new Error(`ASSET_FETCH_FAILED_${response.status}:${asset.itemId}`);
        }

        const bytes = await response.arrayBuffer();
        if (signal?.aborted) throw new Error("TARGET_SUPERSEDED");

        onPhase?.("VERIFYING");

        await verifyAssetBytes(asset, bytes);
        if (signal?.aborted) throw new Error("TARGET_SUPERSEDED");
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

        cachedAssets.validKeys.add(asset.cacheKey);
      }

      return {
        ok: true,
        assets
      };
    } catch (error) {
      // Verified content-addressed bytes may already be used by a newer target.
      // Reference-aware collection, never cancellation, owns their deletion.

      return {
        ok: false,
        error: error instanceof Error ? error.message : "asset verification failed"
      };
    }
  } finally { preparingMediaCount -= 1; }
}

export async function activateRelease({
  assets,
  deviceToken,
  envelope,
  signal
}: {
  assets: PlayerCacheAsset[];
  deviceToken: string;
  envelope: PlayerManifestEnvelope;
  signal?: AbortSignal;
}) {
  const cachedRelease: CachedPlayerRelease = {
    activatedAt: new Date().toISOString(),
    assets,
    deviceToken,
    envelope
  };
  const database = await openPlayerDatabase();
  if (signal?.aborted) { database.close(); throw new Error("TARGET_SUPERSEDED"); }
  const transaction = database.transaction(
    [playerActiveReleaseStoreName, playerPreviousReleaseStoreName],
    "readwrite"
  );
  const store = transaction.objectStore(playerActiveReleaseStoreName);
  const previousStore = transaction.objectStore(playerPreviousReleaseStoreName);
  const abort = () => { try { transaction.abort(); } catch { /* completed */ } };
  signal?.addEventListener("abort", abort, { once: true });
  try {
  const currentRelease = await requestToPromise<CachedPlayerRelease | undefined>(
    store.get(deviceToken)
  );

  if (currentRelease && currentRelease.envelope.manifest.releaseId !== envelope.manifest.releaseId) {
    await requestToPromise(previousStore.put(currentRelease));
  }
  await requestToPromise(store.put(cachedRelease));
  await transactionDone(transaction);
  } finally {
  signal?.removeEventListener("abort", abort);
  database.close();
  }

  return cachedRelease;
}

export async function readActiveRelease(deviceToken: string) {
  return readReleaseFromStore(playerActiveReleaseStoreName, deviceToken);
}

export async function readPreviousRelease(deviceToken: string) {
  return readReleaseFromStore(playerPreviousReleaseStoreName, deviceToken);
}

export async function recoverDeviceTokenFromPersistedRelease() {
  await migratePreviousPlayerStorage();
  const database = await openPlayerDatabase();

  try {
    const candidates = [];

    for (const storeName of [
      playerActiveReleaseStoreName,
      playerPreviousReleaseStoreName
    ]) {
      const candidate = await readLatestDeviceTokenCandidate(
        database,
        storeName
      );
      if (candidate) candidates.push(candidate);
    }

    candidates.sort((left, right) => right.activatedAt - left.activatedAt);
    return candidates[0]?.deviceToken ?? null;
  } finally {
    database.close();
  }
}

export async function garbageCollectPersistedPlayerMedia(
  deviceToken: string,
  store = createPlayerMediaStore(playerAssetCacheName),
  inUse: Array<Pick<CachedPlayerRelease, "assets">> = []
) {
  if (preparingMediaCount) return { deletedKeys: [], retainedKeys: [] };
  const collection = async () => {
  const [activeRelease, previousRelease] = await Promise.all([
    readActiveRelease(deviceToken),
    readPreviousRelease(deviceToken)
  ]);
  return garbageCollectPlayerMedia({
    releases: [activeRelease, previousRelease, ...inUse],
    store
  });
  };
  const result = mediaCollection.then(collection, collection);
  // The caller still receives the failure; a failed cleanup must never prevent
  // the next target from preparing, or leave the preparation guard held.
  mediaCollection = result.catch(() => undefined);
  return result;
}

export async function garbageCollectPlayerMedia({
  releases,
  store
}: {
  releases: Array<Pick<CachedPlayerRelease, "assets"> | null | undefined>;
  store: PlayerMediaStore;
}) {
  const retainedKeys = new Set(
    releases.flatMap((release) => release?.assets.map((asset) => asset.cacheKey) ?? [])
  );
  const storedKeys = await store.keys();
  const obsoleteKeys = storedKeys.filter(
    (key) => key.startsWith(playerCachePathPrefix) && !retainedKeys.has(key)
  );
  await Promise.all(obsoleteKeys.map((key) => store.delete(key)));
  return { deletedKeys: obsoleteKeys, retainedKeys: [...retainedKeys] };
}

async function readReleaseFromStore(storeName: string, deviceToken: string) {
  await migratePreviousPlayerStorage();
  const database = await openPlayerDatabase();
  const transaction = database.transaction(storeName, "readonly");
  const store = transaction.objectStore(storeName);
  const cachedRelease = await requestToPromise<CachedPlayerRelease | undefined>(
    store.get(deviceToken)
  );

  database.close();

  return cachedRelease;
}

async function readLatestDeviceTokenCandidate(
  database: IDBDatabase,
  storeName: string
) {
  if (!database.objectStoreNames.contains(storeName)) return null;

  const transaction = database.transaction(storeName, "readonly");
  const completed = transactionDone(transaction);
  const store = transaction.objectStore(storeName);
  const candidate = await new Promise<{
    activatedAt: number;
    deviceToken: string;
  } | null>((resolve, reject) => {
    let latest: { activatedAt: number; deviceToken: string } | null = null;
    const request = store.openCursor();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) {
        resolve(latest);
        return;
      }

      const value = persistedDeviceTokenCandidate(cursor.value);
      if (value && (!latest || value.activatedAt > latest.activatedAt)) {
        latest = value;
      }
      cursor.continue();
    };
  });
  await completed;
  return candidate;
}

function persistedDeviceTokenCandidate(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const release = value as Partial<CachedPlayerRelease>;
  const deviceToken = release.deviceToken;
  const envelope = release.envelope;
  if (
    typeof deviceToken !== "string" ||
    !/^[A-Za-z0-9_-]{20,200}$/.test(deviceToken) ||
    !envelope ||
    typeof envelope !== "object" ||
    !("device" in envelope) ||
    !("manifest" in envelope)
  ) {
    return null;
  }

  const activatedAt = Date.parse(release.activatedAt ?? "");
  return {
    activatedAt: Number.isFinite(activatedAt) ? activatedAt : 0,
    deviceToken
  };
}

export function migratePreviousReleaseCacheKeys(
  release: CachedPlayerRelease
): CachedPlayerRelease {
  return {
    ...release,
    assets: release.assets.map((asset) => ({
      ...asset,
      cacheKey: asset.cacheKey.startsWith(previousPlayerCachePathPrefix)
        ? `${playerCachePathPrefix}${asset.cacheKey.slice(previousPlayerCachePathPrefix.length)}`
        : asset.cacheKey
    }))
  };
}

async function migratePreviousPlayerStorage() {
  playerStorageMigration ??= performPlayerStorageMigration().catch((error) => {
    playerStorageMigration = undefined;
    throw error;
  });
  return playerStorageMigration;
}

async function performPlayerStorageMigration() {
  const previousDatabase = await openPreviousPlayerDatabase();
  if (!previousDatabase) return;

  try {
    const previousReleases = await readAllStoredReleases(previousDatabase);

    const previousMediaStore = createPlayerMediaStore(previousPlayerAssetCacheName);
    const currentMediaStore = createPlayerMediaStore(playerAssetCacheName);
    const migratedReleases: Array<{
      release: CachedPlayerRelease;
      storeName: string;
    }> = [];

    for (const entry of previousReleases) {
      const release = migratePreviousReleaseCacheKeys(entry.release);
      for (let index = 0; index < entry.release.assets.length; index += 1) {
        const previousAsset = entry.release.assets[index];
        const migratedAsset = release.assets[index];
        if (!previousAsset || !migratedAsset || previousAsset.cacheKey === migratedAsset.cacheKey) {
          continue;
        }
        const existingResponse = await currentMediaStore.get(migratedAsset.cacheKey);
        if (existingResponse) continue;
        const previousResponse = await previousMediaStore.get(previousAsset.cacheKey);
        if (!previousResponse) {
          throw new Error("previous player release contains a missing cached asset");
        }
        await currentMediaStore.put(migratedAsset.cacheKey, previousResponse);
      }
      migratedReleases.push({ release, storeName: entry.storeName });
    }

    await persistMigratedReleases(migratedReleases);
  } finally {
    previousDatabase.close();
  }

  await deleteDatabase(previousPlayerDatabaseName);
  if (typeof caches !== "undefined") {
    await caches.delete(previousPlayerAssetCacheName);
  }
}

async function readAllStoredReleases(database: IDBDatabase) {
  const entries: Array<{ release: CachedPlayerRelease; storeName: string }> = [];
  for (const storeName of [
    playerActiveReleaseStoreName,
    playerPreviousReleaseStoreName
  ]) {
    if (!database.objectStoreNames.contains(storeName)) continue;
    const transaction = database.transaction(storeName, "readonly");
    const releases = await requestToPromise<CachedPlayerRelease[]>(
      transaction.objectStore(storeName).getAll()
    );
    entries.push(...releases.map((release) => ({ release, storeName })));
  }
  return entries;
}

async function persistMigratedReleases(
  entries: Array<{ release: CachedPlayerRelease; storeName: string }>
) {
  const database = await openPlayerDatabase();
  try {
    const existingKeys = new Map<string, Set<IDBValidKey>>();
    for (const storeName of [
      playerActiveReleaseStoreName,
      playerPreviousReleaseStoreName
    ]) {
      const transaction = database.transaction(storeName, "readonly");
      const keys = await requestToPromise<IDBValidKey[]>(
        transaction.objectStore(storeName).getAllKeys()
      );
      existingKeys.set(storeName, new Set(keys));
    }

    const transaction = database.transaction(
      [playerActiveReleaseStoreName, playerPreviousReleaseStoreName],
      "readwrite"
    );
    for (const { release, storeName } of entries) {
      if (!existingKeys.get(storeName)?.has(release.deviceToken)) {
        transaction.objectStore(storeName).put(release);
      }
    }
    await transactionDone(transaction);
  } finally {
    database.close();
  }
}

function openPreviousPlayerDatabase(): Promise<IDBDatabase | null> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB API is unavailable"));
      return;
    }
    const request = indexedDB.open(previousPlayerDatabaseName);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const database = request.result;
      const hasReleaseStore = [
        playerActiveReleaseStoreName,
        playerPreviousReleaseStoreName
      ].some((storeName) => database.objectStoreNames.contains(storeName));
      if (hasReleaseStore) {
        resolve(database);
        return;
      }
      database.close();
      void deleteDatabase(previousPlayerDatabaseName).finally(() => resolve(null));
    };
  });
}

function deleteDatabase(databaseName: string) {
  return new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(databaseName);
    request.onerror = () => reject(request.error);
    request.onblocked = () => resolve();
    request.onsuccess = () => resolve();
  });
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
  const cachedAssets = await inspectCachedAssets(preparedRelease.assets, store);

  if (
    preparedRelease.assets.some(
      (asset) => !cachedAssets.validKeys.has(asset.cacheKey)
    )
  ) {
    throw new Error("cached release contains missing or corrupt assets");
  }

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
  playbackUrls: Record<string, string>
): PlayerManifestEnvelope {
  const manifest = envelope.manifest;

  return {
    ...envelope,
    manifest: {
      ...manifest,
      ...(manifest.sponsorPlan
        ? { sponsorPlan: hydrateSponsorPlan(manifest.sponsorPlan, playbackUrls) }
        : {}),
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
          ? playbackUrls[mediaAsset.cacheKey]
          : undefined;
        const cachedPosterUrl = posterAsset
          ? playbackUrls[posterAsset.cacheKey]
          : undefined;
        const mediaSource = resolveHydratedMediaSource({
          cachedUrl: cachedMediaUrl,
          item
        });
        const dynamicTemplate = hydrateDynamicTemplateAssets(
          item.dynamicTemplate,
          playbackUrls
        );

        return {
          ...item,
          ...(dynamicTemplate ? { dynamicTemplate } : {}),
          source: {
            ...item.source,
            ...mediaSource,
            posterUrl: cachedPosterUrl ?? item.source.posterUrl
          }
        };
      })
    }
  };
}

export function resolveHydratedMediaSource({
  cachedUrl,
  item,
  online = typeof navigator === "undefined" || navigator.onLine !== false
}: {
  cachedUrl?: string;
  item: PlayerManifestItem;
  online?: boolean;
}): Pick<PlayerManifestItem["source"], "fallbackUrl" | "url"> {
  if (!cachedUrl) return { url: item.source.url };

  const nativeStreamFirst =
    item.kind === "video" &&
    online &&
    cachedUrl.startsWith("blob:") &&
    Boolean(item.source.url);

  if (nativeStreamFirst) {
    return {
      fallbackUrl: cachedUrl,
      url: item.source.url
    };
  }

  return { url: cachedUrl };
}

export function refreshHydratedReleaseEnvelope({
  cachedEnvelope,
  freshEnvelope,
  online = true
}: {
  cachedEnvelope: PlayerManifestEnvelope;
  freshEnvelope: PlayerManifestEnvelope;
  online?: boolean;
}): PlayerManifestEnvelope {
  const cachedItems = new Map(
    cachedEnvelope.manifest.items.map((item) => [item.id, item])
  );
  const entitlement = resolveMonotonicPlayerEntitlement(
    cachedEnvelope.entitlement,
    freshEnvelope.entitlement
  );
  const usesCachedEntitlement = entitlement === cachedEnvelope.entitlement;

  return {
    ...freshEnvelope,
    ...(entitlement
      ? {
          entitlement,
          entitlementVerified: usesCachedEntitlement
            ? cachedEnvelope.entitlementVerified
            : freshEnvelope.entitlementVerified
        }
      : {}),
    manifest: {
      ...freshEnvelope.manifest,
      ...(freshEnvelope.manifest.sponsorPlan
        ? {
            sponsorPlan: refreshSponsorPlanAccess(
              cachedEnvelope.manifest.sponsorPlan,
              freshEnvelope.manifest.sponsorPlan
            )
          }
        : {}),
      items: freshEnvelope.manifest.items.map((item) => {
        const cachedItem = cachedItems.get(item.id);
        if (
          !cachedItem ||
          cachedItem.source.checksumSha256 !==
            item.source.checksumSha256
        ) {
          return item;
        }

        const cachedMediaUrl =
          cachedPlaybackUrl(cachedItem.source.fallbackUrl) ??
          cachedPlaybackUrl(cachedItem.source.url);
        const cachedPosterUrl = cachedPlaybackUrl(
          cachedItem.source.posterUrl
        );

        return {
          ...item,
          ...(item.dynamicTemplate
            ? {
                dynamicTemplate: refreshDynamicTemplateAssetAccess(
                  cachedItem.dynamicTemplate,
                  item.dynamicTemplate
                )
              }
            : {}),
          source: {
            ...item.source,
            ...resolveHydratedMediaSource({
              cachedUrl: cachedMediaUrl,
              item,
              online
            }),
            posterUrl: cachedPosterUrl ?? item.source.posterUrl
          }
        };
      })
    }
  };
}

export function shouldRestartForRefreshedMediaAccess({
  cachedFetchedAt,
  freshFetchedAt
}: {
  cachedFetchedAt: string;
  freshFetchedAt: string;
}) {
  const cachedAt = Date.parse(cachedFetchedAt);
  const freshAt = Date.parse(freshFetchedAt);
  if (!Number.isFinite(cachedAt) || !Number.isFinite(freshAt)) return true;
  return freshAt - cachedAt >= playerMediaAccessRefreshMs;
}

function cachedPlaybackUrl(url: string | undefined) {
  return url?.startsWith("blob:") ||
    url?.startsWith("/__veyocast-player-cache/")
    ? url
    : undefined;
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
    cacheKey: `/__veyocast-player-cache/${checksumSha256}`,
    checksumSha256,
    itemId: item.id,
    kind,
    url
  };
}

function toSponsorCacheAsset(creative: PlayerSponsorCreative): PlayerCacheAsset {
  return {
    bytes: creative.bytes,
    cacheKey: `/__veyocast-player-cache/${creative.checksumSha256}`,
    checksumSha256: creative.checksumSha256,
    itemId: creative.creativeId,
    kind: "sponsor",
    url: creative.url
  };
}

function hydrateSponsorPlan(
  plan: PlayerSponsorPlan,
  playbackUrls: Record<string, string>
): PlayerSponsorPlan {
  return {
    ...plan,
    placements: plan.placements.map((placement) => ({
      ...placement,
      creatives: placement.creatives.map((creative) => ({
        ...creative,
        url: playbackUrls[toSponsorCacheAsset(creative).cacheKey] ?? creative.url
      }))
    }))
  };
}

function refreshSponsorPlanAccess(
  cached: PlayerSponsorPlan | undefined,
  fresh: PlayerSponsorPlan
) {
  const cachedCreatives = new Map(
    cached?.placements.flatMap((placement) =>
      placement.creatives.map((creative) => [creative.checksumSha256, creative] as const)
    ) ?? []
  );
  return {
    ...fresh,
    placements: fresh.placements.map((placement) => ({
      ...placement,
      creatives: placement.creatives.map((creative) => {
        const cachedCreative = cachedCreatives.get(creative.checksumSha256);
        return cachedPlaybackUrl(cachedCreative?.url)
          ? { ...creative, url: cachedCreative!.url }
          : creative;
      })
    }))
  };
}

function toDynamicCacheAsset(
  item: PlayerManifestItem,
  asset: PlayerDynamicTemplateAsset
): PlayerCacheAsset {
  return {
    bytes: asset.bytes,
    cacheKey: `/__veyocast-player-cache/${asset.checksumSha256}`,
    checksumSha256: asset.checksumSha256,
    itemId: item.id,
    kind: "dynamic",
    url: asset.url
  };
}

function hydrateDynamicTemplateAssets(
  template: PlayerManifestItem["dynamicTemplate"],
  playbackUrls: Record<string, string>
) {
  if (!template?.assets) return template;
  return {
    ...template,
    assets: Object.fromEntries(
      Object.entries(template.assets).map(([assetId, asset]) => [
        assetId,
        {
          ...asset,
          posterUrl: asset.posterChecksumSha256
            ? playbackUrls[
                `/__veyocast-player-cache/${asset.posterChecksumSha256}`
              ] ?? asset.posterUrl
            : asset.posterUrl,
          url:
            playbackUrls[
              `/__veyocast-player-cache/${asset.checksumSha256}`
            ] ?? asset.url
        }
      ])
    )
  };
}

function refreshDynamicTemplateAssetAccess(
  cachedTemplate: PlayerManifestItem["dynamicTemplate"],
  freshTemplate: NonNullable<PlayerManifestItem["dynamicTemplate"]>
) {
  if (!freshTemplate.assets) return freshTemplate;
  return {
    ...freshTemplate,
    assets: Object.fromEntries(
      Object.entries(freshTemplate.assets).map(([assetId, asset]) => {
        const cachedAsset = cachedTemplate?.assets?.[assetId];
        const cachedUrl =
          cachedAsset?.checksumSha256 === asset.checksumSha256
            ? cachedPlaybackUrl(cachedAsset.url)
            : undefined;
        return [
          assetId,
          {
            ...asset,
            posterUrl:
              cachedAsset && cachedAsset.posterChecksumSha256 === asset.posterChecksumSha256
                ? cachedPlaybackUrl(cachedAsset.posterUrl) ?? asset.posterUrl
                : asset.posterUrl,
            url: cachedUrl ?? asset.url
          }
        ];
      })
    )
  };
}

async function inspectCachedAssets(
  assets: PlayerCacheAsset[],
  store: PlayerMediaStore,
  signal?: AbortSignal
) {
  const validKeys = new Set<string>();
  const inspectedKeys = new Set<string>();
  let missingBytes = 0;

  for (const asset of assets) {
    if (signal?.aborted) throw new Error("TARGET_SUPERSEDED");
    if (inspectedKeys.has(asset.cacheKey)) continue;
    inspectedKeys.add(asset.cacheKey);
    const response = await store.get(asset.cacheKey);
    if (!response) {
      missingBytes += asset.bytes;
      continue;
    }

    try {
      const bytes = await response.clone().arrayBuffer();
      if (signal?.aborted) throw new Error("TARGET_SUPERSEDED");
      await verifyAssetBytes(asset, bytes);
      if (signal?.aborted) throw new Error("TARGET_SUPERSEDED");
      validKeys.add(asset.cacheKey);

      if (
        response.headers.get("Accept-Ranges") !== "bytes" ||
        response.headers.get("Content-Length") !== String(bytes.byteLength)
      ) {
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
      }
    } catch {
      missingBytes += asset.bytes;
    }
  }

  return { missingBytes, validKeys };
}

export async function hasEnoughStorage(missingBytes: number) {
  if (missingBytes <= 0) return { ok: true as const };
  if (!navigator.storage?.estimate) {
    return { ok: true as const };
  }

  const estimate = await navigator.storage.estimate();
  const quota = estimate.quota ?? 0;
  const usage = estimate.usage ?? 0;
  const availableBytes = quota - usage;
  const reserveBytes = Math.min(
    playerMaximumStorageReserveBytes,
    Math.max(playerStorageReserveBytes, Math.ceil(missingBytes * 0.1))
  );
  const requiredBytes = missingBytes + reserveBytes;

  if (quota > 0 && availableBytes < requiredBytes) {
    return {
      ok: false as const,
      error: `not enough storage for pending release: ${missingBytes} bytes missing plus ${reserveBytes} bytes reserve`
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
