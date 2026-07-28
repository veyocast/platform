import { mobileCreatePlaylistRequestSchema } from "@veyocast/contracts";

import {
  getMobileRequestContext,
  requireMobileTenant
} from "../../../../../lib/mobile-api/context";
import {
  mobileContextFailure,
  mobileData,
  mobileFailure
} from "../../../../../lib/mobile-api/response";

export async function POST(request: Request) {
  try {
    const context = await getMobileRequestContext(request);
    const tenant = requireMobileTenant(
      request,
      context,
      "tenant.playlist.write"
    );
    const parsed = mobileCreatePlaylistRequestSchema.safeParse(
      await request.json().catch(() => null)
    );
    if (!parsed.success) {
      return mobileFailure({
        code: "VALIDATION",
        message: "De playlistgegevens zijn niet geldig.",
        recovery: "Gebruik een naam van 2 tot en met 120 tekens.",
        requestId: context.requestId,
        status: 422
      });
    }
    const { data, error } = await context.supabase
      .from("playlists")
      .insert({
        created_by: context.userId,
        description: parsed.data.description,
        name: parsed.data.name,
        status: "draft",
        tenant_id: tenant.id,
        updated_by: context.userId
      })
      .select("id")
      .single();
    if (error || !data) {
      return mobileFailure({
        code: error?.code === "42501" ? "FORBIDDEN" : "CONFLICT",
        message: "De conceptplaylist kon niet worden aangemaakt.",
        recovery: "Controleer je rechten en probeer het opnieuw.",
        requestId: context.requestId,
        status: error?.code === "42501" ? 403 : 409
      });
    }
    return mobileData({ playlistId: data.id }, context.requestId, 201);
  } catch (error) {
    return mobileContextFailure(error);
  }
}
