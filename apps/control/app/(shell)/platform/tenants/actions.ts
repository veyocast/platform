"use server";

import { randomUUID } from "node:crypto";

import { tenantProvisioningCommandSchema } from "@veyocast/contracts";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  createInvitationToken,
  sendTenantInvitationEmail
} from "../../../../lib/invitations";
import { requireControlCapability } from "../../../../lib/control-session";
import { createControlSupabaseClient } from "../../../../lib/supabase/server";

export async function createTenant(formData: FormData) {
  const session = await requireControlCapability("platform.tenant.create", {
    aal2: true,
    returnTo: "/platform/tenants#nieuwe-tenant"
  });
  const supabase = await createControlSupabaseClient();

  if (!session.isLive || !supabase) {
    fail("configuratie");
  }

  const command = tenantProvisioningCommandSchema.safeParse({
    actorBecomesOwner: formData.get("actorBecomesOwner") === "on",
    locale: String(formData.get("locale") ?? ""),
    metadata: {
      idempotencyKey: String(formData.get("idempotencyKey") ?? ""),
      requestId: `request:${randomUUID()}`
    },
    name: String(formData.get("name") ?? ""),
    ownerEmail: String(formData.get("ownerEmail") ?? ""),
    screenLimit: Number.parseInt(String(formData.get("screenLimit") ?? ""), 10),
    slug: String(formData.get("slug") ?? "").trim().toLowerCase(),
    timezone: String(formData.get("timezone") ?? "")
  });

  if (!command.success) fail("invoer");

  const invitationToken = createInvitationToken();
  const { data, error } = await supabase.rpc("provision_platform_tenant", {
    p_actor_becomes_owner: command.data.actorBecomesOwner,
    p_idempotency_key: command.data.metadata.idempotencyKey,
    p_invitation_token: invitationToken,
    p_locale: command.data.locale,
    p_name: command.data.name,
    p_owner_email: command.data.ownerEmail,
    p_request_id: command.data.metadata.requestId,
    p_screen_limit: command.data.screenLimit,
    p_slug: command.data.slug,
    p_timezone: command.data.timezone
  });

  if (error) {
    if (error.code === "23505") fail("conflict");
    if (error.code === "22023") fail("idempotency");
    if (error.code === "42501") fail("rechten");
    if (error.code === "23514") fail("invoer");
    fail("onverwacht");
  }

  const result = parseProvisioningResult(data);
  if (!result) fail("onverwacht");

  if (!result.created) {
    redirect(`/platform/tenants/${result.tenantId}?succes=bestaand`);
  }

  const delivery = await sendTenantInvitationEmail(command.data.ownerEmail, {
    invitationId: result.invitationId,
    tenantId: result.tenantId,
    token: invitationToken
  });
  const { error: deliveryStatusError } = await supabase.rpc(
    "mark_tenant_invitation_delivery",
    {
      p_delivered: delivery.delivered,
      p_error_code: delivery.errorCode,
      p_invitation_id: result.invitationId
    }
  );

  revalidatePath("/platform");
  revalidatePath("/platform/tenants");
  redirect(
    `/platform/tenants/${result.tenantId}?succes=aangemaakt${
      !delivery.delivered || deliveryStatusError ? "&waarschuwing=uitnodiging" : ""
    }`
  );
}

function parseProvisioningResult(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const result = value as Record<string, unknown>;
  if (
    typeof result.created !== "boolean" ||
    typeof result.invitationId !== "string" ||
    typeof result.tenantId !== "string"
  ) return null;
  return {
    created: result.created,
    invitationId: result.invitationId,
    tenantId: result.tenantId
  };
}

function fail(code: string): never {
  redirect(`/platform/tenants?fout=${encodeURIComponent(code)}#nieuwe-tenant`);
}
