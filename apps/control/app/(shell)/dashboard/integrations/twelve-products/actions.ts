"use server";

import {
  normalizeProductRows,
  sanitizeProductMapping,
  type ProductCellValue
} from "@veyocast/integrations";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireTenantCapability } from "../../../../../lib/control-session";
import { createControlSupabaseClient } from "../../../../../lib/supabase/server";
import { loadProductImport } from "./data";

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
  const normalized = normalizeProductRows(
    current.rows.map((row) => row.source as Record<string, ProductCellValue>),
    mapping
  );
  const { error } = await supabase.rpc("replace_product_import_rows_v1", {
    p_column_mapping: mapping,
    p_import_id: importId,
    p_rows: normalized
  });
  if (error) {
    console.error("Productimport opnieuw mappen mislukt", error);
    failImport(importId, "mapping");
  }
  revalidatePath(`/dashboard/integrations/twelve-products/imports/${importId}`);
  redirect(`/dashboard/integrations/twelve-products/imports/${importId}?succes=mapping`);
}

export async function applyProductImport(formData: FormData) {
  const { supabase } = await productContext("tenant.product.write");
  const importId = uuidValue(formData, "importId");
  const mode = String(formData.get("mode") ?? "") === "replace" ? "replace" : "merge";
  const { error } = await supabase.rpc("apply_product_import_v1", {
    p_import_id: importId,
    p_mode: mode
  });
  if (error) {
    console.error("Productimport toepassen mislukt", error);
    failImport(importId, error.code === "23514" ? "niet-gereed" : "toepassen");
  }
  revalidatePath("/dashboard/integrations/twelve-products");
  redirect("/dashboard/integrations/twelve-products?succes=geimporteerd");
}

export async function updateProduct(formData: FormData) {
  const { supabase } = await productContext("tenant.product.write");
  const productId = uuidValue(formData, "productId");
  const revision = integerValue(formData, "revision", 0, Number.MAX_SAFE_INTEGER);
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
    p_vat_rate: vatRate
  });
  if (error || outcome(data) !== "updated") {
    const code = outcome(data) === "conflict" ? "conflict" : "opslaan";
    redirect(`/dashboard/integrations/twelve-products?fout=${code}#product-${productId}`);
  }
  revalidatePath("/dashboard/integrations/twelve-products");
  redirect(`/dashboard/integrations/twelve-products?succes=product#product-${productId}`);
}

async function productContext(capability: "tenant.product.write") {
  const session = await requireTenantCapability(capability);
  const supabase = await createControlSupabaseClient();
  if (!session.isLive || !session.tenantId || !supabase) redirect("/dashboard/integrations/twelve-products?fout=configuratie");
  return { session: { ...session, tenantId: session.tenantId }, supabase };
}

function uuidValue(formData: FormData, name: string) {
  const value = String(formData.get(name) ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(value)) redirect("/dashboard/integrations/twelve-products?fout=invoer");
  return value;
}

function integerValue(formData: FormData, name: string, min: number, max: number) {
  const value = Number(formData.get(name));
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    redirect("/dashboard/integrations/twelve-products?fout=invoer");
  }
  return value;
}

function requiredTextValue(formData: FormData, name: string, max: number) {
  const value = String(formData.get(name) ?? "").trim();
  if (!value || value.length > max) redirect("/dashboard/integrations/twelve-products?fout=invoer");
  return value;
}

function textValue(formData: FormData, name: string, max: number) {
  const value = String(formData.get(name) ?? "").trim();
  if (value.length > max) redirect("/dashboard/integrations/twelve-products?fout=invoer");
  return value || null;
}

function currencyCents(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const number = Number(text.replace(/[€\s]/g, "").replace(",", "."));
  if (!Number.isFinite(number) || number < 0 || number > 1_000_000) {
    redirect("/dashboard/integrations/twelve-products?fout=invoer");
  }
  return Math.round(number * 100);
}

function decimalValue(value: FormDataEntryValue | null, min: number, max: number) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const number = Number(text.replace(",", "."));
  if (!Number.isFinite(number) || number < min || number > max) {
    redirect("/dashboard/integrations/twelve-products?fout=invoer");
  }
  return number;
}

function outcome(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as { outcome?: unknown }).outcome
    : null;
}

function failImport(importId: string, code: string): never {
  redirect(`/dashboard/integrations/twelve-products/imports/${importId}?fout=${encodeURIComponent(code)}`);
}
