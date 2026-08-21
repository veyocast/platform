import { describe, expect, it } from "vitest";

import type { MenuDocumentV2, MenuStudioCommand } from "@veyocast/contracts";

import {
  applyMenuStudioCommand,
  commitMenuStudioHistory,
  createMenuStudioHistory,
  redoMenuStudioHistory,
  undoMenuStudioHistory
} from "../src/menu-studio";

describe("Menu Studio commandlaag", () => {
  it("past een command deterministisch toe en verhoogt precies één revision", () => {
    const result = applyMenuStudioCommand(
      document(),
      command({ kind: "set-title", title: "Avond" }),
      "2026-08-21T13:00:00.000Z"
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.document.title).toBe("Avond");
    expect(result.document.revision).toBe(2);
    expect(result.document.updatedAt).toBe("2026-08-21T13:00:00.000Z");
  });

  it("weigert stale commands", () => {
    const result = applyMenuStudioCommand(
      document(),
      { ...command({ kind: "set-title", title: "Stale" }), baseRevision: 9 },
      "2026-08-21T13:00:00.000Z"
    );
    expect(result).toMatchObject({ code: "revision-conflict", ok: false });
  });

  it("voegt assets alleen via een getypeerde operatie toe", () => {
    const result = applyMenuStudioCommand(
      document(),
      command({
        asset: {
          assetId: "asset-1",
          assetVersion: "v1",
          kind: "image",
          sha256: "a".repeat(64),
          status: "ready"
        },
        kind: "attach-asset"
      }),
      "2026-08-21T13:00:00.000Z"
    );
    expect(result.ok && result.document.assets).toHaveLength(1);
  });

  it("blokkeert assetverwijdering zolang een blok de asset gebruikt", () => {
    const candidate = document();
    candidate.assets.push({
      assetId: "asset-1",
      assetVersion: "v1",
      kind: "image",
      sha256: "a".repeat(64),
      status: "ready"
    });
    candidate.pages[0]!.blocks.push({
      appearance: { fit: "cover", focalPoint: { x: 0.5, y: 0.5 }, opacity: 1 },
      assetId: "asset-1",
      id: "image-1",
      layout: layouts,
      order: 0,
      type: "image"
    });
    const result = applyMenuStudioCommand(
      candidate,
      command({ assetId: "asset-1", kind: "detach-asset" }),
      "2026-08-21T13:00:00.000Z"
    );
    expect(result).toMatchObject({ code: "invalid-command", ok: false });
  });

  it("ondersteunt begrensde undo en redo zonder documentidentiteit te verliezen", () => {
    const original = document();
    const changed = { ...original, revision: 2, title: "Avond" };
    const history = commitMenuStudioHistory(createMenuStudioHistory(original, 2), changed);
    const undone = undoMenuStudioHistory(history);
    const redone = redoMenuStudioHistory(undone);
    expect(undone.present.title).toBe("Lunch");
    expect(redone.present.title).toBe("Avond");
    expect(redone.present.id).toBe(original.id);
  });

  it("groepeert meerdere producten atomair en kan de groep atomair splitsen", () => {
    const candidate = document();
    const products = [placement("regular", 0), placement("zero", 1)];
    candidate.pages[0]!.blocks.push({
      id: "category-cola",
      layout: layouts,
      order: 0,
      productNodes: products,
      source: { source: "manual", sourceCategoryId: "fris", sourceName: "Fris" },
      type: "category"
    });
    const grouped = applyMenuStudioCommand(
      candidate,
      command({
        categoryBlockId: "category-cola",
        group: {
          availabilityPolicy: {
            groupUnavailableWhenNoLinkedProducts: true,
            hideUnavailableLinkedProducts: true,
            keepFreeTextWhenLinkedUnavailable: true
          },
          display: { maxLines: 2, separator: "dot" },
          id: "cola-group",
          kind: "product-group",
          order: 0,
          pricePolicy: "shared",
          secondaryLineItems: products.map((product, index) => ({
            id: `line-${index}`,
            kind: "linked-product" as const,
            order: index,
            productRef: product.productRef,
            snapshotFallback: product.snapshotFallback
          })),
          sharedPrice: products[0]!.snapshotFallback.price,
          title: "Coca-Cola"
        },
        kind: "group-product-nodes",
        nodeIds: products.map((product) => product.id),
        pageId: "page-1"
      }),
      "2026-08-21T13:00:00.000Z"
    );
    expect(grouped.ok, JSON.stringify(grouped)).toBe(true);
    if (!grouped.ok) return;
    const nodes = grouped.document.pages[0]!.blocks[0];
    expect(nodes?.type === "category" && nodes.productNodes).toHaveLength(1);

    const split = applyMenuStudioCommand(
      grouped.document,
      {
        baseRevision: 2,
        operation: {
          categoryBlockId: "category-cola",
          groupId: "cola-group",
          kind: "ungroup-product-node",
          pageId: "page-1",
          products
        },
        operationId: "20000000-0000-4000-8000-000000000002"
      },
      "2026-08-21T14:00:00.000Z"
    );
    expect(split.ok).toBe(true);
    if (!split.ok) return;
    const splitCategory = split.document.pages[0]!.blocks[0];
    expect(splitCategory?.type === "category" && splitCategory.productNodes.map((node) => node.id))
      .toEqual(["regular", "zero"]);
  });
});

function command(operation: MenuStudioCommand["operation"]): MenuStudioCommand {
  return {
    baseRevision: 1,
    operation,
    operationId: "20000000-0000-4000-8000-000000000001"
  };
}

function document(): MenuDocumentV2 {
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
      themeId: "editorial",
      themeVersion: "1.0.0"
    },
    title: "Lunch",
    updatedAt: "2026-08-21T12:00:00.000Z"
  };
}

const layouts = {
  landscape: { h: 120, rotation: 0, w: 240, x: 120, y: 280 },
  portrait: { h: 160, rotation: 0, w: 240, x: 100, y: 400 }
};

function placement(id: string, order: number) {
  return {
    id,
    kind: "product" as const,
    order,
    productRef: { productId: `product-${id}`, source: "manual" as const },
    snapshotFallback: {
      available: true,
      name: id,
      price: { amountMinor: 310, currency: "EUR", taxMode: "inclusive" as const }
    }
  };
}
