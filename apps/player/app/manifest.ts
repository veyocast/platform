import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    background_color: "#080808",
    description: "Offline-first Castivo signage player",
    display: "fullscreen",
    name: "Castivo Player",
    orientation: "landscape",
    scope: "/",
    short_name: "Castivo",
    start_url: "/",
    theme_color: "#080808"
  };
}
