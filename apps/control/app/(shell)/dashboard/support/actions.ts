"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  requireControlCapability,
  requireTenantCapability
} from "../../../../lib/control-session";
import { createControlSupabaseClient } from "../../../../lib/supabase/server";

export async function createSupportTicket(formData: FormData) {
  const session = await requireTenantCapability("tenant.ticket.write");
  const supabase = await createControlSupabaseClient();
  if (!supabase || !session.tenantId) fail("/dashboard/support", "configuratie");
  const { data, error } = await supabase.rpc("create_support_ticket_v1", {
    p_body: requiredText(formData, "body", 10_000),
    p_department_id: uuid(formData, "departmentId"),
    p_priority: enumValue(formData, "priority", ["low", "normal", "high", "urgent"]),
    p_sensitive: formData.get("sensitive") === "on",
    p_subject: requiredText(formData, "subject", 160),
    p_tenant_id: session.tenantId
  });
  const ticketId = recordValue(data, "ticketId");
  if (error || !ticketId) fail("/dashboard/support", "opslaan");
  revalidatePath("/dashboard/support");
  redirect(`/dashboard/support/${ticketId}?succes=aangemaakt`);
}

export async function addTicketMessage(formData: FormData) {
  const platform = formData.get("scope") === "platform";
  await (platform
    ? requireControlCapability("platform.ticket.write")
    : requireTenantCapability("tenant.ticket.write"));
  const ticketId = uuid(formData, "ticketId");
  const supabase = await createControlSupabaseClient();
  if (!supabase) fail(ticketPath(platform, ticketId), "configuratie");
  const { error } = await supabase.rpc("add_support_ticket_message_v1", {
    p_body: requiredText(formData, "body", 10_000),
    p_sensitive: formData.get("sensitive") === "on",
    p_ticket_id: ticketId
  });
  if (error) fail(ticketPath(platform, ticketId), "antwoord");
  revalidatePath(ticketPath(platform, ticketId));
  redirect(`${ticketPath(platform, ticketId)}?succes=antwoord`);
}

export async function updateTicketStatus(formData: FormData) {
  await requireControlCapability("platform.ticket.write");
  const ticketId = uuid(formData, "ticketId");
  const supabase = await createControlSupabaseClient();
  if (!supabase) fail(`/platform/support/${ticketId}`, "configuratie");
  const assignee = String(formData.get("assignedTo") ?? "");
  const { error } = await supabase.rpc("update_support_ticket_v1", {
    p_assigned_to: assignee ? uuid(formData, "assignedTo") : null,
    p_status: enumValue(formData, "status", [
      "open", "in_progress", "waiting_for_customer", "resolved", "closed"
    ]),
    p_ticket_id: ticketId
  });
  if (error) fail(`/platform/support/${ticketId}`, "status");
  revalidatePath(`/platform/support/${ticketId}`);
  redirect(`/platform/support/${ticketId}?succes=status`);
}

export async function deleteSupportTicket(formData: FormData) {
  const platform = formData.get("scope") === "platform";
  await (platform
    ? requireControlCapability("platform.ticket.admin", {
        aal2: true,
        returnTo: "/platform/support"
      })
    : requireTenantCapability("tenant.ticket.write"));
  const ticketId = uuid(formData, "ticketId");
  const supabase = await createControlSupabaseClient();
  if (!supabase) fail(ticketPath(platform, ticketId), "configuratie");
  const { error } = await supabase.rpc("delete_support_ticket_v1", {
    p_ticket_id: ticketId
  });
  if (error) fail(ticketPath(platform, ticketId), "verwijderen");
  revalidatePath(platform ? "/platform/support" : "/dashboard/support");
  redirect(`${platform ? "/platform/support" : "/dashboard/support"}?succes=verwijderd`);
}

export async function uploadTicketAttachment(formData: FormData) {
  const platform = formData.get("scope") === "platform";
  await (platform
    ? requireControlCapability("platform.ticket.write")
    : requireTenantCapability("tenant.ticket.write"));
  const ticketId = uuid(formData, "ticketId");
  const tenantId = uuid(formData, "tenantId");
  const file = formData.get("file");
  if (!(file instanceof File) || !file.size || file.size > 10 * 1024 * 1024) {
    fail(ticketPath(platform, ticketId), "bijlage");
  }
  const allowedTypes = new Set([
    "image/jpeg", "image/png", "application/pdf", "text/plain"
  ]);
  if (!allowedTypes.has(file.type)) fail(ticketPath(platform, ticketId), "bijlage");
  const extension = ({ "image/jpeg": "jpg", "image/png": "png", "application/pdf": "pdf", "text/plain": "txt" } as Record<string, string>)[file.type];
  const path = `tenants/${tenantId}/tickets/${ticketId}/${randomUUID()}.${extension}`;
  const supabase = await createControlSupabaseClient();
  if (!supabase) fail(ticketPath(platform, ticketId), "configuratie");
  const upload = await supabase.storage.from("ticket-attachments").upload(
    path,
    await file.arrayBuffer(),
    { contentType: file.type, upsert: false }
  );
  if (upload.error) fail(ticketPath(platform, ticketId), "bijlage");
  const { error } = await supabase.rpc("register_support_attachment_v1", {
    p_file_name: file.name.slice(0, 180),
    p_file_size_bytes: file.size,
    p_message_id: null,
    p_mime_type: file.type,
    p_sensitive: formData.get("sensitive") === "on",
    p_storage_path: path,
    p_ticket_id: ticketId
  });
  if (error) {
    await supabase.storage.from("ticket-attachments").remove([path]);
    fail(ticketPath(platform, ticketId), "bijlage");
  }
  revalidatePath(ticketPath(platform, ticketId));
  redirect(`${ticketPath(platform, ticketId)}?succes=bijlage`);
}

function ticketPath(platform: boolean, ticketId: string) {
  return `${platform ? "/platform/support" : "/dashboard/support"}/${ticketId}`;
}

function uuid(formData: FormData, name: string) {
  const value = String(formData.get(name) ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(value)) throw new Error("Ongeldige identifier.");
  return value;
}

function requiredText(formData: FormData, name: string, max: number) {
  const value = String(formData.get(name) ?? "").trim();
  if (!value || value.length > max) throw new Error("Ongeldige invoer.");
  return value;
}

function enumValue<T extends string>(
  formData: FormData,
  name: string,
  values: readonly T[]
) {
  const value = String(formData.get(name) ?? "");
  if (!values.includes(value as T)) throw new Error("Ongeldige keuze.");
  return value as T;
}

function recordValue(value: unknown, key: string) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? String((value as Record<string, unknown>)[key] ?? "")
    : "";
}

function fail(path: string, code: string): never {
  redirect(`${path}?fout=${encodeURIComponent(code)}`);
}
