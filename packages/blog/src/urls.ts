export const blogAssetPattern = /^\/api\/blog\/media\/([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/iu;

export function safeBlogUrl(value: unknown, kind: "link" | "image" = "link"): string | undefined {
  if (typeof value !== "string" || !value || [...value].some((character) => character.charCodeAt(0) <= 32 || character.charCodeAt(0) === 127 || character === "\\")) return;
  if (kind === "image") return blogAssetPattern.test(value) ? value : undefined;
  if (/^\/(?!\/)/u.test(value) || /^#[\w-]+$/u.test(value)) return value;
  try {
    const url = new URL(value);
    if (url.username || url.password || !["https:", "http:", "mailto:", "tel:"].includes(url.protocol)) return;
    return url.href;
  } catch { return; }
}

export function blogYoutubeUrl(value: unknown): string | undefined {
  if (typeof value !== "string") return;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.port) return;
    if (!["youtube.com", "www.youtube.com", "www.youtube-nocookie.com", "youtube-nocookie.com", "youtu.be"].includes(url.hostname)) return;
    const [kind, part] = url.pathname.split("/").filter(Boolean);
    const id = url.hostname === "youtu.be" ? kind : kind === "watch" ? url.searchParams.get("v") : ["embed", "shorts", "live"].includes(kind ?? "") ? part : null;
    if (id && /^[\w-]{11}$/u.test(id)) return `https://www.youtube.com/watch?v=${id}`;
  } catch { return; }
}
