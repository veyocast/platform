import { describe, expect, it } from "vitest";

import type { PlaylistStudioItem } from "../playlist-studio-contract";
import {
  durationStep,
  itemOrder,
  reorderItems,
  restoreOrder
} from "./publisher-studio-state";

function item(id: string): PlaylistStudioItem {
  return {
    accessibilityName: null,
    asset: null,
    backgroundColor: null,
    cropFocusX: 0.5,
    cropFocusY: 0.5,
    displayTitle: null,
    durationSeconds: 8,
    enabled: true,
    fitMode: "contain",
    id,
    mediaAssetId: id,
    muted: true,
    sectionId: null,
    sortOrder: 0,
    transition: "cut",
    trimEndSeconds: null,
    trimStartSeconds: 0,
    visibleFrom: null,
    visibleUntil: null,
    volumePercent: 100
  };
}

describe("Publisher Studio editorstate", () => {
  it("herordent deterministisch en kan de vorige volgorde herstellen", () => {
    const original = [item("a"), item("b"), item("c")];
    const moved = reorderItems(original, "c", "a");

    expect(itemOrder(moved)).toEqual(["c", "a", "b"]);
    expect(itemOrder(restoreOrder(moved, itemOrder(original)))).toEqual([
      "a",
      "b",
      "c"
    ]);
  });

  it("begrensst de inline duurstepper op de bestaande servergrenzen", () => {
    expect(durationStep(5, "decrease")).toBe(5);
    expect(durationStep(8, "increase")).toBe(9);
    expect(durationStep(3600, "increase")).toBe(3600);
  });
});
