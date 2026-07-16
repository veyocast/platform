export const platformRoles = [
  "platform_owner",
  "platform_admin",
  "platform_support",
  "platform_viewer"
] as const;

export const tenantRoles = [
  "tenant_owner",
  "tenant_admin",
  "tenant_editor",
  "tenant_viewer"
] as const;

export const tenantStatuses = ["active", "paused", "archived"] as const;

export const invitationStatuses = ["pending", "accepted", "revoked", "expired"] as const;

export const mediaAssetKinds = ["image", "video"] as const;

export const mediaAssetStatuses = [
  "uploading",
  "processing",
  "ready",
  "validation_failed",
  "deleted"
] as const;

export const mediaUploadSessionStatuses = [
  "pending",
  "uploaded",
  "expired",
  "cancelled"
] as const;

export const mediaVariantTypes = ["original", "thumbnail", "player_1080p"] as const;

export const mediaProcessingJobStatuses = [
  "queued",
  "processing",
  "completed",
  "failed"
] as const;

export const playlistStatuses = ["draft", "published", "archived"] as const;

export const playlistItemFitModes = ["contain", "cover"] as const;

export const playlistItemDurationSeconds = {
  default: 10,
  maximum: 3600,
  minimum: 5
} as const;

export const screenStatuses = ["active", "maintenance", "disabled"] as const;

export const playerDeviceStatuses = ["paired", "revoked", "disabled"] as const;

export const pairingSessionStatuses = [
  "pending",
  "claimed",
  "expired",
  "cancelled"
] as const;

export const screenOrientations = ["landscape", "portrait"] as const;

export const mediaImageMimeTypes = ["image/jpeg", "image/png", "image/webp"] as const;
export const mediaVideoMimeTypes = ["video/mp4"] as const;
export const mediaAllowedMimeTypes = [
  ...mediaImageMimeTypes,
  ...mediaVideoMimeTypes
] as const;

export const mediaMaxVideoBytes = 524_288_000;
export const mediaMaxVideoDurationSeconds = 300;

export type PlatformRole = (typeof platformRoles)[number];
export type TenantRole = (typeof tenantRoles)[number];
export type TenantStatus = (typeof tenantStatuses)[number];
export type InvitationStatus = (typeof invitationStatuses)[number];
export type MediaAssetKind = (typeof mediaAssetKinds)[number];
export type MediaAssetStatus = (typeof mediaAssetStatuses)[number];
export type MediaUploadSessionStatus = (typeof mediaUploadSessionStatuses)[number];
export type MediaVariantType = (typeof mediaVariantTypes)[number];
export type MediaProcessingJobStatus = (typeof mediaProcessingJobStatuses)[number];
export type MediaAllowedMimeType = (typeof mediaAllowedMimeTypes)[number];
export type PlaylistStatus = (typeof playlistStatuses)[number];
export type PlaylistItemFitMode = (typeof playlistItemFitModes)[number];
export type ScreenStatus = (typeof screenStatuses)[number];
export type PlayerDeviceStatus = (typeof playerDeviceStatuses)[number];
export type PairingSessionStatus = (typeof pairingSessionStatuses)[number];
export type ScreenOrientation = (typeof screenOrientations)[number];

export const platformTenantMutationRoles = ["platform_owner", "platform_admin"] as const satisfies readonly PlatformRole[];
export const tenantAdministrationRoles = ["tenant_owner", "tenant_admin"] as const satisfies readonly TenantRole[];
export const tenantWriteRoles = ["tenant_owner", "tenant_admin", "tenant_editor"] as const satisfies readonly TenantRole[];

export function getMediaKindForMimeType(mimeType: string): MediaAssetKind | null {
  if ((mediaImageMimeTypes as readonly string[]).includes(mimeType)) {
    return "image";
  }

  if ((mediaVideoMimeTypes as readonly string[]).includes(mimeType)) {
    return "video";
  }

  return null;
}

export function isAllowedMediaMimeType(
  mimeType: string
): mimeType is MediaAllowedMimeType {
  return (mediaAllowedMimeTypes as readonly string[]).includes(mimeType);
}

export function getTenantMediaStoragePrefix(tenantId: string, assetId: string) {
  return `tenants/${tenantId}/assets/${assetId}`;
}

export function getTenantMediaOriginalPath({
  assetId,
  fileName,
  tenantId
}: {
  assetId: string;
  fileName: string;
  tenantId: string;
}) {
  return `${getTenantMediaStoragePrefix(tenantId, assetId)}/original/${sanitizeMediaFileName(fileName)}`;
}

export function getPlaylistReleaseLabel({
  playlistName,
  version
}: {
  playlistName: string;
  version: number;
}) {
  return `${playlistName.trim()} v${version}`;
}

export function formatPairingCode(code: string) {
  const normalizedCode = code.replace(/[^a-zA-Z0-9]+/g, "").toUpperCase();

  if (normalizedCode.length <= 3) {
    return normalizedCode;
  }

  return `${normalizedCode.slice(0, 3)} ${normalizedCode.slice(3, 6)}`;
}

function sanitizeMediaFileName(fileName: string) {
  const trimmedFileName = fileName.trim().toLowerCase();
  const normalizedFileName = trimmedFileName.replace(/[^a-z0-9._-]+/g, "-");
  const collapsedFileName = normalizedFileName.replace(/-+/g, "-").replace(/^-|-$/g, "");

  return collapsedFileName.length > 0 ? collapsedFileName : "upload.bin";
}
