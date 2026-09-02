import { hasCapability, type Capability } from "@veyocast/auth";
import type { HumanRole, TenantStatus } from "@veyocast/domain";

import type { TenantMembershipContext } from "../../../lib/tenant-context";

export type ControlRole = HumanRole;

export type ControlScope = "platform" | "tenant";

export type ControlNavigationSection =
  | "access"
  | "broadcast"
  | "content"
  | "customers"
  | "growth"
  | "operations"
  | "product"
  | "sources"
  | "support"
  | "organization"
  | "today";

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
  capabilities: readonly Capability[];
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
  tenantRoleLabel: string | null;
  tenantSlug: string | null;
  tenantStatus: TenantStatus | null;
  timezoneName: string;
  userId: string;
  userName: string;
};

const controlNavigation: readonly ControlNavigationItem[] = [
  {
    description: "Systeemstatus en tenantgezondheid",
    href: "/platform",
    label: "Platform",
    requiredCapability: "platform.system.read",
    section: "operations",
    scope: "platform"
  },
  {
    description: "SLO's, alerts en herstelroutes",
    href: "/platform/system",
    label: "Systeem",
    requiredCapability: "platform.system.read",
    section: "operations",
    scope: "platform"
  },
  {
    description: "Shadowfacturen, providerhealth en reconciliation",
    href: "/platform/billing",
    label: "Billing",
    requiredCapability: "platform.system.read",
    section: "operations",
    scope: "platform"
  },
  {
    description: "Verenigingen, status en limieten",
    href: "/platform/tenants",
    label: "Klanten",
    requiredCapability: "platform.tenant.read",
    section: "customers",
    scope: "platform"
  },
  {
    description: "Platformrollen en MFA-status",
    href: "/platform/access/users",
    label: "Platformgebruikers",
    requiredCapability: "platform.user.manage",
    section: "access",
    scope: "platform"
  },
  {
    description: "Tickets, afdelingen en toewijzing",
    href: "/platform/support",
    label: "Supportdesk",
    requiredCapability: "platform.ticket.read",
    section: "support",
    scope: "platform"
  },
  {
    description: "Vaste dynamische vormgeving en versies",
    href: "/platform/templates",
    label: "Renderformats",
    requiredCapability: "platform.dynamic_template.read",
    section: "product",
    scope: "platform"
  },
  {
    description: "Club.Dataservice-verbindingen en synchronisatie",
    href: "/platform/integrations/sportlink",
    label: "Sportlink",
    requiredCapability: "platform.tenant.read",
    section: "product",
    scope: "platform"
  },
  {
    description: "Dagelijkse operatie en aandachtspunten",
    href: "/dashboard",
    label: "Vandaag",
    requiredCapability: "tenant.overview.read",
    section: "today",
    scope: "tenant"
  },
  {
    description: "Visuele content ontwerpen en genereren",
    href: "/dashboard/studio",
    label: "Studio",
    requiredCapability: "tenant.studio.read",
    section: "content",
    scope: "tenant"
  },
  {
    description: "Sponsors, campagnes, posities en bewijs van vertoning",
    href: "/dashboard/sponsors",
    label: "Sponsor Hub",
    requiredCapability: "tenant.sponsor.read",
    section: "growth",
    scope: "tenant"
  },
  {
    description: "Polls, publieksstemmen en live resultaten",
    href: "/dashboard/engage",
    label: "Engage",
    requiredCapability: "tenant.dynamic_slide.read",
    section: "growth",
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
    description: "Concepten maken en publiceren",
    href: "/dashboard/playlists",
    label: "Playlists",
    requiredCapability: "tenant.playlist.read",
    section: "content",
    scope: "tenant"
  },
  {
    description: "Datagestuurde slides, versies en renderstatus",
    href: "/dashboard/slides",
    label: "Slides & formats",
    requiredCapability: "tenant.dynamic_slide.read",
    section: "content",
    scope: "tenant"
  },
  {
    description: "Vloot, koppeling en diagnose",
    href: "/dashboard/screens",
    label: "Schermen",
    requiredCapability: "tenant.screen.read",
    section: "broadcast",
    scope: "tenant"
  },
  {
    description: "Content per scherm en tijdstip plannen",
    href: "/dashboard/planning",
    label: "Planning",
    requiredCapability: "tenant.playlist.read",
    section: "broadcast",
    scope: "tenant"
  },
  {
    description: "Schermen logisch organiseren",
    href: "/dashboard/screens/groups",
    label: "Schermgroepen",
    requiredCapability: "tenant.screen.read",
    section: "broadcast",
    scope: "tenant"
  },
  {
    description: "Herbruikbare contentvormen",
    href: "/dashboard/playlist-templates",
    label: "Playlist-sjablonen",
    requiredCapability: "tenant.playlist.read",
    section: "content",
    scope: "tenant"
  },
  {
    description: "Immutable historie, uitrol en preflight",
    href: "/dashboard/publications",
    label: "Publicaties",
    requiredCapability: "tenant.release.read",
    section: "broadcast",
    scope: "tenant"
  },
  {
    description: "Twelve-producten en toekomstige gegevensbronnen",
    href: "/dashboard/sources",
    label: "Bronnen",
    requiredCapability: "tenant.data_source.read",
    section: "sources",
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
    description: "Wijzigingen en publicaties volgen",
    href: "/dashboard/activity",
    label: "Activiteit",
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
  },
  {
    description: "Je eigen profiel, sessie en tweestapsverificatie",
    href: "/dashboard/account",
    label: "Account",
    requiredCapability: "tenant.settings.read",
    section: "organization",
    scope: "tenant"
  },
  {
    description: "Vragen, bijlagen en antwoorden volgen",
    href: "/dashboard/support",
    label: "Support",
    requiredCapability: "tenant.ticket.read",
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

const navigationSectionMeta = {
  platform: [
    { section: "operations", title: "Operatie" },
    { section: "customers", title: "Klanten" },
    { section: "support", title: "Support" },
    { section: "product", title: "Product" },
    { section: "access", title: "Toegang & governance" }
  ],
  tenant: [
    { section: "today", title: "Vandaag" },
    { section: "content", title: "Content" },
    { section: "broadcast", title: "Uitzenden" },
    { section: "sources", title: "Bronnen" },
    { section: "growth", title: "Groei" },
    { section: "organization", title: "Organisatie" }
  ]
} satisfies Record<
  ControlScope,
  readonly Readonly<{
    section: ControlNavigationSection;
    title: string;
  }>[]
>;

export function getNavigationForRoles(
  roles: readonly (ControlRole | Capability)[],
  includeTenantScope = true
) {
  return controlNavigation.filter((item) =>
    hasCapability(roles, item.requiredCapability) &&
    (includeTenantScope || item.scope !== "tenant")
  );
}

export function getNavigationGroupsForRoles(
  roles: readonly (ControlRole | Capability)[],
  includeTenantScope = true
): ControlNavigationGroup[] {
  const permittedItems = getNavigationForRoles(roles, includeTenantScope);

  return (["platform", "tenant"] as const).flatMap((scope) =>
    navigationSectionMeta[scope].flatMap(({ section, title }) => {
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

export function getNavigationGroupsForPathname(
  groups: readonly ControlNavigationGroup[],
  pathname: string,
  fallbackScope: ControlScope
) {
  const activeScope =
    pathname === "/platform" || pathname.startsWith("/platform/")
      ? "platform"
      : pathname === "/dashboard" || pathname.startsWith("/dashboard/")
        ? "tenant"
        : fallbackScope;

  return groups.filter((group) => group.scope === activeScope);
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

export function isImmersiveEditorPath(pathname: string) {
  return (
    /^\/dashboard\/playlists\/[^/]+\/?$/.test(pathname) ||
    /^\/dashboard\/studio\/(?!new(?:\/|$)|templates(?:\/|$))[^/]+\/?$/.test(
      pathname
    )
  );
}
