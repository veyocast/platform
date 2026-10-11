import { describe, expect, it } from "vitest";
import { screenCompositionDraftSchema, screenCompositionGeometry, publishedScreenCompositionSchema } from "../src/screen-composition";

const playlistId = "00000000-0000-4000-8000-000000000001";
const zone = (id: "main" | "side" | "bottom") => ({ id, playlistId });
const draft = { schemaVersion: 1, layout: "three", orientation: "portrait", zones: [zone("main"), zone("side"), zone("bottom")] };

describe("immutable screen content composition", () => {
  it("partitions the exact three-plane geometry without overlap or missing pixels", () => {
    const geometry = screenCompositionGeometry(screenCompositionDraftSchema.parse(draft));
    expect(geometry).toEqual([
      { id: "main", left: 0, top: 0, width: 70, height: 80, audio: true },
      { id: "side", left: 70, top: 0, width: 30, height: 80, audio: false },
      { id: "bottom", left: 0, top: 80, width: 100, height: 20, audio: false }
    ]);
    expect(geometry.reduce((area, entry) => area + entry.width * entry.height, 0)).toBe(10_000);
  });
  it("refuses duplicate zones, missing zones, extra fields and out-of-step ratios", () => {
    for (const patch of [{ zones: [zone("main")] }, { zones: [zone("main"), zone("main"), zone("bottom")] },
      { mainWidthPercent: 73 }, { bottomHeightPercent: 40 }, { tenantId: playlistId }]) {
      expect(screenCompositionDraftSchema.safeParse({ ...draft, ...patch }).success).toBe(false);
    }
  });
  it("refuses mismatched immutable zone bindings", () => {
    const configuration = screenCompositionDraftSchema.parse({ ...draft, layout: "full", zones: [zone("main")] });
    const binding = { zoneId: "side", playlistId, releaseId: playlistId, publicationId: playlistId, configRevision: 1 };
    expect(publishedScreenCompositionSchema.safeParse({ id: playlistId, revision: 1, configuration, bindings: [binding] }).success).toBe(false);
  });
});
