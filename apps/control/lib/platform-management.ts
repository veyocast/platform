import "server-only";

import { createControlAdminClient } from "./supabase/admin";
import { createControlSupabaseClient } from "./supabase/server";

export async function loadPlatformTenantDetail(tenantId: string) {
  const supabase = await createControlSupabaseClient();
  if (!supabase) return platformTenantFailure();

  const [tenant, memberships, invitations, screens, media, audit] = await Promise.all([
    supabase
      .from("tenants")
      .select("id, name, slug, status, screen_limit, locale, timezone, provisioning_status, created_at")
      .eq("id", tenantId)
      .maybeSingle(),
    supabase
      .from("tenant_memberships")
      .select("user_id, role, created_at")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: true }),
    supabase
      .from("tenant_invitations")
      .select("id, email, role, status, delivery_status, send_attempt_count, expires_at, created_at")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false }),
    supabase.from("screens").select("id, status").eq("tenant_id", tenantId).is("deleted_at", null),
    supabase
      .from("media_assets")
      .select("file_size_bytes")
      .eq("tenant_id", tenantId)
      .is("deleted_at", null),
    supabase
      .from("audit_events")
      .select("id, action, target_type, result, created_at")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(12)
  ]);

  if (
    tenant.error || !tenant.data || memberships.error || invitations.error ||
    screens.error || media.error || audit.error
  ) return platformTenantFailure();

  const userIds = (memberships.data ?? []).map((membership) => membership.user_id);
  const profiles = userIds.length
    ? await supabase.from("profiles").select("id, display_name").in("id", userIds)
    : { data: [], error: null };
  if (profiles.error) return platformTenantFailure();
  const names = new Map((profiles.data ?? []).map((profile) => [profile.id, profile.display_name]));

  return {
    auditEvents: audit.data ?? [],
    error: false as const,
    invitations: invitations.data ?? [],
    members: (memberships.data ?? []).map((membership) => ({
      ...membership,
      display_name: names.get(membership.user_id) ?? null
    })),
    screenCount: screens.data?.length ?? 0,
    storageBytes: (media.data ?? []).reduce(
      (total, asset) => total + Number(asset.file_size_bytes ?? 0),
      0
    ),
    tenant: tenant.data
  };
}

export async function loadPlatformUsers() {
  const supabase = await createControlSupabaseClient();
  if (!supabase) return { error: true as const, users: [] };

  const memberships = await supabase
    .from("platform_memberships")
    .select("user_id, role, created_at")
    .order("created_at", { ascending: true });
  if (memberships.error) return { error: true as const, users: [] };

  try {
    const admin = createControlAdminClient();
    const users = await Promise.all(
      (memberships.data ?? []).map(async (membership) => {
        const [userResult, factorResult] = await Promise.all([
          admin.auth.admin.getUserById(membership.user_id),
          admin.auth.admin.mfa.listFactors({ userId: membership.user_id })
        ]);
        return {
          created_at: membership.created_at,
          display_name: String(userResult.data.user?.user_metadata.display_name ?? "") || null,
          email: userResult.data.user?.email ?? "Onbekend account",
          mfaEnabled: (factorResult.data?.factors ?? []).some(
            (factor) => factor.status === "verified"
          ),
          role: membership.role,
          user_id: membership.user_id
        };
      })
    );
    return { error: false as const, users };
  } catch {
    return { error: true as const, users: [] };
  }
}

function platformTenantFailure() {
  return {
    auditEvents: [],
    error: true as const,
    invitations: [],
    members: [],
    screenCount: 0,
    storageBytes: 0,
    tenant: null
  };
}
