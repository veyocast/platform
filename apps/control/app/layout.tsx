import type { Metadata } from "next";
import type { ReactNode } from "react";

import "@veyocast/ui/styles.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "VeyoCast Control",
  description: "Beheeromgeving voor VeyoCast platform- en tenantrollen",
  icons: {
    apple: "/brand/veyocast-apple-touch-icon-180.png",
    icon: [
      { sizes: "any", type: "image/svg+xml", url: "/brand/veyocast-favicon.svg" },
      { sizes: "32x32", type: "image/png", url: "/brand/veyocast-favicon-32.png" }
    ]
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
