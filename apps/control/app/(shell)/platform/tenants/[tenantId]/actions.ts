"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  createInvitationToken,
  sendTenantInvitationEmail
} from "../../../../../lib/invitations";
import { requireControlCapability } from "../../../../../lib/control-session";
import { createControlSupabaseClient } from "../../../../../lib/supabase/server";

export async function updateTenantLifecycle(formData: FormData) {
  const tenantId = idValue(formData, "tenantId");
  const status = String(formData.get("status") ?? "");
  if (!isTenantStatus(status)) fail(tenantId, "invoer");
  if (status !== "active" && formData.get("confirmImpact") !== "on") {
    fail(tenantId, "bevestiging");
  }

  await requireControlCapability("platform.tenant.lifecycle", {
    aal2: true,
    returnTo: `/platform/tenants/${tenantId}`
  });
  const supabase = await createControlSupabaseClient();
  if (!supabase) fail(tenantId, "configuratie");

  const { error } = await supabase.rpc("update_platform_tenant_lifecycle", {
    p_status: status,
    p_tenant_id: tenantId
  });
  if (error) fail(tenantId, error.code === "42501" ? "rechten" : "lifecycle");

  revalidateTenant(tenantId);
  redirect(`/platform/tenants/${tenantId}?succes=lifecycle`);
}

export async function updateTenantScreenLimit(formData: FormData) {
  const tenantId = idValue(formData, "tenantId");
  const screenLimit = Number.parseInt(String(formData.get("screenLimit") ?? ""), 10);
  if (!Number.isInteger(screenLimit) || screenLimit < 1 || screenLimit > 10_000) {
    fail(tenantId, "schermlimiet");
  }

  await requireControlCapability("platform.tenant.lifecycle", {
    aal2: true,
    returnTo: `/platform/tenants/${tenantId}#limieten`
  });
  const supabase = await createControlSupabaseClient();
  if (!supabase) fail(tenantId, "configuratie");
  const { error } = await supabase.rpc("update_platform_tenant_screen_limit", {
    p_screen_limit: screenLimit,
    p_tenant_id: tenantId
  });
  if (error) {
    fail(tenantId, error.code === "23514" ? "limiet-in-gebruik" : "schermlimiet");
  }

  revalidateTenant(tenantId);
  redirect(`/platform/tenants/${tenantId}?succes=limiet#limieten`);
}

export async function resendProvisioningInvitation(formData: FormData) {
  const tenantId = idValue(formData, "tenantId");
  const invitationId = idValue(formData, "invitationId");
  await requireControlCapability("platform.tenant.lifecycle", {
    aal2: true,
    returnTo: `/platform/tenants/${tenantId}#uitnodigingen`
  });
  const supabase = await createControlSupabaseClient();
  if (!supabase) fail(tenantId, "configuratie");

  const token = createInvitationToken();
  const { data: newInvitationId, error: rotateError } = await supabase.rpc(
    "rotate_tenant_invitation",
    { p_invitation_id: invitationId, p_invitation_token: token }
  );
  if (rotateError || typeof newInvitationId !== "string") fail(tenantId, "uitnodiging");

  const invitation = await supabase
    .from("tenant_invitations")
    .select("email")
    .eq("id", newInvitationId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (invitation.error || !invitation.data) fail(tenantId, "uitnodiging");

  const delivery = await sendTenantInvitationEmail(invitation.data.email, {
    invitationId: newInvitationId,
    tenantId,
    token
  });
  const { error: markerError } = await supabase.rpc("mark_tenant_invitation_delivery", {
    p_delivered: delivery.delivered,
    p_error_code: delivery.errorCode,
    p_invitation_id: newInvitationId
  });
  revalidateTenant(tenantId);
  redirect(
    `/platform/tenants/${tenantId}?${
      delivery.delivered && !markerError ? "succes=uitnodiging" : "waarschuwing=uitnodiging"
    }#uitnodigingen`
  );
}

function revalidateTenant(tenantId: string) {
  revalidatePath("/platform");
  revalidatePath("/platform/tenants");
  revalidatePath(`/platform/tenants/${tenantId}`);
}

function idValue(formData: FormData, name: string) {
  const value = String(formData.get(name) ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(value)) redirect("/platform/tenants?fout=invoer");
  return value;
}

function isTenantStatus(value: string): value is "active" | "paused" | "archived" {
  return value === "active" || value === "paused" || value === "archived";
}

function fail(tenantId: string, code: string): never {
  redirect(`/platform/tenants/${tenantId}?fout=${encodeURIComponent(code)}`);
}
