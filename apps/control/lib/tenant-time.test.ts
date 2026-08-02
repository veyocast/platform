import { describe, expect, it } from "vitest";

import {
  formatTenantDateTime,
  normalizeTenantTimeZone
} from "./tenant-time";

const timeOnly = {
  hour: "2-digit",
  hourCycle: "h23",
  minute: "2-digit"
} satisfies Intl.DateTimeFormatOptions;

describe("tenant time", () => {
  it("applies Central European daylight saving time explicitly", () => {
    expect(formatTenantDateTime(
      "2026-01-15T12:00:00.000Z",
      "Europe/Amsterdam",
      timeOnly
    )).toBe("13:00");
    expect(formatTenantDateTime(
      "2026-07-15T12:00:00.000Z",
      "Europe/Amsterdam",
      timeOnly
    )).toBe("14:00");
  });

  it("keeps Amsterdam, Brussels and Paris on the same local clock", () => {
    const instant = "2026-08-02T00:07:00.000Z";
    const times = [
      "Europe/Amsterdam",
      "Europe/Brussels",
      "Europe/Paris"
    ].map((timeZone) => formatTenantDateTime(instant, timeZone, timeOnly));

    expect(times).toEqual(["02:07", "02:07", "02:07"]);
  });

  it("falls back safely when a stored timezone is invalid", () => {
    expect(normalizeTenantTimeZone("Not/A-Timezone"))
      .toBe("Europe/Amsterdam");
  });
});
