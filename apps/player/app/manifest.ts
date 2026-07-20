import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    background_color: "#0A0A0A",
    description: "Offline-first VeyoCast signage player",
    display: "fullscreen",
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
    id: "/",
    name: "VeyoCast Player",
    orientation: "landscape",
    scope: "/",
    short_name: "VeyoCast",
    start_url: "/",
    theme_color: "#0A0A0A"
  };
}
