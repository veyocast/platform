import { hasCapability } from "@veyocast/auth";
import { NextResponse } from "next/server";

import { getControlSession } from "../../../../lib/control-session";
import {
  isImageUploadRequestTooLarge,
  isTrustedImageUploadOrigin,
  type ImageUploadApiResult
} from "../../../../lib/media/image-upload-api";
import {
  MediaUploadError,
  uploadValidatedImageCandidate
} from "../../../../lib/media/validated-image-upload";
import { createControlSupabaseClient } from "../../../../lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  if (
    !isTrustedImageUploadOrigin({
      forwardedHost: request.headers.get("x-forwarded-host"),
      host: request.headers.get("host"),
      origin: request.headers.get("origin")
    })
  ) {
    return failure(
      requestId,
      403,
      "INVALID_ORIGIN",
      "De upload kwam niet van de actieve VeyoCast Control-sessie.",
      "Open Control opnieuw via control.veyocast.nl en probeer het bestand daarna opnieuw."
    );
  }
  if (isImageUploadRequestTooLarge(request.headers.get("content-length"))) {
    return failure(
      requestId,
      413,
      "REQUEST_TOO_LARGE",
      "Het bestand is groter dan de maximale uploadlimiet van 50 MB.",
      "Verklein of comprimeer het bestand en probeer opnieuw."
    );
  }

  let session;
  try {
    session = await getControlSession();
  } catch {
    return failure(
      requestId,
      503,
      "TEMPORARILY_UNAVAILABLE",
      "Je uploadrechten konden niet veilig worden gecontroleerd.",
      "Controleer je verbinding en probeer het opnieuw."
    );
  }
  if (!session?.isLive) {
    return failure(
      requestId,
      401,
      "SESSION_EXPIRED",
      "Je Control-sessie is verlopen.",
      "Log opnieuw in en probeer de upload daarna opnieuw."
    );
  }
  if (
    !session.tenantId ||
    session.tenantStatus !== "active" ||
    !hasCapability(session.capabilities, "tenant.media.write")
  ) {
    return failure(
      requestId,
      403,
      "FORBIDDEN",
      "Je hebt in de gekozen vereniging geen toegang tot media-upload.",
      "Kies de juiste vereniging of vraag een beheerder om uploadrechten."
    );
  }

  const supabase = await createControlSupabaseClient();
  if (!supabase) {
    return failure(
      requestId,
      503,
      "TEMPORARILY_UNAVAILABLE",
      "De beveiligde mediaopslag is tijdelijk niet beschikbaar.",
      "Probeer het later opnieuw; er is geen media-item aangemaakt."
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return failure(
      requestId,
      422,
      "INVALID_FILE",
      "Het uploadbestand kon niet volledig worden ontvangen.",
      "Selecteer het bestand opnieuw en laat Control geopend tot de upload klaar is."
    );
  }

  try {
    const result = await uploadValidatedImageCandidate({
      candidate: formData.get("media"),
      supabase,
      tenantId: session.tenantId,
      title: String(formData.get("title") ?? "").trim(),
      userId: session.userId
    });
    return NextResponse.json(
      {
        data: {
          assetId: result.assetId,
          processing: result.processing,
          title: result.title
        },
        ok: true,
        requestId
      } satisfies ImageUploadApiResult,
      {
        headers: { "Cache-Control": "no-store" },
        status: 201
      }
    );
  } catch (error) {
    if (!(error instanceof MediaUploadError)) {
      console.error("Afbeeldingsupload-API onverwacht mislukt", {
        error: error instanceof Error ? error.name : "unknown",
        requestId
      });
    }
    return failure(
      requestId,
      error instanceof MediaUploadError ? 422 : 503,
      error instanceof MediaUploadError
        ? "INVALID_FILE"
        : "TEMPORARILY_UNAVAILABLE",
      error instanceof MediaUploadError
        ? error.message
        : "De afbeelding kon niet veilig worden opgeslagen.",
      "Controleer het bestand en probeer opnieuw. Blijft dit gebeuren, geef dan de getoonde referentie door aan support."
    );
  }
}

function failure(
  requestId: string,
  status: number,
  code: Extract<ImageUploadApiResult, { ok: false }>["error"]["code"],
  message: string,
  recovery: string
) {
  return NextResponse.json(
    {
      error: { code, message, recovery },
      ok: false,
      requestId
    } satisfies ImageUploadApiResult,
    {
      headers: { "Cache-Control": "no-store" },
      status
    }
  );
}
