import type { BlogArticle, BlogNode } from "@veyocast/blog";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const source = vi.hoisted(() => ({ getPublishedBlogPost: vi.fn(), getPublishedBlogPosts: vi.fn() }));
vi.mock("../../_lib/blog-source", () => ({
  ...source,
  blogCanonicalUrl: (path: string) => `https://marketing-test.veyocast.nl${path === "/" ? "" : path}`,
  blogImageUrl: (id: string) => `/api/blog/media/${id}`
}));
vi.mock("../../_lib/site-config", () => ({
  canonicalUrl: (path: string) => `https://veyocast.nl${path === "/" ? "" : path}`,
  isPublicIndexEnvironment: () => false
}));
vi.mock("next/navigation", () => ({
  notFound: () => { throw new Error("NOT_FOUND"); },
  permanentRedirect: (path: string) => { throw new Error(`PERMANENT_REDIRECT:${path}`); }
}));

import sitemap, { dynamic as sitemapDynamic } from "../../sitemap";
import BlogDetailPage, { dynamic, dynamicParams, generateMetadata } from "../[slug]/page";
import { BlogContent } from "./blog-content";
import { BlogArticlePage, BlogIndexPage } from "./blog-public";
import { articleMetadata, articleStructuredData } from "./metadata";

const assetId = "11111111-1111-4111-8111-111111111111";
const assetSrc = `/api/blog/media/${assetId}`;
const article: BlogArticle = {
  id: "22222222-2222-4222-8222-222222222222", externalId: "campagne-42", revision: 7,
  type: "blog", locale: "nl-NL", title: "Clubschermen op wedstrijddag", slug: "clubschermen-op-wedstrijddag",
  excerpt: "Een praktisch draaiboek voor je clubschermen.",
  content: { type: "doc", content: [{ type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Begin met het programma" }] }, { type: "paragraph", content: [{ type: "text", text: "Controleer de teams en aanvangstijden." }] }] },
  seoTitle: "Clubschermen op wedstrijddag | VeyoCast", seoDescription: "Controleer het programma, je schermen en de sponsorcontent voor een heldere wedstrijddag.",
  author: "VeyoCast", category: "clubtv", tags: ["wedstrijddag"],
  hero: { assetId, src: assetSrc, alt: "Het programma op een clubscherm boven de bar", x: .55, y: .4, width: 800, height: 1000, type: "image/webp" },
  socialImage: null, publishedAt: "2026-11-13T10:00:00.000Z", updatedAt: "2026-11-13T11:00:00.000Z"
};

beforeEach(() => {
  vi.clearAllMocks();
  source.getPublishedBlogPosts.mockResolvedValue([article]);
  source.getPublishedBlogPost.mockResolvedValue({ article });
});

describe("published blog rendering", () => {
  it("keeps the prototype home route, category filter and empty state without demo content", () => {
    const empty = renderToStaticMarkup(<BlogIndexPage articles={[]} />);
    expect(empty).toContain('href="/"');
    expect(empty).not.toContain("/website");
    expect(empty).toContain("Hier staan nog geen artikelen.");
    const filtered = renderToStaticMarkup(<BlogIndexPage articles={[article]} category="sponsoring" />);
    expect(filtered).not.toContain(article.title);
    expect(filtered).toContain("Bekijk alle artikelen");
  });

  it("renders one title, semantic body headings and the stored portrait focus and alt text", () => {
    const html = renderToStaticMarkup(<BlogArticlePage article={article} canonicalUrl="https://marketing-test.veyocast.nl/blog/clubschermen-op-wedstrijddag" />);
    expect(html.match(/<h1(?:\s|>)/gu)).toHaveLength(1);
    expect(html).toContain("<h2>Begin met het programma</h2>");
    expect(html).toMatch(/object-position:55(?:\.0+1)?% 40%/u);
    expect(html).toContain(`alt="${article.hero.alt}"`);
    expect(html).toContain('width="800" height="1000"');
    expect(html.toLowerCase()).toContain(`datetime="${article.publishedAt.toLowerCase()}"`);
    expect(html).toContain("https%3A%2F%2Fmarketing-test.veyocast.nl%2Fblog%2Fclubschermen-op-wedstrijddag");
  });

  it("renders validated tables, task lists and own media as semantic React elements", () => {
    const text = (value: string) => ({ type: "text", text: value });
    const paragraph = (value: string) => ({ type: "paragraph", content: [text(value)] });
    const content: BlogNode = { type: "doc", content: [
      { type: "blockquote", content: [paragraph("Controleer je content.")] },
      { type: "taskList", content: [{ type: "taskItem", attrs: { checked: true }, content: [paragraph("Programma gecontroleerd")] }] },
      { type: "table", content: [{ type: "tableRow", content: [{ type: "tableHeader", content: [paragraph("Team")] }, { type: "tableCell", content: [paragraph("Eerste elftal")] }] }] },
      { type: "image", attrs: { assetId, src: assetSrc, alt: "De clubkantine", width: 800, height: 1000 } },
      { type: "paragraph", content: [{ type: "text", text: "Lees meer", marks: [{ type: "link", attrs: { href: "/clubtv" } }, { type: "bold" }] }] }
    ] };
    const html = renderToStaticMarkup(<BlogContent content={content} />);
    expect(html).toContain("<blockquote>");
    expect(html).toContain('type="checkbox"');
    expect(html).toContain("<table>");
    expect(html).toContain('scope="col"');
    expect(html).toContain(`src="${assetSrc}"`);
    expect(html).toContain("De clubkantine");
    expect(html).toContain('href="/clubtv"');
  });

  it.each([
    { type: "doc", content: [{ type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Tweede H1" }] }] },
    { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Klik", marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }] }] }] },
    { type: "doc", content: [{ type: "image", attrs: { src: "https://evil.example/image.svg", alt: "Extern" } }] }
  ])("fails closed for invalid rich text instead of passing authored HTML or URLs", (content) => {
    const html = renderToStaticMarkup(<BlogContent content={content} />);
    expect(html).toContain("De artikelinhoud is tijdelijk niet beschikbaar.");
    expect(html).not.toMatch(/javascript:|evil\.example|<h1|<img/u);
  });

  it("escapes text that resembles executable HTML", () => {
    const html = renderToStaticMarkup(<BlogContent content={{ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: '<script>alert("x")</script>' }] }] }} />);
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
  });
});

describe("blog metadata and runtime publication", () => {
  it("uses the test origin, publication identifiers and actual hero dimensions as the OG fallback", () => {
    const metadata = articleMetadata(article);
    expect(metadata.alternates?.canonical).toBe("https://marketing-test.veyocast.nl/blog/clubschermen-op-wedstrijddag");
    expect(metadata.robots).toEqual({ index: false, follow: false });
    expect(metadata.other).toEqual({ "socialhero:external-id": "campagne-42", "socialhero:revision": "7" });
    expect(metadata.openGraph).toMatchObject({ images: [{ url: `https://marketing-test.veyocast.nl${assetSrc}`, width: 800, height: 1000, type: "image/webp" }], publishedTime: article.publishedAt, modifiedTime: article.updatedAt });
    expect(articleStructuredData(article)).toMatchObject({ "@type": "BlogPosting", author: { name: "VeyoCast" }, mainEntityOfPage: metadata.alternates?.canonical, datePublished: article.publishedAt, dateModified: article.updatedAt });
  });

  it("uses the separately configured broad image and its actual dimensions", () => {
    const metadata = articleMetadata({ ...article, socialImage: { src: "/api/blog/media/33333333-3333-4333-8333-333333333333", width: 1200, height: 630, type: "image/jpeg" } });
    expect(metadata.openGraph).toMatchObject({ images: [{ url: "https://marketing-test.veyocast.nl/api/blog/media/33333333-3333-4333-8333-333333333333", width: 1200, height: 630, type: "image/jpeg" }] });
  });

  it("resolves a newly published slug and newer revision without static parameters or rebuild", async () => {
    expect(dynamic).toBe("force-dynamic");
    expect(dynamicParams).toBe(true);
    const params = Promise.resolve({ slug: article.slug });
    expect(renderToStaticMarkup(await BlogDetailPage({ params }))).toContain(article.title);
    source.getPublishedBlogPost.mockResolvedValue({ article: { ...article, revision: 8, title: "De bijgewerkte inhoud" } });
    const metadata = await generateMetadata({ params });
    expect(metadata.other?.["socialhero:revision"]).toBe("8");
    expect(renderToStaticMarkup(await BlogDetailPage({ params }))).toContain("De bijgewerkte inhoud");
  });

  it("returns a permanent redirect directly to the current slug and keeps unknown drafts private", async () => {
    source.getPublishedBlogPost.mockResolvedValueOnce({ article, redirectTo: article.slug });
    await expect(BlogDetailPage({ params: Promise.resolve({ slug: "oude-slug" }) })).rejects.toThrow(`PERMANENT_REDIRECT:/blog/${article.slug}`);
    source.getPublishedBlogPost.mockResolvedValueOnce(null);
    await expect(BlogDetailPage({ params: Promise.resolve({ slug: "concept" }) })).rejects.toThrow("NOT_FOUND");
  });

  it("adds only the current published route and its real revision date to a dynamic sitemap", async () => {
    expect(sitemapDynamic).toBe("force-dynamic");
    const entries = await sitemap();
    expect(entries).toContainEqual(expect.objectContaining({ url: "https://veyocast.nl/privacy" }));
    expect(entries).toContainEqual(expect.objectContaining({ url: "https://marketing-test.veyocast.nl/blog", lastModified: article.updatedAt }));
    expect(entries.filter(({ url }) => url.includes("/blog/"))).toEqual([{ changeFrequency: "monthly", lastModified: article.updatedAt, priority: .7, url: `https://marketing-test.veyocast.nl/blog/${article.slug}` }]);
  });
});
