import { z } from "zod";

import { selectableThemeIdSchema, themeModeSchema } from "./theme-engine";

const menuIdPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;
const sha256Pattern = /^[a-f0-9]{64}$/;
const currencyPattern = /^[A-Z]{3}$/;
const localePattern = /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/;

export const menuStudioOrientations = ["landscape", "portrait"] as const;
export const menuStudioColumns = ["left", "right"] as const;
export const menuStudioBlockTypes = [
  "category",
  "product-group",
  "image",
  "video",
  "logo",
  "text",
  "promo"
] as const;

export const menuStudioIdSchema = z.string()
  .trim()
  .min(1)
  .max(128)
  .regex(menuIdPattern);
const dateTimeSchema = z.string().datetime({ offset: true });
const hexColorSchema = z.string().regex(/^#[0-9A-Fa-f]{6}(?:[0-9A-Fa-f]{2})?$/);
const menuLineLabelSchema = z.string()
  .trim()
  .min(1)
  .max(96)
  .transform((value) => value.normalize("NFC"))
  .superRefine((value, context) => {
    if (countGraphemes(value) > 24) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Een subregellabel mag maximaal 24 zichtbare tekens bevatten."
      });
    }
    if (hasControlCharacters(value)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Een subregellabel mag geen besturingstekens bevatten."
      });
    }
  });

export const menuMoneySchema = z.object({
  amountMinor: z.number().int().min(0).max(999_999_999),
  currency: z.string().regex(currencyPattern),
  taxMode: z.enum(["inclusive", "exclusive", "not-applicable"]),
  taxRateBps: z.number().int().min(0).max(10_000).nullable().optional(),
  unitKey: z.string().trim().min(1).max(64).nullable().optional()
}).strict();

export const menuThemeSelectionSchema = z.object({
  brand: z.object({
    accent: hexColorSchema,
    logoAssetId: menuStudioIdSchema.optional(),
    support: hexColorSchema.optional()
  }).strict(),
  mode: themeModeSchema,
  themeId: selectableThemeIdSchema,
  themeVersion: z.string().regex(/^\d+\.\d+\.\d+$/)
}).strict();

export const menuLayoutRectSchema = z.object({
  h: z.number().positive().max(7_680),
  rotation: z.number().min(-180).max(180),
  w: z.number().positive().max(7_680),
  x: z.number().min(-7_680).max(7_680),
  y: z.number().min(-7_680).max(7_680)
}).strict();

export const menuOrientationLayoutsSchema = z.object({
  landscape: menuLayoutRectSchema,
  portrait: menuLayoutRectSchema
}).strict();

export const menuProductRefSchema = z.object({
  productId: menuStudioIdSchema,
  providerConnectionId: menuStudioIdSchema.optional(),
  source: z.enum(["twelve", "manual"]),
  sourceRevision: z.string().trim().min(1).max(128).nullable().optional()
}).strict().superRefine((product, context) => {
  if (product.source === "twelve" && !product.providerConnectionId) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Een Twelve-product vereist een providerConnectionId.",
      path: ["providerConnectionId"]
    });
  }
});

export const menuProductSnapshotSchema = z.object({
  available: z.boolean(),
  capturedAt: dateTimeSchema.optional(),
  imageAssetId: menuStudioIdSchema.nullable().optional(),
  name: z.string().trim().min(1).max(160),
  price: menuMoneySchema,
  variantLabel: z.string().trim().max(48).nullable().optional()
}).strict();

export const menuLinkedProductLineItemSchema = z.object({
  id: menuStudioIdSchema,
  kind: z.literal("linked-product"),
  labelOverride: menuLineLabelSchema.nullable().optional(),
  mediaOverrideAssetId: menuStudioIdSchema.nullable().optional(),
  order: z.number().int().min(0).max(100_000),
  productRef: menuProductRefSchema,
  snapshotFallback: menuProductSnapshotSchema
}).strict();

export const menuFreeTextLineItemSchema = z.object({
  id: menuStudioIdSchema,
  kind: z.literal("free-text"),
  label: menuLineLabelSchema,
  locale: z.string().regex(localePattern).nullable().optional(),
  order: z.number().int().min(0).max(100_000),
  presentationOnly: z.literal(true)
}).strict();

export const menuProductGroupPlacementSchema = z.object({
  availabilityPolicy: z.object({
    groupUnavailableWhenNoLinkedProducts: z.boolean(),
    hideUnavailableLinkedProducts: z.boolean(),
    keepFreeTextWhenLinkedUnavailable: z.literal(true)
  }).strict(),
  display: z.object({
    maxLines: z.union([z.literal(1), z.literal(2)]),
    separator: z.enum(["dot", "comma", "slash"])
  }).strict(),
  familyId: menuStudioIdSchema.nullable().optional(),
  id: menuStudioIdSchema,
  imageAssetId: menuStudioIdSchema.nullable().optional(),
  kind: z.literal("product-group"),
  logoAssetId: menuStudioIdSchema.nullable().optional(),
  order: z.number().int().min(0).max(100_000),
  pricePolicy: z.enum(["shared", "from", "separate"]),
  secondaryLineItems: z.array(z.discriminatedUnion("kind", [
    menuLinkedProductLineItemSchema,
    menuFreeTextLineItemSchema
  ])).min(1).max(40),
  sharedPrice: menuMoneySchema.optional(),
  title: z.string().trim().min(1).max(120)
}).strict().superRefine((group, context) => {
  const lineOrders = new Set<number>();
  for (const [index, item] of group.secondaryLineItems.entries()) {
    if (lineOrders.has(item.order)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Line-itemorders moeten binnen een productgroep uniek zijn.",
        path: ["secondaryLineItems", index, "order"]
      });
    }
    lineOrders.add(item.order);
  }
  const linked = group.secondaryLineItems.filter(
    (item): item is z.infer<typeof menuLinkedProductLineItemSchema> =>
      item.kind === "linked-product"
  );
  const visibleLineLength = group.secondaryLineItems.reduce((total, item, index) => {
    const label = item.kind === "free-text"
      ? item.label
      : item.labelOverride ?? item.snapshotFallback.variantLabel ?? item.snapshotFallback.name;
    return total + countGraphemes(label) + (index > 0 ? 3 : 0);
  }, 0);
  if (visibleLineLength > group.display.maxLines * 72) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: `De kleine regel past niet veilig op ${group.display.maxLines} regel(s). Splits de productgroep of verkort labels.`,
      path: ["secondaryLineItems"]
    });
  }
  if (group.pricePolicy === "shared" && !group.sharedPrice) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Een gedeelde prijs vereist sharedPrice.",
      path: ["sharedPrice"]
    });
  }
  if (group.pricePolicy === "from" && linked.length === 0) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Een vanafprijs vereist minimaal één gekoppeld product.",
      path: ["secondaryLineItems"]
    });
  }
  if (group.pricePolicy === "separate" && group.sharedPrice) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Afzonderlijke prijzen mogen geen sharedPrice bevatten.",
      path: ["sharedPrice"]
    });
  }
  if (group.pricePolicy === "shared" && group.sharedPrice) {
    for (const [index, item] of linked.entries()) {
      if (!sameMoney(group.sharedPrice, item.snapshotFallback.price)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Alle gekoppelde producten moeten exact dezelfde gedeelde prijs hebben.",
          path: ["secondaryLineItems", index, "snapshotFallback", "price"]
        });
      }
    }
  }
});

export const menuProductPlacementSchema = z.object({
  id: menuStudioIdSchema,
  kind: z.literal("product"),
  mediaOverrideAssetId: menuStudioIdSchema.nullable().optional(),
  nameOverride: z.string().trim().min(1).max(160).nullable().optional(),
  order: z.number().int().min(0).max(100_000),
  productRef: menuProductRefSchema,
  snapshotFallback: menuProductSnapshotSchema
}).strict();

const menuCategorySourceSchema = z.object({
  providerConnectionId: menuStudioIdSchema.optional(),
  source: z.enum(["twelve", "manual"]),
  sourceCategoryId: menuStudioIdSchema,
  sourceName: z.string().trim().min(1).max(120),
  sourceRevision: z.string().trim().min(1).max(128).nullable().optional()
}).strict().superRefine((source, context) => {
  if (source.source === "twelve" && !source.providerConnectionId) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Een Twelve-categorie vereist een providerConnectionId.",
      path: ["providerConnectionId"]
    });
  }
});

const baseBlockFields = {
  hidden: z.boolean().optional(),
  id: menuStudioIdSchema,
  layout: menuOrientationLayoutsSchema,
  locked: z.boolean().optional(),
  order: z.number().int().min(0).max(100_000)
};

export const menuCategoryBlockSchema = z.object({
  ...baseBlockFields,
  labelOverride: z.string().trim().min(1).max(56).nullable().optional(),
  productNodes: z.array(z.discriminatedUnion("kind", [
    menuProductPlacementSchema,
    menuProductGroupPlacementSchema
  ])).max(100),
  source: menuCategorySourceSchema,
  subtitle: z.string().trim().max(90).nullable().optional(),
  type: z.literal("category")
}).strict();

const focalPointSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1)
}).strict();

const mediaAppearanceSchema = z.object({
  fit: z.enum(["contain", "cover", "fill"]),
  focalPoint: focalPointSchema,
  opacity: z.number().min(0).max(1),
  radiusToken: z.string().trim().max(80).optional(),
  shadowToken: z.string().trim().max(80).optional()
}).strict();

const orientationMediaAppearanceSchema = z.object({
  landscape: mediaAppearanceSchema.optional(),
  portrait: mediaAppearanceSchema.optional()
}).strict();

export const menuProductGroupBlockSchema = z.object({
  ...baseBlockFields,
  group: menuProductGroupPlacementSchema,
  type: z.literal("product-group")
}).strict();

export const menuImageBlockSchema = z.object({
  ...baseBlockFields,
  appearance: mediaAppearanceSchema,
  assetId: menuStudioIdSchema,
  alt: z.string().trim().max(180).nullable().optional(),
  caption: z.string().trim().max(180).nullable().optional(),
  orientationAppearance: orientationMediaAppearanceSchema.optional(),
  type: z.literal("image")
}).strict();

export const menuVideoBlockSchema = z.object({
  ...baseBlockFields,
  appearance: mediaAppearanceSchema,
  assetId: menuStudioIdSchema,
  orientationAppearance: orientationMediaAppearanceSchema.optional(),
  playback: z.object({
    autoplay: z.boolean(),
    endMs: z.number().int().positive().nullable().optional(),
    loop: z.boolean(),
    muted: z.literal(true),
    posterAssetId: menuStudioIdSchema.nullable().optional(),
    startMs: z.number().int().min(0)
  }).strict(),
  type: z.literal("video")
}).strict().superRefine((block, context) => {
  if (block.playback.endMs !== null && block.playback.endMs !== undefined &&
    block.playback.endMs <= block.playback.startMs) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Het video-eindpunt moet na het startpunt liggen.",
      path: ["playback", "endMs"]
    });
  }
});

export const menuLogoBlockSchema = z.object({
  ...baseBlockFields,
  assetId: menuStudioIdSchema,
  color: z.object({
    custom: hexColorSchema.optional(),
    mode: z.enum(["original", "monochrome", "palette"]),
    recipeHash: z.string().regex(sha256Pattern).nullable().optional(),
    token: z.enum(["accent", "support", "accent-ink"]).optional()
  }).strict(),
  type: z.literal("logo")
}).strict();

export const menuTextBlockSchema = z.object({
  ...baseBlockFields,
  role: z.enum(["heading", "body", "note"]).optional(),
  text: z.string().trim().max(500),
  type: z.literal("text")
}).strict();

export const menuPromoBlockSchema = z.object({
  ...baseBlockFields,
  assetId: menuStudioIdSchema.nullable().optional(),
  body: z.string().trim().max(240).nullable().optional(),
  title: z.string().trim().min(1).max(120),
  type: z.literal("promo")
}).strict();

export const menuBlockSchema = z.discriminatedUnion("type", [
  menuCategoryBlockSchema,
  menuProductGroupBlockSchema,
  menuImageBlockSchema,
  menuVideoBlockSchema,
  menuLogoBlockSchema,
  menuTextBlockSchema,
  menuPromoBlockSchema
]);

export const menuAssetReferenceSchema = z.object({
  assetId: menuStudioIdSchema,
  assetVersion: z.string().trim().min(1).max(128),
  kind: z.enum(["image", "logo", "animation", "video"]),
  posterAssetVersion: z.string().trim().min(1).max(128).nullable().optional(),
  sha256: z.string().regex(sha256Pattern).optional(),
  status: z.literal("ready")
}).strict().superRefine((asset, context) => {
  if ((asset.kind === "video" || asset.kind === "animation") && !asset.posterAssetVersion) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Video en animatie vereisen een immutable poster.",
      path: ["posterAssetVersion"]
    });
  }
});

export const menuPageSchema = z.object({
  blocks: z.array(menuBlockSchema).max(100),
  durationMs: z.number().int().min(6_000).max(120_000).optional(),
  id: menuStudioIdSchema,
  order: z.number().int().min(0).max(10_000)
}).strict();

export const menuDocumentV2Schema = z.object({
  assets: z.array(menuAssetReferenceSchema).max(100),
  createdAt: dateTimeSchema,
  id: menuStudioIdSchema,
  pages: z.array(menuPageSchema).min(1).max(40),
  providerSnapshot: z.object({
    capturedAt: dateTimeSchema.optional(),
    connections: z.array(z.object({
      connectionId: menuStudioIdSchema,
      provider: z.enum(["twelve", "manual"]),
      revision: z.string().trim().min(1).max(128)
    }).strict()).max(20).optional()
  }).strict().optional(),
  publication: z.object({
    assetManifestVersion: z.string().trim().min(1).max(128),
    contentFitVersion: z.string().trim().min(1).max(128),
    documentRevision: z.number().int().min(1),
    publishedAt: dateTimeSchema.optional(),
    rendererVersion: z.string().trim().min(1).max(128),
    themeManifestVersion: z.string().trim().min(1).max(128)
  }).strict().optional(),
  revision: z.number().int().min(1),
  schemaVersion: z.literal("menu-document.v2"),
  tenantId: menuStudioIdSchema,
  theme: menuThemeSelectionSchema,
  title: z.string().trim().max(120).optional(),
  updatedAt: dateTimeSchema
}).strict().superRefine(validateMenuDocumentInvariants);

export const menuStudioCommandSchema = z.object({
  baseRevision: z.number().int().min(1),
  operationId: z.string().uuid(),
  operation: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("set-title"), title: z.string().trim().max(120) }).strict(),
    z.object({ kind: z.literal("set-theme"), theme: menuThemeSelectionSchema }).strict(),
    z.object({ asset: menuAssetReferenceSchema, kind: z.literal("attach-asset") }).strict(),
    z.object({ assetId: menuStudioIdSchema, kind: z.literal("detach-asset") }).strict(),
    z.object({
      assets: z.array(menuAssetReferenceSchema).max(100),
      kind: z.literal("restore-content"),
      pages: z.array(menuPageSchema).min(1).max(40),
      providerSnapshot: z.object({
        capturedAt: dateTimeSchema.optional(),
        connections: z.array(z.object({
          connectionId: menuStudioIdSchema,
          provider: z.enum(["twelve", "manual"]),
          revision: z.string().trim().min(1).max(128)
        }).strict()).max(20).optional()
      }).strict().nullable(),
      theme: menuThemeSelectionSchema,
      title: z.string().trim().max(120).nullable()
    }).strict(),
    z.object({ block: menuBlockSchema, kind: z.literal("add-block"), pageId: menuStudioIdSchema }).strict(),
    z.object({ block: menuBlockSchema, kind: z.literal("replace-block"), pageId: menuStudioIdSchema }).strict(),
    z.object({ blockId: menuStudioIdSchema, kind: z.literal("remove-block"), pageId: menuStudioIdSchema }).strict(),
    z.object({
      beforeBlockId: menuStudioIdSchema.nullable(),
      blockId: menuStudioIdSchema,
      kind: z.literal("move-block"),
      pageId: menuStudioIdSchema
    }).strict(),
    z.object({
      categoryBlockId: menuStudioIdSchema,
      kind: z.literal("rename-category"),
      labelOverride: z.string().trim().min(1).max(56).nullable(),
      pageId: menuStudioIdSchema
    }).strict(),
    z.object({
      categoryBlockId: menuStudioIdSchema,
      kind: z.literal("upsert-product-node"),
      node: z.discriminatedUnion("kind", [menuProductPlacementSchema, menuProductGroupPlacementSchema]),
      pageId: menuStudioIdSchema
    }).strict(),
    z.object({
      beforeNodeId: menuStudioIdSchema.nullable(),
      categoryBlockId: menuStudioIdSchema,
      kind: z.literal("move-product-node"),
      nodeId: menuStudioIdSchema,
      pageId: menuStudioIdSchema
    }).strict(),
    z.object({
      categoryBlockId: menuStudioIdSchema,
      group: menuProductGroupPlacementSchema,
      kind: z.literal("group-product-nodes"),
      nodeIds: z.array(menuStudioIdSchema).min(1).max(20),
      pageId: menuStudioIdSchema
    }).strict(),
    z.object({
      categoryBlockId: menuStudioIdSchema,
      groupId: menuStudioIdSchema,
      kind: z.literal("ungroup-product-node"),
      pageId: menuStudioIdSchema,
      products: z.array(menuProductPlacementSchema).min(1).max(20)
    }).strict(),
    z.object({
      categoryBlockId: menuStudioIdSchema,
      kind: z.literal("remove-product-node"),
      nodeId: menuStudioIdSchema,
      pageId: menuStudioIdSchema
    }).strict()
  ])
}).strict();

export type MenuAssetReference = z.infer<typeof menuAssetReferenceSchema>;
export type MenuBlock = z.infer<typeof menuBlockSchema>;
export type MenuCategoryBlock = z.infer<typeof menuCategoryBlockSchema>;
export type MenuDocumentV2 = z.infer<typeof menuDocumentV2Schema>;
export type MenuFreeTextLineItem = z.infer<typeof menuFreeTextLineItemSchema>;
export type MenuLinkedProductLineItem = z.infer<typeof menuLinkedProductLineItemSchema>;
export type MenuMoney = z.infer<typeof menuMoneySchema>;
export type MenuProductGroupPlacement = z.infer<typeof menuProductGroupPlacementSchema>;
export type MenuProductPlacement = z.infer<typeof menuProductPlacementSchema>;
export type MenuStudioCommand = z.infer<typeof menuStudioCommandSchema>;
export type MenuThemeSelection = z.infer<typeof menuThemeSelectionSchema>;

function validateMenuDocumentInvariants(
  document: z.infer<typeof menuDocumentV2Schema>,
  context: z.RefinementCtx
) {
  const ids = new Set<string>();
  const linkedProducts = new Set<string>();
  const assetIds = new Set(document.assets.map((asset) => asset.assetId));
  const register = (id: string, path: (string | number)[]) => {
    if (ids.has(id)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `ID ${id} komt meer dan één keer voor.`,
        path
      });
    }
    ids.add(id);
  };
  const registerProduct = (
    product: z.infer<typeof menuProductRefSchema>,
    path: (string | number)[]
  ) => {
    const key = [
      product.source,
      product.providerConnectionId ?? "manual",
      product.productId
    ].join(":");
    if (linkedProducts.has(key)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Een gekoppeld product mag maar één keer in een document staan.",
        path
      });
    }
    linkedProducts.add(key);
  };
  const requireAsset = (id: string | null | undefined, path: (string | number)[]) => {
    if (id && !assetIds.has(id)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Asset ${id} ontbreekt in het immutable assetmanifest.`,
        path
      });
    }
  };

  register(document.id, ["id"]);
  for (const [pageIndex, page] of document.pages.entries()) {
    register(page.id, ["pages", pageIndex, "id"]);
    const blockOrders = new Set<number>();
    for (const [blockIndex, block] of page.blocks.entries()) {
      const blockPath = ["pages", pageIndex, "blocks", blockIndex];
      register(block.id, [...blockPath, "id"]);
      if (blockOrders.has(block.order)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Blockorders moeten binnen een pagina uniek zijn.",
          path: [...blockPath, "order"]
        });
      }
      blockOrders.add(block.order);
      for (const orientation of menuStudioOrientations) {
        const layout = block.layout[orientation];
        const body = menuBodyZones[orientation];
        if (
          layout.x < body.x || layout.y < body.y ||
          layout.x + layout.w > body.x + body.w ||
          layout.y + layout.h > body.y + body.h
        ) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Het blok moet volledig binnen de ${orientation}-bodyzone staan.`,
            path: [...blockPath, "layout", orientation]
          });
        }
      }
      if (block.type === "image" || block.type === "video" || block.type === "logo") {
        requireAsset(block.assetId, [...blockPath, "assetId"]);
      }
      if (block.type === "video") {
        requireAsset(block.playback.posterAssetId, [...blockPath, "playback", "posterAssetId"]);
      }
      if (block.type === "promo") requireAsset(block.assetId, [...blockPath, "assetId"]);
      if (block.type === "product-group") {
        registerGroup(block.group, blockPath, register, registerProduct, requireAsset);
      }
      if (block.type !== "category") continue;
      const nodeOrders = new Set<number>();
      for (const [nodeIndex, node] of block.productNodes.entries()) {
        const nodePath = [...blockPath, "productNodes", nodeIndex];
        register(node.id, [...nodePath, "id"]);
        if (nodeOrders.has(node.order)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Productorders moeten binnen een categorie uniek zijn.",
            path: [...nodePath, "order"]
          });
        }
        nodeOrders.add(node.order);
        if (node.kind === "product") {
          registerProduct(node.productRef, [...nodePath, "productRef"]);
          requireAsset(node.mediaOverrideAssetId ?? node.snapshotFallback.imageAssetId, [
            ...nodePath,
            "mediaOverrideAssetId"
          ]);
        } else {
          registerGroup(node, nodePath, register, registerProduct, requireAsset, false);
        }
      }
    }
    const floating = page.blocks.filter((block) =>
      block.type !== "category" && block.type !== "product-group" && !block.hidden
    );
    for (const orientation of menuStudioOrientations) {
      for (let left = 0; left < floating.length; left += 1) {
        for (let right = left + 1; right < floating.length; right += 1) {
          if (!rectanglesOverlap(
            floating[left]!.layout[orientation],
            floating[right]!.layout[orientation]
          )) continue;
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Vrije blokken mogen elkaar in ${orientation} niet overlappen.`,
            path: ["pages", pageIndex, "blocks", page.blocks.indexOf(floating[right]!)]
          });
        }
      }
    }
  }
}

const menuBodyZones = {
  landscape: { h: 704, w: 1728, x: 96, y: 248 },
  portrait: { h: 1388, w: 936, x: 72, y: 348 }
} as const;

function rectanglesOverlap(
  left: z.infer<typeof menuLayoutRectSchema>,
  right: z.infer<typeof menuLayoutRectSchema>
) {
  return left.x < right.x + right.w && left.x + left.w > right.x &&
    left.y < right.y + right.h && left.y + left.h > right.y;
}

function registerGroup(
  group: z.infer<typeof menuProductGroupPlacementSchema>,
  path: (string | number)[],
  register: (id: string, path: (string | number)[]) => void,
  registerProduct: (product: z.infer<typeof menuProductRefSchema>, path: (string | number)[]) => void,
  requireAsset: (id: string | null | undefined, path: (string | number)[]) => void,
  registerSelf = true
) {
  if (registerSelf) register(group.id, [...path, "group", "id"]);
  requireAsset(group.imageAssetId, [...path, "group", "imageAssetId"]);
  requireAsset(group.logoAssetId, [...path, "group", "logoAssetId"]);
  for (const [index, line] of group.secondaryLineItems.entries()) {
    const linePath = [...path, "group", "secondaryLineItems", index];
    register(line.id, [...linePath, "id"]);
    if (line.kind === "linked-product") {
      registerProduct(line.productRef, [...linePath, "productRef"]);
      requireAsset(line.mediaOverrideAssetId ?? line.snapshotFallback.imageAssetId, [
        ...linePath,
        "mediaOverrideAssetId"
      ]);
    }
  }
}

function sameMoney(left: z.infer<typeof menuMoneySchema>, right: z.infer<typeof menuMoneySchema>) {
  return left.amountMinor === right.amountMinor &&
    left.currency === right.currency &&
    left.taxMode === right.taxMode &&
    (left.taxRateBps ?? null) === (right.taxRateBps ?? null) &&
    (left.unitKey ?? null) === (right.unitKey ?? null);
}

function countGraphemes(value: string) {
  return Array.from(new Intl.Segmenter("nl", { granularity: "grapheme" }).segment(value)).length;
}

function hasControlCharacters(value: string) {
  for (const character of value) {
    const codePoint = character.codePointAt(0) ?? 0;
    if (codePoint <= 31 || (codePoint >= 127 && codePoint <= 159)) return true;
  }
  return false;
}
