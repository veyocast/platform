import {
  syncSystemAssets,
  syncSlideAssets,
  syncSlidePageCount,
  syncSlidePresentationSchema,
  syncDynamicPlaybackSchema,
} from "@veyocast/contracts";
import { syncSlideCss } from "@veyocast/content-templates/sync-slide-styles";
import {resolvePlayerItemPresentation,type PlayerManifestItem} from "./player-manifest";

/** Select a render input without rewriting immutable Studio fields during a
 * connected data refresh. The two wire profiles retain separate identities. */
export function syncPlayerContent(item:PlayerManifestItem){
 if(item.syncDynamic){
  if(item.syncStudioPresentation||item.sitesStudioPresentation)return null;
  const parsed=syncDynamicPlaybackSchema.safeParse(item.syncDynamic);
  if(!parsed.success||parsed.data.fallbackChecksumSha256!==item.source.checksumSha256)return null;
  return {presentation:parsed.data.presentation,durationMs:parsed.data.durationMs,assets:parsed.data.assets};
 }
 if(!item.syncStudioPresentation)return null;
 return {presentation:item.syncStudioPresentation,durationMs:item.syncStudioDurationMs,assets:item.syncStudioAssets};
}

/** Source playback accepts prepared local URLs only; no HTTP/data fallback for a required asset. */
export function isSyncPreparedUrl(
  value: string | undefined,
  origin: string,
): value is string {
  if (!value) return false;
  if (/^\/__veyocast-player-cache\/[a-f0-9]{64}$/.test(value)) return true;
  try {
    const parsed = new URL(value);
    return (
      parsed.protocol === "blob:" &&
      parsed.origin === origin &&
      !/[\s"'()<>\\]/.test(value)
    );
  } catch {
    return false;
  }
}
export function syncPreparedPresentation(
  item: PlayerManifestItem,
  origin: string,
): boolean {
  const content=syncPlayerContent(item);
  const parsed = syncSlidePresentationSchema.safeParse(content?.presentation),
    duration = content?.durationMs;
  if (
    !parsed.success ||
    !Number.isInteger(duration) ||
    Number(duration) < 3000 * syncSlidePageCount(parsed.data) ||
    Number(duration) > 120000
  )
    return false;
  const playback=resolvePlayerItemPresentation(item);
  if(playback.trimStartSeconds>0||playback.trimEndSeconds!==null&&playback.trimEndSeconds*1000<Number(duration))return false;
  if (
    syncSystemAssets.some(
      (asset) =>
        !isSyncPreparedUrl(item.syncSystemAssetUrls?.[asset.path], origin),
    )
  )
    return false;
  return syncSlideAssets(parsed.data).every(
    (ref) =>
      ref.kind === "system" ||
      Boolean(
        content?.assets?.[ref.mediaAssetId]?.checksumSha256 ===
          ref.checksumSha256 &&
          isSyncPreparedUrl(
            content?.assets?.[ref.mediaAssetId]?.url,
            origin,
          ),
      ),
  );
}

/** Match the verified binary's object-fit/object-position for the same placement. */
export function syncPlaybackFrame(item:PlayerManifestItem,viewport:{width:number;height:number}){
 const ratio=syncPlayerContent(item)?.presentation.orientation==='portrait'?9/16:16/9;
 const width=item.fitMode==='cover'?Math.max(viewport.width,viewport.height*ratio):Math.min(viewport.width,viewport.height*ratio),height=width/ratio;
 const placement=resolvePlayerItemPresentation(item);
 return {width,height,left:(viewport.width-width)*placement.cropFocusX,top:(viewport.height-height)*placement.cropFocusY,backgroundColor:placement.backgroundColor??undefined};
}
export function syncPreparedCss(
  urls: Record<string, string>,
  origin: string,
): string {
  const expected = new Set(syncSystemAssets.map((asset) => asset.path));
  return syncSlideCss.replace(
    /url\(\s*(['"]?)(\/assets\/[^)'"\s]+)\1\s*\)/g,
    (_match, _quote, path: string) => {
      const url = urls[path];
      if (
        !expected.has(path as (typeof syncSystemAssets)[number]["path"]) ||
        !isSyncPreparedUrl(url, origin)
      )
        throw Error("SYNC_PREPARED_ASSET_UNAVAILABLE");
      return `url(${JSON.stringify(url)})`;
    },
  );
}
