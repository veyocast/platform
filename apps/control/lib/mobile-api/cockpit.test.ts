import { describe, expect, it } from "vitest";

import { mobileCockpitMediaStatuses } from "./cockpit";

describe("mobile cockpit media statuses", () => {
  it("only queries statuses supported by the media_asset_status enum", () => {
    expect(mobileCockpitMediaStatuses).toEqual([
      "uploading",
      "processing",
      "validation_failed"
    ]);
    expect(mobileCockpitMediaStatuses).not.toContain("uploaded");
  });
});
