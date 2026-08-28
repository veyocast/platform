import { describe, expect, it } from "vitest";

import type { MenuDocumentV2, MenuProductPlacement } from "@veyocast/contracts";

import {
  menuSceneCanvases,
  menuSceneZones,
  resolveProductTitleDensity,
  resolveMenuGroupPrice,
  resolveMenuScenePages,
  resolveMenuSceneScale
} from "../src/menu-scene";

describe("MenuScene", () => {
  it("schaalt producttitels voorspelbaar op zichtbare naamlengte", () => {
    expect(resolveProductTitleDensity("AddMoore Sportwater")).toBe("default");
    expect(resolveProductTitleDensity("A".repeat(25))).toBe("compact");
    expect(resolveProductTitleDensity("A".repeat(37))).toBe("dense");
    expect(resolveProductTitleDensity(`  ${"A".repeat(24)}  `)).toBe("default");
  });

  it("verankert de bindende portrait-canvas en veilige zones exact", () => {
    expect(menuSceneCanvases.portrait).toEqual({ height: 1920, width: 1080 });
    expect(menuSceneZones.portrait).toEqual({
      body: { h: 1388, w: 936, x: 72, y: 348 },
      footer: { h: 64, w: 936, x: 72, y: 1760 },
      header: { h: 228, w: 936, x: 72, y: 96 }
    });
  });

  it.each([
    [{ height: 568, width: 320 }, 0.29583333333333334],
    [{ height: 844, width: 390 }, 0.3611111111111111],
    [{ height: 1024, width: 768 }, 0.5333333333333333],
    [{ height: 1920, width: 1080 }, 1],
    [{ height: 796, width: 503 }, 0.41458333333333336]
  ] as const)("schaalt portrait uniform binnen stage %o", (stage, expected) => {
    const scale = resolveMenuSceneScale(stage, "portrait");
    expect(scale).toBeCloseTo(expected, 12);
    expect(1080 * scale).toBeCloseTo(
      stage.height === 796 ? 447.75 : Math.min(stage.width, stage.height * 9 / 16),
      8
    );
  });

  it("levert voor 10 thema's × 2 modi × 2 oriëntaties dezelfde deterministische paginamatrix", () => {
    const signatures = new Set<string>();
    let cases = 0;
    for (const themeId of themeIds) {
      for (const mode of ["light", "dark"] as const) {
        for (const orientation of ["landscape", "portrait"] as const) {
          const pages = resolveMenuScenePages(document(themeId, mode), orientation);
          expect(pages.length).toBeGreaterThan(1);
          expect(pages.every((page) => page.pageCount === pages.length)).toBe(true);
          signatures.add(JSON.stringify(pages));
          cases += 1;
        }
      }
    }
    expect(cases).toBe(40);
    expect(signatures.size).toBe(2);
  });

  it("maakt vervolgkoppen en laat nooit een categorie als laatste rij achter", () => {
    for (const orientation of ["landscape", "portrait"] as const) {
      const pages = resolveMenuScenePages(document("editorial", "light"), orientation);
      const left = pages.map((page) => page.columns.left);
      expect(left.some((rows) => rows.some((row) => row.kind === "category" && row.continuation))).toBe(true);
      expect(left.every((rows) => rows.at(-1)?.kind !== "category")).toBe(true);
    }
  });

  it("pagineert twintig grotere portraittitels en bewaakt drie regels na een breuk", () => {
    const twenty = document("editorial", "light");
    const category = twenty.pages[0]!.blocks[0];
    if (category?.type !== "category") throw new Error("category fixture missing");
    category.productNodes = Array.from({ length: 20 }, (_, index) => product(index));
    const onePage = resolveMenuScenePages(twenty, "portrait");
    expect(onePage.map((page) =>
      page.columns.left.filter((row) => row.kind === "product").length
    )).toEqual([17, 3]);

    category.productNodes = Array.from({ length: 22 }, (_, index) => product(index));
    const split = resolveMenuScenePages(twenty, "portrait");
    expect(split.map((page) =>
      page.columns.left.filter((row) => row.kind === "product").length
    )).toEqual([18, 4]);
  });

  it("verdeelt expliciet smalle portraitcategorieën over twee zichtbare kolommen", () => {
    const twoColumns = document("editorial", "dark");
    const left = twoColumns.pages[0]!.blocks[0];
    if (left?.type !== "category") throw new Error("category fixture missing");
    left.layout.portrait = { h: 1388, rotation: 0, w: 458, x: 72, y: 348 };
    left.productNodes = [product(0), product(1)];
    twoColumns.pages[0]!.blocks.push({
      ...structuredClone(left),
      id: "category-2",
      layout: {
        ...left.layout,
        portrait: { h: 1388, rotation: 0, w: 458, x: 550, y: 348 }
      },
      order: 1,
      productNodes: [product(2), product(3)],
      source: { source: "manual", sourceCategoryId: "warm", sourceName: "Warm" }
    });

    const [page] = resolveMenuScenePages(twoColumns, "portrait");
    expect(page?.columnCount).toBe(2);
    expect(page?.columns.left.some((row) => row.kind === "category" && row.label === "Dranken")).toBe(true);
    expect(page?.columns.right.some((row) => row.kind === "category" && row.label === "Warm")).toBe(true);

    twoColumns.pages[0]!.portraitColumns = 1;
    const [forcedOneColumn] = resolveMenuScenePages(twoColumns, "portrait");
    expect(forcedOneColumn?.columnCount).toBe(1);
    expect(forcedOneColumn?.columns.right).toEqual([]);
  });

  it("verdeelt losse producten zonder broncategoriekoppen over beide kolommen", () => {
    for (const orientation of ["landscape", "portrait"] as const) {
      const candidate = document("editorial", "dark");
      const category = candidate.pages[0]!.blocks[0];
      if (category?.type !== "category") throw new Error("category fixture missing");
      category.flowAcrossColumns = true;
      category.headingVisible = false;
      category.layout.landscape = { h: 704, rotation: 0, w: 1728, x: 96, y: 248 };
      category.layout.portrait = { h: 1388, rotation: 0, w: 936, x: 72, y: 348 };
      category.productNodes = Array.from({ length: 8 }, (_, index) => product(index));

      const [page] = resolveMenuScenePages(candidate, orientation);
      expect(page?.columnCount).toBe(2);
      expect(page?.columns.left.some((row) => row.kind === "category")).toBe(false);
      expect(page?.columns.right.some((row) => row.kind === "category")).toBe(false);
      expect(page?.columns.left.filter((row) => row.kind === "product")).toHaveLength(4);
      expect(page?.columns.right.filter((row) => row.kind === "product")).toHaveLength(4);
    }
  });

  it("behoudt meer dan honderd losse producten verliesvrij over interne blokken", () => {
    const candidate = document("editorial", "light");
    const first = candidate.pages[0]!.blocks[0];
    if (first?.type !== "category") throw new Error("category fixture missing");
    first.flowAcrossColumns = true;
    first.headingVisible = false;
    first.layout.landscape = { h: 704, rotation: 0, w: 1728, x: 96, y: 248 };
    first.layout.portrait = { h: 1388, rotation: 0, w: 936, x: 72, y: 348 };
    first.productNodes = Array.from({ length: 100 }, (_, index) => product(index));
    candidate.pages[0]!.blocks.push({
      ...structuredClone(first),
      id: "loose-products-2",
      order: 1,
      productNodes: Array.from({ length: 37 }, (_, index) => product(index + 100)),
      source: { source: "manual", sourceCategoryId: "loose-products-2", sourceName: "Losse producten" }
    });

    const pages = resolveMenuScenePages(candidate, "portrait");
    const rows = pages.flatMap((page) => [...page.columns.left, ...page.columns.right]);
    expect(rows.filter((row) => row.kind === "product")).toHaveLength(137);
    expect(rows.some((row) => row.kind === "category")).toBe(false);
  });

  it("reserveert ruimte voor keep-together media en markeert echte underfill", () => {
    const candidate = document("editorial", "light");
    const category = candidate.pages[0]!.blocks[0];
    if (category?.type !== "category") throw new Error("category fixture missing");
    category.productNodes = Array.from({ length: 20 }, (_, index) => product(index));
    candidate.assets.push({
      assetId: "asset-1", assetVersion: "a".repeat(64), kind: "image",
      sha256: "a".repeat(64), status: "ready"
    });
    candidate.pages[0]!.blocks.push({
      appearance: { fit: "cover", focalPoint: { x: 0.5, y: 0.5 }, opacity: 1 },
      assetId: "asset-1",
      id: "media-1",
      layout: {
        landscape: { h: 170, rotation: 0, w: 300, x: 1490, y: 760 },
        portrait: { h: 210, rotation: 0, w: 320, x: 660, y: 1370 }
      },
      order: 1,
      type: "image"
    });
    const pages = resolveMenuScenePages(candidate, "portrait");
    expect(pages.length).toBeGreaterThan(1);
    expect(pages[0]!.floatingBlocks.map((block) => block.id)).toEqual(["media-1"]);
    expect(pages.slice(1).every((page) => page.floatingBlocks.length === 0)).toBe(true);

    category.productNodes = Array.from({ length: 4 }, (_, index) => product(index));
    expect(resolveMenuScenePages(candidate, "portrait")[0]!.underfilled).toBe(false);
    candidate.pages[0]!.blocks = candidate.pages[0]!.blocks.filter(
      (block) => block.id !== "media-1"
    );
    candidate.assets = [];
    expect(resolveMenuScenePages(candidate, "portrait")[0]!.underfilled).toBe(true);
  });

  it("berekent shared, from en separate prijzen zonder vrije tekst als prijsbron", () => {
    const group = {
      availabilityPolicy: {
        groupUnavailableWhenNoLinkedProducts: true,
        hideUnavailableLinkedProducts: true,
        keepFreeTextWhenLinkedUnavailable: true as const
      },
      display: { maxLines: 2 as const, separator: "dot" as const },
      id: "group-1",
      kind: "product-group" as const,
      order: 0,
      pricePolicy: "from" as const,
      secondaryLineItems: [
        {
          id: "line-1",
          kind: "linked-product" as const,
          order: 0,
          productRef: { productId: "product-1", source: "manual" as const },
          snapshotFallback: product(1).snapshotFallback
        },
        { id: "line-2", kind: "free-text" as const, label: "Extra shot", order: 1, presentationOnly: true as const }
      ],
      title: "Koffie"
    };
    expect(resolveMenuGroupPrice(group)).toBe("Vanaf € 2,01");
    expect(resolveMenuGroupPrice({ ...group, pricePolicy: "separate" })).toBe("");
    expect(resolveMenuGroupPrice({ ...group, pricePolicy: "shared", sharedPrice: product(1).snapshotFallback.price })).toBe("€ 2,01");
  });
});

function document(
  themeId: MenuDocumentV2["theme"]["themeId"],
  mode: MenuDocumentV2["theme"]["mode"]
): MenuDocumentV2 {
  return {
    assets: [],
    createdAt: "2026-08-21T12:00:00.000Z",
    id: "menu-1",
    pages: [{
      blocks: [{
        id: "category-1",
        layout: {
          landscape: { h: 704, rotation: 0, w: 846, x: 96, y: 248 },
          portrait: { h: 1388, rotation: 0, w: 936, x: 72, y: 348 }
        },
        order: 0,
        productNodes: Array.from({ length: 24 }, (_, index) => product(index)),
        source: { source: "manual", sourceCategoryId: "dranken", sourceName: "Dranken" },
        type: "category"
      }],
      id: "page-1",
      order: 0
    }],
    revision: 1,
    schemaVersion: "menu-document.v2",
    tenantId: "tenant-1",
    theme: { brand: { accent: "#FF5C20" }, mode, themeId, themeVersion: "1.0.0" },
    title: "Lunch",
    updatedAt: "2026-08-21T12:00:00.000Z"
  };
}

function product(index: number): MenuProductPlacement {
  return {
    id: `placement-${index}`,
    kind: "product",
    order: index,
    productRef: { productId: `product-${index}`, source: "manual" },
    snapshotFallback: {
      available: true,
      name: `Product ${index}`,
      price: { amountMinor: 200 + index, currency: "EUR", taxMode: "inclusive" }
    }
  };
}

const themeIds: MenuDocumentV2["theme"]["themeId"][] = [
  "editorial", "obsidian", "atelier", "velocity", "heritage",
  "halo", "swiss", "pavilion", "tactical", "terrace"
];
