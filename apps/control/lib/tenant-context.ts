import type { TenantRole, TenantStatus } from "@veyocast/domain";

export const tenantContextCookieName = "veyocast-tenant-context";

export type TenantMembershipContext = Readonly<{
  id: string;
  name: string;
  role: TenantRole;
  slug: string;
  status: TenantStatus;
}>;

export type TenantContextResolution =
  | Readonly<{ context: TenantMembershipContext; reason: "selected" }>
  | Readonly<{
      context: null;
      reason:
        | "invalid_context"
        | "membership_revoked"
        | "needs_selection"
        | "tenant_archived";
    }>;

const tenantSlugPattern = /^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/;

export function resolveTenantContext(
  memberships: readonly TenantMembershipContext[],
  selectedSlug: string | null | undefined
): TenantContextResolution {
  if (!selectedSlug) {
    return { context: null, reason: "needs_selection" };
  }

  if (!tenantSlugPattern.test(selectedSlug)) {
    return { context: null, reason: "invalid_context" };
  }

  const context = memberships.find(
    (membership) => membership.slug === selectedSlug
  );

  if (!context) {
    return { context: null, reason: "membership_revoked" };
  }

  if (context.status === "archived") {
    return { context: null, reason: "tenant_archived" };
  }

  return { context, reason: "selected" };
}

export function safeControlReturnPath(value: unknown, fallback = "/dashboard") {
  if (typeof value !== "string") return fallback;
  if (!value.startsWith("/") || value.startsWith("//")) return fallback;

  try {
    const url = new URL(value, "https://control.veyocast.nl");
    if (url.origin !== "https://control.veyocast.nl") return fallback;
    if (!/^\/(dashboard|platform|context|account)(\/|$)/.test(url.pathname)) {
      return fallback;
    }
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
