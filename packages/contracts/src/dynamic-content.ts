import { z } from "zod";

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
  "sport_birthdays"
] as const;
export const dynamicSlideTypes = [
  "menu",
  "news",
  ...sportDynamicSlideTypes
] as const;

/**
 * The only Editorial Arena types backed by a complete, tested data flow in
 * the current repository. Control and Player share this capability gate.
 */
export const editorialArenaActiveSlideTypes = [
  "menu",
  "news",
  "sport_activities",
  "sport_cancellations",
  "sport_dressing_rooms",
  "sport_next_match",
  "sport_officials",
  "sport_program",
  "sport_results",
  "sport_standing"
] as const satisfies readonly (typeof dynamicSlideTypes)[number][];

export const editorialArenaThemeId = "editorial-arena" as const;
export const dynamicSlideOrientations = ["landscape", "portrait"] as const;
export const dynamicDataSourceKinds = [
  "manual_products",
  "twelve_excel",
  "rss",
  "sportlink"
] as const;

export const dynamicSlideTypeSchema = z.enum(dynamicSlideTypes);
export const dynamicSlideOrientationSchema = z.enum(dynamicSlideOrientations);
export const dynamicDataSourceKindSchema = z.enum(dynamicDataSourceKinds);

const safeLabelSchema = z.string().trim().min(1).max(160);
const safeTextSchema = z.string().trim().max(4_000);
const idSchema = z.string().uuid();

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
  slideType: dynamicSlideTypeSchema
});

export const playerDynamicTemplateAssetSchema = z
  .object({
    bytes: z.number().int().positive().max(8_000_000),
    checksumSha256: z.string().regex(/^[a-f0-9]{64}$/),
    mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
    url: z.string().min(1).max(4_096)
  })
  .strict();

export const playerDynamicTemplatePayloadSchema = z
  .object({
    assets: z
      .record(idSchema, playerDynamicTemplateAssetSchema)
      .refine((assets) => Object.keys(assets).length <= 51)
      .optional(),
    data: z.record(z.string(), z.unknown()),
    orientation: dynamicSlideOrientationSchema,
    schemaVersion: z.literal(1),
    slideType: dynamicSlideTypeSchema,
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
    data: canonicalMenuSchema,
    type: z.literal("menu")
  }),
  z.object({
    data: canonicalNewsFeedSchema,
    type: z.literal("news")
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
