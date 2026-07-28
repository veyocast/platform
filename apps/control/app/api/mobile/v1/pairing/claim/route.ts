import { createHash } from "node:crypto";

import {
  mobilePairingClaimRequestSchema,
  mobilePairingClaimSchema
} from "@veyocast/contracts";

import {
  getMobileRequestContext,
  requireMobileTenant
} from "../../../../../../lib/mobile-api/context";
import {
  mobileContextFailure,
  mobileData,
  mobileFailure
} from "../../../../../../lib/mobile-api/response";

export async function POST(request: Request) {
  try {
    const context = await getMobileRequestContext(request);
    const tenant = requireMobileTenant(
      request,
      context,
      "tenant.screen.manage"
    );
    const parsed = mobilePairingClaimRequestSchema.safeParse(
      await request.json().catch(() => null)
    );
    if (!parsed.success) {
      return mobileFailure({
        code: "VALIDATION",
        message: "De koppelcode of het gekozen scherm is niet geldig.",
        recovery: "Neem alle tekens over of scan de code opnieuw.",
        requestId: context.requestId,
        status: 422
      });
    }
    const input = parsed.data;
    const { data, error } = await context.supabase.rpc(
      "claim_pairing_session_mobile_v1",
      {
        p_code_hash: createHash("sha256").update(input.code).digest("hex"),
        p_device_name: "VeyoCast Player",
        p_idempotency_key: input.idempotencyKey,
        p_screen_id: input.screenId,
        p_tenant_id: tenant.id
      }
    );
    if (error) {
      return mobileFailure({
        code: error.code === "42501" ? "FORBIDDEN" : "CONFLICT",
        message: "Het scherm kon niet veilig worden gekoppeld.",
        recovery: "Controleer het scherm en vraag zo nodig een nieuwe koppelcode aan.",
        requestId: context.requestId,
        status: error.code === "42501" ? 403 : 409
      });
    }
    const result = pairingResult(data);
    if (!result.ok || !result.deviceId) {
      return mobileFailure({
        code: result.code === "RATE_LIMITED"
          ? "TEMPORARILY_UNAVAILABLE"
          : "CONFLICT",
        message: pairingFailureMessage(result.code),
        recovery: "Laat de Player een nieuwe code tonen en probeer het opnieuw.",
        requestId: context.requestId,
        status: result.code === "RATE_LIMITED" ? 429 : 409
      });
    }
    return mobileData(
      mobilePairingClaimSchema.parse({
        code: input.code,
        deviceId: result.deviceId,
        screenId: input.screenId,
        status: "paired"
      }),
      context.requestId,
      201
    );
  } catch (error) {
    return mobileContextFailure(error);
  }
}

function pairingResult(value: unknown): {
  code: string | null;
  deviceId: string | null;
  ok: boolean;
} {
  if (!value || typeof value !== "object") {
    return { code: "UNKNOWN", deviceId: null, ok: false };
  }
  const record = value as Record<string, unknown>;
  return {
    code: typeof record.code === "string" ? record.code : null,
    deviceId: typeof record.deviceId === "string" ? record.deviceId : null,
    ok: record.ok === true
  };
}

function pairingFailureMessage(code: string | null) {
  if (code === "EXPIRED") return "Deze koppelcode is verlopen.";
  if (code === "RATE_LIMITED") {
    return "Er zijn te veel koppelpogingen gedaan.";
  }
  if (code === "SCREEN_UNAVAILABLE") {
    return "Het gekozen scherm is niet beschikbaar voor koppelen.";
  }
  return "Deze koppelcode is ongeldig of al gebruikt.";
}
