import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { blogMediaUrl, blogUrl } from "../../../../lib/blog/config";
import { getBlogRedirect, publishedArticles } from "../../../../lib/blog/store";
import { BlogArticlePage } from "../_blog/blog-public";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const article = (await publishedArticles()).find((post) => post.slug === slug);
  if (!article) return { robots: { index: false, follow: false } };
  const title = article.seoTitle || `${article.title} | VeyoCast`;
  const description = article.seoDescription || article.excerpt;
  const url = blogUrl(slug);
  const image = blogMediaUrl(article.socialImage || article.hero.src);
  return {
    title, description, alternates: { canonical: url },
    openGraph: { type: "article", title, description, url, siteName: "VeyoCast", locale: article.locale.replace("-", "_"), publishedTime: article.publishedAt, modifiedTime: article.updatedAt, authors: undefined, images: image ? [{ url: image, alt: article.hero.alt }] : undefined },
    twitter: { card: "summary_large_image", title, description, images: image ? [image] : undefined },
  };
}

export default async function BlogArticle({ params }: Props) {
  const { slug } = await params;
  const articles = await publishedArticles();
  const article = articles.find((post) => post.slug === slug);
  if (!article) {
    const redirect = await getBlogRedirect(slug);
    if (redirect) permanentRedirect(`/blog/${redirect}`);
    notFound();
  }
  const image = blogMediaUrl(article.hero.src);
  const structured = {
    "@context": "https://schema.org", "@type": article.type === "blog" ? "BlogPosting" : "Article",
    headline: article.title, description: article.excerpt, inLanguage: article.locale,
    datePublished: article.publishedAt, dateModified: article.updatedAt,
    author: { "@type": article.author.toLowerCase().includes("veyocast") ? "Organization" : "Person", name: article.author },
    publisher: { "@type": "Organization", name: "VeyoCast" },
    image: image ? [image] : undefined, mainEntityOfPage: blogUrl(slug),
    articleSection: article.category, keywords: article.tags.join(", "),
  };
  const related = articles.filter((post) => post.id !== article.id).sort((a, b) => Number(b.category === article.category) - Number(a.category === article.category)).slice(0, 3);
  return <><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structured).replace(/</g, "\\u003c") }} /><BlogArticlePage article={article} related={related} canonicalUrl={blogUrl(slug)} /></>;
}
