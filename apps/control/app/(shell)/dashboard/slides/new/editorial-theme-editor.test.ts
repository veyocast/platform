import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { EditorialThemeConfig, ThemeSelection } from "@veyocast/contracts";
import {
  themeCatalog,
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

describe("Centrale authorable clubstijl-editor", () => {
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

  it.each((["fieldflow", "onzetrots-tv"] as const).flatMap(themeId => (["light", "dark"] as const).map(mode => ({themeId,mode}))))(
    "toont $themeId en beide live paletpreviews in $mode",
    ({themeId,mode}) => {
      const theme = createRoyalCurrentTheme({ primary: "#2459ED" }, mode);
      const html = renderToStaticMarkup(createElement(EditorialThemeEditor, {
        appearance: createRoyalCurrentAppearance(),
        defaults: theme,
        disabled: false,
        onAppearanceChange: () => undefined,
        onChange: () => undefined,
        onSelectionChange: () => undefined,
        selection: { ...selection, ref: { catalog: "v2", id:themeId, version:themeCatalog[themeId].version }, modePolicy: { kind: "fixed", mode } },
        theme
      }));
      const payloadInput = html.match(
        /<input[^>]*name="themeColorOverridesJson"[^>]*>/
      )?.[0];
      const serializedPayload = payloadInput
        ?.match(/value="([^"]+)"/)?.[1]
        ?.replaceAll("&quot;", '"');

      expect(html).toContain(themeCatalog[themeId].name);
      expect(html).toContain(`value="${themeId}" selected=""`);
      expect(html).toContain("OnzeTrots TV");
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
      expect(html).toContain(`name="themeId" value="${themeId}"`);
      expect(html).toContain(`name="themeVersion" value="${themeCatalog[themeId].version}"`);
      expect(Object.keys(JSON.parse(serializedPayload!).fieldflow.light)).toHaveLength(26);
      expect(Object.keys(JSON.parse(serializedPayload!).fieldflow.dark)).toHaveLength(26);
    }
  );

  it("noemt de behouden legacy-editor Huisstijl zonder catalogreferentie of hidden payload te wijzigen", () => {
    const legacySelection: ThemeSelection = { ...selection, ref: { catalog: "legacy", legacyThemeId: "editorial", version: 1 } };
    const before = JSON.stringify(legacySelection);
    const theme = createRoyalCurrentTheme({ primary: "#2459ED" }, "light");
    const html = renderToStaticMarkup(createElement(EditorialThemeEditor, {
      appearance: createRoyalCurrentAppearance(), defaults: theme, disabled: false,
      onAppearanceChange: () => undefined, onChange: () => undefined, onSelectionChange: () => undefined,
      selection: legacySelection, theme
    }));
    expect(html).toMatch(/class="[^"]*editorialThemeEyebrow[^"]*">Huisstijl<\/span>/);
    expect(html).toContain('name="themeId" value="fieldflow"');
    expect(html).toContain('name="themeVersion" value="1"');
    expect(html).toContain('name="themeAccent"');
    expect(JSON.stringify(legacySelection)).toBe(before);
  });

});
