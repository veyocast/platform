import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { EditorialThemeConfig, ThemeSelection } from "@veyocast/contracts";
import {
  editorialArenaLightTokens,
  editorialThemeCssVariables,
  editorialThemeHasValidContrast
} from "@veyocast/content-templates/editorial-arena-theme";

import {
  EditorialThemeEditor,
  colorPickerValue,
  deriveSupportColor,
  editorialThemeTokenGroups,
  fieldflowPalettePresets,
  generateFieldflowPalette,
  replaceColorChannels,
  resolveThemeDraftDefaults
} from "./editorial-theme-editor";

describe("Centrale tenantkleur-editor", () => {
  it("biedt ieder semantisch kleurtoken precies eenmaal aan", () => {
    const editorTokens = editorialThemeTokenGroups
      .flatMap((group) => [...group.tokens])
      .sort();
    const contractTokens = Object.keys(editorialArenaLightTokens).sort();

    expect(editorTokens).toEqual(contractTokens);
    expect(new Set(editorTokens).size).toBe(editorTokens.length);
  });

  it("toont rgba-kleuren in de native kleurkiezer", () => {
    expect(colorPickerValue("rgba(5, 20, 65, 0.88)")).toBe("#051441");
    expect(colorPickerValue("#315CFF")).toBe("#315cff");
    expect(colorPickerValue("hsla(225, 100%, 60%, 0.8)")).toBe("#3366ff");
  });

  it("behoudt transparantie wanneer de kleurkiezer een token wijzigt", () => {
    expect(replaceColorChannels("rgba(6, 8, 10, 0.84)", "#315cff"))
      .toBe("rgba(49, 92, 255, 0.84)");
    expect(replaceColorChannels("#ffffff", "#315cff")).toBe("#315CFF");
  });

  it("blijft veilig tijdens onvolledige accent- en tijdinvoer", () => {
    const fallback: EditorialThemeConfig = {
      dark: editorialArenaLightTokens,
      light: editorialArenaLightTokens,
      mode: "light"
    };
    const selection: ThemeSelection = {
      accent: "#315CFF",
      categoryOverrides: [],
      modePolicy: { kind: "fixed", mode: "light" },
      ref: { catalog: "v2", id: "fieldflow", version: "1.0.0" },
      support: "#00A989"
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
    expect(resolveThemeDraftDefaults(selection, fallback).valid).toBe(true);
  });

  it.each(["#000000", "#FFFFFF", "#FFFF00", "#777777", "#3D61FF"])(
    "bouwt voor de extreme hoofdkleur %s twee complete contrastrijke paletten",
    (primary) => {
      for (const preset of fieldflowPalettePresets) {
        const generated = generateFieldflowPalette(primary, preset.recipe, "dark");
        expect(Object.keys(generated.light).sort())
          .toEqual(Object.keys(editorialArenaLightTokens).sort());
        expect(Object.keys(generated.dark).sort())
          .toEqual(Object.keys(editorialArenaLightTokens).sort());
        expect(editorialThemeHasValidContrast(generated)).toBe(true);
        expect(generated.mode).toBe("dark");
      }
      expect(deriveSupportColor(primary)).toMatch(/^#[0-9A-F]{6}$/);
    }
  );

  it("laat recepten aantoonbaar verschillende volledige paletten maken", () => {
    const balanced = generateFieldflowPalette("#315CFF", "balanced");
    const bright = generateFieldflowPalette("#315CFF", "bright");
    const deep = generateFieldflowPalette("#315CFF", "deep");

    expect(new Set([
      balanced.light.canvas,
      bright.light.canvas,
      deep.light.canvas
    ]).size).toBe(3);
    expect(new Set([
      balanced.dark.surface,
      bright.dark.surface,
      deep.dark.surface
    ]).size).toBe(3);
  });

  it.each(["light", "dark"] as const)(
    "toont alle kleurvelden en previewrollen voor het %s palet",
    (mode) => {
      const theme = generateFieldflowPalette("#315CFF", "balanced", mode);
      const selection: ThemeSelection = {
        accent: "#315CFF",
        categoryOverrides: [],
        modePolicy: { kind: "fixed", mode },
        ref: { catalog: "v2", id: "fieldflow", version: "1.0.0" },
        support: "#00A989"
      };
      const html = renderToStaticMarkup(createElement(EditorialThemeEditor, {
        defaults: theme,
        disabled: false,
        onChange: () => undefined,
        onSelectionChange: () => undefined,
        selection,
        theme
      }));
      const contractTokens = Object.keys(editorialArenaLightTokens).sort();
      const controlTokens = [...html.matchAll(new RegExp(
        `name="${mode}-([A-Za-z]+)"`,
        "g"
      ))].map((match) => match[1]).sort();
      const previewTokens = [...html.matchAll(/data-theme-tokens="([^"]+)"/g)]
        .flatMap((match) => match[1]!.split(" "));
      const payloadInput = html.match(
        /<input[^>]*name="themeColorOverridesJson"[^>]*>/
      )?.[0];
      const serializedPayload = payloadInput
        ?.match(/value="([^"]+)"/)?.[1]
        ?.replaceAll("&quot;", '"');

      expect(html).toContain("Live voorbeeld");
      expect(html).toContain("26/26 rollen");
      expect(html).toContain("Hoofdkleur");
      expect(html).toContain("Standaardpaletten");
      expect(html).toContain('name="themeSaveReadiness"');
      expect(html).toContain('value="ready"');
      expect(html).toContain('role="tablist"');
      expect(html).toContain("Contrastcontrole");
      expect(html).toContain("Palet opnieuw opbouwen");
      expect(controlTokens).toEqual(contractTokens);
      expect(new Set(previewTokens)).toEqual(new Set(contractTokens));
      expect(html.match(/aria-label="[^"]+ herstellen"/g)).toHaveLength(26);
      expect(html).not.toContain("Alle kleuren aanpassen");
      expect(serializedPayload).toBeDefined();
      expect(Object.keys(JSON.parse(serializedPayload!).fieldflow.light).sort())
        .toEqual(contractTokens);
      expect(Object.keys(JSON.parse(serializedPayload!).fieldflow.dark).sort())
        .toEqual(contractTokens);
      for (const variable of Object.keys(editorialThemeCssVariables(
        editorialArenaLightTokens
      ))) {
        expect(html).toContain(`${variable}:`);
      }
      for (const setting of [
        "baseAccent",
        "clubLogoBackground",
        "homeLogoBackground",
        "support"
      ]) {
        expect(html).toContain(`data-theme-setting="${setting}"`);
      }
    }
  );
});
