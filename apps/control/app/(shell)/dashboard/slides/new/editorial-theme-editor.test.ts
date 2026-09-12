import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { EditorialThemeConfig, ThemeSelection } from "@veyocast/contracts";
import {
  createRoyalCurrentAppearance,
  createRoyalCurrentTheme,
  royalCurrentPalettePresets
} from "@veyocast/content-templates";
import {
  editorialArenaLightTokens,
  editorialThemeHasValidContrast
} from "@veyocast/content-templates/editorial-arena-theme";

import {
  EditorialThemeEditor,
  deriveSupportColor,
  fieldflowPalettePresets,
  generateFieldflowPalette,
  resolveThemeDraftDefaults
} from "./editorial-theme-editor";

const selection: ThemeSelection = {
  accent: "#2459ED",
  categoryOverrides: [],
  modePolicy: { kind: "fixed", mode: "light" },
  ref: { catalog: "v2", id: "fieldflow", version: "1.0.0" },
  support: null
};

describe("Centrale Royal Current clubstijl-editor", () => {
  it("biedt exact de zes normatieve clubkleurpresets", () => {
    expect(fieldflowPalettePresets).toEqual(royalCurrentPalettePresets);
    expect(fieldflowPalettePresets.map((preset) => preset.color)).toEqual([
      "#2459ed",
      "#bf263b",
      "#08734d",
      "#e06a14",
      "#713dc2",
      "#343a46"
    ]);
  });

  it("blijft veilig tijdens onvolledige accent- en tijdinvoer", () => {
    const fallback: EditorialThemeConfig = {
      dark: editorialArenaLightTokens,
      light: editorialArenaLightTokens,
      mode: "light"
    };
    expect(resolveThemeDraftDefaults({ ...selection, accent: "#1" }, fallback))
      .toEqual({ theme: fallback, valid: false });
    expect(resolveThemeDraftDefaults({
      ...selection,
      modePolicy: {
        entries: [{ days: [0], end: "", mode: "dark", start: "18:00" }],
        fallback: "light",
        kind: "schedule",
        timezone: "Europe/Amsterdam"
      }
    }, fallback)).toEqual({ theme: fallback, valid: false });
    expect(resolveThemeDraftDefaults(selection, fallback)).toEqual({
      theme: createRoyalCurrentTheme({ primary: "#2459ED" }, "light"),
      valid: true
    });
  });

  it.each(["#000000", "#FFFFFF", "#FFFF00", "#777777", "#3D61FF"])(
    "bouwt voor randkleur %s twee volledige contrastrijke paletten",
    (primary) => {
      const generated = generateFieldflowPalette(primary, "royal-current", "dark");
      expect(Object.keys(generated.light).sort())
        .toEqual(Object.keys(editorialArenaLightTokens).sort());
      expect(Object.keys(generated.dark).sort())
        .toEqual(Object.keys(editorialArenaLightTokens).sort());
      expect(editorialThemeHasValidContrast(generated)).toBe(true);
      expect(generated.mode).toBe("dark");
      expect(deriveSupportColor(primary)).toMatch(/^#[0-9A-F]{6}$/);
    }
  );

  it.each(["light", "dark"] as const)(
    "toont de eenvoudige flow en beide live paletpreviews in %s",
    (mode) => {
      const theme = createRoyalCurrentTheme({ primary: "#2459ED" }, mode);
      const html = renderToStaticMarkup(createElement(EditorialThemeEditor, {
        appearance: createRoyalCurrentAppearance(),
        defaults: theme,
        disabled: false,
        onAppearanceChange: () => undefined,
        onChange: () => undefined,
        onSelectionChange: () => undefined,
        selection: { ...selection, modePolicy: { kind: "fixed", mode } },
        theme
      }));
      const payloadInput = html.match(
        /<input[^>]*name="themeColorOverridesJson"[^>]*>/
      )?.[0];
      const serializedPayload = payloadInput
        ?.match(/value="([^"]+)"/)?.[1]
        ?.replaceAll("&quot;", '"');

      expect(html).toContain("Royal Current v8");
      expect(html).toContain("Primaire clubkleur");
      expect(html).toContain("Standaardpaletten");
      expect(html).toContain("Royal Current live kleurvoorbeeld");
      expect(html).toContain("Navy Glass live kleurvoorbeeld");
      expect(html).toContain("Tweede decoratieve accentkleur");
      expect(html).toContain("Clubkleuren herstellen");
      expect(html).toContain("Globale modus");
      expect(html).toContain("Alles licht");
      expect(html).toContain("Alles donker");
      expect(html).toContain('name="themeSaveReadiness"');
      expect(html).toContain('value="ready"');
      expect(html).toContain("26 semantische kleurrollen");
      expect(html).toContain("QR-voorgrond");
      expect(serializedPayload).toBeDefined();
      expect(Object.keys(JSON.parse(serializedPayload!).fieldflow.light)).toHaveLength(26);
      expect(Object.keys(JSON.parse(serializedPayload!).fieldflow.dark)).toHaveLength(26);
    }
  );
});
