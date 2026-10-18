"use server";

import { randomUUID } from "node:crypto";
import {
  normalizeProductRows,
  sanitizeProductMapping,
  type ProductCellValue,
} from "@veyocast/integrations";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  requireTenantCapability,
  requireTenantControlSession,
} from "../../../../../lib/control-session";
import { createControlSupabaseClient } from "../../../../../lib/supabase/server";
import { loadProductImport, loadProductsCatalogPage } from "./data";
import { normalizeProductCsvRows } from "./product-csv-import";
import type { ProductAvailabilityCommand } from "./types";
import {
  productCatalogFiltersSchema,
  unavailableProductCatalogMessage,
  type ProductCatalogFilters,
  type ProductCatalogPage,
} from "./catalog-model";

export async function listProductsPage(
  input: ProductCatalogFilters,
): Promise<
  { ok: true; page: ProductCatalogPage } | { ok: false; message: string }
> {
  const session = await requireTenantControlSession("tenant.product.read");
  if (
    !session.isLive ||
    !session.tenantId ||
    !productCatalogFiltersSchema.safeParse(input).success
  )
    return { ok: false, message: unavailableProductCatalogMessage };
  const page = await loadProductsCatalogPage(session.tenantId, input);
  return page
    ? { ok: true, page }
    : { ok: false, message: unavailableProductCatalogMessage };
}

export async function remapProductImport(formData: FormData) {
  const { session, supabase } = await productContext("tenant.product.write");
  const importId = uuidValue(formData, "importId");
  const current = await loadProductImport(session.tenantId, importId);
  if (!current || current.status !== "draft") failImport(importId, "status");
  const requested: Record<string, unknown> = {};
  current.headers.forEach((header, index) => {
    requested[header] = String(formData.get(`target-${index}`) ?? "");
  });
  const mapping = sanitizeProductMapping(current.headers, requested);
  const normalized = (
    current.fileName.toLowerCase().endsWith(".csv")
      ? normalizeProductCsvRows
      : normalizeProductRows
  )(
    current.rows.map((row) => row.source as Record<string, ProductCellValue>),
    mapping,
  );
  const { error } = await supabase.rpc("replace_product_import_rows_v1", {
    p_column_mapping: mapping,
    p_import_id: importId,
    p_rows: normalized,
  });
  if (error) {
    console.error("Productimport opnieuw mappen mislukt", error);
    failImport(importId, "mapping");
  }
  revalidatePath(`/dashboard/sources/twelve/imports/${importId}`);
  redirect(
    `/dashboard/sources/twelve/imports/${importId}?succes=mapping`,
  );
}

export async function applyProductImport(formData: FormData) {
  const { supabase } = await productContext("tenant.product.write");
  const importId = uuidValue(formData, "importId");
  const mode =
    String(formData.get("mode") ?? "") === "replace" ? "replace" : "merge";
  const { error } = await supabase.rpc("apply_product_import_v1", {
    p_import_id: importId,
    p_mode: mode,
  });
  if (error) {
    console.error("Productimport toepassen mislukt", error);
    failImport(importId, error.code === "23514" ? "niet-gereed" : "toepassen");
  }
  revalidatePath("/dashboard/sources/twelve/products");
  redirect("/dashboard/sources/twelve/products?succes=geimporteerd");
}

export async function updateProduct(formData: FormData) {
  const { supabase } = await productContext("tenant.product.write");
  const productId = uuidValue(formData, "productId");
  const revision = integerValue(
    formData,
    "revision",
    0,
    Number.MAX_SAFE_INTEGER,
  );
  const priceCents = currencyCents(formData.get("price"));
  const vatRate = decimalValue(formData.get("vatRate"), 0, 100);
  const { data, error } = await supabase.rpc("update_tenant_product_v1", {
    p_active: formData.get("active") === "on",
    p_barcode: textValue(formData, "barcode", 80),
    p_category: textValue(formData, "category", 160),
    p_description: textValue(formData, "description", 1000),
    p_expected_revision: revision,
    p_name: requiredTextValue(formData, "name", 160),
    p_price_cents: priceCents,
    p_product_id: productId,
    p_unit: textValue(formData, "unit", 80),
    p_vat_rate: vatRate,
  });
  if (error || outcome(data) !== "updated") {
    const code = outcome(data) === "conflict" ? "conflict" : "opslaan";
    redirect(
      `/dashboard/sources/twelve/products?fout=${code}#product-${productId}`,
    );
  }
  revalidatePath("/dashboard/sources/twelve/products");
  redirect(
    `/dashboard/sources/twelve/products?succes=product#product-${productId}`,
  );
}

export async function manageProduct(formData: FormData) {
  const { session, supabase } = await productContext("tenant.product.write");
  const action = String(formData.get("action") ?? "");
  if (!["create", "update", "delete"].includes(action))
    redirect("/dashboard/sources/twelve/products?fout=invoer");
  const productId =
    action === "create" ? null : uuidValue(formData, "productId");
  const dataSourceId =
    action === "create" ? uuidValue(formData, "dataSourceId") : null;
  const revision = integerValue(
    formData,
    "revision",
    0,
    Number.MAX_SAFE_INTEGER,
  );
  const values =
    action === "delete"
      ? {}
      : {
          name: requiredTextValue(formData, "name", 160),
          description: textValue(formData, "description", 1000),
          category: textValue(formData, "category", 160),
          priceCents: currencyCents(formData.get("price")),
          vatRate: decimalValue(formData.get("vatRate"), 0, 100),
          unit: textValue(formData, "unit", 80),
          barcode: textValue(formData, "barcode", 80),
          externalId: textValue(formData, "externalId", 160),
          active: formData.get("active") === "on",
        };
  const idempotencyKey = formData.has("idempotencyKey")
    ? uuidValue(formData, "idempotencyKey")
    : randomUUID();
  const { data, error } = await supabase.rpc("manage_tenant_product_v2", {
    p_tenant_id: session.tenantId,
    p_product_id: productId,
    p_data_source_id: dataSourceId,
    p_expected_revision: revision,
    p_action: action,
    p_values: values,
    p_idempotency_key: idempotencyKey,
  });
  const result = outcome(data);
  if (
    error ||
    typeof result !== "string" ||
    !["created", "updated", "archived"].includes(result)
  )
    redirect(
      `/dashboard/sources/twelve/products?fout=${error?.code === "23505" ? "artikelnummer" : outcome(data) === "conflict" ? "conflict" : "opslaan"}`,
    );
  revalidatePath("/dashboard/sources/twelve/products");
  redirect(
    `/dashboard/sources/twelve/products?succes=${action === "delete" ? "verwijderd" : "product"}`,
  );
}

export async function setProductAvailability(
  input: ProductAvailabilityCommand,
): Promise<
  | { ok: true; active: boolean; revision: number }
  | { ok: false; conflict: boolean; message: string }
> {
  const { session, supabase } = await productContext("tenant.product.write");
  if (
    !/^[0-9a-f-]{36}$/i.test(input.productId) ||
    !/^[0-9a-f-]{36}$/i.test(input.idempotencyKey) ||
    !Number.isSafeInteger(input.expectedRevision) ||
    input.expectedRevision < 0 ||
    typeof input.active !== "boolean"
  )
    return {
      ok: false,
      conflict: false,
      message:
        "De beschikbaarheidsopdracht is ongeldig. Er is niets gewijzigd. Vernieuw de lijst.",
    };
  try {
    // Keep the whole original CAS command stable after a lost response. Reading
    // today's product here would change its hash if another operator edited it
    // after the first commit, making recovery of the stored receipt impossible.
    // The existing RPC validates every value and tenant/revision before writing.
    const value = input.values;
    if (
      !value ||
      typeof value !== "object" ||
      Array.isArray(value) ||
      JSON.stringify(value).length > 8192
    )
      return {
        ok: false,
        conflict: false,
        message:
          "De productgegevens ontbreken. Er is niets gewijzigd. Laad de nieuwste lijst en controleer je keuze.",
      };
    const { data, error } = await supabase.rpc("manage_tenant_product_v2", {
      p_tenant_id: session.tenantId,
      p_product_id: input.productId,
      p_data_source_id: null,
      p_expected_revision: input.expectedRevision,
      p_action: "update",
      p_idempotency_key: input.idempotencyKey,
      p_values: {
        name: value.name,
        description: value.description,
        category: value.category,
        priceCents: value.priceCents,
        vatRate: value.vatRate,
        unit: value.unit,
        barcode: value.barcode,
        externalId: value.externalId,
        active: input.active,
      },
    });
    const result = data as { outcome?: string; revision?: number } | null;
    if (result?.outcome === "conflict" || error?.code === "40001")
      return {
        ok: false,
        conflict: true,
        message:
          "Dit product is intussen gewijzigd. De beschikbaarheid is niet aangepast. Je keuze blijft zichtbaar; laad de nieuwste lijst en controleer het product.",
      };
    if (
      error ||
      result?.outcome !== "updated" ||
      !Number.isSafeInteger(result.revision)
    )
      return {
        ok: false,
        conflict: false,
        message:
          "De server bevestigde deze wijziging niet. De huidige catalogus blijft behouden. Probeer dezelfde keuze opnieuw of vernieuw de lijst.",
      };
    revalidatePath("/dashboard/sources/twelve/products");
    return { ok: true, active: input.active, revision: result.revision! };
  } catch {
    return {
      ok: false,
      conflict: false,
      message:
        "De verbinding werd onderbroken. Je eerdere wijziging is nog niet bevestigd; de catalogus kan al zijn bijgewerkt. Bevestig de wijziging opnieuw.",
    };
  }
}

async function productContext(capability: "tenant.product.write") {
  const session = await requireTenantCapability(capability);
  const supabase = await createControlSupabaseClient();
  if (!session.isLive || !session.tenantId || !supabase)
    redirect("/dashboard/sources/twelve/products?fout=configuratie");
  return { session: { ...session, tenantId: session.tenantId }, supabase };
}

function uuidValue(formData: FormData, name: string) {
  const value = String(formData.get(name) ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(value))
    redirect("/dashboard/sources/twelve/products?fout=invoer");
  return value;
}

function integerValue(
  formData: FormData,
  name: string,
  min: number,
  max: number,
) {
  const value = Number(formData.get(name));
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    redirect("/dashboard/sources/twelve/products?fout=invoer");
  }
  return value;
}

function requiredTextValue(formData: FormData, name: string, max: number) {
  const value = String(formData.get(name) ?? "").trim();
  if (!value || value.length > max)
    redirect("/dashboard/sources/twelve/products?fout=invoer");
  return value;
}

function textValue(formData: FormData, name: string, max: number) {
  const value = String(formData.get(name) ?? "").trim();
  if (value.length > max)
    redirect("/dashboard/sources/twelve/products?fout=invoer");
  return value || null;
}

function currencyCents(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const normalized = text.replace(/[€\s]/g, "").replace(",", ".");
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized))
    redirect("/dashboard/sources/twelve/products?fout=invoer");
  const [whole, fraction = ""] = normalized.split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(cents) || cents < 0 || cents > 100_000_000)
    redirect("/dashboard/sources/twelve/products?fout=invoer");
  return cents;
}

function decimalValue(
  value: FormDataEntryValue | null,
  min: number,
  max: number,
) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const number = Number(text.replace(",", "."));
  if (!Number.isFinite(number) || number < min || number > max) {
    redirect("/dashboard/sources/twelve/products?fout=invoer");
  }
  return number;
}

function outcome(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as { outcome?: unknown }).outcome
    : null;
}

function failImport(importId: string, code: string): never {
  redirect(
    `/dashboard/sources/twelve/imports/${importId}?fout=${encodeURIComponent(code)}`,
  );
}
