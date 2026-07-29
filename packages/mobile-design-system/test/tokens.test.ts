import { describe, expect, it } from "vitest";
import {
  minimumTouchTarget,
  mobileFontFamily,
  mobilePalette,
  mobileRadius,
  mobileSpacing,
  mobileType
} from "../src/tokens";

describe("Atelier Ivory Native tokens", () => {
  it("uses the canonical VeyoCast action colour and safe touch target", () => {
    expect(mobilePalette.brand.action).toBe("#FF5C20");
    expect(minimumTouchTarget).toBeGreaterThanOrEqual(44);
    expect(mobileFontFamily.regular).toBe("Roboto_400Regular");
  });

  it("keeps spacing and radii on the governed grids", () => {
    expect(Object.values(mobileSpacing).every((value) => value % 4 === 0)).toBe(true);
    expect(Object.values(mobileRadius).slice(0, -1).every((value) => value % 2 === 0)).toBe(true);
    expect(mobileRadius.card).toBe(10);
    expect(mobileRadius.hero).toBe(14);
  });

  it("keeps the native interface compact without using 12 px primary body copy", () => {
    expect(mobileType.body.fontSize).toBeGreaterThanOrEqual(14);
    expect(mobileType.pageTitle.fontSize).toBeLessThanOrEqual(24);
    expect(mobileType.display.fontSize).toBeLessThanOrEqual(26);
  });
});
