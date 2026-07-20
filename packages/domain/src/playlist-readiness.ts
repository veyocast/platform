export const playlistReadinessReasonCodes = [
  "PLAYLIST_ARCHIVED",
  "PLAYLIST_EMPTY",
  "ASSET_MISSING",
  "ASSET_TENANT_MISMATCH",
  "ASSET_NOT_READY",
  "ASSET_KIND_UNSUPPORTED",
  "PLAYER_VARIANT_MISSING",
  "VARIANT_TENANT_MISMATCH",
  "VARIANT_MIME_UNSUPPORTED",
  "VARIANT_METADATA_INVALID",
  "ITEM_DURATION_INVALID",
  "ITEM_FIT_MODE_INVALID",
  "TARGET_ORIENTATION_UNSUPPORTED"
] as const;

export type PlaylistReadinessReasonCode =
  (typeof playlistReadinessReasonCodes)[number];

export type PlaylistReadinessRecoveryAction =
  | "restore_playlist"
  | "add_media"
  | "replace_media"
  | "wait_for_processing"
  | "reprocess_media"
  | "change_item_settings"
  | "change_target_screens";

export type PlaylistReadinessVariant = Readonly<{
  fileSizeBytes: number;
  height: number | null;
  mimeType: string;
  tenantId: string;
  variantType: string;
  width: number | null;
}>;

export type PlaylistReadinessAsset = Readonly<{
  deleted: boolean;
  id: string;
  kind: string;
  status: string;
  tenantId: string;
  variant: PlaylistReadinessVariant | null;
}>;

export type PlaylistReadinessItem = Readonly<{
  asset: PlaylistReadinessAsset | null;
  durationSeconds: number;
  fitMode: string;
  id: string;
  mediaAssetId: string;
}>;

export type PlaylistReadinessReason = Readonly<{
  assetId?: string;
  code: PlaylistReadinessReasonCode;
  itemId?: string;
  recoveryAction: PlaylistReadinessRecoveryAction;
}>;

export type PlaylistReadinessResult = Readonly<{
  canPublish: boolean;
  itemCount: number;
  reasons: readonly PlaylistReadinessReason[];
  totalBytes: number;
  totalDurationSeconds: number;
}>;

const supportedOrientations = new Set(["landscape", "portrait"]);
const supportedImageMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp"
]);

export function evaluatePlaylistReadiness(input: Readonly<{
  items: readonly PlaylistReadinessItem[];
  playlistStatus: string;
  playlistTenantId: string;
  targetOrientations?: readonly string[];
}>): PlaylistReadinessResult {
  const reasons: PlaylistReadinessReason[] = [];

  if (input.playlistStatus === "archived") {
    reasons.push(reason("PLAYLIST_ARCHIVED", "restore_playlist"));
  }

  if (input.items.length === 0) {
    reasons.push(reason("PLAYLIST_EMPTY", "add_media"));
  }

  for (const orientation of input.targetOrientations ?? []) {
    if (!supportedOrientations.has(orientation)) {
      reasons.push(reason("TARGET_ORIENTATION_UNSUPPORTED", "change_target_screens"));
    }
  }

  let totalBytes = 0;
  let totalDurationSeconds = 0;

  for (const item of input.items) {
    totalDurationSeconds += Number.isFinite(item.durationSeconds)
      ? item.durationSeconds
      : 0;

    if (
      !Number.isInteger(item.durationSeconds) ||
      item.durationSeconds < 5 ||
      item.durationSeconds > 3600
    ) {
      reasons.push(itemReason(item, "ITEM_DURATION_INVALID", "change_item_settings"));
    }

    if (item.fitMode !== "contain" && item.fitMode !== "cover") {
      reasons.push(itemReason(item, "ITEM_FIT_MODE_INVALID", "change_item_settings"));
    }

    const asset = item.asset;
    if (!asset) {
      reasons.push(itemReason(item, "ASSET_MISSING", "replace_media"));
      continue;
    }

    if (asset.tenantId !== input.playlistTenantId) {
      reasons.push(itemReason(item, "ASSET_TENANT_MISMATCH", "replace_media"));
      continue;
    }

    if (asset.deleted || asset.status !== "ready") {
      reasons.push(
        itemReason(
          item,
          "ASSET_NOT_READY",
          asset.status === "uploading" || asset.status === "processing"
            ? "wait_for_processing"
            : "reprocess_media"
        )
      );
      continue;
    }

    if (asset.kind !== "image" && asset.kind !== "video") {
      reasons.push(itemReason(item, "ASSET_KIND_UNSUPPORTED", "replace_media"));
      continue;
    }

    const variant = asset.variant;
    const expectedVariant = asset.kind === "video" ? "player_1080p" : "original";
    if (!variant || variant.variantType !== expectedVariant) {
      reasons.push(itemReason(item, "PLAYER_VARIANT_MISSING", "reprocess_media"));
      continue;
    }

    if (variant.tenantId !== input.playlistTenantId) {
      reasons.push(itemReason(item, "VARIANT_TENANT_MISMATCH", "reprocess_media"));
      continue;
    }

    const mimeSupported =
      asset.kind === "video"
        ? variant.mimeType === "video/mp4"
        : supportedImageMimeTypes.has(variant.mimeType);
    if (!mimeSupported) {
      reasons.push(itemReason(item, "VARIANT_MIME_UNSUPPORTED", "reprocess_media"));
    }

    if (
      !Number.isFinite(variant.fileSizeBytes) ||
      variant.fileSizeBytes <= 0 ||
      !validOptionalDimension(variant.width) ||
      !validOptionalDimension(variant.height)
    ) {
      reasons.push(itemReason(item, "VARIANT_METADATA_INVALID", "reprocess_media"));
      continue;
    }

    totalBytes += variant.fileSizeBytes;
  }

  return {
    canPublish: reasons.length === 0,
    itemCount: input.items.length,
    reasons,
    totalBytes,
    totalDurationSeconds
  };
}

function validOptionalDimension(value: number | null) {
  return value === null || (Number.isInteger(value) && value > 0);
}

function itemReason(
  item: PlaylistReadinessItem,
  code: PlaylistReadinessReasonCode,
  recoveryAction: PlaylistReadinessRecoveryAction
): PlaylistReadinessReason {
  return {
    assetId: item.mediaAssetId,
    code,
    itemId: item.id,
    recoveryAction
  };
}

function reason(
  code: PlaylistReadinessReasonCode,
  recoveryAction: PlaylistReadinessRecoveryAction
): PlaylistReadinessReason {
  return { code, recoveryAction };
}
