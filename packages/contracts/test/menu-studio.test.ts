import { describe, expect, it } from "vitest";

import {
  menuDocumentV2Schema,
  menuProductGroupPlacementSchema,
  menuStudioCommandSchema,
  type MenuDocumentV2
} from "../src/menu-studio";

describe("MenuDocument.v2", () => {
  it("accepteert één strikt document voor de tien canonieke thema's", () => {
    for (const themeId of themeIds) {
      expect(menuDocumentV2Schema.safeParse(document({ themeId })).success).toBe(true);
    }
  });

  it("weigert onbekende thema's en extra velden", () => {
    expect(menuDocumentV2Schema.safeParse({ ...document(), extra: true }).success).toBe(false);
    expect(menuDocumentV2Schema.safeParse({
      ...document(),
      theme: { ...document().theme, themeId: "prototype-only" }
    }).success).toBe(false);
  });

  it("houdt vrije presentatieregels vrij van provider-, prijs- en voorraadsemantiek", () => {
    const group = validGroup();
    const freeText = group.secondaryLineItems[1]!;
    expect(menuProductGroupPlacementSchema.safeParse(group).success).toBe(true);
    expect(menuProductGroupPlacementSchema.safeParse({
      ...group,
      secondaryLineItems: [
        group.secondaryLineItems[0],
        { ...freeText, price: { amountMinor: 200, currency: "EUR", taxMode: "inclusive" } }
      ]
    }).success).toBe(false);
  });

  it("normaliseert subregellabels en blokkeert besturingstekens, meer dan 24 graphemes en onveilige wrapping", () => {
    const group = validGroup();
    const freeText = group.secondaryLineItems[1]!;
    const normalized = menuProductGroupPlacementSchema.parse({
      ...group,
      secondaryLineItems: [group.secondaryLineItems[0], { ...freeText, label: "  cafe\u0301  " }]
    });
    expect(normalized.secondaryLineItems[1]).toMatchObject({ label: "café" });
    for (const label of ["a".repeat(25), "Verborgen\u0000tekst"]) {
      expect(menuProductGroupPlacementSchema.safeParse({
        ...group,
        secondaryLineItems: [group.secondaryLineItems[0], { ...freeText, label }]
      }).success).toBe(false);
    }
    expect(menuProductGroupPlacementSchema.safeParse({
      ...group,
      display: { ...group.display, maxLines: 1 },
      secondaryLineItems: Array.from({ length: 4 }, (_, index) => ({
        ...freeText,
        id: `free-${index}`,
        label: "Variant voor menu",
        order: index
      }))
    }).success).toBe(false);
  });

  it("vereist gelijke bedragen bij een gedeelde groepsprijs", () => {
    const group = validGroup();
    expect(menuProductGroupPlacementSchema.safeParse({
      ...group,
      pricePolicy: "shared",
      sharedPrice: { amountMinor: 450, currency: "EUR", taxMode: "inclusive" }
    }).success).toBe(false);
  });

  it.each([
    ["currency", { currency: "USD" }],
    ["btw-modus", { taxMode: "exclusive" }],
    ["btw-percentage", { taxRateBps: 900 }],
    ["maat/eenheid", { unitKey: "500ml" }]
  ] as const)("blokkeert gedeelde prijs bij afwijkende %s-context", (_label, difference) => {
    const group = validGroup();
    const linked = group.secondaryLineItems[0];
    if (!linked || linked.kind !== "linked-product") throw new Error("linked fixture ontbreekt");
    const sharedPrice = {
      ...linked.snapshotFallback.price,
      taxRateBps: 2_100,
      unitKey: "stuk"
    };
    const candidate = {
      ...group,
      pricePolicy: "shared" as const,
      sharedPrice,
      secondaryLineItems: [{
        ...linked,
        snapshotFallback: {
          ...linked.snapshotFallback,
          price: { ...sharedPrice, ...difference }
        }
      }, group.secondaryLineItems[1]]
    };
    expect(menuProductGroupPlacementSchema.safeParse(candidate).success).toBe(false);
  });

  it("accepteert vrije presentatieregels met een handmatige hoofdprijs, maar geen vanafprijs", () => {
    const freeOnly = {
      ...validGroup(),
      pricePolicy: "shared" as const,
      secondaryLineItems: [validGroup().secondaryLineItems[1]],
      sharedPrice: { amountMinor: 450, currency: "EUR", taxMode: "inclusive" as const }
    };
    expect(menuProductGroupPlacementSchema.safeParse(freeOnly).success).toBe(true);
    expect(menuProductGroupPlacementSchema.safeParse({
      ...freeOnly,
      pricePolicy: "from",
      sharedPrice: undefined
    }).success).toBe(false);
  });

  it("accepteert PostgreSQL-offsettimestamps en orientation-specifieke crops", () => {
    const candidate = document();
    candidate.createdAt = "2026-08-21T12:00:00+00:00";
    candidate.updatedAt = "2026-08-21T14:30:00+02:00";
    candidate.assets.push({
      assetId: "asset-1", assetVersion: "a".repeat(64), kind: "image",
      sha256: "a".repeat(64), status: "ready"
    });
    candidate.pages[0]!.blocks.push({
      appearance: { fit: "cover", focalPoint: { x: 0.5, y: 0.5 }, opacity: 1 },
      assetId: "asset-1",
      id: "image-1",
      layout: layouts,
      order: 0,
      orientationAppearance: {
        portrait: { fit: "contain", focalPoint: { x: 0.2, y: 0.8 }, opacity: 0.9 }
      },
      type: "image"
    });
    expect(menuDocumentV2Schema.safeParse(candidate).success).toBe(true);
  });

  it("weigert vrije blokken buiten de bodyzone en onderlinge overlap", () => {
    const candidate = document();
    candidate.pages[0]!.blocks.push(
      { id: "note-1", layout: layouts, order: 0, text: "A", type: "text" },
      {
        id: "note-2",
        layout: {
          landscape: { ...layouts.landscape },
          portrait: { ...layouts.portrait }
        },
        order: 1,
        text: "B",
        type: "text"
      }
    );
    expect(menuDocumentV2Schema.safeParse(candidate).success).toBe(false);
    candidate.pages[0]!.blocks[1]!.layout.portrait.x = 500;
    candidate.pages[0]!.blocks[1]!.layout.landscape.x = 500;
    expect(menuDocumentV2Schema.safeParse(candidate).success).toBe(true);
    candidate.pages[0]!.blocks[1]!.layout.portrait.y = 100;
    expect(menuDocumentV2Schema.safeParse(candidate).success).toBe(false);
  });

  it("weigert dubbele line-itemorders zonder een runtime-exceptie", () => {
    const group = validGroup();
    const result = menuProductGroupPlacementSchema.safeParse({
      ...group,
      secondaryLineItems: group.secondaryLineItems.map((line) => ({ ...line, order: 0 }))
    });
    expect(result.success).toBe(false);
  });

  it("weigert assetreferenties die niet in het immutable manifest staan", () => {
    const candidate = document();
    candidate.pages[0]!.blocks.push({
      appearance: { fit: "cover", focalPoint: { x: 0.5, y: 0.5 }, opacity: 1 },
      assetId: "missing-asset",
      id: "image-block",
      layout: layouts,
      order: 0,
      type: "image"
    });
    expect(menuDocumentV2Schema.safeParse(candidate).success).toBe(false);
  });

  it("typeert history restore als expliciete commandoperatie", () => {
    const candidate = document();
    expect(menuStudioCommandSchema.safeParse({
      baseRevision: 1,
      operationId: "20000000-0000-4000-8000-000000000001",
      operation: {
        assets: candidate.assets,
        kind: "restore-content",
        pages: candidate.pages,
        providerSnapshot: null,
        theme: candidate.theme,
        title: candidate.title ?? null
      }
    }).success).toBe(true);
  });
});

function document({ themeId = "editorial" }: { themeId?: MenuDocumentV2["theme"]["themeId"] } = {}): MenuDocumentV2 {
  return {
    assets: [],
    createdAt: "2026-08-21T12:00:00.000Z",
    id: "menu-1",
    pages: [{ blocks: [], id: "page-1", order: 0 }],
    revision: 1,
    schemaVersion: "menu-document.v2",
    tenantId: "tenant-1",
    theme: {
      brand: { accent: "#FF5C20" },
      mode: "light",
      themeId,
      themeVersion: "1.0.0"
    },
    title: "Lunch",
    updatedAt: "2026-08-21T12:00:00.000Z"
  };
}

function validGroup() {
  return {
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
        snapshotFallback: {
          available: true,
          name: "Espresso",
          price: { amountMinor: 250, currency: "EUR", taxMode: "inclusive" as const }
        }
      },
      {
        id: "line-2",
        kind: "free-text" as const,
        label: "Met havermelk",
        order: 1,
        presentationOnly: true as const
      }
    ],
    title: "Koffie"
  };
}

const layouts = {
  landscape: { h: 120, rotation: 0, w: 240, x: 120, y: 280 },
  portrait: { h: 160, rotation: 0, w: 240, x: 100, y: 400 }
};

const themeIds: MenuDocumentV2["theme"]["themeId"][] = [
  "editorial", "obsidian", "atelier", "velocity", "heritage",
  "halo", "swiss", "pavilion", "tactical", "terrace"
];
