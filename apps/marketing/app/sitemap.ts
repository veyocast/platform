import type { MetadataRoute } from "next";

import { sitemapPages } from "./_content/pages";
import { canonicalUrl } from "./_lib/site-config";
import { blogCanonicalUrl, getPublishedBlogPosts } from "./_lib/blog-source";
import { marketingPages as syncPages } from "./_sync/pages";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date("2026-07-24T00:00:00.000Z");
  const routes = [...new Set([
    "/",
    ...sitemapPages.map((page) => page.pathname),
    "/privacy",
    "/account-verwijderen",
    "/data-verwijderen"
    , ...Object.keys(syncPages).filter(path => path !== "/").map(path => path.replace(/\/$/, ""))
  ])];

  const articles = await getPublishedBlogPosts();
  const lastBlogChange = articles.reduce((latest, article) => article.updatedAt > latest ? article.updatedAt : latest, "");
  return [...routes.map<MetadataRoute.Sitemap[number]>((pathname) => ({
    changeFrequency: pathname.startsWith("/kennisbank") ? "monthly" : "weekly",
    lastModified: now,
    priority: pathname === "/" ? 1 : pathname.split("/").length === 2 ? 0.8 : 0.7,
    url: canonicalUrl(pathname)
  })), {
    changeFrequency: "weekly" as const,
    lastModified: lastBlogChange || now,
    priority: 0.8,
    url: blogCanonicalUrl("/blog")
  }, ...articles.map((article) => ({
    changeFrequency: "monthly" as const,
    lastModified: article.updatedAt,
    priority: 0.7,
    url: blogCanonicalUrl(`/blog/${encodeURIComponent(article.slug)}`)
  }))];
}
