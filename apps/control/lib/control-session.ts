import "server-only";

import {
  capabilities,
  getCapabilitiesForRoles,
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
import {
  defaultTenantTimeZone,
  normalizeTenantTimeZone
} from "./tenant-time";

type TenantMembershipRow = {
  custom_role_id: string | null;
  role: TenantRole;
  tenant_id: string;
  tenants:
    | { id: string; name: string; slug: string; status: TenantStatus }
    | { id: string; name: string; slug: string; status: TenantStatus }[]
    | null;
};

const demoControlSession = {
  assuranceLevel: "aal2",
  capabilities: getCapabilitiesForRoles(["platform_admin", "tenant_admin", "tenant_viewer"]),
  email: "operator@veyocast.test",
  isLive: false,
  nextAssuranceLevel: "aal2",
  organization: "VeyoCast platform",
  roles: ["platform_admin", "tenant_admin", "tenant_viewer"],
  tenant: "Museumkwartier",
  tenantContextReason: "demo",
  tenantId: null,
  tenantMemberships: [],
  tenantRoleLabel: "Beheerder",
  tenantSlug: "museumkwartier",
  tenantStatus: "active",
  timezoneName: defaultTenantTimeZone,
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
      .select("tenant_id, role, custom_role_id, tenants!inner(id, name, slug, status)")
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
  const customRoleIds = [
    ...new Set(memberships.flatMap((membership) =>
      membership.custom_role_id ? [membership.custom_role_id] : []
    ))
  ];
  const customRolesResult = customRoleIds.length
    ? await supabase
        .from("tenant_custom_roles")
        .select("id, name")
        .in("id", customRoleIds)
    : { data: [], error: null };
  if (customRolesResult.error) {
    throw new Error("De custom rollen voor deze sessie konden niet worden geladen.");
  }
  const customRoleNames = new Map(
    (customRolesResult.data ?? []).map((role) => [role.id, role.name])
  );
  const tenantMemberships = memberships.flatMap((membership) => {
    const tenant = Array.isArray(membership.tenants)
      ? membership.tenants[0]
      : membership.tenants;
    return tenant
      ? [{
          id: tenant.id,
          customRoleId: membership.custom_role_id,
          customRoleName: membership.custom_role_id
            ? customRoleNames.get(membership.custom_role_id) ?? "Custom rol"
            : null,
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
  const tenantSettingsResult = activeMembership?.id
    ? await supabase
        .from("tenant_settings")
        .select("timezone_name")
        .eq("tenant_id", activeMembership.id)
        .maybeSingle()
    : { data: null, error: null };
  if (tenantSettingsResult.error) {
    console.error("Tijdzone voor actieve tenant laden mislukt", tenantSettingsResult.error);
  }
  const roles = getControlSessionRoles(
    (platformResult.data ?? []).map(
      (membership) => membership.role as PlatformRole
    ),
    activeMembership?.role
  );
  const baseCapabilities = activeMembership?.id
    ? await loadEffectiveCapabilities(
        supabase,
        activeMembership.id,
        roles,
        Boolean(activeMembership.customRoleId)
      )
    : getCapabilitiesForRoles(roles);
  const platformTicketResult = await supabase.rpc(
    "get_my_platform_ticket_capabilities_v1"
  );
  const allowedCapabilities = new Set<Capability>(capabilities);
  const platformTicketCapabilities = Array.isArray(platformTicketResult.data)
    ? platformTicketResult.data.filter(
        (value): value is Capability =>
          typeof value === "string" &&
          allowedCapabilities.has(value as Capability)
      )
    : [];
  const effectiveCapabilities = [
    ...new Set([...baseCapabilities, ...platformTicketCapabilities])
  ];

  return {
    assuranceLevel: normalizeAssuranceLevel(assuranceResult.data.currentLevel),
    capabilities: effectiveCapabilities,
    email: user.email ?? "",
    isLive: true,
    nextAssuranceLevel: normalizeAssuranceLevel(assuranceResult.data.nextLevel),
    organization: "VeyoCast platform",
    roles,
    tenant: activeMembership?.name ?? "Kies een vereniging",
    tenantContextReason: tenantResolution.reason,
    tenantId: activeMembership?.id ?? null,
    tenantMemberships,
    tenantRoleLabel: activeMembership?.customRoleName ??
      (activeMembership ? tenantRoleLabel[activeMembership.role] : null),
    tenantSlug: activeMembership?.slug ?? null,
    tenantStatus: activeMembership?.status ?? null,
    timezoneName: normalizeTenantTimeZone(
      tenantSettingsResult.data?.timezone_name
    ),
    userId: user.id,
    userName:
      profileResult.data?.display_name ??
      (user.user_metadata.display_name as string | undefined) ??
      user.email ??
      "VeyoCast gebruiker"
  };
}

const tenantRoleLabel = {
  tenant_admin: "Beheerder",
  tenant_editor: "Editor",
  tenant_owner: "Eigenaar",
  tenant_viewer: "Kijker"
} as const;

async function loadEffectiveCapabilities(
  supabase: NonNullable<Awaited<ReturnType<typeof createControlSupabaseClient>>>,
  tenantId: string,
  fallbackRoles: ControlSession["roles"],
  hasCustomRole: boolean
): Promise<Capability[]> {
  const platformCapabilities = getCapabilitiesForRoles(
    fallbackRoles.filter((role) => role.startsWith("platform_"))
  );
  const { data, error } = await supabase.rpc("get_my_tenant_capabilities_v1", {
    p_tenant_id: tenantId
  });
  if (error || !Array.isArray(data)) {
    console.error("Effectieve tenantrechten laden mislukt", error);
    return hasCustomRole
      ? platformCapabilities
      : getCapabilitiesForRoles(fallbackRoles);
  }
  const allowed = new Set<Capability>(capabilities);
  const tenantCapabilities = data.filter(
    (value): value is Capability =>
      typeof value === "string" && allowed.has(value as Capability)
  );
  return [...new Set([...platformCapabilities, ...tenantCapabilities])];
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
    requireCapability(session.capabilities, capability);
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
    hasCapability(session.capabilities, "tenant.overview.read") &&
    (session.tenantId || !session.isLive)
  ) {
    return "/dashboard";
  }

  if (
    hasCapability(session.capabilities, "tenant.sponsor.read") &&
    (session.tenantId || !session.isLive)
  ) {
    return "/dashboard/sponsors";
  }

  if (session.tenantMemberships.length > 0) {
    return `/context?reden=${encodeURIComponent(session.tenantContextReason)}`;
  }

  if (hasCapability(session.capabilities, "platform.system.read")) {
    return "/platform";
  }

  return "/login?reden=geen-toegang";
}
