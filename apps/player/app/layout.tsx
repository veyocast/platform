import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import "./globals.css";
import { PlayerPwaControls } from "./_components/player-pwa-controls";
import { ServiceWorkerRegistration } from "./_components/service-worker-registration";
import { playerClientFallbackScript } from "./_lib/player-client-fallback";

export const metadata: Metadata = {
  applicationName: "VeyoCast Player",
  title: "VeyoCast Player",
  description: "VeyoCast player plane",
  icons: {
    apple: "/brand/veyocast-apple-touch-icon-180.png",
    icon: [
      { sizes: "any", type: "image/svg+xml", url: "/brand/veyocast-favicon.svg" },
      { sizes: "32x32", type: "image/png", url: "/brand/veyocast-favicon-32.png" }
    ]
  },
  other: {
    "mobile-web-app-capable": "yes"
  }
};

export const viewport: Viewport = {
  colorScheme: "dark",
  initialScale: 1,
  themeColor: "#0A0A0A",
  width: "device-width",
  viewportFit: "cover"
};

export default function RootLayout({
  children
}: Readonly<{ children: ReactNode }>) {
  return (
    <html data-veyocast-player-stage="document" lang="nl">
      <body>
        <script
          dangerouslySetInnerHTML={{ __html: playerClientFallbackScript }}
          id="veyocast-client-fallback-guard"
        />
        <ServiceWorkerRegistration />
        {children}
        <PlayerPwaControls />
      </body>
    </html>
  );
}
