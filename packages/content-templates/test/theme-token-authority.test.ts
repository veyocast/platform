import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import type { EditorialColorTokens, PlayerDynamicTemplatePayload } from "@veyocast/contracts";

import { createDynamicTemplateView } from "../src/dynamic-template-view";
import { editorialArenaDarkTokens } from "../src/editorial-arena-theme";
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
});
