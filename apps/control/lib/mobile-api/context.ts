import "server-only";

import {
  capabilities,
  getCapabilitiesForRoles,
  type Capability
} from "@veyocast/auth";
import type { PlatformRole, TenantRole, TenantStatus } from "@veyocast/domain";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { getSupabasePublicConfig } from "../supabase/config";
import { readBearerToken } from "./auth-header";

type TenantRow = {
  custom_role_id: string | null;
  role: TenantRole;
  tenant_id: string;
  tenants:
    | {
        id: string;
        name: string;
        slug: string;
        status: TenantStatus;
      }
    | Array<{
        id: string;
        name: string;
        slug: string;
        status: TenantStatus;
      }>
    | null;
};

export type MobileTenantContext = Readonly<{
  capabilities: readonly Capability[];
  id: string;
  name: string;
  role: TenantRole;
  roleLabel: string;
  slug: string;
  status: TenantStatus;
}>;

export type MobileRequestContext = Readonly<{
  assuranceLevel: "aal1" | "aal2";
  email: string;
  requestId: string;
  supabase: SupabaseClient;
  tenants: readonly MobileTenantContext[];
  token: string;
  userId: string;
  userName: string;
}>;

export class MobileApiContextError extends Error {
  constructor(
    readonly status: 401 | 403 | 404 | 503,
    readonly code:
      | "FORBIDDEN"
      | "NOT_FOUND"
      | "TEMPORARILY_UNAVAILABLE"
      | "UNAUTHENTICATED",
    message: string,
    readonly recovery: string,
    readonly requestId: string
  ) {
    super(message);
    this.name = "MobileApiContextError";
  }
}

export async function getMobileRequestContext(
  request: Request
): Promise<MobileRequestContext> {
  const requestId =
    request.headers.get("x-request-id")?.trim().slice(0, 128) ||
    crypto.randomUUID();
  const token = readBearerToken(request);
  if (!token) {
    throw new MobileApiContextError(
      401,
      "UNAUTHENTICATED",
      "Je mobiele sessie ontbreekt of is verlopen.",
      "Log opnieuw in en probeer het daarna opnieuw.",
      requestId
    );
  }

  const config = getSupabasePublicConfig();
  if (!config) {
    throw new MobileApiContextError(
      503,
      "TEMPORARILY_UNAVAILABLE",
      "De beveiligde mobiele API is niet geconfigureerd.",
      "Probeer het later opnieuw. Je lokale gegevens blijven behouden.",
      requestId
    );
  }

  const supabase = createClient(config.url, config.anonKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false
    },
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
        "X-Client-Info": "veyocast-control-mobile-api/1"
      }
    }
  });
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser(token);
  if (userError || !user) {
    throw new MobileApiContextError(
      401,
      "UNAUTHENTICATED",
      "Je mobiele sessie is niet meer geldig.",
      "Log opnieuw in om VeyoCast Control veilig te blijven gebruiken.",
      requestId
    );
  }

  const [profileResult, tenantResult, platformResult, assuranceResult] =
    await Promise.all([
      supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle(),
      supabase
        .from("tenant_memberships")
        .select("tenant_id, role, custom_role_id, tenants!inner(id, name, slug, status)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true }),
      supabase.from("platform_memberships").select("role").eq("user_id", user.id),
      supabase.auth.mfa.getAuthenticatorAssuranceLevel()
    ]);

  if (
    profileResult.error ||
    tenantResult.error ||
    platformResult.error ||
    assuranceResult.error
  ) {
    throw new MobileApiContextError(
      503,
      "TEMPORARILY_UNAVAILABLE",
      "Je organisaties en rechten konden niet veilig worden geladen.",
      "Controleer je verbinding en probeer het opnieuw.",
      requestId
    );
  }

  const platformRoles = (platformResult.data ?? []).map(
    (membership) => membership.role as PlatformRole
  );
  const rows = (tenantResult.data ?? []) as unknown as TenantRow[];
  const tenants = await Promise.all(
    rows.flatMap((membership) => {
      const tenant = Array.isArray(membership.tenants)
        ? membership.tenants[0]
        : membership.tenants;
      return tenant ? [{ membership, tenant }] : [];
    }).map(async ({ membership, tenant }) => {
      const fallback = getCapabilitiesForRoles([
        ...platformRoles,
        membership.role
      ]);
      const capabilityResult = await supabase.rpc(
        "get_my_tenant_capabilities_v1",
        { p_tenant_id: tenant.id }
      );
      const allowlist = new Set<Capability>(capabilities);
      const effective =
        !capabilityResult.error && Array.isArray(capabilityResult.data)
          ? capabilityResult.data.filter(
              (value): value is Capability =>
                typeof value === "string" &&
                allowlist.has(value as Capability)
            )
          : fallback;
      return {
        capabilities: [...new Set(effective)],
        id: tenant.id,
        name: tenant.name,
        role: membership.role,
        roleLabel: tenantRoleLabels[membership.role],
        slug: tenant.slug,
        status: tenant.status
      } satisfies MobileTenantContext;
    })
  );

  return {
    assuranceLevel:
      assuranceResult.data.currentLevel === "aal2" ? "aal2" : "aal1",
    email: user.email ?? "",
    requestId,
    supabase,
    tenants,
    token,
    userId: user.id,
    userName:
      profileResult.data?.display_name ??
      (typeof user.user_metadata.display_name === "string"
        ? user.user_metadata.display_name
        : null) ??
      user.email ??
      "VeyoCast-gebruiker"
  };
}

export function requireMobileTenant(
  request: Request,
  context: MobileRequestContext,
  capability: Capability
): MobileTenantContext {
  const tenantId = request.headers.get("x-veyocast-tenant-id")?.trim();
  if (!tenantId) {
    throw new MobileApiContextError(
      404,
      "NOT_FOUND",
      "De gekozen organisatie is niet beschikbaar.",
      "Kies opnieuw een organisatie.",
      context.requestId
    );
  }
  const tenant = context.tenants.find((candidate) => candidate.id === tenantId);
  if (!tenant) {
    throw new MobileApiContextError(
      404,
      "NOT_FOUND",
      "De gekozen organisatie is niet beschikbaar.",
      "Kies een organisatie waartoe je toegang hebt.",
      context.requestId
    );
  }
  if (tenant.status !== "active") {
    throw new MobileApiContextError(
      403,
      "FORBIDDEN",
      "Deze organisatie is niet actief.",
      "Neem contact op met een beheerder van de organisatie.",
      context.requestId
    );
  }
  if (!tenant.capabilities.includes(capability)) {
    throw new MobileApiContextError(
      403,
      "FORBIDDEN",
      "Je hebt geen toegang tot deze mobiele actie.",
      "Vraag een beheerder om de juiste rol of rechten.",
      context.requestId
    );
  }
  return tenant;
}

const tenantRoleLabels: Record<TenantRole, string> = {
  tenant_admin: "Beheerder",
  tenant_editor: "Editor",
  tenant_owner: "Eigenaar",
  tenant_viewer: "Kijker"
};
