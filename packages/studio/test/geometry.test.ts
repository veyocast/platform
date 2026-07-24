import { describe, expect, it } from "vitest";

import {
  alignStudioElements,
  canonicalizeStudioDocument,
  createEmptyStudioDocument,
  fitStudioArtboard,
  getStudioSystemTemplate,
  snapStudioRect
} from "../src";

describe("Studio-geometrie", () => {
  it("fit een logisch artboard zonder de documentcoördinaten te wijzigen", () => {
    expect(fitStudioArtboard(
      { width: 1920, height: 1080 },
      { width: 1000, height: 700 },
      40
    )).toEqual({
      offsetX: 40,
      offsetY: 91.25,
      scale: 0.4791666666666667
    });
  });

  it("snapt randen en middelpunten naar de dichtstbijzijnde hulplijn", () => {
    expect(snapStudioRect(
      { x: 493, y: 95, width: 200, height: 100 },
      [100, 500],
      8
    )).toMatchObject({
      rect: { x: 500, y: 100, width: 200, height: 100 },
      snappedX: 500,
      snappedY: 100
    });
  });

  it("lijnt meerdere elementen exact uit", () => {
    const template = getStudioSystemTemplate("system-matchday-landscape-hd-v1");
    if (!template) throw new Error("Testtemplate ontbreekt.");
    const aligned = alignStudioElements(template.document.elements.slice(0, 3), "left");
    expect(new Set(aligned.map((element) => element.x))).toEqual(new Set([112]));
  });
});

describe("Studio-canonicalisatie", () => {
  it("is ongevoelig voor objectkeyvolgorde", () => {
    const document = createEmptyStudioDocument();
    const reordered = {
      metadata: document.metadata,
      elements: document.elements,
      motion: document.motion,
      artboard: document.artboard,
      schemaVersion: document.schemaVersion
    };
    expect(canonicalizeStudioDocument(document)).toBe(
      canonicalizeStudioDocument(reordered)
    );
  });
});
