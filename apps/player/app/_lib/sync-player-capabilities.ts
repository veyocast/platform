export const syncPlayerRendererHeader = "X-VeyoCast-Sync-Renderer";
export const syncPlayerRendererVersion = "sync-v1";
export const syncDynamicRendererHeader='X-VeyoCast-Sync-Dynamic';
export const syncDynamicDomVersion='sync-dynamic-v1';
export const syncDynamicBinaryVersion='sync-dynamic-binary-v1';
export type SyncDynamicMode=false|'dom'|'binary';
export function readSyncDynamicMode(value:string|null):SyncDynamicMode{return value===syncDynamicDomVersion?'dom':value===syncDynamicBinaryVersion?'binary':false;}

/** Older WebViews retain the complete raster/video path. */
export function supportsSyncSlideDom(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof CSS !== "undefined" &&
    typeof CSS.supports === "function" &&
    CSS.supports("container-type", "inline-size") &&
    CSS.supports("width", "1cqw") &&
    CSS.supports("aspect-ratio", "16 / 9") &&
    typeof ResizeObserver !== "undefined" &&
    typeof document.fonts?.load === "function"
  );
}
