import { describe, expect, it } from "vitest";
import { getSchema } from "@tiptap/core";
import { getBlogExtensions } from "../src/extensions";
import { blogMarkdownToDocument, socialHeroDraft } from "../src/markdown";
import { validateArticleDraft, validateBlogDocument } from "../src/document";
import { resolveBlogConfig } from "../src/config";
import { safeBlogUrl } from "../src/urls";

const assetId = "31300000-0000-4000-8000-000000000001";
const draft = {
  type: "blog", locale: "nl-NL", title: "Een clubscherm op wedstrijddag", slug: "clubscherm-wedstrijddag", excerpt: "Een praktische aanpak.",
  content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Clubnieuws." }] }] },
  seoTitle: "Clubscherm op wedstrijddag | VeyoCast", seoDescription: "Praktische informatie voor de club.", authorId: "redactie", categoryId: "clubtv", tags: ["ClubTV"],
  hero: { assetId, alt: "Clubscherm boven de bar", focalPoint: { x: .5, y: .4 } }, ogImageAssetId: null
};

describe("shared blog document boundary", () => {
  it("roundtrips all authoring families through the actual extension schema", () => {
    const document = blogMarkdownToDocument("## Wedstrijddag\n\n**Nieuws** met [een link](/blog).\n\n- Een punt\n- Nog een punt\n\n> Een citaat\n\n---\n\n| Team | Tijd |\n| --- | --- |\n| Jeugd | 10:00 |\n\n- [x] Gereed\n\n```text\nEen voorbeeld\n```\n\n![Clubscherm](/api/blog/media/" + assetId + ")");
    const normalized = getSchema(getBlogExtensions()).nodeFromJSON(document).toJSON();
    expect(validateBlogDocument(normalized)).toEqual(normalized);
    expect(getSchema(getBlogExtensions()).nodeFromJSON(normalized).textContent).toContain("Wedstrijddag");
  });
  it.each(["javascript:alert(1)", "data:text/html,x", "//evil.example/x", "https://user:secret@example.test", "/\\evil.example", "java\nscript:alert(1)"])("rejects unsafe URL %s", (href) => {
    expect(safeBlogUrl(href)).toBeUndefined();
    expect(() => validateBlogDocument({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Link", marks: [{ type: "link", attrs: { href } }] }] }] })).toThrow();
  });
  it.each(["<script>alert(1)</script>", "[Klik](javascript:alert(1))", "![Extern](https://example.test/hero.jpg)"])("rejects executable or foreign markdown %s", (markdown) => {
    expect(() => blogMarkdownToDocument(markdown)).toThrow();
  });
  it("rejects unknown nodes, attributes, heading1 and invalid list trees", () => {
    for (const node of [{ type: "html", text: "<script>" }, { type: "paragraph", attrs: { onclick: "alert(1)" } }, { type: "heading", attrs: { level: 1 } }, { type: "listItem", content: [{ type: "text", text: "Broken" }] }]) {
      expect(() => validateBlogDocument({ type: "doc", content: [node] })).toThrow();
    }
  });
  it("rejects excessive depth and images without matching own identity/alt", () => {
    let node: unknown = { type: "paragraph" };
    for (let i = 0; i < 30; i++) node = { type: "blockquote", content: [node] };
    expect(() => validateBlogDocument({ type: "doc", content: [node] })).toThrow();
    for (const attrs of [{ assetId, src: "/api/blog/media/31300000-0000-4000-8000-000000000002", alt: "Club" }, { assetId, src: `/api/blog/media/${assetId}`, alt: "" }]) expect(() => validateBlogDocument({ type: "doc", content: [{ type: "image", attrs }] })).toThrow();
  });
  it("bounds multibyte documents by UTF-8 bytes before storage", () => {
    const paragraph = { type: "paragraph", content: [{ type: "text", text: "€".repeat(30_000) }] };
    const withinBudget = { type: "doc", content: [paragraph, paragraph] };
    const overBudget = { type: "doc", content: [paragraph, paragraph, paragraph] };
    expect(JSON.stringify(overBudget).length).toBeLessThan(250_000);
    expect(validateBlogDocument(withinBudget)).toEqual(withinBudget);
    expect(() => validateBlogDocument(overBudget)).toThrow();
  });
  it("allows a private incomplete draft but requires publication fields", () => {
    const incomplete = { ...draft, title: "", hero: { ...draft.hero, assetId: "", alt: "" } };
    expect(validateArticleDraft(incomplete)).toMatchObject({ title: "" });
    expect(() => validateArticleDraft(incomplete, true)).toThrow();
    expect(validateArticleDraft(draft, true)).toEqual(draft);
  });
  it("maps the actual SocialHero JSON contract into the same validated revision", () => {
    const { seoTitle, seoDescription, ...base } = draft;
    expect(socialHeroDraft({ ...base, content: { format: "markdown", body: "## Wedstrijddag\nEen praktische aanpak." }, seo: { title: seoTitle, description: seoDescription } })).toMatchObject({ title: draft.title, seoTitle, content: { type: "doc" } });
  });
});
describe("explicit website/environment configuration", () => {
  it("uses verified production and local origins and refuses an invented staging origin", () => {
    expect(resolveBlogConfig({ VEYOCAST_ENVIRONMENT: "production" }).publicOrigin).toBe("https://veyocast.nl");
    expect(resolveBlogConfig({}).publicOrigin).toBe("http://localhost:3002");
    expect(() => resolveBlogConfig({ VEYOCAST_ENVIRONMENT: "staging" })).toThrow();
    expect(() => resolveBlogConfig({ VEYOCAST_ENVIRONMENT: "production", VEYOCAST_BLOG_PUBLIC_ORIGIN: "http://127.0.0.1:3002" })).toThrow();
    expect(() => resolveBlogConfig({ VEYOCAST_BLOG_PUBLIC_ORIGIN: "https://example.test/blog?x=1" })).toThrow();
  });
});
