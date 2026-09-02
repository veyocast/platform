import type { Metadata } from "next";
import type { ReactNode } from "react";

import "@fontsource-variable/inter/wght.css";
import "@fontsource-variable/manrope/wght.css";
import "@veyocast/ui/styles.css";
import "./globals.css";
import "./fieldflow.css";
import { ControlPwaRuntime } from "./_components/control-pwa-runtime";

export const metadata: Metadata = {
  title: "VeyoCast Control",
  description: "Beheeromgeving voor VeyoCast platform- en tenantrollen",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "VeyoCast"
  },
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
    <html
      data-design-system="fieldflow"
      lang="nl"
      suppressHydrationWarning
    >
      <body>
        {children}
        <ControlPwaRuntime />
      </body>
    </html>
  );
}
