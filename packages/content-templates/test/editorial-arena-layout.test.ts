import { describe, expect, it } from "vitest";

import {
  editorialArenaFrameMetrics,
  paginateEditorialRows,
  priceRowsThatFit,
  resolveEditorialArenaViewportFit,
  sportResultsRowsPerPage,
  sportColumnCount,
  sportRowHeight,
  sportRowsPerColumn,
  sportStandingRowsPerPage
} from "../src/editorial-arena-layout";
import {
  contrastRatio,
  editorialArenaDarkTokens,
  editorialArenaLightTokens,
  parseEditorialArenaConfiguration,
  resolveEditorialThemeConfig
} from "../src/editorial-arena-theme";

describe("Editorial Arena v2 layout", () => {
  it("vult een viewport met gelijke oriëntatie en bewaart mismatch zonder crop", () => {
    expect(resolveEditorialArenaViewportFit(
      { height: 1200, width: 1920 },
      "landscape"
    )).toMatchObject({ mode: "cover", scale: 1200 / 1080 });
    expect(resolveEditorialArenaViewportFit(
      { height: 1920, width: 1200 },
      "portrait"
    )).toMatchObject({ mode: "cover", scale: 1200 / 1080 });
    expect(resolveEditorialArenaViewportFit(
      { height: 1080, width: 1080 },
      "landscape"
    )).toMatchObject({ mode: "cover", scale: 1 });
    expect(resolveEditorialArenaViewportFit(
      { height: 1080, width: 1920 },
      "portrait"
    )).toEqual({ insetX: 0, insetY: 0, mode: "contain", scale: 1080 / 1920 });
  });

  it("houdt de zichtbare buitenmarge aan alle vier viewportzijden gelijk", () => {
    for (const metrics of Object.values(editorialArenaFrameMetrics)) {
      expect(metrics.headerTop).toBe(metrics.gutterX);
      expect(metrics.footerBottom).toBe(metrics.gutterX);
    }
    expect(resolveEditorialArenaViewportFit(
      { height: 1200, width: 1920 },
      "landscape"
    ).insetX).toBeGreaterThan(0);
  });

  it("telt vaste prijslijstrijen per kolom", () => {
    expect(priceRowsThatFit("landscape")).toBe(8);
    expect(priceRowsThatFit("portrait")).toBe(16);
  });

  it("schakelt landschap exact vanaf elf sportregels naar twee kolommen", () => {
    expect(sportColumnCount("landscape", 10)).toBe(1);
    expect(sportColumnCount("landscape", 11)).toBe(2);
    expect(sportRowsPerColumn("landscape", 20)).toBe(10);
    expect(sportColumnCount("portrait", 20)).toBe(1);
    expect(sportRowHeight("portrait", 20)).toBeGreaterThanOrEqual(62);
  });

  it("pagineert pas boven twintig regels", () => {
    expect(paginateEditorialRows(Array.from({ length: 20 }))).toHaveLength(1);
    expect(paginateEditorialRows(Array.from({ length: 21 }))).toHaveLength(2);
  });

  it("pagineert de 50% grotere poulestand op tien leesbare regels", () => {
    expect(sportStandingRowsPerPage).toBe(10);
    expect(paginateEditorialRows(
      Array.from({ length: 20 }),
      sportStandingRowsPerPage
    )).toHaveLength(2);
  });

  it("pagineert 50% grotere pouleuitslagen per schermoriëntatie", () => {
    expect(sportResultsRowsPerPage).toEqual({ landscape: 6, portrait: 5 });
    expect(paginateEditorialRows(
      Array.from({ length: 20 }),
      sportResultsRowsPerPage.landscape
    )).toHaveLength(4);
    expect(paginateEditorialRows(
      Array.from({ length: 20 }),
      sportResultsRowsPerPage.portrait
    )).toHaveLength(4);
  });
});

describe("Editorial Arena v2 theme", () => {
  it("materialiseert volledige light- en darkmaps", () => {
    const theme = resolveEditorialThemeConfig({
      accent: "#315CFF",
      mode: "dark"
    });
    expect(theme.dark).toMatchObject({
      accent: "#315CFF",
      canvas: editorialArenaDarkTokens.canvas
    });
    expect(theme.light).toEqual(editorialArenaLightTokens);
  });

  it("valt bij legacy snapshots terug op veilige volledige tokens", () => {
    const configuration = parseEditorialArenaConfiguration(undefined, {
      accent: "#315CFF",
      mode: "light"
    });
    expect(configuration).toMatchObject({
      newsVariant: "hero_split",
      pricePhotoMode: "show",
      schemaVersion: 2,
      theme: { mode: "light" }
    });
  });

  it("berekent WCAG-contrast voor de wizard", () => {
    expect(contrastRatio("#111315", "#F3F0E9")).toBeGreaterThan(4.5);
    expect(contrastRatio("rgba(17, 19, 21, 0.92)", "hsl(40, 29%, 93%)"))
      .toBeGreaterThan(4.5);
  });
});
