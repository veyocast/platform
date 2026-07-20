import "server-only";

import {
  hasCapability,
  requireCapability,
  type Capability
} from "@veyocast/auth";
import {
  decideTenantOperation,
  type PlatformRole,
  type TenantOperation,
  type TenantRole,
  type TenantStatus
} from "@veyocast/domain";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  getControlSessionRoles,
  type ControlSession
} from "../app/(shell)/_lib/control-navigation";
import {
  resolveTenantContext,
  safeControlReturnPath,
  tenantContextCookieName,
  type TenantMembershipContext
} from "./tenant-context";
import { getControlRuntimeMode } from "./supabase/config";
import { createControlSupabaseClient } from "./supabase/server";

type TenantMembershipRow = {
  role: TenantRole;
  tenant_id: string;
  tenants:
    | { id: string; name: string; slug: string; status: TenantStatus }
    | { id: string; name: string; slug: string; status: TenantStatus }[]
    | null;
};

const demoControlSession = {
  assuranceLevel: "aal2",
  email: "operator@veyocast.test",
  isLive: false,
  nextAssuranceLevel: "aal2",
  organization: "VeyoCast platform",
  roles: ["platform_admin", "tenant_admin", "tenant_viewer"],
  tenant: "Museumkwartier",
  tenantContextReason: "demo",
  tenantId: null,
  tenantMemberships: [],
  tenantSlug: "museumkwartier",
  tenantStatus: "active",
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

  const [profileResult, tenantResult, platformResult, assuranceResult] = await Promise.all([
    supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle(),
    supabase
      .from("tenant_memberships")
      .select("tenant_id, role, tenants!inner(id, name, slug, status)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("platform_memberships")
      .select("role")
      .eq("user_id", user.id),
    supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  ]);

  if (tenantResult.error || platformResult.error || assuranceResult.error) {
    throw new Error("De rollen voor deze sessie konden niet worden geladen.");
  }

  const memberships = (tenantResult.data ?? []) as unknown as TenantMembershipRow[];
  const tenantMemberships = memberships.flatMap((membership) => {
    const tenant = Array.isArray(membership.tenants)
      ? membership.tenants[0]
      : membership.tenants;
    return tenant
      ? [{
          id: tenant.id,
          name: tenant.name,
          role: membership.role,
          slug: tenant.slug,
          status: tenant.status
        } satisfies TenantMembershipContext]
      : [];
  });
  const cookieStore = await cookies();
  const tenantResolution = resolveTenantContext(
    tenantMemberships,
    cookieStore.get(tenantContextCookieName)?.value
  );
  const activeMembership = tenantResolution.context;
  const roles = getControlSessionRoles(
    (platformResult.data ?? []).map(
      (membership) => membership.role as PlatformRole
    ),
    activeMembership?.role
  );

  return {
    assuranceLevel: normalizeAssuranceLevel(assuranceResult.data.currentLevel),
    email: user.email ?? "",
    isLive: true,
    nextAssuranceLevel: normalizeAssuranceLevel(assuranceResult.data.nextLevel),
    organization: "VeyoCast platform",
    roles,
    tenant: activeMembership?.name ?? "Kies een vereniging",
    tenantContextReason: tenantResolution.reason,
    tenantId: activeMembership?.id ?? null,
    tenantMemberships,
    tenantSlug: activeMembership?.slug ?? null,
    tenantStatus: activeMembership?.status ?? null,
    userId: user.id,
    userName:
      profileResult.data?.display_name ??
      (user.user_metadata.display_name as string | undefined) ??
      user.email ??
      "VeyoCast gebruiker"
  };
}

function normalizeAssuranceLevel(level: string | null) {
  return level === "aal2" ? "aal2" as const : "aal1" as const;
}

export async function requireControlSession() {
  const session = await getControlSession();

  if (!session) {
    redirect("/login?reden=sessie");
  }

  if (session.roles.length === 0 && session.tenantMemberships.length === 0) {
    redirect("/login?reden=geen-toegang");
  }

  return session;
}

export async function requireControlCapability(
  capability: Capability,
  options: Readonly<{ aal2?: boolean; returnTo?: string }> = {}
) {
  const session = await requireControlSession();

  try {
    requireCapability(session.roles, capability);
  } catch {
    redirect(getControlLandingPath(session));
  }

  if (options.aal2 && session.isLive && session.assuranceLevel !== "aal2") {
    const returnTo = safeControlReturnPath(options.returnTo, "/platform");
    redirect(`/auth/mfa?reden=aal2&terug=${encodeURIComponent(returnTo)}`);
  }

  return session;
}

export async function requireTenantControlSession(
  requiredCapability: Capability = "tenant.overview.read"
) {
  const session = await requireControlCapability(requiredCapability);

  if (session.isLive && !session.tenantId) {
    redirect(`/context?reden=${encodeURIComponent(session.tenantContextReason)}`);
  }

  return session;
}

export async function requireTenantCapability(
  capability: Capability,
  operation: TenantOperation = "mutate"
) {
  const session = await requireTenantControlSession(capability);

  if (session.isLive && session.tenantStatus) {
    const decision = decideTenantOperation(session.tenantStatus, operation);
    if (!decision.allowed) {
      redirect(
        `/dashboard?fout=${encodeURIComponent(
          decision.reason === "tenant_paused"
            ? "Deze vereniging is gepauzeerd. Je kunt gegevens bekijken, maar nieuwe wijzigingen, publicaties en koppelingen zijn geblokkeerd. Vraag een platformbeheerder om de vereniging te heractiveren."
            : "Deze vereniging is gearchiveerd. Normale beheeracties zijn geblokkeerd; vraag een platformbeheerder om herstel."
        )}`
      );
    }
  }

  return session;
}

export function getControlLandingPath(session: ControlSession) {
  if (
    session.isLive &&
    session.nextAssuranceLevel === "aal2" &&
    session.assuranceLevel !== "aal2"
  ) {
    return "/auth/mfa?reden=verificatie";
  }

  return getControlPostMfaLandingPath(session);
}

export function getControlPostMfaLandingPath(session: ControlSession) {

  if (
    hasCapability(session.roles, "tenant.overview.read") &&
    (session.tenantId || !session.isLive)
  ) {
    return "/dashboard";
  }

  if (session.tenantMemberships.length > 0) {
    return `/context?reden=${encodeURIComponent(session.tenantContextReason)}`;
  }

  if (hasCapability(session.roles, "platform.system.read")) {
    return "/platform";
  }

  return "/login?reden=geen-toegang";
}
