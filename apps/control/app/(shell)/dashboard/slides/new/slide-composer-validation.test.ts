import { describe, expect, it } from "vitest";

import {
  freezeThemePresentation,
  platformDefaultThemeSelection,
  themeToEditorialTokens
} from "@veyocast/content-templates/theme-catalog";

import {
  slideComposerErrorPath,
  validateEditorialSlideTheme
} from "./slide-composer-validation";

function validTheme() {
  const tokens = (mode: "dark" | "light") => themeToEditorialTokens(
    freezeThemePresentation({
      instant: "2026-08-29T12:00:00.000Z",
      selection: {
        ...platformDefaultThemeSelection,
        modePolicy: { kind: "fixed", mode }
      },
      timezone: "Europe/Amsterdam"
    })
  );
  return {
    dark: tokens("dark"),
    light: tokens("light"),
    mode: "light" as const
  };
}

describe("nieuwsslide-validatie", () => {
  it("accepteert het standaard Editorial-thema bij preview en opslag", () => {
    const theme = validTheme();
    expect(validateEditorialSlideTheme({
      rawTheme: theme,
      rawThemeSelection: platformDefaultThemeSelection,
      resolvedTheme: theme,
      slideType: "news"
    })).toEqual({ ok: true });
  });

  it("weigert werkelijk te laag accentcontrast", () => {
    const theme = validTheme();
    const invalid = {
      ...theme,
      dark: { ...theme.dark, accent: "#ff5a1f", textOnAccent: "#fffaf2" },
      light: { ...theme.light, accent: "#ff5a1f", textOnAccent: "#fffaf2" }
    };
    expect(validateEditorialSlideTheme({
      rawTheme: invalid,
      rawThemeSelection: platformDefaultThemeSelection,
      resolvedTheme: invalid,
      slideType: "news"
    })).toMatchObject({
      code: "EDITORIAL_THEME_CONTRAST_LOW",
      ok: false
    });
  });

  it("behoudt de nieuwsfamilie en foutmelding in de wizardroute", () => {
    const path = slideComposerErrorPath(
      "news",
      "De slide kon tijdelijk niet worden gemaakt."
    );
    const url = new URL(path, "https://control.veyocast.nl");
    expect(url.pathname).toBe("/dashboard/slides/new");
    expect(url.searchParams.get("family")).toBe("news");
    expect(url.searchParams.get("fout")).toBe(
      "De slide kon tijdelijk niet worden gemaakt."
    );
  });
});
