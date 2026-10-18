import { readFileSync } from "node:fs";
import { URL } from "node:url";
import { describe, expect, it } from "vitest";
import {
  minimumTouchTarget,
  mobileFontFamilyForWeight,
  mobilePalette,
  mobileRadius,
  mobileType,
} from "../src/tokens";

const source = readFileSync(
  new URL(
    "../../../docs/sync-v1-rebuild/handoff/reference/sites-sync/src/styles.css",
    import.meta.url,
  ),
  "utf8",
);
function contrast(a: string, b: string) {
  const luminance = (hex: string) => {
    const channels = [1, 3, 5]
      .map((i) => Number.parseInt(hex.slice(i, i + 2), 16) / 255)
      .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return (
      channels[0]! * 0.2126 + channels[1]! * 0.7152 + channels[2]! * 0.0722
    );
  };
  const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (values[0]! + 0.05) / (values[1]! + 0.05);
}

describe("Sync V1 native mapping", () => {
  it("maps the pinned workspace palette and geometry while keeping native touch targets", () => {
    for (const [name, value] of Object.entries({
      bg: mobilePalette.light.canvas,
      surface: mobilePalette.light.surface,
      "surface-2": mobilePalette.light.raised,
      text: mobilePalette.light.ink,
      accent: mobilePalette.brand.action,
    })) {
      expect(source).toContain(
        `--${name}:${value === "#ffffff" ? "#fff" : value}`,
      );
    }
    expect(source).toContain(`--radius:${mobileRadius.card}px`);
    expect(minimumTouchTarget).toBeGreaterThanOrEqual(44);
    expect(mobileType.body.fontSize).toBeGreaterThanOrEqual(14);
  });

  it("retains normal-text contrast on source surfaces and primary buttons", () => {
    for (const surface of [
      mobilePalette.light.canvas,
      mobilePalette.light.surface,
      mobilePalette.light.raised,
    ]) {
      expect(
        contrast(mobilePalette.light.secondaryInk, surface),
      ).toBeGreaterThanOrEqual(4.5);
    }
    expect(
      contrast(mobilePalette.brand.onAction, mobilePalette.brand.action),
    ).toBeGreaterThanOrEqual(4.5);
    expect(
      contrast(
        mobilePalette.brand.darkOnAction,
        mobilePalette.brand.darkAction,
      ),
    ).toBeGreaterThanOrEqual(4.5);
  });

  it("uses exact native font files for source intermediate and heading weights", () => {
    expect(mobileFontFamilyForWeight("650")).toBe("SyncManrope_650Strong");
    expect(mobileFontFamilyForWeight(mobileType.pageTitle.fontWeight)).toBe(
      "SyncManrope_750Heading",
    );
    expect(mobileFontFamilyForWeight("450")).toBe("SyncManrope_450Book");
  });
});
