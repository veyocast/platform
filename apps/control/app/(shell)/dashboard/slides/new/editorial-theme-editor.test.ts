import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { EditorialThemeConfig, ThemeSelection } from "@veyocast/contracts";
import { editorialArenaLightTokens } from "@veyocast/content-templates/editorial-arena-theme";

import {
  EditorialThemeEditor,
  colorPickerValue,
  editorialThemeTokenGroups,
  replaceColorChannels
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

  it("toont een taakgerichte preview, paletkeuze en volledige formulierpayload", () => {
    const theme: EditorialThemeConfig = {
      dark: editorialArenaLightTokens,
      light: editorialArenaLightTokens,
      mode: "light"
    };
    const selection: ThemeSelection = {
      accent: "#315CFF",
      categoryOverrides: [],
      modePolicy: { kind: "fixed", mode: "light" },
      ref: { catalog: "v2", id: "fieldflow", version: "1.0.0" },
      support: null
    };
    const html = renderToStaticMarkup(createElement(EditorialThemeEditor, {
      defaults: theme,
      disabled: false,
      onChange: () => undefined,
      onSelectionChange: () => undefined,
      selection,
      theme
    }));

    expect(html).toContain("Live voorbeeld");
    expect(html).toContain('role="tablist"');
    expect(html).toContain('name="themeColorOverridesJson"');
    expect(html).toContain("Contrastcontrole");
  });
});
