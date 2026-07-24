import type { MetadataRoute } from "next";

import { sitemapPages } from "./_content/pages";
import { canonicalUrl } from "./_lib/site-config";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date("2026-07-24T00:00:00.000Z");
  const routes = [
    "/",
    ...sitemapPages.map((page) => page.pathname),
    "/privacy",
    "/data-verwijderen"
  ];

  return routes.map((pathname) => ({
    changeFrequency: pathname.startsWith("/kennisbank") ? "monthly" : "weekly",
    lastModified: now,
    priority: pathname === "/" ? 1 : pathname.split("/").length === 2 ? 0.8 : 0.7,
    url: canonicalUrl(pathname)
  }));
}
