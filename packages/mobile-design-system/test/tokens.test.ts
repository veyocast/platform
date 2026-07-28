import { describe, expect, it } from "vitest";
import {
  minimumTouchTarget,
  mobilePalette,
  mobileRadius,
  mobileSpacing
} from "../src/tokens";

describe("Atelier Ivory Native tokens", () => {
  it("uses the canonical VeyoCast action colour and safe touch target", () => {
    expect(mobilePalette.brand.action).toBe("#FF5C20");
    expect(minimumTouchTarget).toBeGreaterThanOrEqual(48);
  });

  it("keeps spacing and radii on the governed grids", () => {
    expect(Object.values(mobileSpacing).every((value) => value % 4 === 0)).toBe(true);
    expect(Object.values(mobileRadius).slice(0, -1).every((value) => value % 4 === 0)).toBe(true);
  });
});
