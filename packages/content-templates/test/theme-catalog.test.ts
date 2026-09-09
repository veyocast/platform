import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import {
  authorableThemeIds,
  defaultThemeAppearanceSettings,
  dynamicSlideTypes,
  editorialArenaActiveSlideTypes,
  selectableThemeIds
} from "@veyocast/contracts";

import fontLock from "../src/fonts/fonts.lock.json";
import {
  createDynamicTemplateFixtureView,
  createDynamicTemplateView
} from "../src/dynamic-template-view";
import { createRoyalCurrentAppearance } from "../src/royal-current-theme";
import {
  editorialThemeHasValidContrast
} from "../src/editorial-arena-theme";
import {
  freezeThemePresentation,
  parseThemeSelection,
  resolveThemeTransition,
  themeCatalog,
  themeCssVariables,
  themeManifest,
  themeToEditorialTokens
} from "../src/theme-catalog";
import {
  initialThemeMotionFrame,
  reduceThemeMotion,
  themePosterFrameAt
} from "../src/theme-motion";
import {
  themeVisualFamilies,
  themeVisualMatrix
} from "../src/theme-visual-matrix";

describe("theme catalog v2", () => {
  it("keeps FieldFlow authorable and all eleven renderable themes available", () => {
    expect(Object.keys(themeCatalog)).toEqual([...selectableThemeIds]);
    expect(themeManifest.themes).toHaveLength(11);
    expect(authorableThemeIds).toEqual(["fieldflow"]);
  });

  it("fails explicitly for unknown authoring themes", () => {
    expect(() => parseThemeSelection({
      accent: null,
      categoryOverrides: [],
      modePolicy: { kind: "fixed", mode: "light" },
      ref: { catalog: "v2", id: "unknown", version: "1.0.0" },
      support: null
    })).toThrow("unknown theme");
  });

  it("locks every manifest font reference to local bytes", async () => {
    expect(Object.keys(fontLock.assets).sort()).toEqual(
      Object.keys(themeManifest.fontAssets).sort()
    );
    for (const assets of Object.values(fontLock.assets)) {
      for (const asset of assets) {
        const bytes = await readFile(new URL(`../src/fonts/${asset.file}`, import.meta.url));
        expect(createHash("sha256").update(bytes).digest("hex")).toBe(asset.sha256);
      }
    }
    for (const [fontRef, definition] of Object.entries(themeManifest.fontAssets)) {
      const formats = fontLock.assets[fontRef as keyof typeof fontLock.assets]
        .map((asset) => asset.format);
      if (definition.requiredFormat === "woff2-variable") {
        expect(formats).toContain("woff2-variable");
      } else if (definition.requiredFormat === "woff2") {
        expect(formats).toContain("woff2");
      } else {
        expect(formats.every((format) => ["woff2", "woff2-variable"].includes(format)))
          .toBe(true);
      }
    }
  });

  it("freezes scheduled mode resolution and never resolves it during playback", () => {
    const snapshot = freezeThemePresentation({
      instant: "2026-08-20T18:30:00.000Z",
      selection: {
        accent: null,
        categoryOverrides: [],
        modePolicy: {
          entries: [{ days: [4], end: "23:00", mode: "dark", start: "18:00" }],
          fallback: "light",
          kind: "schedule",
          timezone: "Europe/Amsterdam"
        },
        ref: { catalog: "v2", id: "obsidian", version: "1.0.0" },
        support: null
      },
      timezone: "Europe/Amsterdam"
    });
    expect(snapshot.resolvedMode.mode).toBe("dark");
    expect(themeToEditorialTokens(snapshot).canvas).toBe(themeCatalog.obsidian.dark.canvas);
  });

  it("materialiseert v2 appearance en houdt v1-snapshots veilig renderbaar", () => {
    const currentDefault = freezeThemePresentation({
      appearance: defaultThemeAppearanceSettings,
      instant: "2026-09-06T13:33:00.000Z",
      selection: {
        accent: null,
        categoryOverrides: [],
        modePolicy: { kind: "fixed", mode: "light" },
        ref: { catalog: "v2", id: "fieldflow", version: "1.0.0" },
        support: null
      },
      timezone: "Europe/Amsterdam"
    });

    expect(themeCssVariables(currentDefault)).toMatchObject({
      "--brand-primary": "#2459ed",
      "--vc-club-logo-background": "#FFFFFF",
      "--vc-home-logo-background": "#FFFFFF",
      "--vc-theme-body-font": '"Roboto"',
      "--vc-theme-display-font": '"Roboto"',
      "--vc-theme-font-20": "20px",
      "--vc-theme-sport-row-size": "20px"
    });

    const legacy = {
      catalogVersion: "1.0.0",
      resolvedMode: currentDefault.resolvedMode,
      selection: currentDefault.selection,
      snapshotVersion: 1 as const
    };
    expect(themeCssVariables(legacy)).toMatchObject({
      "--vc-club-logo-background": "#E7F5EE",
      "--vc-home-logo-background": "#FFFFFF",
      "--vc-theme-body-font": '"Inter"',
      "--vc-theme-font-20": "20px",
      "--vc-theme-display-font": '"Manrope"',
      "--vc-theme-sport-result-size-compact": "24px",
      "--vc-theme-sport-row-size": "22.4px",
      "--vc-theme-sport-score-size-compact": "42px"
    });

    const current = {
      ...legacy,
      appearance: {
        schemaVersion: 1 as const,
        surfaces: {
          clubLogoBackground: "#102030",
          homeLogoBackground: "#FEFEFE"
        },
        typography: {
          baseScale: 1.1,
          bodyFontRef: "vc-source-serif-4-v1" as const,
          displayFontRef: "vc-anton-v1" as const,
          sportScale: 1.2
        }
      },
      settingsRevision: 9,
      snapshotVersion: 2 as const
    };

    expect(themeCssVariables(current)).toMatchObject({
      "--vc-club-logo-background": "#102030",
      "--vc-home-logo-background": "#FEFEFE",
      "--vc-theme-base-scale": 1.1,
      "--vc-theme-body-font": '"Source Serif 4"',
      "--vc-theme-font-20": "22px",
      "--vc-theme-font-34": "37.4px",
      "--vc-theme-display-font": '"Anton"',
      "--vc-theme-sport-result-size-compact": "28.286px",
      "--vc-theme-sport-result-size": "39.6px",
      "--vc-theme-sport-row-size": "26.4px",
      "--vc-theme-sport-score-size-compact": "49.5px",
      "--vc-theme-sport-score-size": "61.38px",
      "--vc-theme-title-size": "70.4px"
    });
  });

  it("bounds every transition and applies the reduced-motion ceiling", () => {
    for (const id of selectableThemeIds) {
      const snapshot = freezeThemePresentation({
        instant: "2026-08-20T12:00:00.000Z",
        selection: {
          accent: null,
          categoryOverrides: [],
          modePolicy: { kind: "fixed", mode: "light" },
          ref: { catalog: "v2", id, version: themeCatalog[id].version },
          support: null
        },
        timezone: "Europe/Amsterdam"
      });
      expect(resolveThemeTransition(snapshot, "news", false).durationMs).toBeLessThanOrEqual(560);
      expect(resolveThemeTransition(snapshot, "news", true).durationMs).toBeLessThanOrEqual(120);
      expect(resolveThemeTransition(snapshot, "news", false).translatePercent).toBeLessThanOrEqual(2.5);
    }
  });

  it("keeps every catalog theme AA-readable in light and dark mode", () => {
    for (const id of selectableThemeIds) {
      const selection = {
        accent: null,
        categoryOverrides: [],
        modePolicy: { kind: "fixed" as const, mode: "light" as const },
        ref: { catalog: "v2" as const, id, version: themeCatalog[id].version },
        support: null
      };
      const tokens = (mode: "dark" | "light") => themeToEditorialTokens(
        freezeThemePresentation({
          instant: "2026-08-20T12:00:00.000Z",
          selection: {
            ...selection,
            modePolicy: { kind: "fixed", mode }
          },
          timezone: "Europe/Amsterdam"
        })
      );
      expect(editorialThemeHasValidContrast({
        dark: tokens("dark"),
        light: tokens("light"),
        mode: "light"
      }), id).toBe(true);
    }
  });

  it("maakt de FieldFlow fullscreen-fotogradient neutraal en donker achter tekst", () => {
    const tokens = themeToEditorialTokens(freezeThemePresentation({
      appearance: defaultThemeAppearanceSettings,
      instant: "2026-09-02T12:00:00.000Z",
      selection: {
        accent: null,
        categoryOverrides: [],
        modePolicy: { kind: "fixed", mode: "dark" },
        ref: { catalog: "v2", id: "fieldflow", version: themeCatalog.fieldflow.version },
        support: null
      },
      timezone: "Europe/Amsterdam"
    }));

    expect(tokens.imageOverlayStart).toBe("rgba(23,33,58,0.80)");
    expect(tokens.imageOverlayMid).toBe("rgba(23,33,58,0.46)");
    expect(tokens.imageOverlayEnd).toBe("rgba(23,33,58,0.08)");
  });

  it("geeft Royal Current-snapshots voorrang en behoudt v1-kleurkaarten", () => {
    const selection = {
      accent: "#315CFF",
      categoryOverrides: [],
      modePolicy: { kind: "fixed" as const, mode: "light" as const },
      ref: {
        catalog: "v2" as const,
        id: "fieldflow" as const,
        version: themeCatalog.fieldflow.version
      },
      support: null
    };
    const presentation = freezeThemePresentation({
      appearance: createRoyalCurrentAppearance({ primary: selection.accent }),
      instant: "2026-09-05T12:00:00.000Z",
      selection,
      timezone: "Europe/Amsterdam"
    });
    const light = themeToEditorialTokens(presentation);
    const dark = themeToEditorialTokens(freezeThemePresentation({
      appearance: createRoyalCurrentAppearance({ primary: selection.accent }),
      instant: "2026-09-05T12:00:00.000Z",
      selection: { ...selection, modePolicy: { kind: "fixed", mode: "dark" } },
      timezone: "Europe/Amsterdam"
    }));
    const view = createDynamicTemplateView({
      data: {
        brand: { clubName: "Testclub", primaryColor: "#315CFF" },
        editorial: {
          newsVariant: "fullscreen_gradient",
          pricePhotoMode: "show",
          schemaVersion: 2,
          theme: {
            dark,
            light: {
              ...light,
              canvas: "#EAF0FF",
              imageOverlayStart: "rgba(5, 20, 65, 0.88)"
            },
            mode: "light"
          },
          themeSelection: selection
        },
        news: { articles: [], title: "Nieuws" },
        themePresentation: presentation
      },
      orientation: "landscape",
      schemaVersion: 1,
      slideType: "news",
      snapshotHash: "a".repeat(64),
      snapshotId: "00000000-0000-4000-8000-000000000109",
      templateSlug: "editorial-arena-news-light-landscape",
      templateVersionId: "00000000-0000-4000-8000-000000000110"
    });

    expect(presentation.snapshotVersion).toBe(2);
    if (presentation.snapshotVersion !== 2) throw new Error("v2 snapshot verwacht");
    expect(presentation.appearance.schemaVersion).toBe(2);
    if (presentation.appearance.schemaVersion !== 2) throw new Error("v2 appearance verwacht");
    expect(presentation.appearance.palette.primary).toBe("#315CFF");
    expect(view?.themeTokens.canvas).toBe(light.canvas);
    expect(view?.themeTokens.imageOverlayStart).toBe(light.imageOverlayStart);
    expect(view?.themeTokens.canvas).not.toBe("#EAF0FF");

    const legacyView = createDynamicTemplateView({
      ...{
        data: {
          brand: { clubName: "Testclub", primaryColor: "#315CFF" },
          editorial: {
            newsVariant: "fullscreen_gradient",
            pricePhotoMode: "show",
            schemaVersion: 2,
            theme: {
              dark,
              light: {
                ...light,
                canvas: "#EAF0FF",
                imageOverlayStart: "rgba(5, 20, 65, 0.88)"
              },
              mode: "light"
            },
            themeSelection: selection
          },
          news: { articles: [], title: "Nieuws" },
          themePresentation: {
            catalogVersion: presentation.catalogVersion,
            resolvedMode: presentation.resolvedMode,
            selection: presentation.selection,
            snapshotVersion: 1
          }
        },
        orientation: "landscape" as const,
        schemaVersion: 1 as const,
        slideType: "news" as const,
        snapshotHash: "b".repeat(64),
        snapshotId: "00000000-0000-4000-8000-000000000111",
        templateSlug: "editorial-arena-news-light-landscape",
        templateVersionId: "00000000-0000-4000-8000-000000000112"
      }
    });
    expect(legacyView?.designRevision).toBe("legacy");
    expect(legacyView?.themeTokens.canvas).toBe("#EAF0FF");
  });

  it("starts ACTIVE dwell only after ENTERING completes and fixes posters at 900 ms", () => {
    const entering = reduceThemeMotion(initialThemeMotionFrame, { type: "ACTIVATE" });
    expect(entering).toEqual({ activeDwellStarted: false, state: "ENTERING" });
    expect(reduceThemeMotion(entering, { type: "ENTER_COMPLETE" })).toEqual({
      activeDwellStarted: true,
      state: "ACTIVE"
    });
    expect(themePosterFrameAt(899)).toBe(false);
    expect(themePosterFrameAt(900)).toBe(true);
  });

  it("does not leak state across one thousand deterministic transitions", () => {
    let frame = initialThemeMotionFrame;
    for (let index = 0; index < 1_000; index += 1) {
      frame = reduceThemeMotion(frame, { type: "ACTIVATE" });
      frame = reduceThemeMotion(frame, { type: "ENTER_COMPLETE" });
      frame = reduceThemeMotion(frame, { type: "REQUEST_EXIT" });
      frame = reduceThemeMotion(frame, { type: "EXIT_COMPLETE" });
      expect(frame).toBe(initialThemeMotionFrame);
    }
  });

  it("plans every real family and the explicitly fixture-only poll/CTA cell", () => {
    expect(themeVisualFamilies).toContain("poll_cta_fixture");
    expect(themeVisualMatrix).toHaveLength(
      selectableThemeIds.length * 2 * 2 * themeVisualFamilies.length
    );
    expect(themeVisualMatrix.filter((cell) => cell.fixtureOnly).length).toBe(
      (dynamicSlideTypes.length - editorialArenaActiveSlideTypes.length + 1) *
        selectableThemeIds.length * 4
    );
  });

  it("lets the shared snapshot view resolve every theme in both modes and orientations", () => {
    for (const id of selectableThemeIds) {
      for (const mode of ["light", "dark"] as const) {
        for (const orientation of ["landscape", "portrait"] as const) {
          const themePresentation = freezeThemePresentation({
            instant: "2026-08-20T12:00:00.000Z",
            selection: {
              accent: null,
              categoryOverrides: [],
              modePolicy: { kind: "fixed", mode },
              ref: { catalog: "v2", id, version: themeCatalog[id].version },
              support: null
            },
            timezone: "Europe/Amsterdam"
          });
          for (const slideType of dynamicSlideTypes) {
            const data = slideType === "menu"
              ? { menu: { products: [], title: "Menu" } }
              : slideType === "price_list"
                ? { priceList: { sections: [], title: "Prijslijst" } }
                : slideType === "news"
                  ? { news: { articles: [], title: "Nieuws" } }
                  : { sport: { items: [], title: "Clubinformatie" } };
            const createView = editorialArenaActiveSlideTypes.includes(
              slideType as (typeof editorialArenaActiveSlideTypes)[number]
            ) ? createDynamicTemplateView : createDynamicTemplateFixtureView;
            const view = createView({
              data: {
                brand: { clubName: "Testclub", primaryColor: "#FF5C20" },
                ...data,
                themePresentation
              },
              orientation,
              schemaVersion: 1,
              slideType,
              snapshotHash: "a".repeat(64),
              snapshotId: "00000000-0000-4000-8000-000000000109",
              templateSlug: `editorial-arena-${slideType.replaceAll("_", "-")}-${mode}-${orientation}`,
              templateVersionId: "00000000-0000-4000-8000-000000000110"
            });
            expect(view, slideType).not.toBeNull();
            expect(view?.themeId).toBe(id);
            expect(view?.themePresentation.resolvedMode.mode).toBe(mode);
            expect(view?.orientation).toBe(orientation);
          }
        }
      }
    }
  });
});
