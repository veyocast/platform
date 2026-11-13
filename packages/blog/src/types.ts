import type { JSONContent } from "@tiptap/core";

export type BlogNode = JSONContent;
export type ArticleDraft = {
  type: "blog" | "article"; locale: "nl-NL"; title: string; slug: string; excerpt: string;
  content: BlogNode; seoTitle: string; seoDescription: string; authorId: string; categoryId: string;
  tags: string[]; hero: { assetId: string; alt: string; focalPoint: { x: number; y: number } };
  ogImageAssetId: string | null;
};
export type BlogEntry = {
  id: string; externalId: string; draftRevision: number; publishedRevision: number | null;
  draft: ArticleDraft; publishedAt: string | null; updatedAt: string;
  publicUrl: string | null; publishedSlug: string | null;
};
export type BlogImage = { src: string; width: number; height: number; type: string };
export type BlogArticle = {
  id: string; externalId: string; revision: number; type: "blog" | "article"; locale: string;
  title: string; slug: string; excerpt: string; content: BlogNode; seoTitle: string; seoDescription: string;
  author: string; category: string; tags: string[];
  hero: BlogImage & { assetId: string; alt: string; x: number; y: number };
  socialImage: BlogImage | null; publishedAt: string; updatedAt: string;
};
