import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import "@fontsource-variable/inter/wght.css";
import "@fontsource-variable/manrope/wght.css";

import { JsonLd } from "./_components/json-ld";
import { MarketingHeader } from "./_components/marketing-header";
import { MarketingFooter } from "./_components/site-chrome";
import {
  canonicalUrl,
  isPublicIndexEnvironment,
  siteConfig
} from "./_lib/site-config";

import "./globals.css";

export const metadata: Metadata = {
  applicationName: "VeyoCast",
  category: "business",
  creator: "DG Webservices",
  icons: {
    apple: "/brand/veyocast-apple-touch-icon-180.png",
    icon: [
      { sizes: "any", type: "image/svg+xml", url: "/brand/veyocast-favicon.svg" },
      { sizes: "32x32", type: "image/png", url: "/brand/veyocast-favicon-32.png" }
    ]
  },
  metadataBase: new URL(siteConfig.productionOrigin),
  openGraph: {
    images: [
      {
        alt: "VeyoCast",
        height: 630,
        url: "/fieldflow/photos/FF-PHOTO-01-clubhouse-exterior-og-1200x630.webp",
        width: 1200
      }
    ],
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
    images: ["/fieldflow/photos/FF-PHOTO-01-clubhouse-exterior-og-1200x630.webp"]
  }
};

export const viewport: Viewport = {
  colorScheme: "dark",
  themeColor: "#123332",
  width: "device-width"
};

export default function RootLayout({
  children
}: Readonly<{ children: ReactNode }>) {
  return (
    <html data-design-system="fieldflow" lang="nl-NL">
      <body>
        <a className="skip-link" href="#main-content">
          Naar de inhoud
        </a>
        <MarketingHeader controlOrigin={siteConfig.controlOrigin} />
        {children}
        <MarketingFooter />
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
