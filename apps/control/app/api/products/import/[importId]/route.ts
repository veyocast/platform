import { hasCapability } from "@veyocast/auth";
import { normalizeProductRows, sanitizeProductMapping, type ProductCellValue } from "@veyocast/integrations";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getControlSession } from "../../../../../lib/control-session";
import { createControlSupabaseClient } from "../../../../../lib/supabase/server";
import { loadProductImport } from "../../../../(shell)/dashboard/integrations/twelve-products/data";
import { normalizeProductCsvRows } from "../../../../(shell)/dashboard/integrations/twelve-products/product-csv-import";

export const dynamic = "force-dynamic";

// Ordinary form POST/303 keeps the durable receipt independent of the Server
// Action Flight stream. All writes still use the existing authenticated RPCs.
export async function POST(request: Request, context: { params: Promise<{ importId: string }> }) {
  const origin = request.headers.get("origin");
  let sameOrigin = false;
  try {
    const supplied = new URL(origin ?? "");
    sameOrigin = supplied.origin === origin && supplied.host === request.headers.get("host") && supplied.protocol === new URL(request.url).protocol;
  } catch { /* A malformed or opaque Origin cannot authorize a form write. */ }
  if (!sameOrigin) return failure(403);
  const length = Number(request.headers.get("content-length"));
  if (!Number.isSafeInteger(length) || length <= 0 || length > 65_536) return failure(413);
  const session = await getControlSession();
  if (!session?.isLive || !session.tenantId || session.tenantStatus !== "active" || !hasCapability(session.capabilities, "tenant.product.write")) return failure(403);
  const { importId } = await context.params;
  if (!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/iu.test(importId)) return failure(400);
  const supabase = await createControlSupabaseClient();
  if (!supabase) return failure(503);
  const current = await loadProductImport(session.tenantId, importId);
  if (!current) return failure(404);
  const page = `/dashboard/sources/twelve/imports/${importId}`;
  const catalog = "/dashboard/sources/twelve/products";
  const go = (path: string) => NextResponse.redirect(new URL(path, request.url), 303);
  const form = await request.formData().catch(() => null);
  if (!form || form.get("importId") !== importId) return failure(400);
  const intent = form.get("intent");
  if (intent === "mapping") {
    if (current.status !== "draft") return go(page + "?fout=status");
    const requested = Object.fromEntries(current.headers.map((header, index) => [header, String(form.get(`target-${index}`) ?? "")]));
    const mapping = sanitizeProductMapping(current.headers, requested);
    const normalized = (current.fileName.toLowerCase().endsWith(".csv") ? normalizeProductCsvRows : normalizeProductRows)(current.rows.map(row => row.source as Record<string, ProductCellValue>), mapping);
    const result = await supabase.rpc("replace_product_import_rows_v1", { p_import_id: importId, p_column_mapping: mapping, p_rows: normalized });
    if (result.error) return go(page + "?fout=mapping");
    revalidatePath(page);
    return go(page + "?succes=mapping");
  }
  if (intent !== "apply" || !["merge", "replace"].includes(String(form.get("mode")))) return failure(400);
  // A lost HTTP receipt can be verified/replayed against the same immutable
  // import identity; an already applied import never executes its writer twice.
  if (current.status === "applied") return go(catalog + "?succes=geimporteerd");
  if (current.status !== "draft") return go(page + "?fout=status");
  const result = await supabase.rpc("apply_product_import_v1", { p_import_id: importId, p_mode: String(form.get("mode")) });
  if (result.error) {
    const receipt = await loadProductImport(session.tenantId, importId);
    if (receipt?.status !== "applied") return go(page + "?fout=toepassen");
  }
  revalidatePath(catalog);
  revalidatePath(page);
  return go(catalog + "?succes=geimporteerd");
}

function failure(status: number) {
  return NextResponse.json({ error: "De importaanvraag kon niet veilig worden verwerkt. Open de import opnieuw om de opgeslagen status te controleren." }, { status, headers: { "Cache-Control": "no-store" } });
}
