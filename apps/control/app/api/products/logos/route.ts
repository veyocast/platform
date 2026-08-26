import { hasCapability } from "@veyocast/auth";
import { NextResponse } from "next/server";

import { getControlSession } from "../../../../lib/control-session";
import {
  isImageUploadRequestTooLarge,
  isTrustedImageUploadOrigin
} from "../../../../lib/media/image-upload-api";
import {
  MediaUploadError,
  uploadValidatedImageCandidate
} from "../../../../lib/media/validated-image-upload";
import {
  productLogoTitle,
  productLogoValidationMessage,
  readLogoCommandOutcome,
  type ProductLogoApiResult,
  validateProductLogoFile
} from "../../../../lib/products/product-logo-upload";
import { createControlSupabaseClient } from "../../../../lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const context = await logoRequestContext(request, true);
  if (context instanceof NextResponse) return context;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return failure(context.requestId, 422, "INVALID_FILE", "Het logobestand kon niet volledig worden ontvangen.", "Selecteer het bestand opnieuw en laat Control geopend tot de upload klaar is.");
  }

  const productId = uuidValue(formData.get("productId"));
  const expectedRevision = revisionValue(formData.get("revision"));
  if (!productId || expectedRevision === null) {
    return failure(context.requestId, 422, "INVALID_FILE", "De gekozen productregel is ongeldig.", "Vernieuw de productlijst en probeer het opnieuw.");
  }
  const candidate = formData.get("media");
  if (!(candidate instanceof File)) {
    return failure(context.requestId, 422, "INVALID_FILE", "Er is geen productlogo gekozen.", "Kies een JPEG-, PNG-, WebP- of veilig SVG-bestand.");
  }
  const policyFailure = validateProductLogoFile(candidate);
  if (policyFailure) {
    return failure(context.requestId, 422, "INVALID_FILE", productLogoValidationMessage(policyFailure), "Kies een geldig statisch logo en probeer opnieuw.");
  }

  const product = await context.supabase
    .from("tenant_products")
    .select("id, name, revision")
    .eq("tenant_id", context.session.tenantId)
    .eq("id", productId)
    .maybeSingle();
  if (product.error || !product.data) {
    return failure(context.requestId, 404, "NOT_FOUND", "Het product bestaat niet meer in deze vereniging.", "Vernieuw de productlijst en kies opnieuw.");
  }
  if (Number(product.data.revision) !== expectedRevision) {
    return failure(context.requestId, 409, "CONFLICT", "Iemand anders wijzigde deze productregel.", "Vernieuw de productlijst en upload het logo daarna opnieuw.");
  }

  try {
    const upload = await uploadValidatedImageCandidate({
      candidate,
      supabase: context.supabase,
      tenantId: context.session.tenantId,
      title: productLogoTitle(product.data.name),
      userId: context.session.userId
    });
    const command = await context.supabase.rpc("set_tenant_product_logo_v1", {
      p_expected_revision: expectedRevision,
      p_media_asset_id: upload.assetId,
      p_product_id: productId
    });
    const outcome = readLogoCommandOutcome(command.data);
    if (command.error || outcome?.outcome !== "updated" || outcome.revision === null) {
      console.error("Productlogo koppelen mislukt", {
        code: command.error?.code ?? "INVALID_RESULT",
        requestId: context.requestId
      });
      return failure(
        context.requestId,
        outcome?.outcome === "conflict" ? 409 : 503,
        outcome?.outcome === "conflict" ? "CONFLICT" : "TEMPORARILY_UNAVAILABLE",
        "Het logo is veilig in de mediabibliotheek opgeslagen, maar niet aan het product gekoppeld.",
        "Vernieuw de productlijst en probeer het logo opnieuw te koppelen. Het geüploade bestand blijft beschikbaar in Media."
      );
    }
    const previewUrl = await createLogoPreviewUrl(context.supabase, context.session.tenantId, upload.assetId);
    return success(context.requestId, upload.assetId, previewUrl, outcome.revision, "Het productlogo is opgeslagen. Een volgende render gebruikt het nieuwe logo.");
  } catch (error) {
    if (!(error instanceof MediaUploadError)) {
      console.error("Productlogo-upload onverwacht mislukt", {
        error: error instanceof Error ? error.name : "unknown",
        requestId: context.requestId
      });
    }
    return failure(
      context.requestId,
      error instanceof MediaUploadError ? 422 : 503,
      error instanceof MediaUploadError ? "INVALID_FILE" : "TEMPORARILY_UNAVAILABLE",
      error instanceof MediaUploadError ? error.message : "Het productlogo kon niet veilig worden opgeslagen.",
      "Controleer het bestand en probeer opnieuw. Blijft dit gebeuren, geef dan de getoonde referentie door aan support."
    );
  }
}

export async function DELETE(request: Request) {
  const context = await logoRequestContext(request, false);
  if (context instanceof NextResponse) return context;
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const productId = uuidValue(body?.productId);
  const expectedRevision = revisionValue(body?.revision);
  if (!productId || expectedRevision === null) {
    return failure(context.requestId, 422, "INVALID_FILE", "De gekozen productregel is ongeldig.", "Vernieuw de productlijst en probeer het opnieuw.");
  }
  const command = await context.supabase.rpc("set_tenant_product_logo_v1", {
    p_expected_revision: expectedRevision,
    p_media_asset_id: null,
    p_product_id: productId
  });
  const outcome = readLogoCommandOutcome(command.data);
  if (command.error || outcome?.outcome !== "updated" || outcome.revision === null) {
    return failure(
      context.requestId,
      outcome?.outcome === "conflict" ? 409 : command.error?.code === "P0002" ? 404 : 503,
      outcome?.outcome === "conflict" ? "CONFLICT" : command.error?.code === "P0002" ? "NOT_FOUND" : "TEMPORARILY_UNAVAILABLE",
      outcome?.outcome === "conflict" ? "Iemand anders wijzigde deze productregel." : "Het productlogo kon niet veilig worden losgekoppeld.",
      outcome?.outcome === "conflict" ? "Vernieuw de productlijst en probeer opnieuw." : "Probeer het later opnieuw; bestaande publicaties en media blijven ongewijzigd."
    );
  }
  return success(context.requestId, null, null, outcome.revision, "Het logo is van het product verwijderd. Bestaande publicaties blijven ongewijzigd.");
}

async function logoRequestContext(request: Request, upload: boolean) {
  const requestId = crypto.randomUUID();
  if (!isTrustedImageUploadOrigin({ forwardedHost: request.headers.get("x-forwarded-host"), host: request.headers.get("host"), origin: request.headers.get("origin") })) {
    return failure(requestId, 403, "INVALID_ORIGIN", "De aanvraag kwam niet van de actieve VeyoCast Control-sessie.", "Open Control opnieuw via control.veyocast.nl en probeer het daarna opnieuw.");
  }
  if (upload && isImageUploadRequestTooLarge(request.headers.get("content-length"))) {
    return failure(requestId, 413, "REQUEST_TOO_LARGE", "Het bestand is groter dan de maximale uploadlimiet.", "Verklein of comprimeer het logo en probeer opnieuw.");
  }
  const session = await getControlSession().catch(() => null);
  if (!session?.isLive) {
    return failure(requestId, 401, "SESSION_EXPIRED", "Je Control-sessie is verlopen.", "Log opnieuw in en probeer het daarna opnieuw.");
  }
  const permitted = session.tenantId && session.tenantStatus === "active" && hasCapability(session.capabilities, "tenant.product.write") && (!upload || hasCapability(session.capabilities, "tenant.media.write"));
  if (!permitted || !session.tenantId) {
    return failure(requestId, 403, "FORBIDDEN", upload ? "Je hebt niet zowel product- als mediarechten voor deze vereniging." : "Je hebt geen rechten om productlogo's te wijzigen.", "Kies de juiste vereniging of vraag een beheerder om de benodigde rechten.");
  }
  const supabase = await createControlSupabaseClient();
  if (!supabase) {
    return failure(requestId, 503, "TEMPORARILY_UNAVAILABLE", "De beveiligde productopslag is tijdelijk niet beschikbaar.", "Probeer het later opnieuw; er is niets gewijzigd.");
  }
  return { requestId, session: { ...session, tenantId: session.tenantId }, supabase };
}

async function createLogoPreviewUrl(
  supabase: NonNullable<Awaited<ReturnType<typeof createControlSupabaseClient>>>,
  tenantId: string,
  assetId: string
) {
  const variants = await supabase
    .from("media_variants")
    .select("variant_type, storage_path")
    .eq("tenant_id", tenantId)
    .eq("asset_id", assetId);
  if (variants.error) return null;
  const variant = variants.data?.find((item) => item.variant_type === "thumbnail")
    ?? variants.data?.find((item) => item.variant_type === "original");
  if (!variant) return null;
  const signed = await supabase.storage
    .from("tenant-media")
    .createSignedUrl(variant.storage_path, 600);
  return signed.data?.signedUrl ?? null;
}

function success(requestId: string, assetId: string | null, previewUrl: string | null, revision: number, message: string) {
  return NextResponse.json({ data: { assetId, message, previewUrl, revision }, ok: true, requestId } satisfies ProductLogoApiResult, { headers: { "Cache-Control": "no-store" } });
}

function failure(requestId: string, status: number, code: Extract<ProductLogoApiResult, { ok: false }>["error"]["code"], message: string, recovery: string) {
  return NextResponse.json({ error: { code, message, recovery }, ok: false, requestId } satisfies ProductLogoApiResult, { headers: { "Cache-Control": "no-store" }, status });
}

function uuidValue(value: unknown) {
  const text = typeof value === "string" ? value : "";
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text) ? text : null;
}

function revisionValue(value: unknown) {
  const revision = Number(value);
  return Number.isSafeInteger(revision) && revision >= 0 ? revision : null;
}
