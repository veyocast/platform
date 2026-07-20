import { describe, expect, it } from "vitest";

import manifest from "./manifest";

describe("VeyoCast Player PWA-manifest", () => {
  it("publishes approved any and maskable icon variants", () => {
    expect(manifest().icons).toEqual([
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
    ]);
  });
});
