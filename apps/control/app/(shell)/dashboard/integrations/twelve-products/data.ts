import "server-only";

import { createControlSupabaseClient } from "../../../../../lib/supabase/server";
import type { ProductImportView, ProductView } from "./types";

export async function loadProductsWorkspace(tenantId: string) {
  const supabase = await createControlSupabaseClient();
  if (!supabase) return { error: true, imports: [], products: [] };
  const [productsResult, importsResult] = await Promise.all([
    supabase
      .from("tenant_products")
      .select(
        "id, slug, name, description, category, price_cents, vat_rate, unit, barcode, source_external_id, custom_fields, image_media_asset_id, active, revision, updated_at"
      )
      .eq("tenant_id", tenantId)
      .order("active", { ascending: false })
      .order("category", { ascending: true, nullsFirst: false })
      .order("name", { ascending: true })
      .limit(1000),
    supabase
      .from("product_catalog_imports")
      .select(
        "id, file_name, sheet_name, status, row_count, included_count, valid_count, created_at, applied_at"
      )
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(20)
  ]);
  const logoUrls = await loadProductLogoUrls(
    supabase,
    tenantId,
    (productsResult.data ?? []).flatMap((row) =>
      row.image_media_asset_id ? [row.image_media_asset_id] : []
    )
  );
  return {
    error: Boolean(productsResult.error || importsResult.error),
    imports: (importsResult.data ?? []).map((row) => ({
      appliedAt: row.applied_at,
      createdAt: row.created_at,
      fileName: row.file_name,
      id: row.id,
      includedCount: row.included_count,
      rowCount: row.row_count,
      sheetName: row.sheet_name,
      status: row.status,
      validCount: row.valid_count
    })) as ProductImportView[],
    products: (productsResult.data ?? []).map((row) => ({
      active: row.active,
      barcode: row.barcode,
      category: row.category,
      customFields: isRecord(row.custom_fields) ? row.custom_fields : {},
      description: row.description,
      externalId: row.source_external_id,
      id: row.id,
      logoAssetId: row.image_media_asset_id,
      logoUrl: row.image_media_asset_id
        ? logoUrls.get(row.image_media_asset_id) ?? null
        : null,
      name: row.name,
      priceCents: row.price_cents,
      revision: Number(row.revision),
      slug: row.slug,
      unit: row.unit,
      updatedAt: row.updated_at,
      vatRate: row.vat_rate === null ? null : Number(row.vat_rate)
    })) as ProductView[]
  };
}

async function loadProductLogoUrls(
  supabase: NonNullable<Awaited<ReturnType<typeof createControlSupabaseClient>>>,
  tenantId: string,
  assetIds: string[]
) {
  const urls = new Map<string, string>();
  const uniqueAssetIds = [...new Set(assetIds)];
  if (!uniqueAssetIds.length) return urls;

  const variants = await supabase
    .from("media_variants")
    .select("asset_id, variant_type, storage_path")
    .eq("tenant_id", tenantId)
    .in("asset_id", uniqueAssetIds);
  if (variants.error) {
    console.error("Productlogovarianten laden mislukt", {
      code: variants.error.code
    });
    return urls;
  }

  const paths = new Map<string, string>();
  for (const variant of variants.data ?? []) {
    const current = paths.get(variant.asset_id);
    if (variant.variant_type === "thumbnail" || !current) {
      paths.set(variant.asset_id, variant.storage_path);
    }
  }
  const entries = [...paths.entries()];
  if (!entries.length) return urls;

  const signed = await supabase.storage
    .from("tenant-media")
    .createSignedUrls(entries.map(([, path]) => path), 600);
  if (signed.error) {
    console.error("Productlogovoorbeelden ondertekenen mislukt", {
      code: signed.error.message
    });
    return urls;
  }
  const assetByPath = new Map(entries.map(([assetId, path]) => [path, assetId]));
  for (const item of signed.data ?? []) {
    const assetId = assetByPath.get(item.path ?? "");
    if (assetId && item.signedUrl) urls.set(assetId, item.signedUrl);
  }
  return urls;
}

export async function loadProductImport(tenantId: string, importId: string) {
  const supabase = await createControlSupabaseClient();
  if (!supabase) return null;
  const importResult = await supabase
    .from("product_catalog_imports")
    .select(
      "id, file_name, sheet_name, status, headers, column_mapping, row_count, included_count, valid_count, created_at"
    )
    .eq("tenant_id", tenantId)
    .eq("id", importId)
    .maybeSingle();
  if (importResult.error || !importResult.data) return null;
  const rows = await loadAllProductImportRows(supabase, tenantId, importId);
  return {
    columnMapping: isRecord(importResult.data.column_mapping)
      ? importResult.data.column_mapping
      : {},
    createdAt: importResult.data.created_at,
    fileName: importResult.data.file_name,
    headers: Array.isArray(importResult.data.headers)
      ? importResult.data.headers.filter((value): value is string => typeof value === "string")
      : [],
    id: importResult.data.id,
    includedCount: importResult.data.included_count,
    rowCount: importResult.data.row_count,
    rows,
    sheetName: importResult.data.sheet_name,
    status: importResult.data.status as "applied" | "cancelled" | "draft",
    validCount: importResult.data.valid_count
  };
}

async function loadAllProductImportRows(
  supabase: NonNullable<Awaited<ReturnType<typeof createControlSupabaseClient>>>,
  tenantId: string,
  importId: string
) {
  const rows: Array<{
    errors: string[];
    included: boolean;
    normalized: Record<string, unknown>;
    rowNumber: number;
    source: Record<string, unknown>;
  }> = [];
  for (let from = 0; ; from += 1000) {
    const result = await supabase
      .from("product_catalog_import_rows")
      .select("row_number, included, source_values, normalized_values, validation_errors")
      .eq("tenant_id", tenantId)
      .eq("import_id", importId)
      .order("row_number", { ascending: true })
      .range(from, from + 999);
    if (result.error) throw new Error("Productimportregels konden niet worden geladen.");
    const page = result.data ?? [];
    rows.push(...page.map((row) => ({
      errors: Array.isArray(row.validation_errors)
        ? row.validation_errors.filter((value): value is string => typeof value === "string")
        : [],
      included: row.included,
      normalized: isRecord(row.normalized_values) ? row.normalized_values : {},
      rowNumber: row.row_number,
      source: isRecord(row.source_values) ? row.source_values : {}
    })));
    if (page.length < 1000) break;
  }
  return rows;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
