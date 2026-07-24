import { describe, expect, it } from "vitest";

import {
  createEmptyStudioDocument,
  getStudioSystemTemplate,
  safeParseStudioDocument,
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
    expect(studioSystemTemplates).toHaveLength(22);
    for (const template of studioSystemTemplates) {
      expect(safeParseStudioDocument(template.document).success).toBe(true);
    }
  });
});
