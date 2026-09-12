import { describe, expect, it } from "vitest";
import { resolveSportListLayout } from "../src/sport-list-layout";
import { birthdayCalendarDay } from "../src/birthday-calendar";

describe("available sport-list height", () => {
  for (const orientation of ["landscape", "portrait"] as const) {
    for (const slideType of ["sport_program", "sport_results", "sport_cancellations", "sport_officials", "sport_dressing_rooms", "sport_standing"]) {
      it.each([3, 5, 6, 7, 8, 20])(`${orientation} ${slideType}: %i records fill the usable area`, (itemCount) => {
        const layout = resolveSportListLayout({ orientation, slideType, itemCount });
        const rows = Math.min(itemCount, layout.capacity);
        expect(rows * layout.rowHeight + (rows - 1) * layout.gap).toBeCloseTo(layout.contentHeight, 5);
        expect(layout.rowHeight).toBeGreaterThanOrEqual(layout.minimumRowHeight);
      });
    }
  }
  it("fits the seventh landscape result without an unnecessary second page", () => {
    expect(resolveSportListLayout({ orientation: "landscape", slideType: "sport_results", itemCount: 7 }).capacity).toBeGreaterThanOrEqual(7);
  });
  it("accounts for a taller header from measured content geometry", () => {
    const input = { orientation: "landscape" as const, slideType: "sport_program", itemCount: 20 };
    expect(resolveSportListLayout({ ...input, contentHeight: 550 }).capacity).toBeLessThan(resolveSportListLayout({ ...input, contentHeight: 800 }).capacity);
  });
});
describe("birthday calendar uses the tenant day", () => {
  it("crosses Amsterdam midnight before UTC, including DST", () => {
    expect(birthdayCalendarDay(Date.parse("2026-09-12T21:59:59Z"), "Europe/Amsterdam")).toBe("2026-09-12");
    expect(birthdayCalendarDay(Date.parse("2026-09-12T22:00:00Z"), "Europe/Amsterdam")).toBe("2026-09-13");
    expect(birthdayCalendarDay(Date.parse("2026-12-31T23:00:00Z"), "Europe/Amsterdam")).toBe("2027-01-01");
  });
});
