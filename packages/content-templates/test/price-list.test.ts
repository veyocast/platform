import { describe, expect, it } from "vitest";

import {
  paginatePriceList,
  priceListCapacityReport,
  resolvePriceListPhotoVisibility,
  type ResolvedPriceListItem,
  type ResolvedPriceListSection
} from "../src/price-list";

function item(id: string): ResolvedPriceListItem {
  return {
    description: `Omschrijving ${id}`,
    formattedPrice: "€ 2,50",
    id,
    image: { kind: "empty" },
    name: `Product ${id}`,
    photoVisible: false
  };
}

function section(
  id: string,
  count: number,
  column: "left" | "right" = "left",
  order = 0
): ResolvedPriceListSection {
  return {
    column,
    id,
    name: `Categorie ${id}`,
    order,
    products: Array.from({ length: count }, (_, index) => item(`${id}-${index}`))
  };
}

describe("prijslijstpaginering", () => {
  it("telt categorieën en producten als vaste rijen met 9/17 capaciteit", () => {
    expect(priceListCapacityReport([section("a", 8)], "landscape")).toMatchObject({
      capacityPerColumn: 9,
      pageCount: 1,
      selectedRows: { left: 9, right: 0 }
    });
    expect(priceListCapacityReport([section("a", 16)], "portrait")).toMatchObject({
      capacityPerColumn: 17,
      pageCount: 1,
      selectedRows: { left: 17, right: 0 }
    });
  });

  it("laat een categoriekop niet als verweesde laatste rij staan", () => {
    const pages = paginatePriceList([
      section("first", 7, "left", 0),
      section("second", 1, "left", 1)
    ], "landscape");
    expect(pages).toHaveLength(2);
    expect(pages[0]?.columns.left).toHaveLength(8);
    expect(pages[1]?.columns.left.map((row) => row.kind)).toEqual([
      "category",
      "product"
    ]);
  });

  it("herhaalt de categorie op vervolgpagina en telt die rij opnieuw", () => {
    const pages = paginatePriceList([section("long", 9)], "landscape");
    expect(pages).toHaveLength(2);
    expect(pages[1]?.columns.left[0]).toMatchObject({
      continuation: true,
      kind: "category",
      name: "Categorie long"
    });
    expect(pages[1]?.columns.left).toHaveLength(2);
  });

  it("behoudt expliciete kolommen en volgorde zonder balanceren", () => {
    const pages = paginatePriceList([
      section("right-b", 1, "right", 20),
      section("left", 1, "left", 10),
      section("right-a", 1, "right", 10)
    ], "landscape");
    expect(pages[0]?.columns.left[0]).toMatchObject({ name: "Categorie left" });
    expect(pages[0]?.columns.right.filter((row) => row.kind === "category"))
      .toMatchObject([
        { name: "Categorie right-a" },
        { name: "Categorie right-b" }
      ]);
  });

  it("maakt geen placeholderrijen in een kortere of lege kolom", () => {
    const pages = paginatePriceList([section("long", 20)], "landscape");
    expect(pages).toHaveLength(3);
    expect(pages.every((page) => page.columns.right.length === 0)).toBe(true);
    expect(pages[2]?.columns.left.length).toBe(5);
  });

  it("neemt ieder product exact eenmaal op en is deterministic", () => {
    const sections = [section("a", 18), section("b", 5, "right")];
    const first = paginatePriceList(sections, "landscape");
    const second = paginatePriceList(sections, "landscape");
    const ids = first.flatMap((page) => [
      ...page.columns.left,
      ...page.columns.right
    ]).flatMap((row) => row.kind === "product" ? [row.item.id] : []);
    expect(new Set(ids).size).toBe(23);
    expect(first).toEqual(second);
  });

  it("publiceert een lege categorie niet", () => {
    const pages = paginatePriceList([section("empty", 0)], "landscape");
    expect(pages).toEqual([{
      columns: { left: [], right: [] },
      pageCount: 1,
      pageIndex: 0
    }]);
  });
});

describe("prijslijstfoto's", () => {
  it.each([
    ["show", "inherit", true],
    ["hide", "inherit", false],
    ["hide", "show", true],
    ["show", "hide", false]
  ] as const)("lost %s + %s correct op", (slide, category, expected) => {
    expect(resolvePriceListPhotoVisibility(slide, category)).toBe(expected);
  });
});
