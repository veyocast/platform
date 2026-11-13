import "server-only";

import { cache } from "react";
import { blogDocumentAssetIds, resolveBlogConfig, validateArticleDraft, type BlogArticle, type ArticleDraft } from "@veyocast/blog";
import { hasBlogPublicBackend, publicBlogRows } from "@veyocast/blog/server";

type Publication = { id: string; external_id: string; revision: number; payload: unknown; slug: string; published_at: string; first_published_at: string; updated_at: string };
type Asset = { id: string; width: number; height: number; type: string };

export function blogCanonicalUrl(path: string) {
  if (!/^\/(?!\/)/u.test(path) || [...path].some((character) => character.charCodeAt(0) <= 32 || character === "\\")) throw new Error("Ongeldig blogpad.");
  return `${resolveBlogConfig().publicOrigin}${path === "/" ? "" : path}`;
}
export function blogImageUrl(assetId: string) { return `/api/blog/media/${encodeURIComponent(assetId.toLowerCase())}`; }

function parameters(select: string) {
  const config = resolveBlogConfig();
  return new URLSearchParams({ select, site_id: `eq.${config.siteId}`, environment: `eq.${config.environment}` });
}
async function articles(rows: Publication[]): Promise<BlogArticle[]> {
  const drafts = rows.map((row) => validateArticleDraft(row.payload, true));
  const ids = [...new Set(drafts.flatMap((draft) => [draft.hero.assetId, ...(draft.ogImageAssetId ? [draft.ogImageAssetId] : []), ...blogDocumentAssetIds(draft.content)]).map((id) => id.toLowerCase()))];
  const assets = new Map<string, Asset>();
  for (let offset = 0; offset < ids.length; offset += 100) {
    const query = parameters("id,width,height,type"); query.set("id", `in.(${ids.slice(offset, offset + 100).join(",")})`);
    for (const asset of await publicBlogRows<Asset>("platform_blog_assets", query)) assets.set(asset.id.toLowerCase(), asset);
  }
  const image = (id: string) => {
    const asset = assets.get(id.toLowerCase()); if (!asset) throw new Error("Gepubliceerd blogbeeld is niet beschikbaar.");
    return { src: blogImageUrl(id), width: asset.width, height: asset.height, type: asset.type };
  };
  return rows.map((row, index) => {
    const draft = drafts[index] as ArticleDraft;
    return {
      id: row.id, externalId: row.external_id, revision: row.revision, type: draft.type, locale: draft.locale,
      title: draft.title, slug: row.slug, excerpt: draft.excerpt, content: draft.content, seoTitle: draft.seoTitle, seoDescription: draft.seoDescription,
      author: draft.authorId === "redactie" ? "VeyoCast" : draft.authorId, category: draft.categoryId, tags: draft.tags,
      hero: { ...image(draft.hero.assetId), assetId: draft.hero.assetId, alt: draft.hero.alt, x: draft.hero.focalPoint.x, y: draft.hero.focalPoint.y },
      socialImage: draft.ogImageAssetId ? image(draft.ogImageAssetId) : null,
      publishedAt: row.first_published_at, updatedAt: row.updated_at
    };
  });
}

export const getPublishedBlogPosts = cache(async (): Promise<BlogArticle[]> => {
  if (!hasBlogPublicBackend()) return [];
  const rows: Publication[] = [];
  // PostgREST's default row cap must not silently truncate the list or sitemap.
  for (let offset = 0; offset < 50_000; offset += 500) {
    const query = parameters("id,external_id,revision,payload,slug,published_at,first_published_at,updated_at");
    query.set("order", "first_published_at.desc,id.asc"); query.set("limit", "500"); query.set("offset", String(offset));
    const batch = await publicBlogRows<Publication>("platform_blog_publications", query); rows.push(...batch);
    if (batch.length < 500) return articles(rows);
  }
  throw new Error("De blogsitemap vereist paginering over meerdere bestanden.");
});

export const getPublishedBlogPost = cache(async (slug: string): Promise<{ article: BlogArticle; redirectTo?: string } | null> => {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(slug) || slug.length > 160 || !hasBlogPublicBackend()) return null;
  const routes = parameters("post_id"); routes.set("slug", `eq.${slug}`); routes.set("was_published", "eq.true"); routes.set("limit", "1");
  const route = (await publicBlogRows<{ post_id: string }>("platform_blog_routes", routes))[0];
  if (!route) return null;
  const query = parameters("id,external_id,revision,payload,slug,published_at,first_published_at,updated_at"); query.set("id", `eq.${route.post_id}`); query.set("limit", "1");
  const result = await articles(await publicBlogRows<Publication>("platform_blog_publications", query));
  const article = result[0]; if (!article) return null;
  return { article, ...(article.slug !== slug ? { redirectTo: `/blog/${article.slug}` } : {}) };
});
