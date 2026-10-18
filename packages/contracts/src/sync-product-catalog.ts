import { z } from "zod";

const count = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
export const productCatalogFiltersSchema = z
  .object({
    query: z.string().max(120),
    category: z.string().max(160),
    availability: z.enum(["all", "active", "inactive"]),
    offset: z.number().int().min(0).max(100000),
  })
  .strict();
export const productCatalogResponseSchema = z
  .object({
    rows: z
      .array(
        z
          .object({
            id: z.string().uuid(),
            data_source_id: z.string().uuid().nullable(),
            slug: z.string(),
            name: z.string(),
            description: z.string().nullable(),
            category: z.string().nullable(),
            price_cents: z.number().int().nullable(),
            vat_rate: z.number().nullable(),
            unit: z.string().nullable(),
            barcode: z.string().nullable(),
            source_external_id: z.string().nullable(),
            custom_fields: z.record(z.string(), z.unknown()),
            image_media_asset_id: z.string().uuid().nullable(),
            active: z.boolean(),
            revision: count,
            updated_at: z.string(),
          })
          .strict(),
      )
      .max(50),
    count,
    total: count,
    active: count,
    categories: z.array(z.string()).max(200),
    categoriesComplete: z.boolean(),
    offset: z.number().int().min(0).max(100000),
    pageSize: z.literal(50),
  })
  .strict()
  .superRefine((page, context) => {
    if (
      page.count > page.total ||
      page.active > page.total ||
      page.rows.length !==
        Math.min(page.pageSize, Math.max(0, page.count - page.offset))
    )
      context.addIssue({
        code: "custom",
        message: "Incomplete catalog page or inconsistent totals.",
      });
  });

export type SyncProductCatalogFilters = z.infer<
  typeof productCatalogFiltersSchema
>;
