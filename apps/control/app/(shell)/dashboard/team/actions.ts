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
  const access = accessValue(formData);
  const email = emailValue(formData);

  const token = createInvitationToken();
  const invitation = access.kind === "custom"
    ? await supabase.rpc("create_tenant_custom_role_invitation_v1", {
        p_custom_role_id: access.id,
        p_email: email,
        p_invitation_token: token,
        p_tenant_id: session.tenantId
      })
    : await supabase.rpc("create_tenant_invitation", {
        p_email: email,
        p_invitation_token: token,
        p_role: access.role,
        p_tenant_id: session.tenantId
      });
  const { data: invitationId, error } = invitation;
  if (error || typeof invitationId !== "string") {
    fail(error?.code === "23505" ? "bestaat" : error?.code === "42501" ? "rechten" : "uitnodiging");
  }

  await deliverAndMark(supabase, email, {
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
  const access = accessValue(formData);
  if (userId === session.userId) fail("zelf");

  const { error } = access.kind === "custom"
    ? await supabase.rpc("set_tenant_member_custom_role_v1", {
        p_custom_role_id: access.id,
        p_tenant_id: session.tenantId,
        p_user_id: userId
      })
    : await supabase.rpc("clear_tenant_member_custom_role_v1", {
        p_role: access.role,
        p_tenant_id: session.tenantId,
        p_user_id: userId
      });
  if (error) fail(teamMutationError(error.code, error.message));
  done("rol");
}

export async function createTenantCustomRole(formData: FormData) {
  const { session, supabase } = await customRoleContext();
  const details = customRoleDetails(formData);
  const { error } = await supabase.rpc("create_tenant_custom_role_v1", {
    p_capabilities: details.capabilities,
    p_description: details.description || null,
    p_name: details.name,
    p_tenant_id: session.tenantId
  });
  if (error) fail(customRoleError(error.code, error.message));
  done("custom-rol");
}

export async function updateTenantCustomRole(formData: FormData) {
  const { session, supabase } = await customRoleContext();
  const details = customRoleDetails(formData);
  const roleId = idValue(formData, "roleId");
  const expectedRevision = revisionValue(formData);
  const { data, error } = await supabase.rpc("update_tenant_custom_role_v1", {
    p_capabilities: details.capabilities,
    p_description: details.description || null,
    p_expected_revision: expectedRevision,
    p_name: details.name,
    p_role_id: roleId,
    p_tenant_id: session.tenantId
  });
  if (error) fail(customRoleError(error.code, error.message));
  if (resultOutcome(data) === "conflict") fail("rolconflict");
  done("custom-rol");
}

export async function archiveTenantCustomRole(formData: FormData) {
  const { session, supabase } = await customRoleContext();
  const roleId = idValue(formData, "roleId");
  const expectedRevision = revisionValue(formData);
  if (formData.get("confirmArchive") !== "on") fail("bevestiging");
  const { data, error } = await supabase.rpc("archive_tenant_custom_role_v1", {
    p_expected_revision: expectedRevision,
    p_role_id: roleId,
    p_tenant_id: session.tenantId
  });
  if (error) fail(customRoleError(error.code, error.message));
  if (resultOutcome(data) === "conflict") fail("rolconflict");
  done("rol-gearchiveerd");
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

async function customRoleContext() {
  const context = await teamContext();
  const membership = context.session.tenantMemberships.find(
    (item) => item.id === context.session.tenantId
  );
  const isPlatformManager = context.session.roles.some(
    (role) => role === "platform_owner" || role === "platform_admin"
  );
  if (membership?.role !== "tenant_owner" && !isPlatformManager) fail("rol-eigenaar");
  return context;
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

function accessValue(formData: FormData):
  | { kind: "builtin"; role: "tenant_owner" | "tenant_admin" | "tenant_editor" | "tenant_viewer" }
  | { id: string; kind: "custom" } {
  const value = String(formData.get("access") ?? "");
  if (value.startsWith("builtin:")) {
    const role = value.slice("builtin:".length);
    if (isTenantRole(role)) return { kind: "builtin", role };
  }
  if (value.startsWith("custom:")) {
    const id = value.slice("custom:".length);
    if (/^[0-9a-f-]{36}$/i.test(id)) return { id, kind: "custom" };
  }
  fail("invoer");
}

function emailValue(formData: FormData) {
  const parsed = tenantInvitationCommandSchema.shape.email.safeParse(
    String(formData.get("email") ?? "")
  );
  if (!parsed.success) fail("invoer");
  return parsed.data;
}

function customRoleDetails(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  if (name.length < 2 || name.length > 60 || description.length > 240) fail("rolinvoer");
  const selected = new Set(
    formData.getAll("capabilities").map((value) => String(value))
  );
  const capabilities = selected.has("content.write")
    ? ["tenant.media.write", "tenant.playlist.write"]
    : [];
  if (selected.has("studio.author")) {
    capabilities.push(
      "tenant.studio.create",
      "tenant.studio.edit_own",
      "tenant.studio.motion.edit",
      "tenant.studio.render"
    );
  }
  if (selected.has("studio.manage")) {
    capabilities.push(
      "tenant.studio.edit_all",
      "tenant.studio.archive",
      "tenant.studio.job.manage"
    );
  }
  for (const capability of configurableCapabilities) {
    if (selected.has(capability)) capabilities.push(capability);
  }
  return { capabilities, description, name };
}

function revisionValue(formData: FormData) {
  const revision = Number(formData.get("expectedRevision"));
  if (!Number.isSafeInteger(revision) || revision < 0) fail("rolinvoer");
  return revision;
}

function resultOutcome(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return (value as { outcome?: unknown }).outcome;
}

function customRoleError(code: string, message: string) {
  if (code === "23505") return "rolbestaat";
  if (code === "42501") return "rol-eigenaar";
  if (code === "23514" && message.includes("still assigned")) return "rol-toegewezen";
  return code === "23514" ? "rolinvoer" : "teamwijziging";
}

const configurableCapabilities = [
  "tenant.playlist.publish",
  "tenant.studio.template.manage",
  "tenant.screen.manage",
  "tenant.settings.manage",
  "tenant.audit.read",
  "tenant.support.export"
] as const;

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
