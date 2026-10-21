import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import "@fontsource-variable/inter/wght.css";
import "@fontsource-variable/manrope/wght.css";

import { JsonLd } from "./_components/json-ld";
import { MarketingChrome } from "./_sync/chrome";
import {
  canonicalUrl,
  isPublicIndexEnvironment,
  marketingOpenGraphImages,
  siteConfig
} from "./_lib/site-config";

import "./globals.css";
import "./_sync/runtime.css";
import "./_sync/accessibility.css";
import "./_sync/retained.css";

export const metadata: Metadata = {
  applicationName: "VeyoCast",
  category: "business",
  creator: "DG Webservices",
  icons: {
    apple: "/assets/sync-icon-192.png",
    icon: [
      { sizes: "any", type: "image/svg+xml", url: "/assets/brand-icon.svg" },
      { sizes: "192x192", type: "image/png", url: "/assets/sync-icon-192.png" }
    ]
  },
  metadataBase: new URL(siteConfig.productionOrigin),
  openGraph: {
    images: marketingOpenGraphImages,
    locale: "nl_NL",
    siteName: "VeyoCast",
    type: "website"
  },
  publisher: "DG Webservices",
  robots: {
    follow: isPublicIndexEnvironment(),
    index: isPublicIndexEnvironment()
  },
  title: {
    default: "VeyoCast | ClubTV en narrowcasting",
    template: "%s"
  },
  twitter: {
    card: "summary_large_image",
    images: ["/assets/brand-hero-1254.webp"]
  }
};

export const viewport: Viewport = {
  colorScheme: "light",
  themeColor: "#123332",
  width: "device-width"
};

export default function RootLayout({
  children
}: Readonly<{ children: ReactNode }>) {
  return (
    <html data-design-system="fieldflow" lang="nl-NL">
      <body>
        <MarketingChrome controlOrigin={siteConfig.controlOrigin}>{children}</MarketingChrome>
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@type": "WebPage",
            inLanguage: "nl-NL",
            isPartOf: {
              "@type": "WebSite",
              name: "VeyoCast",
              url: canonicalUrl("/")
            }
          }}
        />
      </body>
    </html>
  );
}
