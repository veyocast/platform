import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { ThemeSelection } from "@veyocast/contracts";
import {
  createRoyalCurrentAppearance,
  createRoyalCurrentTheme
} from "@veyocast/content-templates";

import { TenantThemeEditor } from "./tenant-theme-editor";

const selection: ThemeSelection = {
  accent: "#2459ED",
  categoryOverrides: [],
  modePolicy: { kind: "fixed", mode: "light" },
  ref: { catalog: "v2", id: "fieldflow", version: "1.0.0" },
  support: null
};

describe("TenantThemeEditor appearance-bediening", () => {
  it("toont en previewt fonts, schalen, motion en beide opgeslagen logo-oppervlakken", () => {
    const appearance = {
      ...createRoyalCurrentAppearance(),
      motionEnabled: false,
      surfaces: {
        clubLogoBackground: "#123456",
        homeLogoBackground: "#FEDCBA"
      },
      typography: {
        baseScale: 1.2,
        bodyFontRef: "vc-inter-v1",
        displayFontRef: "vc-manrope-v1",
        sportScale: 1.4
      }
    } as const;
    const theme = createRoyalCurrentTheme(appearance.palette, "light");
    const html = renderToStaticMarkup(createElement(TenantThemeEditor, {
      defaults: theme,
      disabled: false,
      initialAppearance: appearance,
      initialSelection: selection,
      initialTheme: theme
    }));
    const appearanceInput = html.match(
      /<input[^>]*name="themeAppearanceJson"[^>]*>/
    )?.[0];
    const serializedAppearance = appearanceInput
      ?.match(/value="([^"]+)"/)?.[1]
      ?.replaceAll("&quot;", '"');

    expect(html).toContain("Achtergrond clublogo");
    expect(html).toContain("Achtergrond thuislogo");
    expect(html).toContain("#123456");
    expect(html).toContain("#FEDCBA");
    expect(html).toContain("--preview-club-logo-background:#123456");
    expect(html).toContain("--preview-home-logo-background:#FEDCBA");
    expect(html).toContain('--preview-body-font:&quot;Inter&quot;');
    expect(html).toContain('--preview-display-font:&quot;Manrope&quot;');
    expect(html).toContain("--preview-base-scale:1.2");
    expect(html).toContain("--preview-sport-scale:1.4");
    expect(html).toContain('data-motion-state="off"');
    expect(html).toContain("beweging uit");
    expect(JSON.parse(serializedAppearance!).surfaces).toEqual(
      appearance.surfaces
    );
  });
});
