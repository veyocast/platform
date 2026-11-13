import type { JSONContent } from "@tiptap/react";
import { z } from "zod";

const imageSource = z.string().max(300).refine((value) => !value || /^\/(?:api\/blog-demo\/media\/[a-f0-9-]{36}|assets\/[a-z\d/_\-.]+|blog-assets\/[a-z\d/_\-.]+|fieldflow\/[a-z\d/_\-.]+|marketing-assets\/[a-z\d/_\-.]+)$/i.test(value));

const nodeNames = new Set([
  "doc", "paragraph", "heading", "text", "blockquote", "bulletList", "orderedList",
  "listItem", "taskList", "taskItem", "hardBreak", "horizontalRule", "codeBlock",
  "image", "youtube", "table", "tableRow", "tableHeader", "tableCell",
]);
const markNames = new Set(["bold", "italic", "strike", "underline", "link", "code"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function validNode(value: unknown, depth = 0): boolean {
  if (!isRecord(value) || typeof value.type !== "string" || !nodeNames.has(value.type) || depth > 35) return false;
  if (value.text !== undefined && typeof value.text !== "string") return false;
  if (value.attrs !== undefined && !isRecord(value.attrs)) return false;
  if (value.marks !== undefined && (!Array.isArray(value.marks) ||
      !value.marks.every((mark: unknown) => isRecord(mark) && typeof mark.type === "string" &&
        markNames.has(mark.type) && (mark.attrs === undefined || isRecord(mark.attrs))))) return false;
  return value.content === undefined || (Array.isArray(value.content) &&
    value.content.every((child: unknown) => validNode(child, depth + 1)));
}

export function hasArticleContent(node: JSONContent): boolean {
  return Boolean(node.text?.trim() || node.type === "image" || node.type === "youtube" || node.content?.some(hasArticleContent));
}

export const draftSchema = z.object({
  title: z.string().trim().min(1).max(160),
  slug: z.string().trim().min(1).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  excerpt: z.string().trim().max(360),
  content: z.custom<JSONContent>((value) => isRecord(value) && value.type === "doc" && validNode(value) && JSON.stringify(value).length <= 95_000),
  locale: z.string().trim().regex(/^[a-z]{2}(?:-[A-Z]{2})?$/),
  author: z.string().trim().max(100),
  category: z.string().trim().max(100),
  tags: z.array(z.string().trim().min(1).max(50)).max(20),
  type: z.enum(["blog", "article"]),
  seoTitle: z.string().trim().max(160),
  seoDescription: z.string().trim().max(320),
  hero: z.object({ src: imageSource, alt: z.string().trim().max(250), x: z.number().min(0).max(1), y: z.number().min(0).max(1) }),
  socialImage: imageSource,
});

export type ArticleDraft = z.infer<typeof draftSchema>;
