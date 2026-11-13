import { safeBlogUrl, type BlogArticle } from "@veyocast/blog";
import type { Metadata } from "next";

import { blogCanonicalUrl } from "../../_lib/blog-source";
import { isPublicIndexEnvironment } from "../../_lib/site-config";

export function articlePath(article: BlogArticle) {
  return `/blog/${encodeURIComponent(article.slug)}`;
}

function absoluteImage(src: string) {
  const safe = safeBlogUrl(src, "image");
  return safe ? new URL(safe, blogCanonicalUrl("/")).href : undefined;
}

export function articleMetadata(article: BlogArticle): Metadata {
  const title = article.seoTitle || `${article.title} | VeyoCast`;
  const description = article.seoDescription || article.excerpt;
  const canonical = blogCanonicalUrl(articlePath(article));
  const asset = article.socialImage ?? article.hero;
  const image = absoluteImage(asset.src);
  return {
    title,
    description,
    authors: [{ name: article.author }],
    alternates: { canonical },
    robots: { index: isPublicIndexEnvironment(), follow: isPublicIndexEnvironment() },
    openGraph: {
      type: "article",
      title,
      description,
      url: canonical,
      siteName: "VeyoCast",
      locale: article.locale.replace("-", "_"),
      publishedTime: article.publishedAt,
      modifiedTime: article.updatedAt,
      images: image ? [{ url: image, width: asset.width, height: asset.height, type: asset.type, alt: article.socialImage ? article.title : article.hero.alt }] : []
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: image ? [{ url: image, alt: article.socialImage ? article.title : article.hero.alt }] : []
    },
    other: {
      ...(article.externalId ? { "socialhero:external-id": article.externalId } : {}),
      "socialhero:revision": String(article.revision)
    }
  };
}

export function articleStructuredData(article: BlogArticle) {
  const image = absoluteImage(article.hero.src);
  return {
    "@context": "https://schema.org",
    "@type": article.type === "blog" ? "BlogPosting" : "Article",
    headline: article.title,
    description: article.excerpt,
    inLanguage: article.locale,
    datePublished: article.publishedAt,
    dateModified: article.updatedAt,
    author: { "@type": article.author.toLowerCase().includes("veyocast") ? "Organization" : "Person", name: article.author },
    publisher: { "@type": "Organization", name: "VeyoCast" },
    image: image ? [{ "@type": "ImageObject", url: image, width: article.hero.width, height: article.hero.height, caption: article.hero.alt }] : undefined,
    mainEntityOfPage: blogCanonicalUrl(articlePath(article)),
    url: blogCanonicalUrl(articlePath(article)),
    articleSection: article.category,
    keywords: article.tags.join(", "),
    identifier: `${article.id}:${article.revision}`
  };
}
