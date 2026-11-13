export const blogSiteOrigin = "https://veyocast-production-exact-20261027.dgwebserv.chatgpt.site";
export const blogBase = "/blog";

export function blogUrl(slug: string) {
  return new URL(`${blogBase}/${encodeURIComponent(slug)}`, blogSiteOrigin).href;
}

export function blogMediaUrl(source: string) {
  if (!source.startsWith("/") || source.startsWith("//")) return undefined;
  return new URL(source, blogSiteOrigin).href;
}
