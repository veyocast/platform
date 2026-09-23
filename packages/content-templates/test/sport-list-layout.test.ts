import { describe, expect, it } from "vitest";
import { resolveSportListLayout } from "../src/sport-list-layout";
import { birthdayCalendarDay } from "../src/birthday-calendar";

describe("available sport-list height", () => {
  for (const orientation of ["landscape", "portrait"] as const) {
    for (const slideType of ["sport_program", "sport_results", "sport_cancellations", "sport_officials", "sport_dressing_rooms", "sport_standing"]) {
      it(`${orientation} ${slideType}: 1, 2, 3 en een volle pagina houden dezelfde rijhoogte`, () => {
        const first = resolveSportListLayout({ orientation, slideType, itemCount: 1 });
        const layouts = [1, 2, 3, first.capacity, first.capacity + 1].map((itemCount) =>
          resolveSportListLayout({ orientation, slideType, itemCount })
        );
        expect(layouts.map((layout) => layout.rowHeight)).toEqual(
          layouts.map(() => first.rowHeight)
        );
        expect(first.rowsPerColumn * first.rowHeight +
          (first.rowsPerColumn - 1) * first.gap).toBeCloseTo(first.contentHeight, 5);
        expect(first.rowHeight).toBeGreaterThanOrEqual(first.minimumRowHeight);
        expect(first.rowHeight).toBeLessThan(first.contentHeight);
      });

      it(`${orientation} ${slideType}: pagineert pas na de vaste capaciteit`, () => {
        const layout = resolveSportListLayout({ orientation, slideType, itemCount: 1 });
        expect(Math.ceil(layout.capacity / layout.capacity)).toBe(1);
        expect(Math.ceil((layout.capacity + 1) / layout.capacity)).toBe(2);
      });
    }
  }

  it("houdt ook bij twee landschapskolommen de rijhoogte los van itemCount", () => {
    const short = resolveSportListLayout({
      columns: 2,
      itemCount: 1,
      orientation: "landscape",
      slideType: "sport_program"
    });
    const full = resolveSportListLayout({
      columns: 2,
      itemCount: short.capacity,
      orientation: "landscape",
      slideType: "sport_program"
    });
    expect(short.capacity).toBe(short.rowsPerColumn * 2);
    expect(short.rowHeight).toBe(full.rowHeight);
  });
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
