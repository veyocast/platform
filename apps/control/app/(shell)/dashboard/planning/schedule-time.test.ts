import { describe, expect, it } from "vitest";

import {
  isoToZonedDateTimeLocal,
  zonedLocalDateTimeToIso
} from "./schedule-time";

describe("Publisher planning timezone conversion", () => {
  it("normaliseert wintertijd naar een ISO-moment", () => {
    expect(zonedLocalDateTimeToIso("2026-01-20T14:30", "Europe/Amsterdam"))
      .toBe("2026-01-20T13:30:00.000Z");
  });

  it("normaliseert zomertijd naar een ISO-moment", () => {
    expect(zonedLocalDateTimeToIso("2026-07-20T14:30", "Europe/Amsterdam"))
      .toBe("2026-07-20T12:30:00.000Z");
  });

  it("weigert een niet-bestaande lokale DST-tijd", () => {
    expect(() => zonedLocalDateTimeToIso("2026-03-29T02:30", "Europe/Amsterdam"))
      .toThrow("bestaat niet");
  });

  it("formatteert ISO terug naar tenantlokale invoer", () => {
    expect(isoToZonedDateTimeLocal("2026-07-20T12:30:00.000Z", "Europe/Amsterdam"))
      .toBe("2026-07-20T14:30");
  });
});
