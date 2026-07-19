import "server-only";

import { redirect } from "next/navigation";

import {
  getControlSessionRoles,
  type ControlRole,
  type ControlSession
} from "../app/(shell)/_lib/control-navigation";
import { hasControlRole } from "../app/(shell)/_lib/control-navigation";
import { getControlRuntimeMode } from "./supabase/config";
import { createControlSupabaseClient } from "./supabase/server";

type TenantMembershipRow = {
  role: ControlRole;
  tenant_id: string;
  tenants: { name: string } | { name: string }[] | null;
};

const demoControlSession = {
  email: "operator@veyocast.test",
  isLive: false,
  organization: "VeyoCast platform",
  roles: ["platform_admin", "tenant_admin", "tenant_viewer"],
  tenant: "Museumkwartier",
  tenantId: null,
  userId: "demo-control-user",
  userName: "Daan Operator"
} satisfies ControlSession;

export async function getControlSession(): Promise<ControlSession | null> {
  const runtimeMode = getControlRuntimeMode();

  if (runtimeMode === "demo") {
    return demoControlSession;
  }

  if (runtimeMode === "unavailable") {
    return null;
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
  const roles = getControlSessionRoles(
    (platformResult.data ?? []).map(
      (membership) => membership.role as ControlRole
    ),
    activeMembership?.role
  );

  return {
    email: user.email ?? "",
    isLive: true,
    organization: "VeyoCast platform",
    roles,
    tenant: tenantRecord?.name ?? "Geen actieve vereniging",
    tenantId: activeMembership?.tenant_id ?? null,
    userId: user.id,
    userName:
      profileResult.data?.display_name ??
      (user.user_metadata.display_name as string | undefined) ??
      user.email ??
      "VeyoCast gebruiker"
  };
}

export async function requireControlSession() {
  const session = await getControlSession();

  if (!session) {
    redirect("/login?reden=sessie");
  }

  if (session.roles.length === 0) {
    redirect("/login?reden=geen-toegang");
  }

  return session;
}

export async function requireControlRole(requiredRole: ControlRole) {
  const session = await requireControlSession();

  if (!hasControlRole(session.roles, requiredRole)) {
    redirect(getControlLandingPath(session));
  }

  return session;
}

export async function requireTenantControlSession(
  requiredRole: ControlRole = "tenant_viewer"
) {
  const session = await requireControlRole(requiredRole);

  if (session.isLive && !session.tenantId) {
    redirect(getControlLandingPath(session));
  }

  return session;
}

export function getControlLandingPath(session: ControlSession) {
  if (hasControlRole(session.roles, "tenant_viewer") && (session.tenantId || !session.isLive)) {
    return "/dashboard";
  }

  if (hasControlRole(session.roles, "platform_admin")) {
    return "/platform";
  }

  return "/login?reden=geen-toegang";
}
