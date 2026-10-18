import type { Metadata } from "next";
import { SyncStructuredData } from "./_sync/structured-data";
import Marketing from "./_sync/Marketing";
import { marketingPages } from "./_sync/pages";
import { canonicalUrl, siteConfig } from "./_lib/site-config";

export const metadata: Metadata = {
  alternates: { canonical: canonicalUrl("/") },
  description: marketingPages["/"]!.description,
  openGraph: {
    description: marketingPages["/"]!.description,
    locale: "nl_NL",
    title: marketingPages["/"]!.title,
    type: "website",
    url: canonicalUrl("/")
  },
  title: marketingPages["/"]!.title
};

export default function HomePage() {
  return <><SyncStructuredData path="/" /><Marketing page="/" appHref={siteConfig.controlOrigin} playerHref={siteConfig.playerOrigin}/></>;
}
