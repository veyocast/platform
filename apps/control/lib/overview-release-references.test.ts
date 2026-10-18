import { describe, expect, it } from "vitest";
import { missingOverviewReleaseIds } from "./overview-release-references";

describe("overview release references", () => {
  it("keeps an old active release, a different desired release and a heartbeat reference outside the latest twenty", () => {
    const latest = Array.from({ length: 20 }, (_, index) => ({ id: `recent-${index}` }));
    expect(missingOverviewReleaseIds({
      devices: [{ active_release_id: "old-lkg", desired_release_id: "new-target" }],
      heartbeats: [{ active_release_id: "old-lkg" }, { active_release_id: "prior-frame" }],
      screens: [{ assigned_release_id: "new-target" }, { assigned_release_id: "recent-1" }]
    }, latest)).toEqual(["old-lkg", "new-target", "prior-frame"]);
  });
  it("does not query missing/duplicate IDs or repeat already loaded references", () => {
    expect(missingOverviewReleaseIds({
      devices: [{ active_release_id: null, desired_release_id: "same" }],
      heartbeats: [{ active_release_id: "same" }], screens: [{ assigned_release_id: null }]
    }, [{ id: "same" }])).toEqual([]);
  });
});
