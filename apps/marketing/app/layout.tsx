import type { Metadata } from "next";
import type { ReactNode } from "react";

import "./globals.css";

export const metadata: Metadata = {
  title: "VeyoCast | ClubTV en narrowcasting voor beheerde schermen",
  description:
    "VeyoCast is een local-first MVP voor ClubTV, tenantbeheer, immutable releases en offline-first player playback.",
  icons: {
    apple: "/brand/veyocast-apple-touch-icon-180.png",
    icon: [
      { sizes: "any", type: "image/svg+xml", url: "/brand/veyocast-favicon.svg" },
      { sizes: "32x32", type: "image/png", url: "/brand/veyocast-favicon-32.png" }
    ]
  },
  metadataBase: new URL("https://veyocast.nl"),
  openGraph: {
    description:
      "Beheer media, publiceer vaste releases en laat schermen fullscreen doorspelen met offline fallback.",
    locale: "nl_NL",
    images: [
      {
        alt: "VeyoCast",
        height: 1024,
        url: "/brand/veyocast-social-avatar-1024.png",
        width: 1024
      }
    ],
    siteName: "VeyoCast",
    title: "VeyoCast | ClubTV en narrowcasting",
    type: "website"
  }
};

export default function RootLayout({
  children
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="nl">
      <body>{children}</body>
    </html>
  );
}
