import { describe, expect, it } from "vitest";

import {
  alignStudioElements,
  canonicalizeStudioDocument,
  createEmptyStudioDocument,
  fitStudioArtboard,
  getStudioSystemTemplate,
  snapStudioRect,
  studioSystemTemplates
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
    const aligned = alignStudioElements(
      template.document.elements.filter((element) =>
        ["club-bar", "title-panel", "match-stage"].includes(element.id)
      ),
      "left"
    );
    expect(new Set(aligned.map((element) => element.x))).toEqual(new Set([150]));
  });

  it("houdt alle functionele templatelagen binnen beide artboards", () => {
    for (const template of studioSystemTemplates) {
      const { height, width } = template.document.artboard;
      const functionalElements = template.document.elements.filter(
        (element) => !element.id.startsWith("flow-orbit")
      );

      for (const element of functionalElements) {
        expect(element.x, `${template.id}:${element.id}:x`).toBeGreaterThanOrEqual(0);
        expect(element.y, `${template.id}:${element.id}:y`).toBeGreaterThanOrEqual(0);
        expect(element.x + element.width, `${template.id}:${element.id}:right`)
          .toBeLessThanOrEqual(width);
        expect(element.y + element.height, `${template.id}:${element.id}:bottom`)
          .toBeLessThanOrEqual(height);
      }
    }
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
