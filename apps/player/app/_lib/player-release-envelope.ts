import "server-only";

import {
  playerDynamicTemplateAssetSchema,
  playerDynamicTemplatePayloadSchema,
  type PlayerDynamicTemplateAsset,
  type PlayerDynamicTemplatePayload
} from "@veyocast/contracts";

import type {
  PlayerManifestEnvelope,
  PlayerManifestItem,
  PlayerManifestPresentationDefaults,
  PlayerManifestTransition
} from "./player-manifest";
import {
  buildDynamicTemplatePayloadMap,
  type DynamicSnapshotPayloadRow,
  type DynamicTemplatePayloadRow,
  type DynamicTemplatePayloadVersionRow
} from "./player-dynamic-template-payload";
import { createPlayerAdminClient } from "./player-supabase";

type ReleaseRow = {
  id: string;
  manifest_hash: string;
  manifest_json: unknown;
  playlist_id: string;
  published_at: string;
  tenant_id: string;
  total_bytes: number;
  total_duration_seconds: number;
  version: number;
};

type ReleaseItemRow = {
  accessibility_name: string | null;
  asset_kind: "image" | "video";
  asset_title: string;
  background_color: string | null;
  checksum_sha256: string;
  crop_focus_x: number;
  crop_focus_y: number;
  display_title: string | null;
  duration_seconds: number;
  dynamic_snapshot_id: string | null;
  enabled: boolean;
  file_size_bytes: number;
  fit_mode: "contain" | "cover";
  id: string;
  mime_type: string;
  muted: boolean;
  section_name: string | null;
  section_position_key: number | null;
  section_source_id: string | null;
  storage_bucket: string;
  storage_path: string;
  transition: PlayerManifestTransition;
  trim_end_seconds: number | null;
  trim_start_seconds: number;
  visible_from: string | null;
  visible_until: string | null;
  volume_percent: number;
};

export type PlayerReleaseDevice = {
  activeReleaseId: string;
  desiredReleaseId: string;
  id: string;
  screenId: string;
  screenName: string;
};

export async function loadPlayerReleaseEnvelope({
  device,
  releaseId,
  tenantId
}: {
  device: PlayerReleaseDevice;
  releaseId: string;
  tenantId: string;
}): Promise<PlayerManifestEnvelope> {
  const admin = createPlayerAdminClient();
  const [releaseResult, itemResult] = await Promise.all([
    admin
      .from("playlist_releases")
      .select("id, tenant_id, playlist_id, version, manifest_hash, manifest_json, published_at, total_duration_seconds, total_bytes")
      .eq("id", releaseId)
      .eq("tenant_id", tenantId)
      .single(),
    admin
      .from("playlist_release_items")
      .select("id, asset_kind, asset_title, display_title, duration_seconds, fit_mode, muted, transition, crop_focus_x, crop_focus_y, background_color, volume_percent, trim_start_seconds, trim_end_seconds, visible_from, visible_until, enabled, accessibility_name, section_source_id, section_name, section_position_key, storage_bucket, storage_path, mime_type, file_size_bytes, checksum_sha256, dynamic_snapshot_id")
      .eq("release_id", releaseId)
      .eq("tenant_id", tenantId)
      .order("sort_order", { ascending: true })
  ]);

  if (releaseResult.error || itemResult.error || !releaseResult.data) {
    throw new Error("release unavailable");
  }

  const release = releaseResult.data as ReleaseRow;
  const releaseItems = (itemResult.data ?? []) as ReleaseItemRow[];
  if (releaseItems.length === 0) throw new Error("release has no items");
  const presentationDefaults = readPresentationDefaults(release.manifest_json);
  const dynamicTemplates = await loadDynamicTemplatePayloads(
    admin,
    releaseItems,
    tenantId
  );
  const dynamicAssetBytes = uniqueDynamicAssetBytes(dynamicTemplates);

  const items = await Promise.all(
    releaseItems.map(async (item): Promise<PlayerManifestItem> => {
      const { data: signed, error: signedError } = await admin.storage
        .from(item.storage_bucket)
        .createSignedUrl(item.storage_path, 60 * 60);

      if (signedError || !signed?.signedUrl) {
        throw new Error("signed asset URL unavailable");
      }

      return {
        accessibilityName: item.accessibility_name ?? item.asset_title,
        backgroundColor: item.background_color ?? undefined,
        cropFocus: {
          x: Number(item.crop_focus_x),
          y: Number(item.crop_focus_y)
        },
        displayTitle: item.display_title ?? item.asset_title,
        durationSeconds: item.duration_seconds,
        ...(dynamicTemplates.get(item.id)
          ? { dynamicTemplate: dynamicTemplates.get(item.id) }
          : {}),
        enabled: item.enabled,
        fitMode: item.fit_mode,
        id: item.id,
        kind: item.asset_kind,
        muted: item.muted,
        section:
          item.section_source_id &&
          item.section_name &&
          item.section_position_key !== null
            ? {
                name: item.section_name,
                positionKey: Number(item.section_position_key),
                sourceSectionId: item.section_source_id
              }
            : undefined,
        source: {
          bytes: item.file_size_bytes,
          checksumSha256: item.checksum_sha256,
          mimeType: item.mime_type,
          url: signed.signedUrl
        },
        title: item.asset_title,
        transition: item.transition,
        trim: {
          endSeconds:
            item.trim_end_seconds === null
              ? undefined
              : Number(item.trim_end_seconds),
          startSeconds: Number(item.trim_start_seconds)
        },
        visibility:
          item.visible_from || item.visible_until
            ? {
                from: item.visible_from ?? undefined,
                until: item.visible_until ?? undefined
              }
            : undefined,
        volumePercent: item.volume_percent
      };
    })
  );

  const fetchedAt = new Date().toISOString();
  return {
    device,
    diagnostics: {
      lastSuccessfulSyncAt: fetchedAt,
      nextSyncReason:
        device.activeReleaseId === device.desiredReleaseId
          ? "desired release already active"
          : "desired release must be verified",
      syncStatus: "online"
    },
    fetchedAt,
    manifest: {
      items,
      label: `Playlist release ${release.version}`,
      manifestHash: release.manifest_hash,
      playlistId: release.playlist_id,
      publishedAt: release.published_at,
      releaseId: release.id,
      schemaVersion: 1,
      tenantId: release.tenant_id,
      totalBytes: release.total_bytes + dynamicAssetBytes,
      totalDurationSeconds: release.total_duration_seconds,
      version: release.version,
      ...(presentationDefaults ? { presentationDefaults } : {})
    },
    state:
      device.activeReleaseId === device.desiredReleaseId ? "PLAYING" : "READY"
  };
}

async function loadDynamicTemplatePayloads(
  admin: ReturnType<typeof createPlayerAdminClient>,
  releaseItems: ReleaseItemRow[],
  tenantId: string
) {
  const snapshotIds = [
    ...new Set(
      releaseItems.flatMap((item) =>
        item.dynamic_snapshot_id ? [item.dynamic_snapshot_id] : []
      )
    )
  ];
  const result = new Map<string, PlayerDynamicTemplatePayload>();
  if (snapshotIds.length === 0) return result;

  const snapshotResult = await admin
    .from("dynamic_slide_snapshots")
    .select("id, source_revision_hash, snapshot_data_json, template_version_id")
    .in("id", snapshotIds);
  if (snapshotResult.error) return result;
  const snapshots = (snapshotResult.data ?? []) as DynamicSnapshotPayloadRow[];
  const versionIds = [
    ...new Set(snapshots.map((snapshot) => snapshot.template_version_id))
  ];
  if (versionIds.length === 0) return result;

  const versionResult = await admin
    .from("dynamic_template_versions")
    .select("id, template_id")
    .in("id", versionIds);
  if (versionResult.error) return result;
  const versions = (versionResult.data ??
    []) as DynamicTemplatePayloadVersionRow[];
  const templateIds = [
    ...new Set(versions.map((version) => version.template_id))
  ];
  if (templateIds.length === 0) return result;

  const templateResult = await admin
    .from("dynamic_templates")
    .select("id, slug, slide_type, orientation")
    .in("id", templateIds);
  if (templateResult.error) return result;

  const payloads = buildDynamicTemplatePayloadMap({
    snapshots,
    templates: (templateResult.data ?? []) as DynamicTemplatePayloadRow[],
    versions
  });
  const mediaIdsBySnapshot = new Map(
    snapshots.map((snapshot) => [
      snapshot.id,
      collectDynamicSnapshotMediaAssetIds(snapshot.snapshot_data_json)
    ])
  );
  const mediaAssetIds = [
    ...new Set([...mediaIdsBySnapshot.values()].flat())
  ];
  const assetsById = mediaAssetIds.length
    ? await loadDynamicTemplateAssets(admin, tenantId, mediaAssetIds)
    : new Map<string, PlayerDynamicTemplateAsset>();
  for (const item of releaseItems) {
    if (!item.dynamic_snapshot_id) continue;
    const payload = payloads.get(item.dynamic_snapshot_id);
    if (!payload) continue;
    const assets = Object.fromEntries(
      (mediaIdsBySnapshot.get(item.dynamic_snapshot_id) ?? []).flatMap(
        (assetId) => {
          const asset = assetsById.get(assetId);
          return asset ? [[assetId, asset]] : [];
        }
      )
    );
    const parsed = playerDynamicTemplatePayloadSchema.safeParse({
      ...payload,
      ...(Object.keys(assets).length ? { assets } : {})
    });
    if (parsed.success) result.set(item.id, parsed.data);
  }
  return result;
}

export function collectDynamicSnapshotMediaAssetIds(snapshot: unknown) {
  if (!isRecord(snapshot)) return [];
  const ids = new Set<string>();
  const brand = isRecord(snapshot.brand) ? snapshot.brand : null;
  if (
    typeof brand?.logoMediaAssetId === "string" &&
    uuidPattern.test(brand.logoMediaAssetId)
  ) {
    ids.add(brand.logoMediaAssetId);
  }
  const menu = isRecord(snapshot.menu) ? snapshot.menu : null;
  if (Array.isArray(menu?.products)) {
    for (const value of menu.products.slice(0, 40)) {
      const product = isRecord(value) ? value : null;
      if (
        product &&
        typeof product.imageMediaAssetId === "string" &&
        uuidPattern.test(product.imageMediaAssetId)
      ) {
        ids.add(product.imageMediaAssetId);
      }
    }
  }
  const priceList = isRecord(snapshot.priceList) ? snapshot.priceList : null;
  if (Array.isArray(priceList?.sections)) {
    for (const sectionValue of priceList.sections.slice(0, 40)) {
      const section = isRecord(sectionValue) ? sectionValue : null;
      if (!Array.isArray(section?.products)) continue;
      for (const productValue of section.products.slice(0, 100)) {
        const product = isRecord(productValue) ? productValue : null;
        if (
          product?.photoVisible === true &&
          typeof product.imageMediaAssetId === "string" &&
          uuidPattern.test(product.imageMediaAssetId)
        ) {
          ids.add(product.imageMediaAssetId);
        }
      }
    }
  }
  const menuDocument = isRecord(snapshot.menuDocument)
    ? snapshot.menuDocument
    : null;
  if (Array.isArray(menuDocument?.assets)) {
    for (const value of menuDocument.assets.slice(0, 100)) {
      const asset = isRecord(value) ? value : null;
      if (
        typeof asset?.assetId === "string" &&
        uuidPattern.test(asset.assetId)
      ) {
        ids.add(asset.assetId);
      }
    }
  }
  const sport = isRecord(snapshot.sport) ? snapshot.sport : null;
  if (Array.isArray(sport?.items)) {
    for (const value of sport.items.slice(0, 100)) {
      const item = isRecord(value) ? value : null;
      if (
        item &&
        typeof item.logoMediaAssetId === "string" &&
        uuidPattern.test(item.logoMediaAssetId)
      ) {
        ids.add(item.logoMediaAssetId);
      }
    }
  }
  const news = isRecord(snapshot.news) ? snapshot.news : null;
  if (!news) return [...ids];
  if (
    typeof news.providerLogoMediaAssetId === "string" &&
    uuidPattern.test(news.providerLogoMediaAssetId)
  ) {
    ids.add(news.providerLogoMediaAssetId);
  }
  if (Array.isArray(news.articles)) {
    for (const value of news.articles.slice(0, 50)) {
      const article = isRecord(value) ? value : null;
      if (
        article &&
        typeof article.heroMediaAssetId === "string" &&
        uuidPattern.test(article.heroMediaAssetId)
      ) {
        ids.add(article.heroMediaAssetId);
      }
      if (
        article &&
        typeof article.qrMediaAssetId === "string" &&
        uuidPattern.test(article.qrMediaAssetId)
      ) {
        ids.add(article.qrMediaAssetId);
      }
    }
  }
  return [...ids];
}

async function loadDynamicTemplateAssets(
  admin: ReturnType<typeof createPlayerAdminClient>,
  tenantId: string,
  mediaAssetIds: string[]
) {
  const assetResult = await admin
    .from("media_assets")
    .select("id, kind")
    .eq("tenant_id", tenantId)
    .eq("status", "ready")
    .in("id", mediaAssetIds);
  if (assetResult.error) return new Map<string, PlayerDynamicTemplateAsset>();
  const readyAssets = assetResult.data ?? [];
  const readyIds = readyAssets.map((asset) => asset.id);
  const kindById = new Map(readyAssets.map((asset) => [asset.id, asset.kind]));
  const missingIds = mediaAssetIds.filter((id) => !readyIds.includes(id));
  const [variantResult, providerResult] = await Promise.all([
    readyIds.length
      ? admin
          .from("media_variants")
          .select("asset_id, variant_type, storage_bucket, storage_path, mime_type, file_size_bytes, checksum_sha256")
          .eq("tenant_id", tenantId)
          .in("variant_type", ["original", "player_1080p", "thumbnail"])
          .in("asset_id", readyIds)
      : Promise.resolve({ data: [], error: null }),
    missingIds.length
      ? admin
          .from("provider_asset_versions")
          .select("id, storage_bucket, storage_path, mime_type, file_size_bytes, checksum_sha256")
          .in("id", missingIds)
      : Promise.resolve({ data: [], error: null })
  ]);
  if (variantResult.error || providerResult.error) {
    return new Map<string, PlayerDynamicTemplateAsset>();
  }
  const assets = new Map<string, PlayerDynamicTemplateAsset>();
  const variants = variantResult.data ?? [];
  await Promise.all(readyAssets.map(async (asset) => {
    const delivery = variants.find((variant) =>
      variant.asset_id === asset.id && variant.variant_type === (
        kindById.get(asset.id) === "video" ? "player_1080p" : "original"
      )
    );
    const poster = kindById.get(asset.id) === "video"
      ? variants.find((variant) =>
          variant.asset_id === asset.id && variant.variant_type === "thumbnail"
        )
      : null;
    if (!delivery || (kindById.get(asset.id) === "video" && !poster)) return;
    const [signed, signedPoster] = await Promise.all([
      admin.storage.from(delivery.storage_bucket)
        .createSignedUrl(delivery.storage_path, 60 * 60),
      poster
        ? admin.storage.from(poster.storage_bucket)
            .createSignedUrl(poster.storage_path, 60 * 60)
        : Promise.resolve({ data: null, error: null })
    ]);
    if (signed.error || !signed.data?.signedUrl ||
      (poster && (signedPoster.error || !signedPoster.data?.signedUrl))) return;
    const parsed = playerDynamicTemplateAssetSchema.safeParse({
      bytes: Number(delivery.file_size_bytes),
      checksumSha256: delivery.checksum_sha256,
      mimeType: delivery.mime_type,
      ...(poster ? {
        posterBytes: Number(poster.file_size_bytes),
        posterChecksumSha256: poster.checksum_sha256,
        posterMimeType: "image/png",
        posterUrl: signedPoster.data?.signedUrl
      } : {}),
      url: signed.data.signedUrl
    });
    if (parsed.success) assets.set(asset.id, parsed.data);
  }));
  await Promise.all((providerResult.data ?? []).map(async (provider) => {
    const signed = await admin.storage.from(provider.storage_bucket)
      .createSignedUrl(provider.storage_path, 60 * 60);
    if (signed.error || !signed.data?.signedUrl) return;
    const parsed = playerDynamicTemplateAssetSchema.safeParse({
      bytes: Number(provider.file_size_bytes),
      checksumSha256: provider.checksum_sha256,
      mimeType: provider.mime_type,
      url: signed.data.signedUrl
    });
    if (parsed.success) assets.set(provider.id, parsed.data);
  }));
  return assets;
}

function uniqueDynamicAssetBytes(
  templates: Map<string, PlayerDynamicTemplatePayload>
) {
  const assets = new Map<string, number>();
  for (const template of templates.values()) {
    for (const asset of Object.values(template.assets ?? {})) {
      assets.set(asset.checksumSha256, asset.bytes);
      if (asset.posterChecksumSha256 && asset.posterBytes) {
        assets.set(asset.posterChecksumSha256, asset.posterBytes);
      }
    }
  }
  return [...assets.values()].reduce((total, bytes) => total + bytes, 0);
}

function readPresentationDefaults(
  manifest: unknown
): PlayerManifestPresentationDefaults | null {
  if (!isRecord(manifest) || !isRecord(manifest.presentationDefaults)) {
    return null;
  }

  const defaults = manifest.presentationDefaults;
  if (
    !Number.isInteger(defaults.imageDurationSeconds) ||
    !["cut", "crossfade", "wipe"].includes(String(defaults.transition)) ||
    !["contain", "cover"].includes(String(defaults.fitMode)) ||
    typeof defaults.videoMuted !== "boolean" ||
    typeof defaults.loopEnabled !== "boolean"
  ) {
    return null;
  }

  const backgroundColor =
    typeof defaults.backgroundColor === "string" &&
    /^#[0-9a-f]{6}$/i.test(defaults.backgroundColor)
      ? defaults.backgroundColor
      : undefined;

  return {
    ...(backgroundColor ? { backgroundColor } : {}),
    fitMode: defaults.fitMode as "contain" | "cover",
    imageDurationSeconds: defaults.imageDurationSeconds as number,
    loopEnabled: defaults.loopEnabled,
    transition: defaults.transition as PlayerManifestTransition,
    videoMuted: defaults.videoMuted
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
