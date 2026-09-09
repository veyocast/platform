import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  defaultThemeAppearanceSettings,
  type ThemeSelection
} from "@veyocast/contracts";
import {
  freezeThemePresentation,
  themeToEditorialTokens
} from "@veyocast/content-templates/theme-catalog";

import { TenantStyleSummary } from "./tenant-style-summary";

const selection: ThemeSelection = {
  accent: "#2459ed",
  categoryOverrides: [],
  modePolicy: { kind: "fixed", mode: "light" },
  ref: { catalog: "v2", id: "fieldflow", version: "1.0.0" },
  support: null
};
const presentation = freezeThemePresentation({
  appearance: defaultThemeAppearanceSettings,
  instant: "2026-09-09T12:00:00.000Z",
  selection,
  settingsRevision: 4,
  timezone: "Europe/Amsterdam"
});
const tokens = (mode: "dark" | "light") => themeToEditorialTokens({
  ...presentation,
  resolvedMode: { ...presentation.resolvedMode, mode }
});

describe("tenantstijl-indicatie", () => {
  it("toont beide modes en maakt geen losse stijlcontrol aan", () => {
    const html = renderToStaticMarkup(
      <TenantStyleSummary style={{
        appearance: defaultThemeAppearanceSettings,
        dark: tokens("dark"),
        error: null,
        light: tokens("light"),
        presentation,
        revision: 4,
        selection
      }} />
    );

    expect(html).toContain("Gebruikt clubstijl");
    expect(html).toContain("Royal Current");
    expect(html).toContain("Navy Glass");
    expect(html).toContain("Tekstschaal 100%");
    expect(html).toContain("Motion aan");
    expect(html).toContain("/dashboard/themes/fieldflow");
    expect(html).not.toContain("<input");
    expect(html).not.toContain("<select");
  });
});
