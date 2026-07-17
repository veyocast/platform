export type ControlRole = "platform_admin" | "tenant_admin" | "tenant_viewer";

export type ControlScope = "platform" | "tenant";

export type NavigationStatus = "ready" | "placeholder";

export type ControlNavigationItem = {
  description: string;
  href: string;
  label: string;
  requiredRole: ControlRole;
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
  email: string;
  organization: string;
  roles: readonly ControlRole[];
  tenant: string;
  userName: string;
};

const controlNavigation: readonly ControlNavigationItem[] = [
  {
    description: "Systeemstatus en tenantgezondheid",
    href: "/platform",
    label: "Platform",
    requiredRole: "platform_admin",
    scope: "platform",
    status: "placeholder"
  },
  {
    description: "Verenigingen, status en limieten",
    href: "/platform/tenants",
    label: "Tenants",
    requiredRole: "platform_admin",
    scope: "platform",
    status: "placeholder"
  },
  {
    description: "Dagelijkse operatie en aandachtspunten",
    href: "/dashboard",
    label: "Dashboard",
    requiredRole: "tenant_viewer",
    scope: "tenant",
    status: "ready"
  },
  {
    description: "Bibliotheek, verwerking en gebruik",
    href: "/dashboard/media",
    label: "Media",
    requiredRole: "tenant_viewer",
    scope: "tenant",
    status: "ready"
  },
  {
    description: "Concepten, publicaties en releases",
    href: "/dashboard/playlists",
    label: "Playlists",
    requiredRole: "tenant_viewer",
    scope: "tenant",
    status: "ready"
  },
  {
    description: "Vloot, koppeling en diagnose",
    href: "/dashboard/screens",
    label: "Schermen",
    requiredRole: "tenant_viewer",
    scope: "tenant",
    status: "ready"
  },
  {
    description: "Mensen, rollen en uitnodigingen",
    href: "/dashboard/team",
    label: "Team",
    requiredRole: "tenant_admin",
    scope: "tenant",
    status: "placeholder"
  },
  {
    description: "Gebeurtenissen en beveiligingsspoor",
    href: "/dashboard/auditlog",
    label: "Auditlog",
    requiredRole: "tenant_admin",
    scope: "tenant",
    status: "placeholder"
  },
  {
    description: "Profiel, limieten en beveiliging",
    href: "/dashboard/settings",
    label: "Instellingen",
    requiredRole: "tenant_admin",
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

export const demoControlSession = {
  email: "operator@castivo.test",
  organization: "Castivo platform",
  roles: ["platform_admin", "tenant_admin", "tenant_viewer"],
  tenant: "Museumkwartier",
  userName: "Daan Operator"
} satisfies ControlSession;

export function hasControlRole(
  roles: readonly ControlRole[],
  requiredRole: ControlRole
) {
  if (roles.includes(requiredRole)) {
    return true;
  }

  return requiredRole === "tenant_viewer" && roles.includes("tenant_admin");
}

export function getNavigationForRoles(roles: readonly ControlRole[]) {
  return controlNavigation.filter((item) =>
    hasControlRole(roles, item.requiredRole)
  );
}

export function getNavigationGroupsForRoles(
  roles: readonly ControlRole[]
): ControlNavigationGroup[] {
  const permittedItems = getNavigationForRoles(roles);

  return navigationGroupMeta
    .map((group) => ({
      ...group,
      items: permittedItems.filter((item) => item.scope === group.scope)
    }))
    .filter((group) => group.items.length > 0);
}
