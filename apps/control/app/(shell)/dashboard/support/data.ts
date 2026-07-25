import "server-only";

import { createControlSupabaseClient } from "../../../../lib/supabase/server";

export async function loadTenantSupport(tenantId: string) {
  const supabase = await createControlSupabaseClient();
  if (!supabase) return { departments: [], tickets: [] };
  const [departments, tickets] = await Promise.all([
    supabase.from("support_departments")
      .select("id, name, description").eq("active", true).order("sort_order"),
    supabase.from("support_tickets")
      .select("id, ticket_number, subject, status, priority, sensitive, last_message_at, support_departments(name)")
      .eq("tenant_id", tenantId).is("deleted_at", null)
      .order("last_message_at", { ascending: false })
  ]);
  return {
    departments: departments.data ?? [],
    tickets: tickets.data ?? []
  };
}

export async function loadSupportTicket(ticketId: string) {
  const supabase = await createControlSupabaseClient();
  if (!supabase) return null;
  const [ticket, messages, platformUsers, attachments] = await Promise.all([
    supabase.from("support_tickets")
      .select("id, tenant_id, ticket_number, subject, status, priority, sensitive, created_at, assigned_to, support_departments(name), tenants(name)")
      .eq("id", ticketId).maybeSingle(),
    supabase.from("support_ticket_messages")
      .select("id, author_user_id, author_scope, body, sensitive, created_at, profiles(display_name)")
      .eq("ticket_id", ticketId).order("created_at"),
    supabase.from("platform_memberships")
      .select("user_id, profiles(display_name)").order("created_at"),
    supabase.from("support_ticket_attachments")
      .select("id, file_name, mime_type, file_size_bytes, storage_path, sensitive, created_at")
      .eq("ticket_id", ticketId).is("deleted_at", null).order("created_at")
  ]);
  if (ticket.error || !ticket.data) return null;
  const signedAttachments = await Promise.all((attachments.data ?? []).map(async (attachment) => {
    const signed = await supabase.storage
      .from("ticket-attachments")
      .createSignedUrl(attachment.storage_path, 300);
    return { ...attachment, url: signed.data?.signedUrl ?? null };
  }));
  return {
    attachments: signedAttachments,
    messages: messages.data ?? [],
    platformUsers: platformUsers.data ?? [],
    ticket: ticket.data
  };
}

export async function loadPlatformSupport() {
  const supabase = await createControlSupabaseClient();
  if (!supabase) return {
    assignments: [],
    departments: [],
    platformUsers: [],
    roles: [],
    tickets: []
  };
  const [departments, roles, tickets, platformUsers, assignments] = await Promise.all([
    supabase.from("support_departments")
      .select("id, name, description, active").order("sort_order"),
    supabase.from("platform_custom_roles")
      .select("id, name, description, capabilities, active").order("name"),
    supabase.from("support_tickets")
      .select("id, ticket_number, subject, status, priority, sensitive, last_message_at, support_departments(name), tenants(name), profiles!support_tickets_assigned_to_fkey(display_name)")
      .is("deleted_at", null).order("last_message_at", { ascending: false })
      .limit(250),
    supabase.from("platform_memberships")
      .select("user_id, profiles(display_name)").order("created_at"),
    supabase.from("platform_custom_role_assignments")
      .select("user_id, role_id")
  ]);
  return {
    departments: departments.data ?? [],
    assignments: assignments.data ?? [],
    platformUsers: platformUsers.data ?? [],
    roles: roles.data ?? [],
    tickets: tickets.data ?? []
  };
}
