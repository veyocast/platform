import { describe, expect, it } from "vitest";

import {
  resolveFrozenPlayerTheme,
  themePresentationFromDynamicData
} from "./player-presentation-theme";
import { playerSystemThemeAttributes } from "./player-system-theme";

const snapshot = {
  appearance: {
    designRevision: "royal-current-v8",
    motionEnabled: false,
    palette: {
      background: "club",
      primary: "#08734D",
      secondary: null,
      version: 1
    },
    schemaVersion: 2,
    surfaces: {
      clubLogoBackground: "#FFFFFF",
      homeLogoBackground: "#FFFFFF"
    },
    typography: {
      baseScale: 1,
      bodyFontRef: "vc-roboto-v1",
      displayFontRef: "vc-roboto-v1",
      sportScale: 1
    }
  },
  catalogVersion: "1.0.0",
  resolvedMode: {
    mode: "dark",
    policy: { kind: "fixed", mode: "dark" },
    resolvedAt: "2026-09-09T12:00:00.000Z",
    timezone: "Europe/Amsterdam"
  },
  selection: {
    accent: "#08734D",
    categoryOverrides: [],
    modePolicy: { kind: "fixed", mode: "dark" },
    ref: { catalog: "v2", id: "fieldflow", version: "1.0.0" },
    support: null
  },
  settingsRevision: 7,
  snapshotVersion: 2
} as const;

describe("frozen Player theme projection", () => {
  it("projecteert Royal Current uitsluitend uit een valide immutable snapshot", () => {
    const resolved = resolveFrozenPlayerTheme(snapshot);

    expect(resolved).toMatchObject({
      designRevision: "royal-current-v8",
      mode: "dark",
      motionEnabled: false
    });
    expect(resolved?.style).toMatchObject({
      "--bg": "#0a241b",
      "--player-accent": "#84b9a6",
      "--player-bg": "#0a241b",
      "--player-ink": "#f5f7fb",
      "--vc-theme-body-font": "\"Roboto\""
    });
  });

  it("leest de authority op de bestaande dynamische data-locatie", () => {
    expect(themePresentationFromDynamicData({ themePresentation: snapshot })?.mode)
      .toBe("dark");
    expect(themePresentationFromDynamicData({ themePresentation: { bad: true } }))
      .toBeNull();
    expect(themePresentationFromDynamicData(null)).toBeNull();
  });

  it("valt veilig terug wanneer de Player de catalogusversie niet kent", () => {
    expect(resolveFrozenPlayerTheme({
      ...snapshot,
      catalogVersion: "9.9.9",
      selection: {
        ...snapshot.selection,
        ref: { ...snapshot.selection.ref, version: "9.9.9" }
      }
    })).toBeNull();
  });

  it("merkt systeemschermen als product-owned in plaats van tenant-themed", () => {
    expect(playerSystemThemeAttributes).toEqual({
      "data-design-revision": "royal-current-v8",
      "data-theme-authority": "player-system",
      "data-theme-mode": "dark"
    });
  });
});
