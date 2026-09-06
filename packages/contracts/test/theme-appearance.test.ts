import { describe, expect, it } from "vitest";

import {
  defaultThemeAppearanceSettings,
  themeAppearanceSettingsSchema,
  themePresentationSnapshotSchema
} from "../src/theme-engine";

const selection = {
  accent: null,
  categoryOverrides: [],
  modePolicy: { kind: "fixed" as const, mode: "light" as const },
  ref: {
    catalog: "v2" as const,
    id: "fieldflow" as const,
    version: "1.0.0"
  },
  support: null
};

const resolvedMode = {
  mode: "light" as const,
  policy: selection.modePolicy,
  resolvedAt: "2026-09-06T12:00:00.000Z",
  timezone: "Europe/Amsterdam"
};

describe("theme appearance", () => {
  it("houdt fonts, schaal en logoplaatkleuren binnen gecureerde grenzen", () => {
    expect(themeAppearanceSettingsSchema.parse(defaultThemeAppearanceSettings))
      .toEqual(defaultThemeAppearanceSettings);
    expect(themeAppearanceSettingsSchema.safeParse({
      ...defaultThemeAppearanceSettings,
      typography: {
        ...defaultThemeAppearanceSettings.typography,
        displayFontRef: "https://example.test/font.woff2"
      }
    }).success).toBe(false);
  });

  it("blijft historische v1-presentaties lezen en bevriest v2-instellingen", () => {
    expect(themePresentationSnapshotSchema.safeParse({
      catalogVersion: "1.0.0",
      resolvedMode,
      selection,
      snapshotVersion: 1
    }).success).toBe(true);
    expect(themePresentationSnapshotSchema.safeParse({
      appearance: defaultThemeAppearanceSettings,
      catalogVersion: "1.0.0",
      resolvedMode,
      selection,
      settingsRevision: 7,
      snapshotVersion: 2
    }).success).toBe(true);
  });
});
