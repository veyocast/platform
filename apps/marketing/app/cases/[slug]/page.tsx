import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  findPublishedDetail,
  publishedCases
} from "../../_content/published-details";
import { SeoPageShell } from "../../_components/seo-page";
import { canonicalUrl } from "../../_lib/site-config";

type DetailPageProps = {
  params: Promise<{ slug: string }>;
};

export const dynamicParams = false;

export function generateStaticParams() {
  return publishedCases.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({
  params
}: DetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const page = findPublishedDetail(publishedCases, slug);
  if (!page) return {};

  return {
    alternates: { canonical: canonicalUrl(page.pathname) },
    description: page.description,
    openGraph: {
      description: page.description,
      locale: "nl_NL",
      title: `${page.title} | VeyoCast`,
      type: "article",
      url: canonicalUrl(page.pathname)
    },
    title: `${page.title} | VeyoCast`
  };
}

export default async function CaseDetailPage({ params }: DetailPageProps) {
  const { slug } = await params;
  const page = findPublishedDetail(publishedCases, slug);
  if (!page) notFound();

  return <SeoPageShell page={page} />;
}
