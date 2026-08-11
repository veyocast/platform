import type { CanonicalNewsArticle } from "@veyocast/contracts";

const entityPattern = /&(#x?[0-9a-f]+|amp|apos|gt|lt|quot);/gi;
const entityDeclarationPattern = /<!ENTITY\b/i;

export class RssParseError extends Error {
  readonly code = "rss_invalid_feed";

  constructor(message: string) {
    super(message);
    this.name = "RssParseError";
  }
}

export type ParsedNewsFeed = {
  articles: CanonicalNewsArticle[];
  media: {
    articleImages: Array<{ externalId: string; url: string }>;
    providerLogoUrl: string | null;
  };
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
  if (entityDeclarationPattern.test(xml)) {
    throw new RssParseError("XML-entitydeclaraties zijn niet toegestaan.");
  }
  const feedXml = stripInertFeedDoctypes(xml);
  assertFeedDocument(feedXml);
  const rootTitle =
    firstTag(feedXml, "channel") && firstTag(firstTag(feedXml, "channel")!, "title") ||
    firstTag(feedXml, "feed") && firstTag(firstTag(feedXml, "feed")!, "title") ||
    new URL(sourceUrl).hostname;
  const channel = firstTag(feedXml, "channel");
  const providerLogoUrl = resolveHttpUrl(
    channel
      ? firstTag(firstTag(channel, "image") ?? "", "url")
      : firstTag(firstTag(feedXml, "feed") ?? "", "logo"),
    sourceUrl
  );
  const itemBlocks = [
    ...feedXml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi)
  ].flatMap((match) => match[1] ? [match[1]] : []);
  const entryBlocks = [
    ...feedXml.matchAll(/<entry(?:\s[^>]*)?>([\s\S]*?)<\/entry>/gi)
  ].flatMap((match) => match[1] ? [match[1]] : []);
  const blocks = (itemBlocks.length ? itemBlocks : entryBlocks).slice(
    0,
    Math.min(50, Math.max(1, limit))
  );
  const candidates = blocks.flatMap((block, index) => {
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
    const imageUrl = rssImageUrl(block, sourceUrl);
    return [{
      article: {
        author: nullableText(
          firstTag(block, "author") ?? firstTag(block, "dc:creator")
        ),
        canonicalLink: canonicalArticleLink(link),
        externalId: externalId || `${link}#${index}`,
        heroMediaAssetId: null,
        intro: nullableText(
          firstTag(block, "description") ??
          firstTag(block, "summary") ??
          firstTag(block, "content")
        ),
        link,
        publishedAt,
        qrMediaAssetId: null,
        sourceName: cleanText(rootTitle ?? "") || new URL(sourceUrl).hostname,
        title
      } satisfies CanonicalNewsArticle,
      imageUrl
    }];
  });
  const uniqueCandidates = uniqueLatestArticles(candidates);
  const articles = uniqueCandidates.map((candidate) => candidate.article);
  const articleImages = uniqueCandidates.flatMap((candidate) =>
    candidate.imageUrl
      ? [{ externalId: candidate.article.externalId, url: candidate.imageUrl }]
      : []
  );
  if (!articles.length) {
    throw new RssParseError("De feed bevat geen bruikbare nieuwsartikelen.");
  }
  return {
    articles,
    media: {
      articleImages,
      providerLogoUrl
    },
    title: cleanText(rootTitle ?? "") || new URL(sourceUrl).hostname
  };
}

function uniqueLatestArticles<T extends {
  article: CanonicalNewsArticle;
  imageUrl: string | null;
}>(candidates: T[]): T[] {
  const latestByLink = new Map<string, T>();
  for (const candidate of candidates) {
    const current = latestByLink.get(candidate.article.canonicalLink);
    if (!current || articleTime(candidate.article) > articleTime(current.article)) {
      latestByLink.set(candidate.article.canonicalLink, candidate);
    }
  }
  return [...latestByLink.values()].sort(
    (left, right) => articleTime(right.article) - articleTime(left.article)
  );
}

function articleTime(article: CanonicalNewsArticle) {
  return article.publishedAt ? Date.parse(article.publishedAt) || 0 : 0;
}

export function canonicalArticleLink(value: string) {
  const url = new URL(value);
  url.hash = "";
  for (const key of [...url.searchParams.keys()]) {
    const normalized = key.toLowerCase();
    if (
      normalized.startsWith("utm_") ||
      ["fbclid", "gclid", "mc_cid", "mc_eid"].includes(normalized)
    ) {
      url.searchParams.delete(key);
    }
  }
  url.searchParams.sort();
  if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, "");
  return url.toString();
}

function stripInertFeedDoctypes(xml: string): string {
  let result = xml;
  let searchFrom = 0;
  for (;;) {
    const start = result.slice(searchFrom).search(/<!DOCTYPE\b/i);
    if (start < 0) return result;
    const declarationStart = searchFrom + start;
    let quote: "'" | "\"" | null = null;
    let hasInternalSubset = false;
    let declarationEnd = -1;

    for (let index = declarationStart + 9; index < result.length; index += 1) {
      const character = result[index];
      if (quote) {
        if (character === quote) quote = null;
        continue;
      }
      if (character === "'" || character === "\"") {
        quote = character;
        continue;
      }
      if (character === "[") hasInternalSubset = true;
      if (character === ">") {
        declarationEnd = index + 1;
        break;
      }
    }

    if (declarationEnd < 0 || hasInternalSubset) {
      throw new RssParseError(
        "Interne DTD-subsets en XML-entitydeclaraties zijn niet toegestaan."
      );
    }
    const declaration = result.slice(declarationStart, declarationEnd);
    if (!/^<!DOCTYPE\s+(?:rss|feed|rdf:RDF)\b/i.test(declaration)) {
      throw new RssParseError(
        "De URL verwijst naar een webpagina in plaats van een RSS- of Atom-feed."
      );
    }

    // This parser never resolves a DTD. Removing the inert declaration keeps
    // legacy RSS metadata compatible without permitting filesystem or network
    // entity expansion.
    result =
      result.slice(0, declarationStart) +
      result.slice(declarationEnd);
    searchFrom = declarationStart;
  }
}

function assertFeedDocument(xml: string) {
  const documentStart = xml
    .replace(/^\uFEFF/, "")
    .replace(/^\s*<\?xml[\s\S]*?\?>/i, "")
    .replace(/^(?:\s*<!--[\s\S]*?-->)*\s*/, "");
  const rootName = documentStart.match(/^<([A-Za-z_][\w.:-]*)\b/)?.[1]
    ?.toLowerCase();
  if (!rootName || !["feed", "rdf:rdf", "rss"].includes(rootName)) {
    throw new RssParseError(
      "De URL verwijst naar een webpagina in plaats van een RSS- of Atom-feed."
    );
  }
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

function rssImageUrl(block: string, sourceUrl: string): string | null {
  const mediaContent = block.match(
    /<media:content\b(?=[^>]*\b(?:medium=["']image["']|type=["']image\/[^"']+["']))(?=[^>]*\burl=["']([^"']+)["'])[^>]*\/?>/i
  )?.[1];
  const mediaThumbnail = block.match(
    /<media:thumbnail\b(?=[^>]*\burl=["']([^"']+)["'])[^>]*\/?>/i
  )?.[1];
  const enclosure = block.match(
    /<enclosure\b(?=[^>]*\btype=["']image\/[^"']+["'])(?=[^>]*\burl=["']([^"']+)["'])[^>]*\/?>/i
  )?.[1];
  const htmlImage = (
    firstTag(block, "description") ??
    firstTag(block, "content:encoded") ??
    firstTag(block, "content") ??
    ""
  ).match(/<img\b(?=[^>]*\bsrc=["']([^"']+)["'])[^>]*>/i)?.[1];
  return resolveHttpUrl(
    mediaContent ?? mediaThumbnail ?? enclosure ?? htmlImage,
    sourceUrl
  );
}

function resolveHttpUrl(
  value: string | null | undefined,
  baseUrl: string
): string | null {
  if (!value) return null;
  try {
    const url = new URL(decodeEntities(value.trim()), baseUrl);
    return isHttpUrl(url.toString()) ? url.toString() : null;
  } catch {
    return null;
  }
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
