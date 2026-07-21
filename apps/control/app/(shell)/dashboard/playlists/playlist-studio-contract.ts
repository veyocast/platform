export type PlaylistStudioItem = {
  asset: PlaylistStudioAsset | null;
  durationSeconds: number;
  fitMode: "contain" | "cover";
  id: string;
  mediaAssetId: string;
  muted: boolean;
  sortOrder: number;
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
