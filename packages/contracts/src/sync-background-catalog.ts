/** Approved OnzeTrots photographs from the immutable v17 asset set. These are
 * backgrounds only, independent of the eleven immutable Sync renderer assets. */
export const syncBackgroundSourceRevision = "6800bc858436ba0843eaea89b682cd5b43c3521d" as const;
export const syncBackgroundScenes = [
  { id: "houtrust", label: "Houtrust", landscape: {
    path: "/onzetrots/website-brush/houtrust-wide-1672.webp",
    sha256: "4e654df31f432c922a44b1670f6bf8d64af3361d40645f410de0a4d696d46171",
    bytes: 596258, mimeType: "image/webp", width: 1672, height: 941,
  }, portrait: {
    path: "/onzetrots/website-brush/houtrust-portrait-941.webp",
    sha256: "e96a079d1a96f3ca75305329431065d2c61b7f3548735f48811bb57d34be4a14",
    bytes: 524608, mimeType: "image/webp", width: 941, height: 1672,
  } },
  { id: "de-wijk", label: "De wijk", landscape: {
    path: "/onzetrots/website-brush/de-wijk-wide-1672.webp",
    sha256: "d7198cf38780978b142c15c6cbc33f196afe1d77016582495438daf903c4234e",
    bytes: 570048, mimeType: "image/webp", width: 1672, height: 941,
  }, portrait: {
    path: "/onzetrots/website-brush/de-wijk-portrait-941.webp",
    sha256: "a9aab1cb20cbd4abcf92ed90463d8e50a2a67c4cf1637bd2cdeb55dbd265ae70",
    bytes: 538010, mimeType: "image/webp", width: 941, height: 1672,
  } },
  { id: "aan-zee", label: "Aan zee", landscape: {
    path: "/onzetrots/website-brush/aan-zee-wide-1672.webp",
    sha256: "ab1df0dd01e1f5ed768e099897377e12b92b85c2856eb80c48c7a06416ece3ae",
    bytes: 535874, mimeType: "image/webp", width: 1672, height: 941,
  }, portrait: {
    path: "/onzetrots/website-brush/aan-zee-portrait-941.webp",
    sha256: "446eeeaa84b0e032d34fa6aac10615716d4927917bf9258d245ddad0ebc347d6",
    bytes: 517752, mimeType: "image/webp", width: 941, height: 1672,
  } },
] as const;
export type SyncBackgroundSceneId = (typeof syncBackgroundScenes)[number]["id"];
export const syncBackgroundAssets = syncBackgroundScenes.flatMap(scene => [scene.landscape, scene.portrait]);

export function syncBackgroundAssetForRef(ref: { kind: string; path?: string; checksumSha256: string } | undefined) {
  return ref?.kind === "system" ? syncBackgroundAssets.find(asset => asset.path === ref.path && asset.sha256 === ref.checksumSha256) : undefined;
}
