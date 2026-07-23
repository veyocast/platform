import { describe, expect, it } from "vitest";

import {
  buildPreviewOffsets,
  resolvePreviewPosition
} from "./publisher-studio-preview-state";

describe("Publisher Studio previewtijdlijn", () => {
  const offsets = buildPreviewOffsets([
    { durationSeconds: 8, id: "first" },
    { durationSeconds: 12, id: "second" },
    { durationSeconds: 5, id: "third" }
  ]);

  it("bouwt een deterministische lineaire tijdlijn", () => {
    expect(offsets).toEqual([
      { end: 8, id: "first", start: 0 },
      { end: 20, id: "second", start: 8 },
      { end: 25, id: "third", start: 20 }
    ]);
  });

  it("vertaalt seekposities naar item en lokale tijd", () => {
    expect(resolvePreviewPosition(offsets, 14)).toEqual({
      elapsedSeconds: 6,
      index: 1
    });
    expect(resolvePreviewPosition(offsets, 25)).toEqual({
      elapsedSeconds: 5,
      index: 2
    });
  });
});
