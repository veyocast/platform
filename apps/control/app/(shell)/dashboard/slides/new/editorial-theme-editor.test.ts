import { describe, expect, it } from "vitest";

import { editorialArenaLightTokens } from "@veyocast/content-templates/editorial-arena-theme";

import {
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
});
