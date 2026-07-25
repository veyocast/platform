import "server-only";

import { createControlSupabaseClient } from "../../../../../lib/supabase/server";

export type ProductView = Readonly<{
  active: boolean;
  barcode: string | null;
  category: string | null;
  customFields: Readonly<Record<string, unknown>>;
  description: string | null;
  externalId: string | null;
  id: string;
  name: string;
  priceCents: number | null;
  revision: number;
  slug: string;
  unit: string | null;
  updatedAt: string;
  vatRate: number | null;
}>;

export type ProductImportView = Readonly<{
  appliedAt: string | null;
  createdAt: string;
  fileName: string;
  id: string;
  includedCount: number;
  rowCount: number;
  sheetName: string;
  status: "applied" | "cancelled" | "draft";
  validCount: number;
}>;

export async function loadProductsWorkspace(tenantId: string) {
  const supabase = await createControlSupabaseClient();
  if (!supabase) return { error: true, imports: [], products: [] };
  const [productsResult, importsResult] = await Promise.all([
    supabase
      .from("tenant_products")
      .select(
        "id, slug, name, description, category, price_cents, vat_rate, unit, barcode, source_external_id, custom_fields, active, revision, updated_at"
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
