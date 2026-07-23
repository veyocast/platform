export type PlaylistStudioItem = {
  accessibilityName: string | null;
  asset: PlaylistStudioAsset | null;
  backgroundColor: string | null;
  cropFocusX: number;
  cropFocusY: number;
  displayTitle: string | null;
  durationSeconds: number;
  enabled: boolean;
  fitMode: "contain" | "cover";
  id: string;
  mediaAssetId: string;
  muted: boolean;
  sectionId: string | null;
  sortOrder: number;
  transition: "crossfade" | "cut" | "wipe";
  trimEndSeconds: number | null;
  trimStartSeconds: number;
  visibleFrom: string | null;
  visibleUntil: string | null;
  volumePercent: number;
};

export type PlaylistStudioSection = {
  defaultDurationSeconds: number | null;
  defaultTransition: "crossfade" | "cut" | "wipe" | null;
  enabled: boolean;
  id: string;
  name: string;
  positionKey: number;
};

export type PlaylistStudioAsset = {
  deletedAt: string | null;
  id: string;
  kind: "image" | "video";
  mimeType: string;
  status: string;
  tenantId: string;
  title: string;
  variant: PlaylistStudioVariant | null;
};

export type PlaylistStudioVariant = {
  assetId: string;
  checksumSha256: string;
  durationSeconds: number | null;
  fileSizeBytes: number;
  height: number | null;
  mimeType: string;
  previewUrl: string | null;
  storagePath: string;
  tenantId: string;
  variantType: string;
  width: number | null;
};
