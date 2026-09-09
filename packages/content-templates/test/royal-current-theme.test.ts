import { describe, expect, it } from "vitest";

import {
  clubStyleConfigurationSchema,
  themeAppearanceSettingsSchema
} from "@veyocast/contracts";

import goldenSource from "./fixtures/royal-current-color-tokens.json";
import {
  createRoyalCurrentAppearance,
  createRoyalCurrentPalette,
  normalizeClubHex,
  normalizeClubStyle,
  royalCurrentContrastRatio,
  royalCurrentDefaultStyle,
  royalCurrentPalettePresets
} from "../src/royal-current-theme";

type GoldenCase = {
  config: {
    background: "club" | "neutral";
    primary: string;
    secondary: string | null;
    version: 1;
  };
  mode: "glass" | "royal";
  name: string;
  tokens: Record<string, string>;
};

describe("Royal Current v8 palettecontract", () => {
  it("is byte-for-byte gelijk aan alle 44 aangeleverde golden vectors", () => {
    const cases = goldenSource.cases as GoldenCase[];
    expect(cases).toHaveLength(44);
    for (const golden of cases) {
      expect(
        createRoyalCurrentPalette(golden.config, golden.mode),
        `${golden.name} · ${golden.mode} · ${golden.config.background}`
      ).toEqual(golden.tokens);
    }
  });

  it("normaliseert 3/6-cijferige HEX en valt veilig terug bij ongeldige invoer", () => {
    expect(normalizeClubHex(" #_Run ")).toBeNull();
    expect(normalizeClubHex("#A3F")).toBe("#aa33ff");
    expect(normalizeClubHex("2459ED")).toBe("#2459ed");
    expect(normalizeClubStyle({ primary: "geen-kleur" }))
      .toEqual(royalCurrentDefaultStyle);
    expect(clubStyleConfigurationSchema.safeParse(
      normalizeClubStyle({ primary: "#fff", secondary: "#123456" })
    ).success).toBe(true);
  });

  it("houdt gecontroleerde tekstparen voor iedere preset in beide modes leesbaar", () => {
    for (const preset of royalCurrentPalettePresets) {
      for (const mode of ["royal", "glass"] as const) {
        const tokens = createRoyalCurrentPalette({ primary: preset.color }, mode);
        for (const background of [
          tokens["--bg"],
          tokens["--surface"],
          tokens["--surface-2"],
          tokens["--accent-soft"]
        ]) {
          expect(royalCurrentContrastRatio(tokens["--accent"], background))
            .toBeGreaterThanOrEqual(4.5);
          expect(royalCurrentContrastRatio(tokens["--muted"], background))
            .toBeGreaterThanOrEqual(4.5);
        }
      }
    }
  });

  it("maakt nieuwe appearance standaard Roboto, 100% en expliciet revisioned", () => {
    expect(themeAppearanceSettingsSchema.parse(createRoyalCurrentAppearance()))
      .toMatchObject({
        designRevision: "royal-current-v8",
        motionEnabled: true,
        palette: {
          background: "club",
          primary: "#2459ED",
          secondary: null,
          version: 1
        },
        schemaVersion: 2,
        typography: {
          baseScale: 1,
          bodyFontRef: "vc-roboto-v1",
          displayFontRef: "vc-roboto-v1",
          sportScale: 1
        }
      });
  });

  it("behoudt opgeslagen logo-oppervlakken bij een losse paletwijziging", () => {
    const current = createRoyalCurrentAppearance();
    const customized = {
      ...current,
      surfaces: {
        clubLogoBackground: "#123456",
        homeLogoBackground: "#FEDCBA"
      }
    } as const;

    expect(createRoyalCurrentAppearance({ primary: "#08734D" }, customized))
      .toMatchObject({
        palette: { primary: "#08734D" },
        surfaces: customized.surfaces
      });
  });
});
