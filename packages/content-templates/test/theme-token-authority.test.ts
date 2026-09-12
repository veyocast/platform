import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import type { EditorialColorTokens, PlayerDynamicTemplatePayload } from "@veyocast/contracts";

import { createDynamicTemplateView } from "../src/dynamic-template-view";
import { editorialArenaDarkTokens } from "../src/editorial-arena-theme";
import { createRoyalCurrentAppearance } from "../src/royal-current-theme";
import { freezeThemePresentation, themeCssVariables } from "../src/theme-catalog";

const presentation = freezeThemePresentation({
  instant: "2026-09-09T08:00:00.000Z",
  selection: {
    accent: "#4169E1",
    categoryOverrides: [],
    modePolicy: { kind: "fixed", mode: "dark" },
    ref: { catalog: "v2", id: "fieldflow", version: "1.0.0" },
    support: "#7A5CE6"
  },
  timezone: "Europe/Amsterdam"
});

const tokens: EditorialColorTokens = {
  ...editorialArenaDarkTokens,
  accent: "#4169E1",
  border: "rgba(255, 255, 255, 0.20)",
  canvas: "#142B72",
  row: "#102D67",
  shadow: "rgba(1, 8, 36, 0.36)",
  surface: "#1E3E9F",
  surfaceRaised: "#294EB5",
  text: "#FFFFFF",
  textMuted: "#D3DEFF",
  textOnAccent: "#FFFFFF"
};

function newsPayload(runtimeVersion?: number): PlayerDynamicTemplatePayload {
  return {
    data: {
      ...(runtimeVersion === undefined
        ? {}
        : { _veyocastThemeRuntime: { version: runtimeVersion } }),
      brand: { clubName: "Duindorp SV", primaryColor: "#4169E1" },
      editorial: {
        newsVariant: "hero_split",
        pricePhotoMode: "show",
        schemaVersion: 2,
        theme: { dark: tokens, light: tokens, mode: "dark" },
        themeSelection: presentation.selection
      },
      news: { articles: [], title: "Nieuws" },
      themePresentation: presentation
    },
    orientation: "landscape",
    schemaVersion: 1,
    slideType: "news",
    snapshotHash: "a".repeat(64),
    snapshotId: "00000000-0000-4000-8000-000000001591",
    templateSlug: "editorial-arena-news-dark-landscape",
    templateVersionId: "00000000-0000-4000-8000-000000001592"
  };
}

function royalNewsPayload(overrides: EditorialColorTokens): PlayerDynamicTemplatePayload {
  const royalPresentation = freezeThemePresentation({
    appearance: createRoyalCurrentAppearance({ primary: "#4169e1" }),
    instant: "2026-09-09T08:00:00.000Z",
    selection: presentation.selection,
    timezone: "Europe/Amsterdam"
  });
  return {
    data: {
      _veyocastThemeColorOverrides: {
        dark: overrides,
        light: overrides,
        mode: "dark"
      },
      brand: { clubName: "Duindorp SV", primaryColor: "#4169E1" },
      news: { articles: [], title: "Nieuws" },
      themePresentation: royalPresentation,
      type: "news"
    },
    orientation: "landscape",
    schemaVersion: 1,
    slideType: "news",
    snapshotHash: "b".repeat(64),
    snapshotId: "00000000-0000-4000-8000-000000001593",
    templateSlug: "editorial-arena-news-dark-landscape",
    templateVersionId: "00000000-0000-4000-8000-000000001594"
  };
}

describe("FieldFlow frozen token authority", () => {
  it("projects semantic tenant tokens into every shared theme alias", () => {
    expect(themeCssVariables(presentation, tokens)).toMatchObject({
      "--vc-theme-accent": "#4169E1",
      "--vc-theme-accent-ink": "#FFFFFF",
      "--vc-theme-canvas": "#142B72",
      "--vc-theme-line": "rgba(255, 255, 255, 0.20)",
      "--vc-theme-muted": "#D3DEFF",
      "--vc-theme-shadow": "rgba(1, 8, 36, 0.36)",
      "--vc-theme-surface": "#1E3E9F",
      "--vc-theme-surface-alt": "#294EB5",
      "--vc-theme-text": "#FFFFFF",
      "--vc-theme-text-muted": "#D3DEFF"
    });
  });

  it("activates content-theme overrides only for explicitly marked snapshots", () => {
    expect(createDynamicTemplateView(newsPayload())?.themeRuntimeVersion).toBe(0);
    expect(createDynamicTemplateView(newsPayload(2))?.themeRuntimeVersion).toBe(2);

    const renderer = readFileSync(
      fileURLToPath(new URL("../src/editorial-arena-renderer.tsx", import.meta.url)),
      "utf8"
    );
    expect(renderer).toContain("view.themeRuntimeVersion >= 2");
    expect(renderer).toContain(
      "themeCssVariables(view.themePresentation, view.themeTokens)"
    );
  });

  it("uses the frozen tenant mode instead of the legacy template slug", () => {
    const view = createDynamicTemplateView({
      ...newsPayload(),
      templateSlug: "editorial-arena-news-light-landscape"
    });

    expect(view?.theme).toBe("dark");
    expect(view?.themeTokens.canvas).toBe(tokens.canvas);
  });

  it("honours the complete tenant palette on Royal Current snapshots", () => {
    const custom = {
      ...tokens,
      canvas: "#0b1f55",
      row: "#123477",
      rowSelected: "#123477",
      text: "#ffffff"
    };
    const view = createDynamicTemplateView(royalNewsPayload(custom));
    expect(view?.designRevision).toBe("royal-current-v8");
    expect(view?.themeTokens.canvas).toBe("#0b1f55");
    expect(view?.themeTokens.row).toBe("#123477");
    expect(themeCssVariables(view!.themePresentation, view!.themeTokens)).toMatchObject({
      "--bg": "#0b1f55",
      "--deep": "#123477",
      "--surface": "#1E3E9F",
      "--ink": "#ffffff",
      "--line": "rgba(255, 255, 255, 0.20)"
    });
  });
});
