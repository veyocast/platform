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
    apple: "/assets/sync-icon-192.png",
    icon: [
      { sizes: "any", type: "image/svg+xml", url: "/assets/brand-icon.svg" },
      { sizes: "192x192", type: "image/png", url: "/assets/sync-icon-192.png" }
    ]
  },
  other: {
    "mobile-web-app-capable": "yes"
  }
};

export const viewport: Viewport = {
  colorScheme: "dark",
  initialScale: 1,
  themeColor: "#071C1B",
  width: "device-width",
  viewportFit: "cover"
};

export default function RootLayout({
  children
}: Readonly<{ children: ReactNode }>) {
  return (
    <html data-design-system="fieldflow" data-veyocast-player-stage="document" lang="nl">
      <body>
        <script
          dangerouslySetInnerHTML={{ __html: playerClientFallbackScript }}
          id="veyocast-client-fallback-guard"
        />
        <div id="veyocast-client-fallback-host" />
        <ServiceWorkerRegistration />
        {children}
        <PlayerPwaControls />
      </body>
    </html>
  );
}
