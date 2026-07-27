import type { CanonicalNewsArticle } from "@veyocast/contracts";

const entityPattern = /&(#x?[0-9a-f]+|amp|apos|gt|lt|quot);/gi;
const blockedXmlPattern = /<!DOCTYPE|<!ENTITY|\bSYSTEM\b|\bPUBLIC\b/i;

export class RssParseError extends Error {
  readonly code = "rss_invalid_feed";

  constructor(message: string) {
    super(message);
    this.name = "RssParseError";
  }
}

export type ParsedNewsFeed = {
  articles: CanonicalNewsArticle[];
  title: string;
};

export function parseRssOrAtom(
  xml: string,
  sourceUrl: string,
  limit = 50
): ParsedNewsFeed {
  if (xml.length > 2_000_000) {
    throw new RssParseError("De feed is groter dan de veilige limiet.");
  }
  if (blockedXmlPattern.test(xml)) {
    throw new RssParseError("DTD- en entitydeclaraties zijn niet toegestaan.");
  }
  const rootTitle =
    firstTag(xml, "channel") && firstTag(firstTag(xml, "channel")!, "title") ||
    firstTag(xml, "feed") && firstTag(firstTag(xml, "feed")!, "title") ||
    new URL(sourceUrl).hostname;
  const itemBlocks = [
    ...xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi)
  ].flatMap((match) => match[1] ? [match[1]] : []);
  const entryBlocks = [
    ...xml.matchAll(/<entry(?:\s[^>]*)?>([\s\S]*?)<\/entry>/gi)
  ].flatMap((match) => match[1] ? [match[1]] : []);
  const blocks = (itemBlocks.length ? itemBlocks : entryBlocks).slice(
    0,
    Math.min(50, Math.max(1, limit))
  );
  const articles = blocks.flatMap((block, index) => {
    const title = cleanText(firstTag(block, "title") ?? "");
    const link = rssLink(block) ?? sourceUrl;
    if (!title || !isHttpUrl(link)) return [];
    const published = firstTag(block, "pubDate") ??
      firstTag(block, "published") ??
      firstTag(block, "updated");
    const publishedAt = published && !Number.isNaN(Date.parse(cleanText(published)))
      ? new Date(cleanText(published)).toISOString()
      : null;
    const externalId = cleanText(
      firstTag(block, "guid") ?? firstTag(block, "id") ?? link
    ).slice(0, 512);
    return [{
      author: nullableText(
        firstTag(block, "author") ?? firstTag(block, "dc:creator")
      ),
      externalId: externalId || `${link}#${index}`,
      heroMediaAssetId: null,
      intro: nullableText(
        firstTag(block, "description") ??
        firstTag(block, "summary") ??
        firstTag(block, "content")
      ),
      link,
      publishedAt,
      sourceName: cleanText(rootTitle ?? "") || new URL(sourceUrl).hostname,
      title
    } satisfies CanonicalNewsArticle];
  });
  if (!articles.length) {
    throw new RssParseError("De feed bevat geen bruikbare nieuwsartikelen.");
  }
  return {
    articles,
    title: cleanText(rootTitle ?? "") || new URL(sourceUrl).hostname
  };
}

function rssLink(block: string): string | null {
  const atomAlternate = block.match(
    /<link\b(?=[^>]*\brel=["']alternate["'])(?=[^>]*\bhref=["']([^"']+)["'])[^>]*\/?>/i
  )?.[1];
  const atomAny = block.match(
    /<link\b(?=[^>]*\bhref=["']([^"']+)["'])[^>]*\/?>/i
  )?.[1];
  return nullableText(atomAlternate ?? atomAny ?? firstTag(block, "link"));
}

function firstTag(xml: string, tag: string): string | null {
  const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return xml.match(
    new RegExp(`<${escaped}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${escaped}>`, "i")
  )?.[1] ?? null;
}

function nullableText(value: string | null): string | null {
  const text = cleanText(value ?? "");
  return text ? text.slice(0, 4_000) : null;
}

function cleanText(value: string): string {
  return decodeEntities(
    value
      .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/\s+/g, " ")
    .trim();
}

function decodeEntities(value: string): string {
  return value.replace(entityPattern, (_match, entity: string) => {
    const normalized = entity.toLowerCase();
    if (normalized === "amp") return "&";
    if (normalized === "apos") return "'";
    if (normalized === "gt") return ">";
    if (normalized === "lt") return "<";
    if (normalized === "quot") return '"';
    const hex = normalized.startsWith("#x");
    const code = Number.parseInt(normalized.slice(hex ? 2 : 1), hex ? 16 : 10);
    return Number.isFinite(code) && code >= 0 && code <= 0x10ffff
      ? String.fromCodePoint(code)
      : "";
  });
}

function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}
