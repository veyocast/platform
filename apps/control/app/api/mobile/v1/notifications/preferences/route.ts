import { mobileNotificationPreferencesSchema } from "@veyocast/contracts";

import {
  getMobileRequestContext,
  requireMobileTenant
} from "../../../../../../lib/mobile-api/context";
import {
  mobileContextFailure,
  mobileData,
  mobileFailure
} from "../../../../../../lib/mobile-api/response";

export async function GET(request: Request) {
  try {
    const context = await getMobileRequestContext(request);
    const tenant = requireMobileTenant(
      request,
      context,
      "tenant.overview.read"
    );
    const { data, error } = await context.supabase
      .from("mobile_notification_preferences")
      .select("screen_offline, player_error, publication_completed, media_failed, approval_requested")
      .eq("user_id", context.userId)
      .eq("tenant_id", tenant.id)
      .maybeSingle();
    if (error) {
      return mobileFailure({
        code: "TEMPORARILY_UNAVAILABLE",
        message: "Meldingsvoorkeuren konden niet worden geladen.",
        recovery: "Probeer het later opnieuw.",
        requestId: context.requestId,
        status: 503
      });
    }
    return mobileData(
      mapPreferences(
        data ?? {
          approval_requested: false,
          media_failed: true,
          player_error: true,
          publication_completed: true,
          screen_offline: true
        }
      ),
      context.requestId
    );
  } catch (error) {
    return mobileContextFailure(error);
  }
}

export async function PUT(request: Request) {
  try {
    const context = await getMobileRequestContext(request);
    const tenant = requireMobileTenant(
      request,
      context,
      "tenant.overview.read"
    );
    const parsed = mobileNotificationPreferencesSchema.safeParse(
      await request.json().catch(() => null)
    );
    if (!parsed.success) {
      return mobileFailure({
        code: "VALIDATION",
        message: "De meldingsvoorkeuren zijn niet geldig.",
        recovery: "Vernieuw de pagina en probeer het opnieuw.",
        requestId: context.requestId,
        status: 422
      });
    }
    const preferences = parsed.data;
    const { data, error } = await context.supabase
      .from("mobile_notification_preferences")
      .upsert(
        {
          approval_requested: preferences.approvalRequested,
          media_failed: preferences.mediaFailed,
          player_error: preferences.playerError,
          publication_completed: preferences.publicationCompleted,
          screen_offline: preferences.screenOffline,
          tenant_id: tenant.id,
          user_id: context.userId
        },
        { onConflict: "user_id,tenant_id" }
      )
      .select("screen_offline, player_error, publication_completed, media_failed, approval_requested")
      .single();
    if (error || !data) {
      return mobileFailure({
        code: "TEMPORARILY_UNAVAILABLE",
        message: "De meldingsvoorkeuren konden niet worden opgeslagen.",
        recovery: "Je vorige voorkeuren blijven actief. Probeer het later opnieuw.",
        requestId: context.requestId,
        status: 503
      });
    }
    return mobileData(mapPreferences(data), context.requestId);
  } catch (error) {
    return mobileContextFailure(error);
  }
}

function mapPreferences(row: {
  approval_requested: boolean;
  media_failed: boolean;
  player_error: boolean;
  publication_completed: boolean;
  screen_offline: boolean;
}) {
  return {
    approvalRequested: row.approval_requested,
    mediaFailed: row.media_failed,
    playerError: row.player_error,
    publicationCompleted: row.publication_completed,
    screenOffline: row.screen_offline
  };
}
