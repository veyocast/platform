import { describe, expect, it } from "vitest";

import {
  applyStudioBrandKit,
  getStudioSystemTemplate,
  parseStudioDocument
} from "../src";

describe("Studio-branding", () => {
  it("vervangt alleen canonieke accentkleuren en het tenantlogoslot", () => {
    const source = getStudioSystemTemplate(
      "system-matchday-landscape-hd-v1"
    )?.document;
    expect(source).toBeDefined();

    const branded = applyStudioBrandKit(parseStudioDocument(source), {
      logoMediaAssetId: "59ff4110-25d8-4f62-9554-b9726ff31998",
      primaryColor: "#0055AA",
      secondaryColor: "#DDEEFF"
    });

    expect(branded.metadata.tenantBrandApplied).toBe(true);
    expect(branded.elements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fill: expect.objectContaining({ color: "#0055AA" }),
          id: "accent-block"
        }),
        expect.objectContaining({
          fill: "#DDEEFF",
          id: "eyebrow"
        }),
        expect.objectContaining({
          id: "brand-mark",
          mediaAssetId: "59ff4110-25d8-4f62-9554-b9726ff31998",
          objectFit: "contain",
          type: "image"
        })
      ])
    );
  });

  it("blijft geldig wanneer een template geen tenantlogoslot bevat", () => {
    const source = getStudioSystemTemplate(
      "system-menu-portrait-hd-v1"
    )?.document;

    expect(() =>
      applyStudioBrandKit(parseStudioDocument(source), {
        logoMediaAssetId: "59ff4110-25d8-4f62-9554-b9726ff31998",
        primaryColor: "#112233",
        secondaryColor: "#AABBCC"
      })
    ).not.toThrow();
  });
});
