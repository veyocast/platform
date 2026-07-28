import { uploadValidatedImageCandidate } from "../../../../../../lib/media/validated-image-upload";
import {
  getMobileRequestContext,
  requireMobileTenant
} from "../../../../../../lib/mobile-api/context";
import {
  mobileContextFailure,
  mobileData,
  mobileFailure
} from "../../../../../../lib/mobile-api/response";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const context = await getMobileRequestContext(request);
    const tenant = requireMobileTenant(
      request,
      context,
      "tenant.media.write"
    );
    const formData = await request.formData().catch(() => null);
    if (!formData) {
      return mobileFailure({
        code: "VALIDATION",
        message: "De upload bevat geen geldig bestand.",
        recovery: "Kies een JPEG-, PNG- of WebP-afbeelding en probeer opnieuw.",
        requestId: context.requestId,
        status: 422
      });
    }
    try {
      const result = await uploadValidatedImageCandidate({
        candidate: formData.get("media"),
        supabase: context.supabase,
        tenantId: tenant.id,
        title: String(formData.get("title") ?? "").trim(),
        userId: context.userId
      });
      return mobileData(result, context.requestId, 201);
    } catch (error) {
      console.error("Mobile image upload rejected", {
        error: error instanceof Error ? error.name : "unknown",
        requestId: context.requestId
      });
      return mobileFailure({
        code: "VALIDATION",
        message:
          error instanceof Error
            ? error.message
            : "De afbeelding kon niet veilig worden verwerkt.",
        recovery: "Controleer type, inhoud en bestandsgrootte en probeer opnieuw.",
        requestId: context.requestId,
        status: 422
      });
    }
  } catch (error) {
    return mobileContextFailure(error);
  }
}
