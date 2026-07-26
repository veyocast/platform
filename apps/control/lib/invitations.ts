import "server-only";

import { randomBytes } from "node:crypto";

import { classifyInvitationDeliveryError } from "./invitation-delivery";
import { createControlAdminClient } from "./supabase/admin";

export const invitationContextCookieName = "veyocast-invitation-context";
export const accountInvitationCookieName = "veyocast-account-invitation";

export type InvitationContext = Readonly<{
  invitationId: string;
  tenantId: string;
  token: string;
}>;

export function createInvitationToken() {
  return randomBytes(32).toString("hex");
}

export function serializeInvitationContext(context: InvitationContext) {
  return `${context.invitationId}.${context.tenantId}.${context.token}`;
}

export function parseInvitationContext(value: string | null | undefined): InvitationContext | null {
  if (!value) return null;
  const [invitationId, tenantId, token, extra] = value.split(".");
  if (
    extra || !invitationId || !tenantId || !token ||
    !isUuid(invitationId) || !isUuid(tenantId) || !/^[a-f0-9]{64}$/.test(token)
  ) {
    return null;
  }
  return { invitationId, tenantId, token };
}

export function createInvitationRedirectUrl(context: InvitationContext) {
  const appUrl = publicControlUrl();

  appUrl.pathname = "/auth/confirm";
  appUrl.search = "";
  appUrl.searchParams.set("invitation", context.invitationId);
  appUrl.searchParams.set("tenant", context.tenantId);
  appUrl.searchParams.set("invite_token", context.token);
  return appUrl.toString();
}

export function createAccountInvitationRedirectUrl() {
  const appUrl = publicControlUrl();

  appUrl.pathname = "/auth/confirm";
  appUrl.search = "";
  appUrl.searchParams.set("account", "platform");
  return appUrl.toString();
}

export function createPasswordRecoveryRedirectUrl() {
  const appUrl = publicControlUrl();

  appUrl.pathname = "/auth/confirm";
  appUrl.search = "";
  appUrl.searchParams.set("recovery", "password");
  return appUrl.toString();
}

function publicControlUrl() {
  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() ?? "";
  const appUrl = new URL(configuredUrl || "http://127.0.0.1:3000");

  if (appUrl.protocol !== "https:" && !["127.0.0.1", "localhost"].includes(appUrl.hostname)) {
    throw new Error("De publieke Control-URL is niet veilig geconfigureerd.");
  }

  return appUrl;
}

export async function sendTenantInvitationEmail(
  email: string,
  context: InvitationContext
) {
  return sendInvitationEmail(email, createInvitationRedirectUrl(context), {
    invitation_id: context.invitationId,
    invitation_kind: "tenant"
  });
}

export async function sendPlatformInvitationEmail(email: string) {
  return sendInvitationEmail(email, createAccountInvitationRedirectUrl(), {
    invitation_kind: "platform"
  });
}

async function sendInvitationEmail(
  email: string,
  redirectTo: string,
  data: Record<string, string>
) {
  try {
    const admin = createControlAdminClient();
    const { error } = await admin.auth.admin.inviteUserByEmail(email, {
      data,
      redirectTo
    });

    if (!error) return { delivered: true as const, errorCode: null };

    return {
      delivered: false as const,
      errorCode: classifyInvitationDeliveryError(error)
    };
  } catch {
    return {
      delivered: false as const,
      errorCode: "invite_provider_unavailable"
    };
  }
}

function isUuid(value: string | undefined) {
  return Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value));
}
