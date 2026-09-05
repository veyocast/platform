import { z } from "zod";

import { themeSelectionSchema } from "./theme-engine";

export const sportDynamicSlideTypes = [
  "sport_program",
  "sport_results",
  "sport_standing",
  "sport_period_standing",
  "sport_match_of_the_day",
  "sport_next_match",
  "sport_cancellations",
  "sport_dressing_rooms",
  "sport_officials",
  "sport_team",
  "sport_sponsor",
  "sport_activities",
  "sport_trainings",
  "sport_volunteers",
  "sport_birthdays",
  "sport_visitor_arrivals",
  "sport_referee_arrivals"
] as const;
export const dynamicSlideTypes = [
  "menu",
  "price_list",
  "news",
  ...sportDynamicSlideTypes
] as const;
export const dynamicTemplateSlideTypes = [
  ...dynamicSlideTypes,
  "ledscores_live_match"
] as const;

/** All typed dynamic families supported by both modern and static players. */
export const editorialArenaActiveSlideTypes = [
  "menu",
  "price_list",
  "news",
  "sport_activities",
  "sport_birthdays",
  "sport_cancellations",
  "sport_dressing_rooms",
  "sport_match_of_the_day",
  "sport_next_match",
  "sport_officials",
  "sport_period_standing",
  "sport_program",
  "sport_referee_arrivals",
  "sport_results",
  "sport_standing",
  "sport_sponsor",
  "sport_team",
  "sport_trainings",
  "sport_visitor_arrivals",
  "sport_volunteers"
] as const satisfies readonly (typeof dynamicSlideTypes)[number][];

export const editorialArenaThemeId = "editorial-arena" as const;
export const editorialArenaThemeModes = ["light", "dark"] as const;
export const editorialArenaNewsVariants = [
  "hero_split",
  "fullscreen_gradient",
  "news_grid",
  "text_only"
] as const;
export const editorialArenaPricePhotoModes = [
  "show",
  "reserve-empty"
] as const;
export const dynamicSlideOrientations = ["landscape", "portrait"] as const;
export const dynamicDataSourceKinds = [
  "ledscores",
  "manual_products",
  "twelve_excel",
  "rss",
  "sportlink"
] as const;

export const dynamicSlideTypeSchema = z.enum(dynamicSlideTypes);
export const dynamicTemplateSlideTypeSchema = z.enum(dynamicTemplateSlideTypes);
export const dynamicSlideOrientationSchema = z.enum(dynamicSlideOrientations);
export const dynamicDataSourceKindSchema = z.enum(dynamicDataSourceKinds);

const safeLabelSchema = z.string().trim().min(1).max(160);
const safeTextSchema = z.string().trim().max(4_000);
const idSchema = z.string().uuid();
const cssColorSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(
    /^(#[0-9a-f]{6}|rgba?\([0-9.,%\s]+\)|hsla?\([0-9.,%\s]+\))$/i,
    "Ongeldige CSS-kleur"
  );

export const editorialColorTokensSchema = z.object({
  accent: cssColorSchema,
  accentSoft: cssColorSchema,
  border: cssColorSchema,
  borderSoft: cssColorSchema,
  canvas: cssColorSchema,
  danger: cssColorSchema,
  divider: cssColorSchema,
  imageOverlayEnd: cssColorSchema,
  imageOverlayMid: cssColorSchema,
  imageOverlayStart: cssColorSchema,
  neutral: cssColorSchema,
  panel: cssColorSchema,
  qrInk: cssColorSchema,
  qrSurface: cssColorSchema,
  row: cssColorSchema,
  rowSelected: cssColorSchema,
  shadow: cssColorSchema,
  success: cssColorSchema,
  surface: cssColorSchema,
  surfaceRaised: cssColorSchema,
  text: cssColorSchema,
  textFaint: cssColorSchema,
  textMuted: cssColorSchema,
  textOnAccent: cssColorSchema,
  textOnSelected: cssColorSchema,
  warning: cssColorSchema
}).strict();

export const editorialThemeConfigSchema = z.object({
  dark: editorialColorTokensSchema,
  light: editorialColorTokensSchema,
  mode: z.enum(editorialArenaThemeModes)
}).strict();

export const tenantThemeColorOverridesSchema = z.object({
  fieldflow: editorialThemeConfigSchema.optional()
}).strict();

export const editorialFocalPointSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1)
}).strict();

export const editorialPriceListEntrySchema = z.discriminatedUnion("kind", [
  z.object({
    category: z.string().trim().min(1).max(160),
    kind: z.literal("category")
  }).strict(),
  z.object({
    kind: z.literal("product"),
    productId: idSchema
  }).strict()
]);

export const editorialPriceListConfigurationSchema = z.object({
  categoryPhotoModes: z.record(
    z.string().trim().min(1).max(160),
    z.enum(["inherit", ...editorialArenaPricePhotoModes])
  ),
  columns: z.object({
    left: z.array(editorialPriceListEntrySchema).max(100),
    right: z.array(editorialPriceListEntrySchema).max(100)
  }).strict(),
  productFocalPoints: z.record(idSchema, editorialFocalPointSchema)
}).strict();

export const editorialArenaConfigurationSchema = z.object({
  newsFocalPoint: editorialFocalPointSchema.optional(),
  newsVariant: z.enum(editorialArenaNewsVariants).default("hero_split"),
  priceList: editorialPriceListConfigurationSchema.optional(),
  pricePhotoMode: z
    .enum(editorialArenaPricePhotoModes)
    .default("show"),
  schemaVersion: z.literal(2),
  theme: editorialThemeConfigSchema,
  themeSelection: themeSelectionSchema.optional()
}).strict();

export const priceListPhotoModes = ["show", "hide"] as const;
export const priceListCategoryPhotoModes = ["inherit", "show", "hide"] as const;
export const priceListColumns = ["left", "right"] as const;

export const priceListProductPlacementSchema = z.object({
  descriptionOverride: z.string().trim().max(240).nullable(),
  id: idSchema,
  imageAssetIdOverride: idSchema.nullable(),
  imageFocalPointOverride: z.object({
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1)
  }).nullable(),
  nameOverride: z.string().trim().min(1).max(160).nullable(),
  order: z.number().int().min(0).max(100_000),
  priceCentsOverride: z.number().int().min(0).max(999_999_999).nullable(),
  productId: idSchema,
  visible: z.boolean()
}).strict();

export const priceListSectionPlacementSchema = z.object({
  categoryId: z.string().trim().min(1).max(200),
  categoryIdentity: z.object({
    providerConnectionId: idSchema,
    sourceCategoryId: z.string().trim().min(1).max(200)
  }).strict().optional(),
  categoryNameOverride: z.string().trim().min(1).max(28).nullable(),
  column: z.enum(priceListColumns),
  expectedRevision: z.number().int().min(0).optional(),
  id: idSchema,
  order: z.number().int().min(0).max(100_000),
  photoMode: z.enum(priceListCategoryPhotoModes),
  products: z.array(priceListProductPlacementSchema).min(1).max(100)
}).strict();

export const priceListSlideConfigSchema = z.object({
  sections: z.array(priceListSectionPlacementSchema).min(1).max(40),
  slidePhotoMode: z.enum(priceListPhotoModes),
  title: safeLabelSchema
}).strict().superRefine((config, context) => {
  const placementIds = new Set<string>();
  const productIds = new Set<string>();
  let placementCount = 0;
  for (const section of config.sections) {
    if (placementIds.has(section.id)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Section placement IDs must be unique."
      });
    }
    placementIds.add(section.id);
    for (const product of section.products) {
      placementCount += 1;
      if (placementIds.has(product.id)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Placement IDs must be unique."
        });
      }
      placementIds.add(product.id);
      if (product.visible && productIds.has(product.productId)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "A product can only be placed once."
        });
      }
      if (product.visible) productIds.add(product.productId);
    }
  }
  if (placementCount > 200) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Een prijslijst kan maximaal 200 producten bevatten.",
      path: ["sections"]
    });
  }
});

export const canonicalProductSchema = z.object({
  active: z.boolean(),
  available: z.boolean(),
  category: z.string().trim().max(160).nullable(),
  currency: z.string().regex(/^[A-Z]{3}$/),
  description: safeTextSchema.nullable(),
  externalId: z.string().trim().min(1).max(200),
  id: idSchema,
  imageMediaAssetId: idSchema.nullable(),
  name: safeLabelSchema,
  priceMinor: z.number().int().min(0).max(999_999_999),
  sortOrder: z.number().int().min(0).max(100_000),
  sourceUpdatedAt: z.string().datetime().nullable()
});

export const canonicalMenuCategorySchema = z.object({
  id: z.string().trim().min(1).max(200),
  name: safeLabelSchema,
  products: z.array(canonicalProductSchema).max(100),
  sortOrder: z.number().int().min(0).max(100_000)
});

export const canonicalMenuSchema = z.object({
  categories: z.array(canonicalMenuCategorySchema).max(20),
  generatedAt: z.string().datetime(),
  title: safeLabelSchema
});

export const canonicalNewsArticleSchema = z.object({
  author: z.string().trim().max(160).nullable(),
  canonicalLink: z.string().url().max(2_048),
  externalId: z.string().trim().min(1).max(512),
  heroMediaAssetId: idSchema.nullable(),
  intro: safeTextSchema.nullable(),
  link: z.string().url().max(2_048),
  publishedAt: z.string().datetime().nullable(),
  qrMediaAssetId: idSchema.nullable(),
  sourceName: safeLabelSchema,
  title: safeLabelSchema
});

export const canonicalNewsFeedSchema = z.object({
  articles: z.array(canonicalNewsArticleSchema).max(50),
  generatedAt: z.string().datetime(),
  providerLogoMediaAssetId: idSchema.nullable().optional(),
  secondsPerSlide: z.number().int().min(5).max(120).optional(),
  sourceName: safeLabelSchema
});

export const dynamicTemplateFieldTypes = [
  "string",
  "number",
  "boolean",
  "datetime",
  "media_id",
  "url"
] as const;

export const dynamicTemplateManifestSchema = z.object({
  allowedFields: z.array(
    z.object({
      path: z.string().regex(/^[a-zA-Z][a-zA-Z0-9_.]*$/).max(120),
      required: z.boolean().default(false),
      type: z.enum(dynamicTemplateFieldTypes)
    })
  ).min(1).max(100),
  canvas: z.object({
    height: z.number().int().min(360).max(4_320),
    width: z.number().int().min(360).max(7_680)
  }),
  engine: z.literal("veyocast-safe-template-v1"),
  maxCollectionItems: z.number().int().min(1).max(100).default(40),
  schemaVersion: z.literal(1),
  slideType: dynamicTemplateSlideTypeSchema
});

export const playerDynamicTemplateAssetSchema = z
  .object({
    bytes: z.number().int().positive().max(524_288_000),
    checksumSha256: z.string().regex(/^[a-f0-9]{64}$/),
    mimeType: z.enum([
      "image/gif",
      "image/jpeg",
      "image/png",
      "image/svg+xml",
      "image/webp",
      "video/mp4"
    ]),
    posterBytes: z.number().int().positive().max(25_000_000).optional(),
    posterChecksumSha256: z.string().regex(/^[a-f0-9]{64}$/).optional(),
    posterMimeType: z.literal("image/png").optional(),
    posterUrl: z.string().min(1).max(4_096).optional(),
    url: z.string().min(1).max(4_096)
  }).strict().superRefine((asset, context) => {
    const posterFields = [
      asset.posterBytes,
      asset.posterChecksumSha256,
      asset.posterMimeType,
      asset.posterUrl
    ];
    if (posterFields.some((value) => value !== undefined) &&
      posterFields.some((value) => value === undefined)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Poster metadata moet volledig zijn."
      });
    }
  });

export const playerDynamicTemplatePayloadSchema = z
  .object({
    assets: z
      .record(idSchema, playerDynamicTemplateAssetSchema)
      .refine((assets) => Object.keys(assets).length <= 201)
      .optional(),
    data: z.record(z.string(), z.unknown()),
    orientation: dynamicSlideOrientationSchema,
    schemaVersion: z.literal(1),
    slideType: dynamicTemplateSlideTypeSchema,
    snapshotHash: z.string().regex(/^[a-f0-9]{64}$/),
    snapshotId: idSchema,
    templateSlug: z
      .string()
      .trim()
      .regex(/^[a-z0-9][a-z0-9-]{0,119}$/),
    templateVersionId: idSchema
  })
  .strict();

export const dynamicSnapshotDataSchema = z.discriminatedUnion("type", [
  z.object({
    liveMatch: z.record(z.string(), z.unknown()),
    type: z.literal("ledscores_live_match")
  }),
  z.object({
    data: canonicalMenuSchema,
    type: z.literal("menu")
  }),
  z.object({
    data: canonicalNewsFeedSchema,
    type: z.literal("news")
  }),
  z.object({
    priceList: z.record(z.string(), z.unknown()),
    type: z.literal("price_list")
  }),
  ...sportDynamicSlideTypes.map((slideType) =>
    z.object({
      sport: z.record(z.string(), z.unknown()),
      type: z.literal(slideType)
    })
  )
]);

export type CanonicalProduct = z.infer<typeof canonicalProductSchema>;
export type CanonicalMenu = z.infer<typeof canonicalMenuSchema>;
export type CanonicalNewsArticle = z.infer<
  typeof canonicalNewsArticleSchema
>;
export type CanonicalNewsFeed = z.infer<typeof canonicalNewsFeedSchema>;
export type PriceListProductPlacement = z.infer<
  typeof priceListProductPlacementSchema
>;
export type PriceListSectionPlacement = z.infer<
  typeof priceListSectionPlacementSchema
>;
export type PriceListSlideConfig = z.infer<typeof priceListSlideConfigSchema>;
export type DynamicTemplateManifest = z.infer<
  typeof dynamicTemplateManifestSchema
>;
export type PlayerDynamicTemplateAsset = z.infer<
  typeof playerDynamicTemplateAssetSchema
>;
export type PlayerDynamicTemplatePayload = z.infer<
  typeof playerDynamicTemplatePayloadSchema
>;
export type DynamicSnapshotData = z.infer<typeof dynamicSnapshotDataSchema>;
export type EditorialColorTokens = z.infer<typeof editorialColorTokensSchema>;
export type EditorialThemeConfig = z.infer<typeof editorialThemeConfigSchema>;
export type TenantThemeColorOverrides = z.infer<
  typeof tenantThemeColorOverridesSchema
>;
export type EditorialFocalPoint = z.infer<typeof editorialFocalPointSchema>;
export type EditorialPriceListConfiguration = z.infer<
  typeof editorialPriceListConfigurationSchema
>;
export type EditorialArenaConfiguration = z.infer<
  typeof editorialArenaConfigurationSchema
>;
export type EditorialNewsVariant =
  (typeof editorialArenaNewsVariants)[number];
export type EditorialPricePhotoMode =
  (typeof editorialArenaPricePhotoModes)[number];
