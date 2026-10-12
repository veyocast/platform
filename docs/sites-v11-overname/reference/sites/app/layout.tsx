import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VeyoCast — Control",
  description: "VeyoCast FieldFlow — interactieve UI/UX-demonstratie van je narrowcastingplatform.",
  icons: {
    icon: "/brand/veyocast-favicon.svg",
    shortcut: "/brand/veyocast-favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="nl" data-design-system="fieldflow">
      <body>{children}</body>
    </html>
  );
}
