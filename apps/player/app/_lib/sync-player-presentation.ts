import {
  syncSystemAssets,
  syncBackgroundAssetForRef,
  syncSlideAssets,
  syncSlidePresentationSchema,
  syncDynamicPlaybackSchema,
  syncSlideRendererAssets,
  syncSlideMinimumDurationMs,
  syncOnzeTrotsRendererVersion,
  type SyncSlidePresentation,
} from "@veyocast/contracts";
import { syncSlideCss } from "@veyocast/content-templates/sync-slide-styles";
import {syncOnzeTrotsV9Styles,syncOnzeTrotsCss} from '@veyocast/content-templates/sync-slide-static-view';
import {resolvePlayerItemPresentation,type PlayerManifestItem} from "./player-manifest";

/** Select a render input without rewriting immutable Studio fields during a
 * connected data refresh. The two wire profiles retain separate identities. */
export function syncPlayerContent(item:PlayerManifestItem){
 if(item.syncDynamic){
  if(item.syncStudioPresentation||item.sitesStudioPresentation)return null;
  const parsed=syncDynamicPlaybackSchema.safeParse(item.syncDynamic);
  if(!parsed.success||(parsed.data.schemaVersion===1?parsed.data.fallbackChecksumSha256:parsed.data.descriptorChecksumSha256)!==item.source.checksumSha256)return null;
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
    Number(duration) < syncSlideMinimumDurationMs(parsed.data) ||
    Number(duration) > 120000
  )
    return false;
  const playback=resolvePlayerItemPresentation(item);
  if(playback.trimStartSeconds>0||playback.trimEndSeconds!==null&&playback.trimEndSeconds*1000<Number(duration))return false;
  const background = syncBackgroundAssetForRef(parsed.data.style.backgroundAsset);
  if (
    [...syncSlideRendererAssets(parsed.data), ...(background ? [background] : [])].some(
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
  presentation?:SyncSlidePresentation,
): string {
  const expected = new Set<string>((presentation?syncSlideRendererAssets(presentation):syncSystemAssets).map((asset) => asset.path));
  return (presentation?.rendererVersion==='sync-onzetrots-v9'?syncOnzeTrotsV9Styles(presentation):presentation?.rendererVersion===syncOnzeTrotsRendererVersion?syncOnzeTrotsCss:syncSlideCss).replace(
    /url\(\s*(['"]?)(\/(?:onzetrots-approved-v(?:1|9)\/)?assets\/[^)'"\s]+)\1\s*\)/g,
    (_match, _quote, path: string) => {
      const url = urls[path];
      if (
        !expected.has(path) ||
        !isSyncPreparedUrl(url, origin)
      )
        throw Error("SYNC_PREPARED_ASSET_UNAVAILABLE");
      return `url(${JSON.stringify(url)})`;
    },
  );
}

/** A gallery frame owns only its verified cached faces. Global shell families
 * can have overlapping declarations whose network sources are unavailable offline. */
export function prepareSyncBackgroundFonts(urls: Record<string, string>, origin: string) {
  return prepareSyncFontFaces(urls,origin,[
    { family: "Inter", path: "/assets/inter.woff2", weight: "100 900", format: "woff2" },
    { family: "Manrope", path: "/assets/manrope.woff2", weight: "200 800", format: "woff2" },
    { family: "OnzeTrots", path: "/assets/onzetrots-brush.ttf", weight: "normal", format: "truetype" },
    { family: "OnzeTrots Brush", path: "/assets/onzetrots-brush.ttf", weight: "normal", format: "truetype" },
  ]);
}

export function prepareSyncOnzeTrotsFonts(urls:Record<string,string>,origin:string,presentation?:SyncSlidePresentation){
 return prepareSyncFontFaces(urls,origin,[
  {family:'OTManrope',path:'/onzetrots-approved-v1/assets/fonts/club-font-4.ttf',weight:'400',format:'truetype'},
  {family:'OTManrope',path:'/onzetrots-approved-v1/assets/fonts/club-font-6.ttf',weight:'600',format:'truetype'},
  {family:'OTManrope',path:'/onzetrots-approved-v1/assets/fonts/club-font-8.ttf',weight:'800',format:'truetype'},
  {family:'OTBarlow',path:'/onzetrots-approved-v1/assets/fonts/club-font-2.ttf',weight:'800',format:'truetype'},
  {family:'OTBarlow',path:'/onzetrots-approved-v1/assets/fonts/club-font-3.ttf',weight:'900',format:'truetype'},
  presentation?.rendererVersion==='sync-onzetrots-v9'?{family:'OTRubikDistressed',path:'/onzetrots-approved-v9/assets/fonts/RubikDistressed-Regular.ttf',weight:'400',format:'truetype'}:{family:'OTMarker',path:'/onzetrots-approved-v1/assets/fonts/club-font-9.ttf',weight:'400',format:'truetype'},
 ]);
}

function prepareSyncFontFaces(urls:Record<string,string>,origin:string,definitions:Array<{family:string;path:string;weight:string;format:string}>){
  const faces: FontFace[] = [];
  let stopped = false;
  const dispose = () => {
    stopped = true;
    for (const face of faces) document.fonts.delete(face);
  };
  const ready = Promise.resolve().then(async () => {
    if (stopped) return;
    for (const definition of definitions) {
      const url = urls[definition.path];
      if (!isSyncPreparedUrl(url, origin)) throw Error("SYNC_PREPARED_ASSET_UNAVAILABLE");
      faces.push(new FontFace(definition.family, `url(${JSON.stringify(url)}) format("${definition.format}")`, {
        weight: definition.weight, style: "normal", display: "swap",
      }));
    }
    await Promise.all(faces.map(face => face.load().then(loaded => {
      if (stopped) return;
      if (loaded.status !== "loaded") throw Error("SYNC_FONT_NOT_LOADED");
      document.fonts.add(loaded);
    })));
  }).catch(error => { dispose(); throw error; });
  return { ready, dispose };
}
