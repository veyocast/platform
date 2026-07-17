import type { Metadata } from "next";
import type { ReactNode } from "react";

import "./globals.css";

export const metadata: Metadata = {
  title: "Castivo | ClubTV en narrowcasting voor beheerde schermen",
  description:
    "Castivo is een local-first MVP voor ClubTV, tenantbeheer, immutable releases en offline-first player playback.",
  metadataBase: new URL("https://castivo.local"),
  openGraph: {
    description:
      "Beheer media, publiceer vaste releases en laat schermen fullscreen doorspelen met offline fallback.",
    locale: "nl_NL",
    siteName: "Castivo",
    title: "Castivo | ClubTV en narrowcasting",
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
