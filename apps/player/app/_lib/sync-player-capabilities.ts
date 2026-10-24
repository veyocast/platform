export const syncPlayerRendererHeader = "X-VeyoCast-Sync-Renderer";
export const syncPlayerRendererVersion = "sync-v1";
export const syncEngagePagingHeader = "X-VeyoCast-Sync-Engage-Paging";
export const syncEngagePagingVersion = "sync-engage-pages-v1";
export const syncBackgroundsHeader = "X-VeyoCast-Sync-Backgrounds";
export const syncBackgroundsVersion = "sync-backgrounds-v1";
export const syncOnzeTrotsHeader='X-VeyoCast-Sync-OnzeTrots';
export const syncOnzeTrotsVersion='sync-onzetrots-v1';
export const syncOnzeTrotsCurrentHeader='X-VeyoCast-Sync-OnzeTrots-Current';
export const syncOnzeTrotsCurrentVersion='onzetrots-20261024';
export const syncOnzeTrotsV9Header='X-VeyoCast-Sync-OnzeTrots-V9';
export const syncOnzeTrotsV9Version='sync-onzetrots-v9';
export function supportsSyncOnzeTrotsV9(){return supportsSyncOnzeTrots()&&CSS.supports('filter','blur(1px)');}
export function supportsSyncOnzeTrots(){return supportsSyncBackgrounds()&&CSS.supports('position','sticky')&&typeof SVGForeignObjectElement!=='undefined'&&typeof Element.prototype.getAnimations==='function';}
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

/** Photographs need a bounded decode before the candidate may become active. */
export function supportsSyncBackgrounds(): boolean {
  return supportsSyncSlideDom() && typeof Image !== "undefined" && typeof Image.prototype.decode === "function"
    && typeof FontFace === "function" && typeof FontFace.prototype.load === "function"
    && typeof document.fonts.add === "function" && typeof document.fonts.delete === "function";
}
