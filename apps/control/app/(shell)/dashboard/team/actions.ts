"use server";

import { tenantInvitationCommandSchema } from "@veyocast/contracts";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  createInvitationToken,
  sendTenantInvitationEmail
} from "../../../../lib/invitations";
import { requireTenantCapability } from "../../../../lib/control-session";
import { createControlSupabaseClient } from "../../../../lib/supabase/server";

export async function inviteTenantMember(formData: FormData) {
  const { session, supabase } = await teamContext();
  const command = tenantInvitationCommandSchema.safeParse({
    email: String(formData.get("email") ?? ""),
    role: String(formData.get("role") ?? "")
  });
  if (!command.success) fail("invoer");

  const token = createInvitationToken();
  const { data: invitationId, error } = await supabase.rpc("create_tenant_invitation", {
    p_email: command.data.email,
    p_invitation_token: token,
    p_role: command.data.role,
    p_tenant_id: session.tenantId
  });
  if (error || typeof invitationId !== "string") {
    fail(error?.code === "23505" ? "bestaat" : error?.code === "42501" ? "rechten" : "uitnodiging");
  }

  await deliverAndMark(supabase, command.data.email, {
    invitationId,
    tenantId: session.tenantId,
    token
  });
}

export async function resendTenantInvitation(formData: FormData) {
  const { session, supabase } = await teamContext();
  const invitationId = idValue(formData, "invitationId");
  const token = createInvitationToken();
  const { data: newInvitationId, error } = await supabase.rpc("rotate_tenant_invitation", {
    p_invitation_id: invitationId,
    p_invitation_token: token
  });
  if (error || typeof newInvitationId !== "string") fail("uitnodiging");

  const invitation = await supabase
    .from("tenant_invitations")
    .select("email")
    .eq("tenant_id", session.tenantId)
    .eq("id", newInvitationId)
    .maybeSingle();
  if (invitation.error || !invitation.data) fail("uitnodiging");

  await deliverAndMark(supabase, invitation.data.email, {
    invitationId: newInvitationId,
    tenantId: session.tenantId,
    token
  });
}

export async function revokeTenantInvitation(formData: FormData) {
  const { supabase } = await teamContext();
  const invitationId = idValue(formData, "invitationId");
  if (formData.get("confirmRevoke") !== "on") fail("bevestiging");
  const { error } = await supabase.rpc("revoke_tenant_invitation", {
    p_invitation_id: invitationId
  });
  if (error) fail(error.code === "42501" ? "rechten" : "uitnodiging");
  done("ingetrokken");
}

export async function changeTenantMemberRole(formData: FormData) {
  const { session, supabase } = await teamContext();
  const userId = idValue(formData, "userId");
  const role = String(formData.get("role") ?? "");
  if (!isTenantRole(role)) fail("invoer");
  if (userId === session.userId) fail("zelf");

  const { error } = await supabase.rpc("set_tenant_member_role", {
    p_role: role,
    p_tenant_id: session.tenantId,
    p_user_id: userId
  });
  if (error) fail(teamMutationError(error.code, error.message));
  done("rol");
}

export async function removeTenantMember(formData: FormData) {
  const { session, supabase } = await teamContext();
  const userId = idValue(formData, "userId");
  if (formData.get("confirmRemove") !== "on") fail("bevestiging");
  if (userId === session.userId) fail("zelf");

  const { error } = await supabase.rpc("remove_tenant_member", {
    p_tenant_id: session.tenantId,
    p_user_id: userId
  });
  if (error) fail(teamMutationError(error.code, error.message));
  done("verwijderd");
}

async function teamContext() {
  const session = await requireTenantCapability("tenant.team.manage");
  const supabase = await createControlSupabaseClient();
  if (!session.isLive || !session.tenantId || !supabase) fail("configuratie");
  return { session: { ...session, tenantId: session.tenantId }, supabase };
}

async function deliverAndMark(
  supabase: NonNullable<Awaited<ReturnType<typeof createControlSupabaseClient>>>,
  email: string,
  context: Readonly<{ invitationId: string; tenantId: string; token: string }>
) {
  const delivery = await sendTenantInvitationEmail(email, context);
  const { error } = await supabase.rpc("mark_tenant_invitation_delivery", {
    p_delivered: delivery.delivered,
    p_error_code: delivery.errorCode,
    p_invitation_id: context.invitationId
  });
  revalidatePath("/dashboard/team");
  redirect(
    `/dashboard/team?${
      delivery.delivered && !error ? "succes=verstuurd" : "waarschuwing=bezorging"
    }#uitnodigingen`
  );
}

function teamMutationError(code: string, message: string) {
  if (code === "42501" && message.includes("self lockout")) return "zelf";
  if (code === "23514" && message.includes("last tenant owner")) return "laatste-eigenaar";
  return code === "42501" ? "rechten" : "teamwijziging";
}

function isTenantRole(value: string): value is "tenant_owner" | "tenant_admin" | "tenant_editor" | "tenant_viewer" {
  return ["tenant_owner", "tenant_admin", "tenant_editor", "tenant_viewer"].includes(value);
}

function idValue(formData: FormData, name: string) {
  const value = String(formData.get(name) ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(value)) fail("invoer");
  return value;
}

function done(code: string): never {
  revalidatePath("/dashboard/team");
  redirect(`/dashboard/team?succes=${encodeURIComponent(code)}`);
}

function fail(code: string): never {
  redirect(`/dashboard/team?fout=${encodeURIComponent(code)}`);
}
