import { redirect } from "next/navigation";

import {
  demoControlSession,
  type ControlRole,
  type ControlSession
} from "../app/(shell)/_lib/control-navigation";
import { isLiveSupabaseConfigured } from "./supabase/config";
import { createControlSupabaseClient } from "./supabase/server";

type TenantMembershipRow = {
  role: ControlRole;
  tenant_id: string;
  tenants: { name: string } | { name: string }[] | null;
};

export async function getControlSession(): Promise<ControlSession | null> {
  if (!isLiveSupabaseConfigured()) {
    return demoControlSession;
  }

  const supabase = await createControlSupabaseClient();

  if (!supabase) {
    return null;
  }

  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return null;
  }

  const [profileResult, tenantResult, platformResult] = await Promise.all([
    supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle(),
    supabase
      .from("tenant_memberships")
      .select("tenant_id, role, tenants!inner(name)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("platform_memberships")
      .select("role")
      .eq("user_id", user.id)
  ]);

  if (tenantResult.error || platformResult.error) {
    throw new Error("De rollen voor deze sessie konden niet worden geladen.");
  }

  const memberships = (tenantResult.data ?? []) as unknown as TenantMembershipRow[];
  const activeMembership = memberships[0];
  const tenantRecord = Array.isArray(activeMembership?.tenants)
    ? activeMembership.tenants[0]
    : activeMembership?.tenants;
  const roles = uniqueRoles([
    ...(platformResult.data ?? []).map((membership) => membership.role as ControlRole),
    ...memberships.map((membership) => membership.role)
  ]);

  return {
    email: user.email ?? "",
    isLive: true,
    organization: "Castivo platform",
    roles,
    tenant: tenantRecord?.name ?? "Geen actieve vereniging",
    tenantId: activeMembership?.tenant_id ?? null,
    userId: user.id,
    userName:
      profileResult.data?.display_name ??
      (user.user_metadata.display_name as string | undefined) ??
      user.email ??
      "Castivo gebruiker"
  };
}

export async function requireControlSession() {
  const session = await getControlSession();

  if (!session) {
    redirect("/login?reden=sessie");
  }

  return session;
}

function uniqueRoles(roles: ControlRole[]) {
  return [...new Set(roles)];
}
