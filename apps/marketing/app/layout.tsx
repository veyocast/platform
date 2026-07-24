import type { Metadata, Viewport } from "next";
import { Inter, Inter_Tight } from "next/font/google";
import type { ReactNode } from "react";

import { JsonLd } from "./_components/json-ld";
import { MarketingHeader } from "./_components/marketing-header";
import { MarketingFooter } from "./_components/site-chrome";
import {
  canonicalUrl,
  isPublicIndexEnvironment,
  siteConfig
} from "./_lib/site-config";

import "./globals.css";

const inter = Inter({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-inter"
});

const interTight = Inter_Tight({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-inter-tight"
});

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
        height: 1024,
        url: "/brand/veyocast-social-avatar-1024.png",
        width: 1024
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
    images: ["/brand/veyocast-social-avatar-1024.png"]
  }
};

export const viewport: Viewport = {
  colorScheme: "dark",
  themeColor: "#080808",
  width: "device-width"
};

export default function RootLayout({
  children
}: Readonly<{ children: ReactNode }>) {
  return (
    <html className={`${inter.variable} ${interTight.variable}`} lang="nl-NL">
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
