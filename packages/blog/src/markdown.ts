import { marked, type Token, type Tokens } from "marked";
import { BlogValidationError, validateArticleDraft, validateBlogDocument } from "./document";
import { blogAssetPattern, safeBlogUrl } from "./urls";
import type { ArticleDraft, BlogNode } from "./types";

function reject(): never { throw new BlogValidationError("Deze Markdown bevat niet-ondersteunde opmaak of een onveilige link. Controleer de artikelinhoud."); }
function inline(tokens: Token[] = []): BlogNode[] {
  return tokens.flatMap((token): BlogNode[] => {
    switch (token.type) {
      case "checkbox": return [];
      case "text": case "escape": return "tokens" in token && Array.isArray(token.tokens) ? inline(token.tokens) : [{ type: "text", text: token.text }];
      case "strong": case "em": case "del": {
        const mark = token.type === "strong" ? "bold" : token.type === "em" ? "italic" : "strike";
        return inline((token as Tokens.Strong).tokens).map((node) => ({ ...node, marks: [...(node.marks ?? []), { type: mark }] }));
      }
      case "codespan": return [{ type: "text", text: token.text, marks: [{ type: "code" }] }];
      case "br": return [{ type: "hardBreak" }];
      case "link": {
        const link = token as Tokens.Link;
        const href = safeBlogUrl(link.href); if (!href) reject();
        return inline(link.tokens).map((node) => ({ ...node, marks: [...(node.marks ?? []), { type: "link", attrs: { href } }] }));
      }
      case "image": {
        const image = token as Tokens.Image; const match = blogAssetPattern.exec(image.href);
        if (!match || !image.text.trim()) reject();
        return [{ type: "image", attrs: { src: image.href, assetId: match[1], alt: image.text, title: image.title || null } }];
      }
      default: return reject();
    }
  }).filter((node) => node.type !== "text" || Boolean(node.text));
}
function blocks(tokens: Token[] = []): BlogNode[] {
  return tokens.flatMap((token): BlogNode[] => {
    switch (token.type) {
      case "checkbox": return [];
      case "space": return [];
      case "paragraph": case "text": {
        const nodes = inline("tokens" in token && Array.isArray(token.tokens) ? token.tokens : [{ type: "text", raw: token.raw, text: token.text }]);
        // Images are block nodes in the shared TipTap schema.
        const result: BlogNode[] = []; let paragraph: BlogNode[] = [];
        for (const node of nodes) {
          if (node.type === "image") { if (paragraph.length) result.push({ type: "paragraph", content: paragraph }); paragraph = []; result.push(node); }
          else paragraph.push(node);
        }
        if (paragraph.length) result.push({ type: "paragraph", content: paragraph });
        return result;
      }
      case "heading": return [{ type: "heading", attrs: { level: Math.max(2, Math.min(4, token.depth)) }, content: inline(token.tokens) }];
      case "blockquote": return [{ type: "blockquote", content: blocks(token.tokens) }];
      case "hr": return [{ type: "horizontalRule" }];
      case "code": return [{ type: "codeBlock", attrs: { language: token.lang || null }, ...(token.text ? { content: [{ type: "text", text: token.text }] } : {}) }];
      case "list": {
        const list = token as Tokens.List; const tasks = list.items.some((item) => item.task);
        if (tasks && list.items.some((item) => !item.task)) reject();
        return [{ type: tasks ? "taskList" : list.ordered ? "orderedList" : "bulletList", ...(list.ordered ? { attrs: { start: list.start || 1 } } : {}), content: list.items.map((item) => ({ type: tasks ? "taskItem" : "listItem", ...(tasks ? { attrs: { checked: Boolean(item.checked) } } : {}), content: blocks(item.tokens) })) }];
      }
      case "table": {
        const table = token as Tokens.Table;
        const row = (cells: Tokens.TableCell[], header: boolean): BlogNode => ({ type: "tableRow", content: cells.map((cell) => ({ type: header ? "tableHeader" : "tableCell", content: [{ type: "paragraph", content: inline(cell.tokens) }] })) });
        return [{ type: "table", content: [row(table.header, true), ...table.rows.map((cells) => row(cells, false))] }];
      }
      default: return reject();
    }
  });
}
export function blogMarkdownToDocument(body: string): BlogNode {
  if (body.length > 200_000) reject();
  const content = blocks(marked.lexer(body, { gfm: true }));
  return validateBlogDocument({ type: "doc", content: content.length ? content : [{ type: "paragraph" }] });
}

export function socialHeroDraft(value: unknown): ArticleDraft {
  if (!value || typeof value !== "object" || Array.isArray(value)) reject();
  const input = value as Record<string, unknown>;
  const allowed = ["type", "locale", "title", "slug", "excerpt", "content", "seo", "authorId", "categoryId", "tags", "hero", "ogImageAssetId"];
  if (Object.keys(input).some((key) => !allowed.includes(key))) reject();
  const content = input.content as Record<string, unknown> | null;
  let document: BlogNode;
  if (content?.format === "markdown" && typeof content.body === "string") document = blogMarkdownToDocument(content.body);
  else if (content?.format === "tiptap") document = validateBlogDocument(content.body);
  else reject();
  if (!content || Object.keys(content).some((key) => !["format", "body"].includes(key))) reject();
  const seo = input.seo as Record<string, unknown> | null;
  if (!seo || typeof seo !== "object" || Array.isArray(seo) || Object.keys(seo).some((key) => !["title", "description"].includes(key))) reject();
  const fields = { ...input }; delete fields.seo;
  return validateArticleDraft({ ...fields, content: document, seoTitle: seo.title, seoDescription: seo.description, ogImageAssetId: input.ogImageAssetId ?? null });
}
