import {assertSyncPlayerAssetManifest,assertSyncDynamicConfigurationContinuity} from "./sync-player-assets";
import { assertMediaFrameManifest, assertMediaFrameContinuity } from "./player-media-frame";
import sitesSystemAssets from "../../../../packages/content-templates/src/sites-system-assets.json";
import {publishedScreenCompositionSchema} from "@veyocast/contracts";
import type { PlayerDynamicTemplateAsset } from "@veyocast/contracts";
import type { PlayerSponsorCreative, PlayerSponsorPlan } from "@veyocast/contracts";

import type {
  PlayerManifestEnvelope,
  PlayerManifestItem,
  PlayerReleaseManifest
} from "./player-manifest";
import { resolveMonotonicPlayerEntitlement } from "./player-entitlement";
import { createPlayerMediaStore, type PlayerMediaStore } from "./player-media-store";
import { playerMediaTraffic } from "./media-traffic";
import { downloadMedia } from "./media-download";

export const playerAssetCacheName = "veyocast-player-assets-v1";
export const playerDatabaseName = "veyocast-player-cache-v1";
export const playerActiveReleaseStoreName = "activeReleases";
export const playerPreviousReleaseStoreName = "previousReleases";
export const playerStorageReserveBytes = 16 * 1024 * 1024;
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
  kind: "dynamic" | "media" | "poster" | "sponsor" | "system";
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
  assertSyncPlayerAssetManifest(manifest);
  assertMediaFrameManifest(manifest);
  if(manifest.systemAssets){const expected=new Map(sitesSystemAssets.files.map(asset=>[asset.path,asset]));if(manifest.systemAssets.length!==expected.size||new Set(manifest.systemAssets.map(asset=>asset.path)).size!==expected.size||manifest.systemAssets.some(asset=>{const trusted=expected.get(asset.path);return !trusted||trusted.sha256!==asset.checksumSha256||trusted.bytes!==asset.bytes||trusted.mimeType!==asset.mimeType;}))throw new Error("SITES_ASSET_MANIFEST_INVALID");}
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

    for (const asset of Object.values({...item.dynamicTemplate?.assets,...item.sitesStudioAssets,...item.syncStudioAssets,...item.syncDynamic?.assets,...item.mediaFrameBackgroundAssets})) {
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
  const systemAssets=(manifest.systemAssets??[]).flatMap(asset=>{const cacheKey=`/__veyocast-player-cache/${asset.checksumSha256}`;if(seen.has(cacheKey))return [];seen.add(cacheKey);return [{...asset,cacheKey,itemId:"sites-v11",kind:"system" as const,url:asset.path}];});
  const syncAssets=(manifest.syncSystemAssets??[]).flatMap(asset=>{const cacheKey=`/__veyocast-player-cache/${asset.checksumSha256}`;if(seen.has(cacheKey))return [];seen.add(cacheKey);return [{...asset,cacheKey,itemId:"sync-v1",kind:"system" as const,url:asset.path}];});
  return [...contentAssets, ...sponsorAssets,...systemAssets,...syncAssets];
}


export function getEnvelopeCacheableAssets(envelope:PlayerManifestEnvelope):PlayerCacheAsset[]{
 if(envelope.composition){const parsed=publishedScreenCompositionSchema.safeParse(envelope.composition.published);if(!parsed.success)throw new Error("COMPOSITION_ASSETS_UNAVAILABLE");const bindings=parsed.data.bindings.filter(binding=>binding.zoneId!=="main");if(Object.keys(envelope.composition.zones).length!==bindings.length||bindings.some(binding=>{const zone=envelope.composition!.zones[binding.zoneId as "side"|"bottom"];return !zone||zone.composition||zone.manifest.tenantId!==envelope.manifest.tenantId||zone.device.id!==envelope.device.id||zone.device.screenId!==envelope.device.screenId||zone.manifest.releaseId!==binding.releaseId||zone.manifest.playlistId!==binding.playlistId;}))throw new Error("COMPOSITION_ASSETS_UNAVAILABLE");}
 const assets=[...getCacheableAssets(envelope.manifest),...Object.values(envelope.composition?.zones??{}).flatMap(zone=>getCacheableAssets(zone.manifest))];
 return [...new Map(assets.map(asset=>[asset.cacheKey,asset])).values()];
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
  let assets:PlayerCacheAsset[];try{assets=getEnvelopeCacheableAssets(envelope);}catch{return {ok:false,error:"RELEASE_ASSET_MANIFEST_INVALID"};}
  preparingMediaCount += 1;
  try {
    await mediaCollection;

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
        if (cachedAssets.validKeys.has(asset.cacheKey)) { playerMediaTraffic.add("cacheHits", 1); continue; }
        playerMediaTraffic.add("cacheMisses", 1);
        if (!playerMediaTraffic.allow(asset.cacheKey)) throw new Error("MEDIA_RETRY_BUDGET_EXCEEDED");

        try {
          const { bytes, mimeType } = await downloadMedia(asset.url, asset.checksumSha256, asset.bytes, signal);
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
                "Content-Type": mimeType
              }
            })
          );

          cachedAssets.validKeys.add(asset.cacheKey);
          playerMediaTraffic.success(asset.cacheKey);
        } catch (error) {
          if (!signal?.aborted) playerMediaTraffic.failure(asset.cacheKey);
          throw error;
        }
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
  const required=getEnvelopeCacheableAssets(preparedRelease.envelope);
  const provided=new Map(preparedRelease.assets.map(asset=>[asset.cacheKey,asset]));
  if(required.some(asset=>{const stored=provided.get(asset.cacheKey);return !stored||stored.bytes!==asset.bytes||stored.checksumSha256!==asset.checksumSha256;}))throw new Error("cached release contains an incomplete composition");
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
    playerMediaTraffic.add("corrupt", 1);
    throw new Error("asset size mismatch");
  }

  const checksum = await sha256Hex(bytes);

  if (checksum !== asset.checksumSha256) {
    playerMediaTraffic.add("corrupt", 1);
    throw new Error("asset checksum mismatch");
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
    ...(envelope.composition?{composition:{...envelope.composition,zones:Object.fromEntries(Object.entries(envelope.composition.zones).map(([id,zone])=>[id,withCachedUrls(zone,playbackUrls)]))}}:{}),
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
          ...(manifest.systemAssets?.length?{sitesSystemAssetUrls:Object.fromEntries(manifest.systemAssets.map(asset=>[asset.path,playbackUrls[`/__veyocast-player-cache/${asset.checksumSha256}`]??asset.path]))}:{}),
          ...(manifest.syncSystemAssets?.length?{syncSystemAssetUrls:Object.fromEntries(manifest.syncSystemAssets.map(asset=>[asset.path,playbackUrls[`/__veyocast-player-cache/${asset.checksumSha256}`]??asset.path]))}:{}),
          ...(item.syncStudioAssets?{syncStudioAssets:Object.fromEntries(Object.entries(item.syncStudioAssets).map(([id,asset])=>[id,{...asset,url:playbackUrls[`/__veyocast-player-cache/${asset.checksumSha256}`]??asset.url}]))}:{}),
          ...(item.mediaFrameBackgroundAssets?{mediaFrameBackgroundAssets:Object.fromEntries(Object.entries(item.mediaFrameBackgroundAssets).map(([id,asset])=>[id,{...asset,url:playbackUrls[`/__veyocast-player-cache/${asset.checksumSha256}`]??asset.url}]))}:{}),
          ...(item.syncDynamic?{syncDynamic:{...item.syncDynamic,assets:Object.fromEntries(Object.entries(item.syncDynamic.assets).map(([id,asset])=>[id,{...asset,url:playbackUrls[`/__veyocast-player-cache/${asset.checksumSha256}`]??asset.url}]))}}:{}),
          ...(dynamicTemplate ? { dynamicTemplate } : {}),
          ...(item.sitesStudioAssets?{sitesStudioAssets:Object.fromEntries(Object.entries(item.sitesStudioAssets).map(([id,asset])=>[id,{...asset,url:playbackUrls[`/__veyocast-player-cache/${asset.checksumSha256}`]??asset.url}]))}:{}),
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
  item
}: {
  cachedUrl?: string;
  item: PlayerManifestItem;
  online?: boolean;
}): Pick<PlayerManifestItem["source"], "fallbackUrl" | "url"> {
  if (!cachedUrl) return { url: item.source.url };

  // Transport credentials must never displace verified local content.
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
  assertSyncPlayerAssetManifest(freshEnvelope.manifest);
  assertSyncDynamicConfigurationContinuity(cachedEnvelope.manifest,freshEnvelope.manifest);
  assertMediaFrameManifest(freshEnvelope.manifest);
  assertMediaFrameContinuity(cachedEnvelope.manifest,freshEnvelope.manifest);
  const cachedItems = new Map(
    cachedEnvelope.manifest.items.map((item) => [item.id, item])
  );
  const entitlement = resolveMonotonicPlayerEntitlement(
    cachedEnvelope.entitlement,
    freshEnvelope.entitlement
  );
  const usesCachedEntitlement = entitlement === cachedEnvelope.entitlement;

  const refreshed: PlayerManifestEnvelope = {
    ...freshEnvelope,
    ...(entitlement
      ? {
          entitlement,
          entitlementVerified: usesCachedEntitlement
            ? cachedEnvelope.entitlementVerified
            : freshEnvelope.entitlementVerified
        }
      : {}),
    ...(freshEnvelope.composition?{composition:{...freshEnvelope.composition,zones:Object.fromEntries(Object.entries(freshEnvelope.composition.zones).map(([id,zone])=>[id,refreshHydratedReleaseEnvelope({cachedEnvelope:cachedEnvelope.composition?.zones[id as "side"|"bottom"]??zone,freshEnvelope:zone,online})]))}}:{}),
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
          ...(item.sitesStudioAssets?{sitesStudioAssets:Object.fromEntries(Object.entries(item.sitesStudioAssets).map(([id,asset])=>{const cached=cachedItem.sitesStudioAssets?.[id];return [id,{...asset,url:cached?.checksumSha256===asset.checksumSha256?cached.url:asset.url}];}))}:{}),
          ...(item.syncStudioAssets?{syncStudioAssets:Object.fromEntries(Object.entries(item.syncStudioAssets).map(([id,asset])=>{const cached=cachedItem.syncStudioAssets?.[id];return [id,{...asset,url:cached?.checksumSha256===asset.checksumSha256?cached.url:asset.url}];}))}:{}),
          ...(item.mediaFrameBackgroundAssets?{mediaFrameBackgroundAssets:Object.fromEntries(Object.entries(item.mediaFrameBackgroundAssets).map(([id,asset])=>{const cached=cachedItem.mediaFrameBackgroundAssets?.[id];return [id,{...asset,url:cached?.checksumSha256===asset.checksumSha256?cached.url:asset.url}];}))}:{}),
          ...(item.syncDynamic?{syncDynamic:{...item.syncDynamic,assets:Object.fromEntries(Object.entries(item.syncDynamic.assets).map(([id,asset])=>{const cached=cachedItem.syncDynamic?.assets[id];return [id,{...asset,url:cached?.checksumSha256===asset.checksumSha256?cached.url:asset.url}];}))}}:{}),
          ...(cachedItem.syncSystemAssetUrls?{syncSystemAssetUrls:cachedItem.syncSystemAssetUrls}:{}),
          ...(cachedItem.sitesSystemAssetUrls?{sitesSystemAssetUrls:cachedItem.sitesSystemAssetUrls}:{}),
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
  // A cached release verified by an older client keeps its complete binary
  // profile. A signed-URL refresh cannot activate a newly introduced Source
  // enhancement without preparing/verifying that enhancement as a new target.
  if(cachedEnvelope.manifest.releaseId===freshEnvelope.manifest.releaseId){
    refreshed.manifest.items=refreshed.manifest.items.map(item=>{
      const cached=cachedItems.get(item.id);
      if(cached&&cached.source.checksumSha256===item.source.checksumSha256&&item.mediaFrameBackground&&!cached.mediaFrameBackground){const binary={...item};delete binary.mediaFrameBackground;delete binary.mediaFrameBackgroundAssets;return binary;}
      if(cached&&cached.source.checksumSha256===item.source.checksumSha256&&item.syncDynamic&&!cached.syncDynamic){const binary={...item};delete binary.syncDynamic;if(cached.syncDynamicBinary)binary.syncDynamicBinary=cached.syncDynamicBinary;if(!binary.syncStudioPresentation)delete binary.syncSystemAssetUrls;return binary;}
      if(!cached||cached.source.checksumSha256!==item.source.checksumSha256||!item.syncStudioPresentation)return item;
      if(!cached.syncStudioPresentation){const binary={...item};delete binary.syncStudioPresentation;delete binary.syncStudioDurationMs;delete binary.syncStudioAssets;delete binary.syncSystemAssetUrls;return binary;}
      if(JSON.stringify(cached.syncStudioPresentation)!==JSON.stringify(item.syncStudioPresentation)||cached.syncStudioDurationMs!==item.syncStudioDurationMs)throw Error("SYNC_IMMUTABLE_PRESENTATION_CHANGED");
      return item;
    });
    if(!refreshed.manifest.items.some(item=>item.syncStudioPresentation||item.syncDynamic))delete refreshed.manifest.syncSystemAssets;
  }
  return refreshed;
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
