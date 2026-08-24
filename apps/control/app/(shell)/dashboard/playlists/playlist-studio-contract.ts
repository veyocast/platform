export type PlaylistStudioItem = {
  accessibilityName: string | null;
  asset: PlaylistStudioAsset | null;
  backgroundColor: string | null;
  cropFocusX: number;
  cropFocusY: number;
  displayTitle: string | null;
  dynamicSlideId: string | null;
  dynamicSnapshotId: string | null;
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

export type PlaylistStudioDynamicSlide = {
  durationSeconds: number;
  id: string;
  name: string;
  orientation: "landscape" | "portrait";
  previewAsset: PlaylistStudioAsset;
  selectionMode: "latest" | "pinned";
  slideCount: number;
  slideType: string;
  snapshotId: string;
};

export type PlaylistStudioYouTubeSource = {
  channelTitle: string | null;
  fallbackAsset: PlaylistStudioAsset;
  id: string;
  title: string;
  videoId: string;
};

export type PlaylistStudioEngageCampaign = {
  id: string;
  publicId: string;
  question: string;
  status: "closed" | "live" | "scheduled";
  title: string;
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
