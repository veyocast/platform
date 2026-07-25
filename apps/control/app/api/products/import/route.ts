import { createHash } from "node:crypto";

import {
  guessProductColumnMapping,
  normalizeProductRows,
  parseProductWorkbook,
  ProductWorkbookError
} from "@veyocast/integrations";
import { hasCapability } from "@veyocast/auth";
import { NextResponse } from "next/server";

import { getControlSession } from "../../../../lib/control-session";
import { createControlSupabaseClient } from "../../../../lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (!Number.isFinite(contentLength) || contentLength <= 0 || contentLength > maxRequestBytes) {
    return failure("Het Excel-bestand is groter dan 8 MB.", 413);
  }
  const session = await getControlSession();
  if (
    !session?.isLive ||
    !session.tenantId ||
    session.tenantStatus !== "active" ||
    !hasCapability(session.capabilities, "tenant.product.write")
  ) {
    return failure("Je hebt geen toegang om producten te importeren.", 403);
  }
  const supabase = await createControlSupabaseClient();
  if (!supabase) return failure("De productimport is tijdelijk niet beschikbaar.", 503);

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) return failure("Kies een Excel-bestand.", 400);
    const bytes = new Uint8Array(await file.arrayBuffer());
    const workbook = await parseProductWorkbook(file.name, bytes);
    const mapping = guessProductColumnMapping(workbook.headers);
    const rows = normalizeProductRows(workbook.rows, mapping);
    const checksum = createHash("sha256").update(bytes).digest("hex");
    const { data, error } = await supabase.rpc("stage_product_import_v1", {
      p_column_mapping: mapping,
      p_file_name: workbook.fileName,
      p_file_sha256: checksum,
      p_headers: workbook.headers,
      p_rows: rows,
      p_sheet_name: workbook.sheetName,
      p_source: "twelve_excel",
      p_tenant_id: session.tenantId
    });
    if (error || typeof data !== "string") {
      console.error("Productimport opslaan mislukt", error);
      return failure("De werkmap is gelezen, maar kon niet veilig worden opgeslagen.", 500);
    }
    return NextResponse.json(
      { importId: data, rowCount: rows.length },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    if (error instanceof ProductWorkbookError) {
      return failure(workbookErrors[error.code], 400);
    }
    console.error("Productwerkmap lezen mislukt", error);
    return failure(
      "De werkmap kon niet worden gelezen. Sla deze opnieuw op als een normaal .xlsx-bestand.",
      400
    );
  }
}

function failure(message: string, status: number) {
  return NextResponse.json(
    { error: message },
    { headers: { "Cache-Control": "no-store" }, status }
  );
}

const maxRequestBytes = 9 * 1024 * 1024;
const workbookErrors = {
  empty: "De werkmap bevat geen bruikbare productregels.",
  file_too_large: "Het Excel-bestand is groter dan 8 MB.",
  invalid_format: "Gebruik een normaal .xlsx-bestand zonder macro’s.",
  no_header: "Er is geen betrouwbare kopregel met kolomnamen gevonden.",
  too_many_columns: "De werkmap bevat meer dan 75 kolommen.",
  too_many_rows: "De werkmap bevat meer dan 10.000 productregels.",
  too_many_sheets: "De werkmap bevat meer dan acht tabbladen."
} as const;
