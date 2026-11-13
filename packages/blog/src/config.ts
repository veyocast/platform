export type BlogConfig = { siteId: string; environment: string; publicOrigin: string; blogPath: "/blog" };

export function resolveBlogConfig(environment: Record<string, string | undefined> = process.env): BlogConfig {
  const stage = environment.VEYOCAST_ENVIRONMENT?.trim() || "development";
  if (!["development", "test", "staging", "production"].includes(stage)) throw new Error("Blogomgeving is ongeldig.");
  const siteId = environment.VEYOCAST_BLOG_SITE_ID?.trim() || "veyocast";
  if (!/^[a-z0-9][a-z0-9-]{0,62}$/u.test(siteId)) throw new Error("Blogwebsite-ID is ongeldig.");
  const candidate = environment.VEYOCAST_BLOG_PUBLIC_ORIGIN?.trim() || environment.NEXT_PUBLIC_MARKETING_URL?.trim()
    || (stage === "production" ? "https://veyocast.nl" : stage === "development" || stage === "test" ? "http://localhost:3002" : "");
  let url: URL;
  try { url = new URL(candidate); } catch { throw new Error("Stel de publieke blogorigin voor deze omgeving in."); }
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) && ["development", "test"].includes(stage);
  if ((!local && url.protocol !== "https:") || (local && !["https:", "http:"].includes(url.protocol)) || url.username || url.password || url.pathname !== "/" || url.search || url.hash) throw new Error("Gebruik een volledige HTTPS-origin zonder pad of meetparameters.");
  return { siteId, environment: stage, publicOrigin: url.origin, blogPath: "/blog" };
}
