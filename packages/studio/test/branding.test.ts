import {
  createRoyalCurrentPalette,
  royalCurrentEditorialTokens
} from "@veyocast/content-templates/royal-current-theme";
import { describe, expect, it } from "vitest";

import {
  applyStudioBrandKit,
  createEmptyStudioDocument,
  getStudioSystemTemplate,
  parseStudioDocument,
  resolveStudioBrandPalette
} from "../src";

const logoMediaAssetId = "59ff4110-25d8-4f62-9554-b9726ff31998";

describe("Studio-branding", () => {
  it("gebruikt exact dezelfde Royal Current-generator als de slideketen", () => {
    const brand = {
      background: "neutral" as const,
      logoMediaAssetId,
      mode: "royal" as const,
      primaryColor: "#BF263B",
      secondaryColor: "#08734D"
    };
    const resolved = resolveStudioBrandPalette(brand);
    const expected = createRoyalCurrentPalette({
      background: "neutral",
      primary: "#bf263b",
      secondary: "#08734d",
      version: 1
    }, "royal");
    const editorial = royalCurrentEditorialTokens({
      background: "neutral",
      primary: "#bf263b",
      secondary: "#08734d",
      version: 1
    }, "light");

    expect(resolved).toMatchObject({
      accent: expected["--accent"].toUpperCase(),
      background: expected["--bg"].toUpperCase(),
      canvasEnd: expected["--canvas-end"].toUpperCase(),
      canvasStart: expected["--canvas-start"].toUpperCase(),
      danger: editorial.danger.toUpperCase(),
      flowAccent: expected["--flow-accent"].toUpperCase(),
      ink: expected["--ink"].toUpperCase(),
      surface: expected["--surface"].toUpperCase()
    });
  });

  it("past clublogo en semantische kleuren op de curated template toe", () => {
    const source = getStudioSystemTemplate(
      "system-matchday-landscape-hd-v1"
    )?.document;
    expect(source).toBeDefined();

    const branded = applyStudioBrandKit(parseStudioDocument(source), {
      logoMediaAssetId,
      primaryColor: "#0055AA",
      secondaryColor: "#DDEEFF"
    });
    const resolved = resolveStudioBrandPalette({
      logoMediaAssetId,
      primaryColor: "#0055AA",
      secondaryColor: "#DDEEFF"
    });

    expect(branded.metadata.tenantBrandApplied).toBe(true);
    expect(branded.artboard.background).toEqual({
      angle: 135,
      from: resolved.canvasStart,
      kind: "linear-gradient",
      to: resolved.canvasEnd
    });
    expect(branded.elements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fill: expect.objectContaining({ color: resolved.solidAccent }),
          id: "accent-block"
        }),
        expect.objectContaining({
          fill: expect.objectContaining({ color: resolved.flowAccent }),
          id: "flow-sideband"
        }),
        expect.objectContaining({
          id: "brand-mark",
          mediaAssetId: logoMediaAssetId,
          objectFit: "contain",
          type: "image"
        })
      ])
    );
  });

  it("ondersteunt Royal en Navy Glass zonder vrije kleuren te overschrijven", () => {
    const source = getStudioSystemTemplate(
      "system-menu-portrait-hd-v1"
    )?.document;
    if (!source) throw new Error("Testtemplate ontbreekt.");
    const royal = applyStudioBrandKit(source, {
      logoMediaAssetId,
      mode: "royal",
      primaryColor: "#713DC2",
      secondaryColor: ""
    });
    const glass = applyStudioBrandKit(source, {
      logoMediaAssetId,
      mode: "glass",
      primaryColor: "#713DC2",
      secondaryColor: ""
    });
    expect(royal.artboard.background).not.toEqual(glass.artboard.background);

    const free = createEmptyStudioDocument("landscape-hd");
    const custom = parseStudioDocument({
      ...free,
      elements: [{
        cornerRadius: 20,
        fill: { color: "#ABCDEF", kind: "solid" },
        height: 200,
        id: "free-shape",
        locked: false,
        name: "Vrij vlak",
        opacity: 1,
        rotation: 0,
        shape: "rectangle",
        type: "shape",
        visible: true,
        width: 400,
        x: 100,
        y: 100,
        zIndex: 0
      }]
    });
    const brandedFree = applyStudioBrandKit(custom, {
      logoMediaAssetId,
      primaryColor: "#713DC2",
      secondaryColor: ""
    });
    expect(brandedFree.elements[0]).toMatchObject({
      fill: { color: "#ABCDEF" },
      id: "free-shape"
    });
  });
});
