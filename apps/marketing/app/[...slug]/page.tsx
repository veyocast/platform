import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { marketingPages, getMarketingPage } from "../_content/pages";
import { SeoPageShell } from "../_components/seo-page";
import { canonicalUrl, isPublicIndexEnvironment } from "../_lib/site-config";

type RouteProps = {
  params: Promise<{ slug: string[] }>;
};

function pathnameFromSlug(slug: string[]) {
  return `/${slug.join("/")}`;
}

export const dynamicParams = false;

export function generateStaticParams() {
  return marketingPages.map((page) => ({
    slug: page.pathname.split("/").filter(Boolean)
  }));
}

export async function generateMetadata({ params }: RouteProps): Promise<Metadata> {
  const { slug } = await params;
  const page = getMarketingPage(pathnameFromSlug(slug));
  if (!page) return {};

  const url = canonicalUrl(page.pathname);
  const shouldIndex = isPublicIndexEnvironment() && page.index;

  return {
    alternates: { canonical: url },
    description: page.description,
    openGraph: {
      description: page.description,
      locale: "nl_NL",
      title: `${page.title} | VeyoCast`,
      type: page.kind === "article" ? "article" : "website",
      url
    },
    robots: {
      follow: shouldIndex,
      index: shouldIndex
    },
    title: `${page.title} | VeyoCast`
  };
}

export default async function MarketingContentPage({ params }: RouteProps) {
  const { slug } = await params;
  const page = getMarketingPage(pathnameFromSlug(slug));

  if (!page) notFound();

  return <SeoPageShell page={page} />;
}
