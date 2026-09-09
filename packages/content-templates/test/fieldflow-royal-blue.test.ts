import { describe, expect, it } from "vitest";

import {
  editorialThemeConfigSchema,
  themeAppearanceSettingsSchema,
  themeSelectionSchema
} from "@veyocast/contracts";

import { editorialThemeHasValidContrast } from "../src/editorial-arena-theme";
import {
  createFieldflowRoyalBlueAppearance,
  createFieldflowRoyalBlueSelection,
  createFieldflowRoyalBlueTheme,
  fieldflowRoyalBlueAppearance,
  fieldflowRoyalBluePreset,
  fieldflowRoyalBlueTheme
} from "../src/fieldflow-royal-blue";

describe("FieldFlow Royal blauw-preset", () => {
  it("levert twee volledige, contrastrijke royal/navy-tokenkaarten", () => {
    expect(editorialThemeConfigSchema.safeParse(fieldflowRoyalBlueTheme).success)
      .toBe(true);
    expect(Object.keys(fieldflowRoyalBlueTheme.light)).toHaveLength(26);
    expect(Object.keys(fieldflowRoyalBlueTheme.dark)).toHaveLength(26);
    expect(editorialThemeHasValidContrast(fieldflowRoyalBlueTheme)).toBe(true);
    expect(fieldflowRoyalBlueTheme.dark.canvas).toBe("#0a1124");
    expect(fieldflowRoyalBlueTheme.dark.surface).toBe("#17213a");
    expect(fieldflowRoyalBlueTheme.dark.text).toBe("#f5f7fb");
    expect(fieldflowRoyalBlueTheme.light.text).toBe("#132044");
  });

  it("bevriest de gevraagde kleur-, selectie- en appearancebasis", () => {
    const selection = createFieldflowRoyalBlueSelection();

    expect(fieldflowRoyalBluePreset).toMatchObject({
      color: "#2459ed",
      support: null
    });
    expect(themeSelectionSchema.parse(selection)).toMatchObject({
      accent: "#2459ED",
      modePolicy: { kind: "fixed", mode: "light" },
      support: null
    });
    expect(themeAppearanceSettingsSchema.parse(fieldflowRoyalBlueAppearance))
      .toMatchObject({
        surfaces: {
          clubLogoBackground: "#FFFFFF",
          homeLogoBackground: "#FFFFFF"
        },
        typography: {
          baseScale: 1,
          bodyFontRef: "vc-roboto-v1",
          displayFontRef: "vc-roboto-v1",
          sportScale: 1
        }
      });
  });

  it("geeft nieuwe objecten terug voor veilige editorstate", () => {
    const firstTheme = createFieldflowRoyalBlueTheme();
    const secondTheme = createFieldflowRoyalBlueTheme();
    const firstAppearance = createFieldflowRoyalBlueAppearance();
    const secondAppearance = createFieldflowRoyalBlueAppearance();

    expect(firstTheme).toEqual(secondTheme);
    expect(firstTheme).not.toBe(secondTheme);
    expect(firstTheme.dark).not.toBe(secondTheme.dark);
    expect(firstAppearance).toEqual(secondAppearance);
    expect(firstAppearance).not.toBe(secondAppearance);
    expect(firstAppearance.typography).not.toBe(secondAppearance.typography);
  });
});
