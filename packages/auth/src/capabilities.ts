import type { HumanRole } from "@veyocast/domain";

export const capabilities = [
  "platform.tenant.read",
  "platform.tenant.create",
  "platform.tenant.lifecycle",
  "platform.user.manage",
  "platform.audit.read",
  "platform.system.read",
  "tenant.overview.read",
  "tenant.media.read",
  "tenant.media.write",
  "tenant.playlist.read",
  "tenant.playlist.write",
  "tenant.playlist.publish",
  "tenant.release.read",
  "tenant.screen.read",
  "tenant.screen.manage",
  "tenant.team.read",
  "tenant.team.manage",
  "tenant.settings.read",
  "tenant.settings.manage",
  "tenant.audit.read"
] as const;

export type Capability = (typeof capabilities)[number];

const tenantReadCapabilities = [
  "tenant.overview.read",
  "tenant.media.read",
  "tenant.playlist.read",
  "tenant.release.read",
  "tenant.screen.read",
  "tenant.team.read",
  "tenant.settings.read"
] as const satisfies readonly Capability[];

const tenantWriteCapabilities = [
  "tenant.media.write",
  "tenant.playlist.write",
  "tenant.playlist.publish"
] as const satisfies readonly Capability[];

const tenantManageCapabilities = [
  "tenant.screen.manage",
  "tenant.team.manage",
  "tenant.settings.manage",
  "tenant.audit.read"
] as const satisfies readonly Capability[];

const roleCapabilities: Readonly<Record<HumanRole, readonly Capability[]>> = {
  platform_owner: capabilities,
  platform_admin: capabilities.filter((capability) => capability !== "platform.user.manage"),
  platform_support: [
    "platform.tenant.read",
    "platform.audit.read",
    "platform.system.read",
    ...tenantReadCapabilities,
    "tenant.audit.read"
  ],
  platform_viewer: ["platform.tenant.read", "platform.system.read"],
  tenant_owner: [
    ...tenantReadCapabilities,
    ...tenantWriteCapabilities,
    ...tenantManageCapabilities
  ],
  tenant_admin: [
    ...tenantReadCapabilities,
    ...tenantWriteCapabilities,
    ...tenantManageCapabilities
  ],
  tenant_editor: [...tenantReadCapabilities, ...tenantWriteCapabilities],
  tenant_viewer: tenantReadCapabilities
};

export type CapabilityDecision = Readonly<{
  allowed: boolean;
  capability: Capability;
  reason: "allowed" | "missing_capability";
}>;

export function getCapabilitiesForRoles(roles: readonly HumanRole[]): Capability[] {
  return [...new Set(roles.flatMap((role) => roleCapabilities[role]))];
}

export function hasCapability(
  roles: readonly HumanRole[],
  capability: Capability
): boolean {
  return roles.some((role) => roleCapabilities[role].includes(capability));
}

export function decideCapability(
  roles: readonly HumanRole[],
  capability: Capability
): CapabilityDecision {
  return hasCapability(roles, capability)
    ? { allowed: true, capability, reason: "allowed" }
    : { allowed: false, capability, reason: "missing_capability" };
}
