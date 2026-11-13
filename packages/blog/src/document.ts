import { getSchema } from "@tiptap/core";
import { Node } from "@tiptap/pm/model";
import { z } from "zod";
import { getBlogExtensions } from "./extensions";
import { blogAssetPattern, blogYoutubeUrl, safeBlogUrl } from "./urls";
import type { ArticleDraft, BlogNode } from "./types";

export class BlogValidationError extends Error {
  readonly code = "INVALID_REQUEST";
  constructor(message = "De artikelinhoud is ongeldig. Controleer de velden en probeer opnieuw.") { super(message); this.name = "BlogValidationError"; }
}

const attrsByNode: Record<string, string[]> = {
  doc: [], text: [], paragraph: ["textAlign"], heading: ["level", "textAlign"],
  bulletList: [], orderedList: ["start", "type"], listItem: [], taskList: [], taskItem: ["checked"],
  blockquote: [], codeBlock: ["language"], horizontalRule: [], hardBreak: [],
  image: ["assetId", "src", "alt", "title", "width", "height"],
  table: [], tableRow: [], tableHeader: ["colspan", "rowspan", "colwidth", "align"], tableCell: ["colspan", "rowspan", "colwidth", "align"],
  youtube: ["src", "start", "width", "height"]
};
const plainMarks = new Set(["bold", "italic", "underline", "strike", "code"]);
let schema: ReturnType<typeof getSchema> | undefined;
function plain(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function fail(message?: string): never { throw new BlogValidationError(message); }

export function validateBlogDocument(value: unknown): BlogNode {
  if (!plain(value) || value.type !== "doc" || new TextEncoder().encode(JSON.stringify(value)).byteLength > 250_000) fail();
  let count = 0;
  function walk(node: unknown, depth: number): void {
    if (++count > 5000 || depth > 24 || !plain(node) || typeof node.type !== "string") fail();
    const allowed = attrsByNode[node.type];
    if (!allowed || Object.keys(node).some((key) => !["type", "text", "content", "marks", "attrs"].includes(key))) fail();
    const attrs = node.attrs ?? {};
    if (!plain(attrs) || Object.keys(attrs).some((key) => !allowed.includes(key))) fail();
    if (node.type === "text" && (typeof node.text !== "string" || node.text.length > 40_000)) fail();
    if (node.type !== "text" && node.text !== undefined) fail();
    if (attrs.textAlign != null && !["left", "center", "right"].includes(String(attrs.textAlign))) fail();
    if (attrs.align != null && !["left", "center", "right"].includes(String(attrs.align))) fail();
    if (node.type === "heading" && ![2, 3, 4].includes(Number(attrs.level))) fail("Gebruik koppen van niveau 2 tot en met 4 in de artikelinhoud.");
    if (attrs.language != null && !/^[a-z0-9_+-]{1,40}$/iu.test(String(attrs.language))) fail();
    for (const key of ["width", "height", "colspan", "rowspan", "start"]) {
      if (attrs[key] != null && (!Number.isSafeInteger(attrs[key]) || Number(attrs[key]) < (key === "start" ? 0 : 1) || Number(attrs[key]) > (key === "colspan" || key === "rowspan" ? 50 : 10000))) fail();
    }
    if (attrs.checked != null && typeof attrs.checked !== "boolean") fail();
    if (attrs.colwidth != null && (!Array.isArray(attrs.colwidth) || attrs.colwidth.length > 50 || attrs.colwidth.some((width) => !Number.isInteger(width) || Number(width) < 0 || Number(width) > 10000))) fail();
    if (node.type === "image") {
      const match = typeof attrs.src === "string" && blogAssetPattern.exec(attrs.src);
      if (!match || attrs.assetId !== match[1] || typeof attrs.alt !== "string" || !attrs.alt.trim() || attrs.alt.length > 300 || (attrs.title != null && (typeof attrs.title !== "string" || attrs.title.length > 300))) fail("Gebruik een eigen geüploade afbeelding met een beschrijvende alt-tekst.");
    }
    if (node.type === "youtube" && blogYoutubeUrl(attrs.src) !== attrs.src) fail("Gebruik het canonieke YouTube-adres voor deze video.");
    if (node.marks !== undefined) {
      if (!Array.isArray(node.marks) || node.marks.length > 8) fail();
      for (const mark of node.marks) {
        if (!plain(mark) || Object.keys(mark).some((key) => !["type", "attrs"].includes(key))) fail();
        if (mark.type === "link") {
          if (!plain(mark.attrs) || !safeBlogUrl(mark.attrs.href) || Object.keys(mark.attrs).some((key) => !["href", "target", "rel", "class", "title"].includes(key)) || mark.attrs.target != null || mark.attrs.rel != null || mark.attrs.class != null || (mark.attrs.title != null && (typeof mark.attrs.title !== "string" || mark.attrs.title.length > 300))) fail("Deze link is niet toegestaan. Gebruik een webadres of een interne link.");
        } else if (typeof mark.type !== "string" || !plainMarks.has(mark.type) || (mark.attrs != null && (!plain(mark.attrs) || Object.keys(mark.attrs).length))) fail();
      }
    }
    if (node.content !== undefined) {
      if (!Array.isArray(node.content)) fail();
      for (const child of node.content) walk(child, depth + 1);
    }
  }
  walk(value, 0);
  try {
    schema ??= getSchema(getBlogExtensions());
    const document = Node.fromJSON(schema, value);
    document.check();
  } catch { fail("De structuur van het artikel klopt niet. Controleer koppen, lijsten en tabellen."); }
  return value as BlogNode;
}

const draftSchema = z.object({
  type: z.enum(["blog", "article"]).default("blog"), locale: z.literal("nl-NL").default("nl-NL"),
  title: z.string().max(200), slug: z.string().min(1).max(160).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  excerpt: z.string().max(600), content: z.unknown(), seoTitle: z.string().max(200), seoDescription: z.string().max(600),
  authorId: z.literal("redactie").default("redactie"), categoryId: z.enum(["clubtv", "sponsoring", "schermen", "narrowcasting"]),
  tags: z.array(z.string().trim().min(1).max(60)).max(20),
  hero: z.object({ assetId: z.union([z.uuid(), z.literal("")]), alt: z.string().max(300), focalPoint: z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) }).strict() }).strict(),
  ogImageAssetId: z.uuid().nullable().default(null)
}).strict();

export function validateArticleDraft(value: unknown, publication = false): ArticleDraft {
  const result = draftSchema.safeParse(value);
  if (!result.success) fail(`Controleer de artikelvelden: ${[...new Set(result.error.issues.map((issue) => issue.path.join(".")))].slice(0, 5).join(", ")}.`);
  const draft = result.data;
  validateBlogDocument(draft.content);
  if (publication && (draft.title.trim().length < 3 || !draft.excerpt.trim() || !draft.seoTitle.trim() || !draft.seoDescription.trim() || !draft.hero.assetId || !draft.hero.alt.trim() || !hasBlogContent(draft.content as BlogNode))) fail("Een titel van minimaal drie tekens, samenvatting, SEO, artikelinhoud en een hero met alt-tekst zijn nodig om te publiceren.");
  return draft as ArticleDraft;
}

export function hasBlogContent(node: BlogNode): boolean {
  return Boolean(node.text?.trim() || ["image", "youtube"].includes(node.type ?? "") || node.content?.some(hasBlogContent));
}

export function blogDocumentAssetIds(node: BlogNode): string[] {
  return [...new Set([...(node.type === "image" && typeof node.attrs?.assetId === "string" ? [node.attrs.assetId] : []), ...(node.content ?? []).flatMap(blogDocumentAssetIds)])];
}
