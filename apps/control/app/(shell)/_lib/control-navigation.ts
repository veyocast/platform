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

export type ControlRouteFamily =
  | "account"
  | "activity"
  | "engage"
  | "integrations"
  | "media"
  | "overview"
  | "planning"
  | "platform"
  | "playlists"
  | "publications"
  | "publish"
  | "screens"
  | "secondary"
  | "settings"
  | "slides"
  | "sources"
  | "sponsors"
  | "studio"
  | "support"
  | "team"
  | "templates"
  | "themes";

export type ControlRouteLayout =
  | "journey"
  | "platform"
  | "reference"
  | "resource"
  | "secondary";

export type ControlRoutePresentation = {
  description: string;
  family: ControlRouteFamily;
  layout: ControlRouteLayout;
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
    description: "Kleuren, typografie en logo-oppervlakken per slide-theme",
    href: "/dashboard/themes",
    label: "Thema's",
    requiredCapability: "tenant.settings.read",
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

/**
 * Keeps the shell context specific to the route family, including aliases that
 * intentionally render the same workspace. Page components still own their
 * task-level heading and all business state.
 */
export function getControlRoutePresentation(
  pathname: string,
  navigationLabel: string | undefined,
  contextName: string,
  userName: string
): ControlRoutePresentation {
  const normalizedPathname = normalizePathname(pathname);

  if (normalizedPathname === "/dashboard") {
    return {
      description: `Dit is wat er vandaag speelt bij ${contextName}.`,
      family: "overview",
      layout: "reference",
      title: `Goedemorgen, ${firstName(userName)}`
    };
  }

  if (/^\/dashboard\/playlists\/[^/]+\/publish(?:\/|$)/.test(normalizedPathname)) {
    return {
      description: "Controleer inhoud, kies doelschermen en publiceer veilig.",
      family: "publish",
      layout: "journey",
      title: "Playlist publiceren"
    };
  }

  const routePresentations: readonly Readonly<{
    description: string;
    family: ControlRouteFamily;
    paths: readonly string[];
    title: string;
  }>[] = [
    {
      description: "Maak en beheer wat jouw schermen laten zien.",
      family: "studio",
      paths: ["/dashboard/studio"],
      title: "Studio"
    },
    {
      description: "Overzicht van alle schermen en schermgroepen.",
      family: "screens",
      paths: ["/dashboard/screens", "/dashboard/screen-groups"],
      title: "Schermen"
    },
    {
      description: "Bepaal waar en wanneer content zichtbaar wordt.",
      family: "planning",
      paths: ["/dashboard/planning"],
      title: "Planning"
    },
    {
      description: "Beheer foto's, video's en andere clubmedia.",
      family: "media",
      paths: ["/dashboard/media"],
      title: "Media"
    },
    {
      description: "Bouw, orden en publiceer wat jouw schermen afspelen.",
      family: "playlists",
      paths: ["/dashboard/playlists"],
      title: "Playlists"
    },
    {
      description: "Beheer herbruikbare vormen voor nieuwe playlists.",
      family: "templates",
      paths: ["/dashboard/playlist-templates", "/dashboard/templates"],
      title: "Playlist-sjablonen"
    },
    {
      description: "Volg publicatieversies, uitrol en synchronisatie per scherm.",
      family: "publications",
      paths: ["/dashboard/publications", "/dashboard/releases"],
      title: "Publicaties"
    },
    {
      description: "Beheer herbruikbare slides, formats en dynamische inhoud.",
      family: "slides",
      paths: ["/dashboard/slides"],
      title: "Slides & formats"
    },
    {
      description: "Beheer kleuren, typografie en oppervlakken per slide-theme.",
      family: "themes",
      paths: ["/dashboard/themes"],
      title: "Thema's"
    },
    {
      description: "Verbind en bewaak gegevensbronnen voor actuele clubcontent.",
      family: "sources",
      paths: ["/dashboard/sources", "/dashboard/data-sources"],
      title: "Bronnen"
    },
    {
      description: "Beheer koppelingen die data en content beschikbaar maken.",
      family: "integrations",
      paths: ["/dashboard/integrations", "/dashboard/products"],
      title: "Integraties"
    },
    {
      description: "Beheer sponsors, campagnes, posities en vertoningsbewijs.",
      family: "sponsors",
      paths: ["/dashboard/sponsors"],
      title: "Sponsor Hub"
    },
    {
      description: "Maak publieksinteractie en volg live resultaten.",
      family: "engage",
      paths: ["/dashboard/engage"],
      title: "Engage"
    },
    {
      description: "Beheer mensen, rollen en uitnodigingen binnen de vereniging.",
      family: "team",
      paths: ["/dashboard/team"],
      title: "Team"
    },
    {
      description: "Beheer verenigingsgegevens, voorkeuren en abonnement.",
      family: "settings",
      paths: ["/dashboard/settings"],
      title: "Instellingen"
    },
    {
      description: "Beheer je profiel, sessie en tweestapsverificatie.",
      family: "account",
      paths: ["/dashboard/account"],
      title: "Account"
    },
    {
      description: "Stel vragen en volg hulpverzoeken en antwoorden.",
      family: "support",
      paths: ["/dashboard/support"],
      title: "Support"
    },
    {
      description: "Volg wijzigingen, publicaties en beheeracties.",
      family: "activity",
      paths: ["/dashboard/activity", "/dashboard/auditlog"],
      title: "Activiteit"
    }
  ];

  const routePresentation = routePresentations.find(({ paths }) =>
    paths.some((path) => isRouteOrDescendant(normalizedPathname, path))
  );

  if (routePresentation) {
    const referenceFamilies: readonly ControlRouteFamily[] = [
      "media",
      "planning",
      "screens",
      "studio"
    ];

    return {
      description: routePresentation.description,
      family: routePresentation.family,
      layout: referenceFamilies.includes(routePresentation.family)
        ? "reference"
        : "resource",
      title: routePresentation.title
    };
  }

  const platformRoute = isRouteOrDescendant(normalizedPathname, "/platform");

  return {
    description: platformRoute
      ? "Beheer de VeyoCast-platformomgeving."
      : `Werk binnen ${contextName}.`,
    family: platformRoute ? "platform" : "secondary",
    layout: platformRoute ? "platform" : "secondary",
    title: navigationLabel === "Vandaag"
      ? "Overzicht"
      : navigationLabel ?? "VeyoCast"
  };
}

export function isImmersiveEditorPath(pathname: string) {
  return (
    /^\/dashboard\/playlists\/[^/]+\/?$/.test(pathname) ||
    /^\/dashboard\/studio\/(?!led-scores(?:\/|$)|new(?:\/|$)|sportlink(?:\/|$)|templates(?:\/|$))[^/]+\/?$/.test(
      pathname
    )
  );
}

function firstName(name: string) {
  return name.trim().split(/\s+/)[0] || "daar";
}

function isRouteOrDescendant(pathname: string, route: string) {
  return pathname === route || pathname.startsWith(`${route}/`);
}

function normalizePathname(pathname: string) {
  if (pathname === "/") return pathname;
  return pathname.replace(/\/+$/, "");
}
