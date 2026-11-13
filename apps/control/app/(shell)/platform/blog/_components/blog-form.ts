import type { ArticleDraft, BlogEntry } from "@veyocast/blog";

export const emptyDraft: ArticleDraft = {
  type: "blog", locale: "nl-NL", title: "", slug: "", excerpt: "",
  content: { type: "doc", content: [{ type: "paragraph" }] },
  seoTitle: "", seoDescription: "", authorId: "redactie", categoryId: "narrowcasting", tags: [],
  hero: { assetId: "", alt: "", focalPoint: { x: 0.5, y: 0.5 } }, ogImageAssetId: null
};

export function articleStatus(entry: BlogEntry): "draft" | "live" | "revision" {
  return entry.publishedRevision === null ? "draft" : entry.draftRevision === entry.publishedRevision ? "live" : "revision";
}

export function toSlug(value: string) {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 100).replace(/-$/, "");
}

export function ownImageUrl(value: string) {
  const trimmed = value.trim();
  return /^\/api\/blog\/media\/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(trimmed) ? trimmed : "";
}

export function mediaUrl(assetId: string | null | undefined) {
  return assetId ? ownImageUrl(`/api/blog/media/${assetId}`) : "";
}

export function hasArticleContent(node: ArticleDraft["content"]): boolean {
  return Boolean(node.text?.trim() || ["image", "youtube"].includes(node.type ?? "") || node.content?.some(hasArticleContent));
}
