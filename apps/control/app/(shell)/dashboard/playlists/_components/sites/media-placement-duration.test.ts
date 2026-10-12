import { describe, expect, it } from "vitest";

import { mediaPlacementDuration } from "./model";
import { planPlaylistChanges, validatePlaylistPlan } from "./playlist-command-plan";

describe("verified media placement duration", () => {
  it("keeps a processed ten-second video publishable through the actual batch plan", () => {
    const original = { id: "19110000-0000-4000-8000-000000000001", name: "Video playlist", description: "", status: "Concept", updated: "", slides: [] };
    const slide = { id: "19110000-0000-4000-8000-000000000002", mediaId: "19110000-0000-4000-8000-000000000003", name: "Verified short video", image: "", seconds: mediaPlacementDuration({ kind: "video", durationSeconds: 10.033 }), kind: "video" as const };
    const plan = planPlaylistChanges(original, { ...original, slides: [slide] }, new Map([[slide.id, slide]]));
    expect(plan[0]).toMatchObject({ operation: "add_media", durationSeconds: 11 });
    expect(plan.find(operation => operation.operation === "patch")).toMatchObject({ patch: { durationSeconds: 11 } });
    expect(() => validatePlaylistPlan(original.id, 1, "19110000-0000-4000-8000-000000000004", plan)).not.toThrow();
  });

  it.each([undefined, 0, -1, Number.NaN, Number.POSITIVE_INFINITY])("refuses an unverified video duration %s", durationSeconds => {
    expect(() => mediaPlacementDuration({ kind: "video", durationSeconds })).toThrow("geverifieerde videoduur ontbreekt");
  });

  it("retains the Source image duration and existing video boundary limits", () => {
    expect(mediaPlacementDuration({ kind: "image" })).toBe(12);
    expect(mediaPlacementDuration({ kind: "video", durationSeconds: 2.5 })).toBe(5);
    expect(mediaPlacementDuration({ kind: "video", durationSeconds: 3600.1 })).toBe(3600);
    expect(mediaPlacementDuration({ kind: "video", sourceKind: "youtube" })).toBe(12);
  });
});
