import type { MetadataRoute } from "next";
import { blogSiteOrigin, blogUrl } from "../lib/blog/config";
import { publishedArticles } from "../lib/blog/store";

export const dynamic = "force-dynamic";
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  return [{ url: `${blogSiteOrigin}/website` }, { url: `${blogSiteOrigin}/blog` },
    ...(await publishedArticles()).map((article) => ({ url: blogUrl(article.slug), lastModified: article.updatedAt }))];
}
