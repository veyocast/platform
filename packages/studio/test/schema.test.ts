import { describe, expect, it } from "vitest";

import {
  createEmptyStudioDocument,
  getStudioSystemTemplate,
  parseStudioDocument,
  safeParseStudioDocument,
  studioFonts,
  studioSystemTemplates
} from "../src";

describe("Studio-documentcontract", () => {
  it("maakt alleen de twee ondersteunde HD-artboards", () => {
    expect(createEmptyStudioDocument("landscape-hd").artboard).toMatchObject({
      width: 1920,
      height: 1080,
      orientation: "landscape"
    });
    expect(createEmptyStudioDocument("portrait-hd").artboard).toMatchObject({
      width: 1080,
      height: 1920,
      orientation: "portrait"
    });
  });

  it("weigert dubbele laag-ID's en timing buiten de documentduur", () => {
    const template = getStudioSystemTemplate("system-matchday-landscape-hd-v1");
    expect(template).toBeDefined();
    const document = template?.document;
    if (!document) throw new Error("Testtemplate ontbreekt.");
    const invalid = {
      ...document,
      elements: [
        document.elements[0],
        {
          ...document.elements[0],
          timing: { startMs: 0, endMs: 20_000 }
        }
      ]
    };
    const result = safeParseStudioDocument(invalid);
    expect(result.success).toBe(false);
  });

  it("levert iedere systeemtemplate in liggend en staand", () => {
    expect(studioFonts).toContainEqual({
      family: "Roboto",
      label: "Roboto",
      weights: [400, 500, 700, 900]
    });
    expect(studioSystemTemplates).toHaveLength(22);
    expect(new Set(studioSystemTemplates.map((template) => template.category)).size)
      .toBe(11);
    for (const template of studioSystemTemplates) {
      expect(safeParseStudioDocument(template.document).success).toBe(true);
      expect(template.version).toBe(2);
      expect(template.document.metadata.fontRegistryVersion).toBe("2026-09-09.1");
      const text = template.document.elements.filter(
        (element) => element.type === "text"
      );
      expect(text.length).toBeGreaterThan(4);
      expect(text.every((element) => element.fontFamily === "Roboto")).toBe(true);
      expect(text.some((element) => element.fontWeight === 900)).toBe(true);
    }
    const fingerprints = studioSystemTemplates
      .filter((template) => template.formatId === "landscape-hd")
      .map((template) => template.document.elements.map((element) => element.id).join("|"));
    expect(new Set(fingerprints).size).toBe(11);
  });

  it("houdt historische fontregistries en gewicht 800 geldig", () => {
    const template = getStudioSystemTemplate("system-matchday-landscape-hd-v1");
    if (!template) throw new Error("Testtemplate ontbreekt.");
    const headline = template.document.elements.find(
      (element) => element.type === "text" && element.id === "headline"
    );
    if (!headline || headline.type !== "text") {
      throw new Error("Koptekst ontbreekt.");
    }
    expect(safeParseStudioDocument({
      ...template.document,
      elements: template.document.elements.map((element) =>
        element.id === headline.id ? { ...headline, fontWeight: 800 } : element
      ),
      metadata: {
        ...template.document.metadata,
        fontRegistryVersion: "2026-09-02.1"
      }
    }).success).toBe(true);
  });

  it("valideert groepen als expliciete wederzijdse laagrelatie", () => {
    const template = getStudioSystemTemplate("system-matchday-landscape-hd-v1");
    if (!template) throw new Error("Testtemplate ontbreekt.");
    const [first, second] = template.document.elements;
    if (!first || !second) throw new Error("Testlagen ontbreken.");
    const grouped = {
      ...template.document,
      elements: [
        { ...first, groupId: "group-main" },
        { ...second, groupId: "group-main" },
        ...template.document.elements.slice(2),
        {
          id: "group-main",
          type: "group",
          name: "Hoofdgroep",
          x: 0,
          y: 0,
          width: 1200,
          height: 700,
          rotation: 0,
          opacity: 1,
          visible: true,
          locked: false,
          zIndex: template.document.elements.length,
          childIds: [first.id, second.id]
        }
      ]
    };
    expect(safeParseStudioDocument(grouped).success).toBe(true);
  });

  it("begrenst bronvideo tot één vergrendelde full-canvas achtergrond", () => {
    const empty = createEmptyStudioDocument("portrait-hd");
    const video = {
      alt: "Sfeerbeeld clubhuis",
      focusX: 0.5,
      focusY: 0.5,
      height: 1920,
      id: "venue-video",
      locked: true,
      loop: true,
      mediaAssetId: "10000000-0000-4000-8000-000000000001",
      muted: true,
      name: "Clubhuis · achtergrond",
      objectFit: "cover",
      opacity: 1,
      rotation: 0,
      startOffsetMs: 500,
      type: "video",
      variant: "player_1080p",
      visible: true,
      width: 1080,
      x: 0,
      y: 0,
      zIndex: 0
    } as const;
    const document = parseStudioDocument({
      ...empty,
      artboard: { ...empty.artboard, background: { kind: "transparent" } },
      elements: [video]
    });
    expect(document.elements[0]).toMatchObject({
      mediaAssetId: video.mediaAssetId,
      type: "video"
    });
    expect(safeParseStudioDocument({
      ...document,
      elements: [video, { ...video, id: "second-video", zIndex: 1 }]
    }).success).toBe(false);
    expect(safeParseStudioDocument({
      ...document,
      artboard: {
        ...document.artboard,
        background: { color: "#0A0A0A", kind: "solid" }
      }
    }).success).toBe(false);
  });
});
