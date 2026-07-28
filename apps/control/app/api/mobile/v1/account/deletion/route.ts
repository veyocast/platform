import { getMobileRequestContext } from "../../../../../../lib/mobile-api/context";
import {
  mobileContextFailure,
  mobileData,
  mobileFailure
} from "../../../../../../lib/mobile-api/response";

export async function GET(request: Request) {
  try {
    const context = await getMobileRequestContext(request);
    const { data, error } = await context.supabase
      .from("data_deletion_requests")
      .select("id, request_number, status, requested_at, executed_at")
      .eq("requested_user_id", context.userId)
      .eq("scope", "account")
      .order("requested_at", { ascending: false });
    if (error) {
      return mobileFailure({
        code: "TEMPORARILY_UNAVAILABLE",
        message: "Je verwijderverzoeken konden niet worden geladen.",
        recovery: "Probeer het later opnieuw.",
        requestId: context.requestId,
        status: 503
      });
    }
    return mobileData(
      (data ?? []).map((item) => ({
        executedAt: item.executed_at,
        id: item.id,
        requestedAt: item.requested_at,
        requestNumber: Number(item.request_number),
        status: item.status
      })),
      context.requestId
    );
  } catch (error) {
    return mobileContextFailure(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await getMobileRequestContext(request);
    const body: unknown = await request.json().catch(() => null);
    let reason: string | null = null;
    if (body && typeof body === "object") {
      const candidate = (body as Record<string, unknown>).reason;
      if (candidate === undefined) reason = "";
      if (typeof candidate === "string") reason = candidate.trim();
    }
    if (reason === null || reason.length > 1000) {
      return mobileFailure({
        code: "VALIDATION",
        message: "De toelichting is niet geldig.",
        recovery: "Gebruik maximaal 1.000 tekens.",
        requestId: context.requestId,
        status: 422
      });
    }
    const { data, error } = await context.supabase.rpc(
      "request_data_deletion_v1",
      {
        p_reason: reason || null,
        p_scope: "account",
        p_tenant_id: null
      }
    );
    if (error) {
      return mobileFailure({
        code: error.code === "42501" ? "FORBIDDEN" : "CONFLICT",
        message: "Het verwijderverzoek kon niet veilig worden opgeslagen.",
        recovery: "Controleer je sessie en probeer het opnieuw.",
        requestId: context.requestId,
        status: error.code === "42501" ? 403 : 409
      });
    }
    const result =
      data && typeof data === "object"
        ? (data as Record<string, unknown>)
        : {};
    return mobileData(
      {
        requestId:
          typeof result.requestId === "string" ? result.requestId : null,
        requestNumber:
          typeof result.requestNumber === "number"
            ? result.requestNumber
            : null,
        status: "requested"
      },
      context.requestId,
      201
    );
  } catch (error) {
    return mobileContextFailure(error);
  }
}
