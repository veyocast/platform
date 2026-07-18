import type { Metadata } from "next";
import type { ReactNode } from "react";

import "./globals.css";
import { ServiceWorkerRegistration } from "./_components/service-worker-registration";

export const metadata: Metadata = {
  title: "VeyoCast Player",
  description: "VeyoCast player plane"
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
