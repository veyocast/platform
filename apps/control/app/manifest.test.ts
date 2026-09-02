import { describe, expect, it } from "vitest";

import manifest from "./manifest";

describe("VeyoCast Control PWA-manifest", () => {
  it("is installable without widening the app scope", () => {
    expect(manifest()).toMatchObject({
      display: "standalone",
      id: "/dashboard",
      name: "VeyoCast Control",
      scope: "/",
      start_url: "/dashboard"
    });
  });

  it("contains regular and maskable brand icons", () => {
    expect(manifest().icons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ purpose: "any", sizes: "512x512" }),
        expect.objectContaining({ purpose: "maskable", sizes: "512x512" })
      ])
    );
  });

  it("uses the canonical FieldFlow launch colors", () => {
    expect(manifest()).toMatchObject({
      background_color: "#F4F7F5",
      theme_color: "#123332"
    });
  });
});
