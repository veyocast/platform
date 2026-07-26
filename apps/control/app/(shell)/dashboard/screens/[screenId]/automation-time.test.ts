import { describe, expect, it } from "vitest";

import { isoToZonedLocal, zonedLocalToIso } from "./automation-time";

describe("screen automation zoned override time", () => {
  it("round-trips winter and summer dates in the tenant timezone", () => {
    expect(
      zonedLocalToIso("2026-01-15T08:30", "Europe/Amsterdam")
    ).toBe("2026-01-15T07:30:00.000Z");
    expect(
      zonedLocalToIso("2026-07-15T08:30", "Europe/Amsterdam")
    ).toBe("2026-07-15T06:30:00.000Z");
    expect(
      isoToZonedLocal("2026-07-15T06:30:00.000Z", "Europe/Amsterdam")
    ).toBe("2026-07-15T08:30");
  });
});
