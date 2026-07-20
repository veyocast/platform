import type { Metadata } from "next";
import type { ReactNode } from "react";

import "./globals.css";
import { ServiceWorkerRegistration } from "./_components/service-worker-registration";

export const metadata: Metadata = {
  title: "VeyoCast Player",
  description: "VeyoCast player plane",
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
      <body>
        <ServiceWorkerRegistration />
        {children}
      </body>
    </html>
  );
}
