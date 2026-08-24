import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { marketingPages, getMarketingPage } from "../_content/pages";
import { SeoPageShell } from "../_components/seo-page";
import { canonicalUrl, isPublicIndexEnvironment } from "../_lib/site-config";
import {
  verifySetupIntentToken
} from "../_lib/setup-intent";
import { setupIntentSigningSecret } from "../_lib/setup-intent.server";

type RouteProps = {
  params: Promise<{ slug: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
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

export default async function MarketingContentPage({ params, searchParams }: RouteProps) {
  const { slug } = await params;
  const query = await searchParams;
  const page = getMarketingPage(pathnameFromSlug(slug));

  if (!page) notFound();

  const rawToken = page.kind === "demo" && typeof query.setup === "string" ? query.setup : null;
  const secret = rawToken ? setupIntentSigningSecret() : null;
  const setupIntent = rawToken && secret ? await verifySetupIntentToken(rawToken, secret) : null;
  const setupStatus =
    page.kind === "demo" &&
    (query.setup_status === "unavailable" || (rawToken && !setupIntent))
      ? "unavailable"
      : null;

  return (
    <SeoPageShell
      page={page}
      setupIntent={setupIntent}
      setupIntentToken={setupIntent ? rawToken : null}
      setupStatus={setupStatus}
    />
  );
}
