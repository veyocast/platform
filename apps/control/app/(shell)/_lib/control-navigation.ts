import { hasCapability, type Capability } from "@veyocast/auth";
import type { HumanRole, TenantStatus } from "@veyocast/domain";

import type { TenantMembershipContext } from "../../../lib/tenant-context";

export type ControlRole = HumanRole;

export type ControlScope = "platform" | "tenant";

export type NavigationStatus = "ready" | "placeholder";

export type ControlNavigationItem = {
  description: string;
  href: string;
  label: string;
  requiredCapability: Capability;
  scope: ControlScope;
  status: NavigationStatus;
};

export type ControlNavigationGroup = {
  description: string;
  items: ControlNavigationItem[];
  roleLabel: string;
  scope: ControlScope;
  title: string;
};

export type ControlSession = {
  assuranceLevel: "aal1" | "aal2";
  nextAssuranceLevel: "aal1" | "aal2";
  email: string;
  isLive: boolean;
  organization: string;
  roles: readonly ControlRole[];
  tenant: string;
  tenantContextReason:
    | "demo"
    | "invalid_context"
    | "membership_revoked"
    | "needs_selection"
    | "selected"
    | "tenant_archived";
  tenantId: string | null;
  tenantMemberships: readonly TenantMembershipContext[];
  tenantSlug: string | null;
  tenantStatus: TenantStatus | null;
  userId: string;
  userName: string;
};

const controlNavigation: readonly ControlNavigationItem[] = [
  {
    description: "Systeemstatus en tenantgezondheid",
    href: "/platform",
    label: "Platform",
    requiredCapability: "platform.system.read",
    scope: "platform",
    status: "placeholder"
  },
  {
    description: "Verenigingen, status en limieten",
    href: "/platform/tenants",
    label: "Tenants",
    requiredCapability: "platform.tenant.read",
    scope: "platform",
    status: "placeholder"
  },
  {
    description: "Platformrollen en MFA-status",
    href: "/platform/users",
    label: "Platformgebruikers",
    requiredCapability: "platform.user.manage",
    scope: "platform",
    status: "ready"
  },
  {
    description: "Dagelijkse operatie en aandachtspunten",
    href: "/dashboard",
    label: "Dashboard",
    requiredCapability: "tenant.overview.read",
    scope: "tenant",
    status: "ready"
  },
  {
    description: "Upload, publicatie en Player-koppeling",
    href: "/dashboard/pilot",
    label: "Pilotflow",
    requiredCapability: "tenant.playlist.write",
    scope: "tenant",
    status: "ready"
  },
  {
    description: "Bibliotheek, verwerking en gebruik",
    href: "/dashboard/media",
    label: "Media",
    requiredCapability: "tenant.media.read",
    scope: "tenant",
    status: "ready"
  },
  {
    description: "Concepten, publicaties en releases",
    href: "/dashboard/playlists",
    label: "Playlists",
    requiredCapability: "tenant.playlist.read",
    scope: "tenant",
    status: "ready"
  },
  {
    description: "Vloot, koppeling en diagnose",
    href: "/dashboard/screens",
    label: "Schermen",
    requiredCapability: "tenant.screen.read",
    scope: "tenant",
    status: "ready"
  },
  {
    description: "Mensen, rollen en uitnodigingen",
    href: "/dashboard/team",
    label: "Team",
    requiredCapability: "tenant.team.read",
    scope: "tenant",
    status: "placeholder"
  },
  {
    description: "Gebeurtenissen en beveiligingsspoor",
    href: "/dashboard/auditlog",
    label: "Auditlog",
    requiredCapability: "tenant.audit.read",
    scope: "tenant",
    status: "placeholder"
  },
  {
    description: "Profiel, limieten en beveiliging",
    href: "/dashboard/settings",
    label: "Instellingen",
    requiredCapability: "tenant.settings.read",
    scope: "tenant",
    status: "placeholder"
  }
];

const navigationGroupMeta = [
  {
    description: "Alleen zichtbaar voor platformrollen.",
    roleLabel: "Platformadmin",
    scope: "platform",
    title: "Platform"
  },
  {
    description: "Zichtbaar binnen de actieve tenantcontext.",
    roleLabel: "Tenantbeheer",
    scope: "tenant",
    title: "Tenant"
  }
] satisfies readonly Omit<ControlNavigationGroup, "items">[];

export function getNavigationForRoles(
  roles: readonly ControlRole[],
  includeTenantScope = true
) {
  return controlNavigation.filter((item) =>
    hasCapability(roles, item.requiredCapability) &&
    (includeTenantScope || item.scope !== "tenant")
  );
}

export function getNavigationGroupsForRoles(
  roles: readonly ControlRole[],
  includeTenantScope = true
): ControlNavigationGroup[] {
  const permittedItems = getNavigationForRoles(roles, includeTenantScope);

  return navigationGroupMeta
    .map((group) => ({
      ...group,
      items: permittedItems.filter((item) => item.scope === group.scope)
    }))
    .filter((group) => group.items.length > 0);
}

export function getControlSessionRoles(
  platformRoles: readonly ControlRole[],
  activeTenantRole?: ControlRole
) {
  return [
    ...new Set([
      ...platformRoles,
      ...(activeTenantRole ? [activeTenantRole] : [])
    ])
  ];
}
