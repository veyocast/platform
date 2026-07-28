import { createHash } from "node:crypto";

import { mobileDeviceRegistrationSchema } from "@veyocast/contracts";

import { getMobileRequestContext } from "../../../../../../lib/mobile-api/context";
import {
  mobileContextFailure,
  mobileData,
  mobileFailure
} from "../../../../../../lib/mobile-api/response";
import {
  encryptPushToken,
  readPushTokenEncryptionKey
} from "../../../../../../lib/mobile-api/push-token";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const context = await getMobileRequestContext(request);
    const parsed = mobileDeviceRegistrationSchema.safeParse(
      await request.json().catch(() => null)
    );
    if (!parsed.success) {
      return mobileFailure({
        code: "VALIDATION",
        message: "De pushregistratie is niet geldig.",
        recovery: "Werk de app bij en schakel meldingen opnieuw in.",
        requestId: context.requestId,
        status: 422
      });
    }
    const key = readPushTokenEncryptionKey();
    if (!key) {
      return mobileFailure({
        code: "TEMPORARILY_UNAVAILABLE",
        message: "Pushregistratie is in deze omgeving niet geconfigureerd.",
        recovery: "Meldingen blijven uitgeschakeld. Probeer het later opnieuw.",
        requestId: context.requestId,
        status: 503
      });
    }
    const token = parsed.data.pushToken;
    const encrypted = encryptPushToken(token, key);
    const { data, error } = await context.supabase.rpc(
      "register_mobile_control_device_v1",
      {
        p_app_version: parsed.data.appVersion,
        p_encrypted_token: `\\x${encrypted.toString("hex")}`,
        p_encryption_key_version: 1,
        p_locale: parsed.data.locale,
        p_timezone_name: parsed.data.timezone,
        p_token_hash: createHash("sha256").update(token).digest("hex")
      }
    );
    if (error || typeof data !== "string") {
      console.error("Mobile push registration failed", {
        code: error?.code,
        requestId: context.requestId
      });
      return mobileFailure({
        code: "TEMPORARILY_UNAVAILABLE",
        message: "Dit apparaat kon niet voor meldingen worden geregistreerd.",
        recovery: "Meldingen blijven uitgeschakeld. Probeer het later opnieuw.",
        requestId: context.requestId,
        status: 503
      });
    }
    return mobileData({ deviceId: data }, context.requestId, 201);
  } catch (error) {
    return mobileContextFailure(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const context = await getMobileRequestContext(request);
    const body: unknown = await request.json().catch(() => null);
    const deviceId =
      body &&
      typeof body === "object" &&
      "deviceId" in body &&
      typeof body.deviceId === "string"
        ? body.deviceId
        : null;
    if (
      !deviceId ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        deviceId
      )
    ) {
      return mobileFailure({
        code: "VALIDATION",
        message: "De apparaatregistratie is niet geldig.",
        recovery: "Vernieuw de meldingsinstellingen.",
        requestId: context.requestId,
        status: 422
      });
    }
    const { data, error } = await context.supabase.rpc(
      "revoke_mobile_control_device_v1",
      { p_device_id: deviceId }
    );
    if (error) {
      return mobileFailure({
        code: "TEMPORARILY_UNAVAILABLE",
        message: "Meldingen konden niet server-side worden uitgeschakeld.",
        recovery: "Android blokkeert meldingen lokaal; probeer serveruitschrijving later opnieuw.",
        requestId: context.requestId,
        status: 503
      });
    }
    return mobileData({ revoked: data === true }, context.requestId);
  } catch (error) {
    return mobileContextFailure(error);
  }
}
