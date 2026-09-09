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
    expect(fieldflowRoyalBlueTheme.dark.canvas).toBe("#071538");
    expect(fieldflowRoyalBlueTheme.dark.surface).toBe("#3154D4");
    expect(fieldflowRoyalBlueTheme.dark.text).toBe("#FFFFFF");
    expect(fieldflowRoyalBlueTheme.light.text).toBe("#FFFFFF");
  });

  it("bevriest de gevraagde kleur-, selectie- en appearancebasis", () => {
    const selection = createFieldflowRoyalBlueSelection();

    expect(fieldflowRoyalBluePreset).toMatchObject({
      color: "#4169E1",
      support: "#7A5CE6"
    });
    expect(themeSelectionSchema.parse(selection)).toMatchObject({
      accent: "#4169E1",
      modePolicy: { kind: "fixed", mode: "dark" },
      support: "#7A5CE6"
    });
    expect(themeAppearanceSettingsSchema.parse(fieldflowRoyalBlueAppearance))
      .toMatchObject({
        surfaces: {
          clubLogoBackground: "#FFFFFF",
          homeLogoBackground: "#FFFFFF"
        },
        typography: {
          baseScale: 1.05,
          bodyFontRef: "vc-inter-v1",
          displayFontRef: "vc-manrope-v1",
          sportScale: 1.4
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
