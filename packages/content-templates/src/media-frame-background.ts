import type { MediaFramePlaybackBackground } from "@veyocast/contracts";

export type MediaFrameBackgroundStyle = {
  background: string;
  backgroundImage?: string;
  backgroundSize?: string;
  backgroundPosition?: string;
};

/** Exact rawmedia backgrounds from the chosen immutable Sync Content source.
 * URLs must come from a verified source/asset map; there is no network fallback.
 * Rawmedia deliberately has no text, logo, grain, orbit or footer overlay.
 */
export function mediaFrameBackgroundStyle(
  value: MediaFramePlaybackBackground,
  urls: { image?: string; clubmuur?: string } = {},
): MediaFrameBackgroundStyle | null {
  const base = value.themeId === "onzetrots-tv"
    ? "linear-gradient(123deg,#103d96 0%,#0c2150 61%,#07132c 100%)"
    : "linear-gradient(125deg,#1b6798,#102c53 62%,#112139)";
  const background = value.background;
  if (background.kind === "image") {
    if (!urls.image) return null;
    return { background: base, backgroundImage: `linear-gradient(90deg,rgba(6,19,45,.92),rgba(6,19,45,.3)),url(${JSON.stringify(urls.image)})`, backgroundSize: "cover", backgroundPosition: background.position };
  }
  if (background.preset === "light") return { background: "#edf2fa" };
  if (background.preset === "gradient") return { background: `radial-gradient(ellipse at 78% 10%,${value.accentColor},transparent 65%),#0a1934` };
  if (background.preset === "stripes") return { background: "repeating-linear-gradient(130deg,#102e64 0,#102e64 7%,#123871 7%,#123871 14%)" };
  if (background.preset === "clubmuur") {
    if (!urls.clubmuur) return null;
    return { background: base, backgroundImage: `linear-gradient(115deg,rgba(4,22,58,.36),rgba(4,20,53,.76)),url(${JSON.stringify(urls.clubmuur)})`, backgroundSize: "cover", backgroundPosition: "center" };
  }
  // Source has no bg-dark override; both stadium and dark retain the theme.
  return { background: base };
}
