import type { MetadataRoute } from "next";

const atelierIvoryPwaColors = {
  background: "#F5F1E8",
  theme: "#151411"
} as const;

export default function manifest(): MetadataRoute.Manifest {
  return {
    background_color: atelierIvoryPwaColors.background,
    description: "Beheer schermen, media en publicaties met VeyoCast Publisher.",
    display: "standalone",
    icons: [
      {
        purpose: "any",
        sizes: "192x192",
        src: "/brand/veyocast-icon-192.png",
        type: "image/png"
      },
      {
        purpose: "any",
        sizes: "512x512",
        src: "/brand/veyocast-icon-512.png",
        type: "image/png"
      },
      {
        purpose: "maskable",
        sizes: "192x192",
        src: "/brand/veyocast-icon-maskable-192.png",
        type: "image/png"
      },
      {
        purpose: "maskable",
        sizes: "512x512",
        src: "/brand/veyocast-icon-maskable-512.png",
        type: "image/png"
      }
    ],
    id: "/dashboard",
    name: "VeyoCast Control",
    orientation: "any",
    scope: "/",
    short_name: "VeyoCast",
    start_url: "/dashboard",
    theme_color: atelierIvoryPwaColors.theme
  };
}
