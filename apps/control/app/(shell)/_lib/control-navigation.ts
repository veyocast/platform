export type ControlRole =
  | "platform_owner"
  | "platform_admin"
  | "platform_support"
  | "platform_viewer"
  | "tenant_owner"
  | "tenant_admin"
  | "tenant_editor"
  | "tenant_viewer";

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
  isLive: boolean;
  organization: string;
  roles: readonly ControlRole[];
  tenant: string;
  tenantId: string | null;
  userId: string;
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
    description: "Upload, publicatie en Player-koppeling",
    href: "/dashboard/pilot",
    label: "Pilotflow",
    requiredRole: "tenant_editor",
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

export function hasControlRole(
  roles: readonly ControlRole[],
  requiredRole: ControlRole
) {
  return roles.some(
    (role) =>
      role === requiredRole ||
      (roleRank[role].scope === roleRank[requiredRole].scope &&
        roleRank[role].rank >= roleRank[requiredRole].rank)
  );
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

const roleRank = {
  platform_owner: { rank: 4, scope: "platform" },
  platform_admin: { rank: 3, scope: "platform" },
  platform_support: { rank: 2, scope: "platform" },
  platform_viewer: { rank: 1, scope: "platform" },
  tenant_owner: { rank: 4, scope: "tenant" },
  tenant_admin: { rank: 3, scope: "tenant" },
  tenant_editor: { rank: 2, scope: "tenant" },
  tenant_viewer: { rank: 1, scope: "tenant" }
} as const satisfies Record<ControlRole, { rank: number; scope: ControlScope }>;
