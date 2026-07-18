import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    background_color: "#080808",
    description: "Offline-first VeyoCast signage player",
    display: "fullscreen",
    name: "VeyoCast Player",
    orientation: "landscape",
    scope: "/",
    short_name: "VeyoCast",
    start_url: "/",
    theme_color: "#080808"
  };
}
