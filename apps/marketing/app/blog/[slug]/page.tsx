import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";

import { JsonLd } from "../../_components/json-ld";
import { blogCanonicalUrl, getPublishedBlogPost, getPublishedBlogPosts } from "../../_lib/blog-source";
import { BlogArticlePage } from "../_blog/blog-public";
import { articleMetadata, articlePath, articleStructuredData } from "../_blog/metadata";

type DetailPageProps = {
  params: Promise<{ slug: string }>;
};

export const dynamic = "force-dynamic";
export const dynamicParams = true;

export async function generateMetadata({
  params
}: DetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const result = await getPublishedBlogPost(slug);
  return result ? articleMetadata(result.article) : { robots: { index: false, follow: false } };
}

export default async function BlogDetailPage({ params }: DetailPageProps) {
  const { slug } = await params;
  const result = await getPublishedBlogPost(slug);
  if (!result) notFound();
  const { article, redirectTo } = result;
  if (redirectTo) permanentRedirect(articlePath(article));
  const related = (await getPublishedBlogPosts())
    .filter((post) => post.id !== article.id)
    .sort((a, b) => Number(b.category === article.category) - Number(a.category === article.category))
    .slice(0, 3);
  return <><JsonLd data={articleStructuredData(article)} /><BlogArticlePage article={article} related={related} canonicalUrl={blogCanonicalUrl(articlePath(article))} /></>;
}
