export type LedScoresMediaSlot = "fallback" | "logo" | "sound";

export type LedScoresMediaPolicyAsset = {
  canvasCompatible?: boolean;
  kind: string;
  mimeType: string | null;
  purposeApproved?: boolean;
  sourceKind: string;
};

const supportedImages = new Set(["image/jpeg", "image/png", "image/webp"]);

export function resolveLedScoresPlaybackMime(
  kind: string,
  originalMime: string | null,
  playerVariantMime: string | null
) {
  return kind === "video" ? playerVariantMime : originalMime;
}

export function isLedScoresMediaEligible(
  asset: LedScoresMediaPolicyAsset,
  slot: LedScoresMediaSlot
) {
  if (asset.canvasCompatible === false) return false;
  if (slot === "logo") {
    return asset.purposeApproved === true
      && asset.kind === "image"
      && supportedImages.has(asset.mimeType ?? "");
  }
  if (asset.sourceKind !== "user") return false;
  if (slot === "sound") {
    return asset.kind === "video" && asset.mimeType === "video/mp4";
  }
  return (
    (asset.kind === "image" && supportedImages.has(asset.mimeType ?? ""))
    || (asset.kind === "video" && asset.mimeType === "video/mp4")
  );
}
