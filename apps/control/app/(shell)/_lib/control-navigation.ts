import { hasCapability, type Capability } from "@veyocast/auth";
import type { HumanRole, TenantStatus } from "@veyocast/domain";

import type { TenantMembershipContext } from "../../../lib/tenant-context";

export type ControlRole = HumanRole;

export type ControlScope = "platform" | "tenant";

export type ControlNavigationSection =
  | "overview"
  | "content"
  | "distribution"
  | "organization";

export type ControlNavigationItem = {
  description: string;
  href: string;
  label: string;
  requiredCapability: Capability;
  section: ControlNavigationSection;
  scope: ControlScope;
};

export type ControlNavigationGroup = {
  contextLabel: string;
  description: string;
  id: string;
  items: ControlNavigationItem[];
  section: ControlNavigationSection;
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
    section: "overview",
    scope: "platform"
  },
  {
    description: "SLO's, alerts en herstelroutes",
    href: "/platform/system",
    label: "Systeem",
    requiredCapability: "platform.system.read",
    section: "overview",
    scope: "platform"
  },
  {
    description: "Verenigingen, status en limieten",
    href: "/platform/tenants",
    label: "Tenants",
    requiredCapability: "platform.tenant.read",
    section: "organization",
    scope: "platform"
  },
  {
    description: "Platformrollen en MFA-status",
    href: "/platform/users",
    label: "Platformgebruikers",
    requiredCapability: "platform.user.manage",
    section: "organization",
    scope: "platform"
  },
  {
    description: "Dagelijkse operatie en aandachtspunten",
    href: "/dashboard",
    label: "Dashboard",
    requiredCapability: "tenant.overview.read",
    section: "overview",
    scope: "tenant"
  },
  {
    description: "Bibliotheek, verwerking en gebruik",
    href: "/dashboard/media",
    label: "Media",
    requiredCapability: "tenant.media.read",
    section: "content",
    scope: "tenant"
  },
  {
    description: "Concepten, publicaties en releases",
    href: "/dashboard/playlists",
    label: "Playlists",
    requiredCapability: "tenant.playlist.read",
    section: "content",
    scope: "tenant"
  },
  {
    description: "Immutable historie, uitrol en preflight",
    href: "/dashboard/releases",
    label: "Releases",
    requiredCapability: "tenant.release.read",
    section: "content",
    scope: "tenant"
  },
  {
    description: "Vloot, koppeling en diagnose",
    href: "/dashboard/screens",
    label: "Schermen",
    requiredCapability: "tenant.screen.read",
    section: "distribution",
    scope: "tenant"
  },
  {
    description: "Mensen, rollen en uitnodigingen",
    href: "/dashboard/team",
    label: "Team",
    requiredCapability: "tenant.team.read",
    section: "organization",
    scope: "tenant"
  },
  {
    description: "Gebeurtenissen en beveiligingsspoor",
    href: "/dashboard/auditlog",
    label: "Auditlog",
    requiredCapability: "tenant.audit.read",
    section: "organization",
    scope: "tenant"
  },
  {
    description: "Profiel, limieten en beveiliging",
    href: "/dashboard/settings",
    label: "Instellingen",
    requiredCapability: "tenant.settings.read",
    section: "organization",
    scope: "tenant"
  }
];

const navigationScopeMeta = {
  platform: {
    contextLabel: "Platformcontext",
    description: "Platformbreed beheer"
  },
  tenant: {
    contextLabel: "Verenigingscontext",
    description: "Binnen de actieve vereniging"
  }
} satisfies Record<ControlScope, Readonly<{ contextLabel: string; description: string }>>;

const navigationSectionMeta = [
  { section: "overview", title: "Overzicht" },
  { section: "content", title: "Content" },
  { section: "distribution", title: "Distributie" },
  { section: "organization", title: "Organisatie" }
] satisfies readonly Readonly<{ section: ControlNavigationSection; title: string }>[];

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

  return (["platform", "tenant"] as const).flatMap((scope) =>
    navigationSectionMeta.flatMap(({ section, title }) => {
      const items = permittedItems.filter(
        (item) => item.scope === scope && item.section === section
      );

      return items.length
        ? [
            {
              ...navigationScopeMeta[scope],
              id: `${scope}-${section}`,
              items,
              scope,
              section,
              title
            }
          ]
        : [];
    })
  );
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
