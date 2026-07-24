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
  "tenant.studio.read",
  "tenant.studio.create",
  "tenant.studio.edit_own",
  "tenant.studio.edit_all",
  "tenant.studio.archive",
  "tenant.studio.template.manage",
  "tenant.studio.motion.edit",
  "tenant.studio.render",
  "tenant.studio.job.manage",
  "tenant.playlist.read",
  "tenant.playlist.write",
  "tenant.playlist.archive",
  "tenant.playlist.publish",
  "tenant.release.read",
  "tenant.screen.read",
  "tenant.screen.manage",
  "tenant.team.read",
  "tenant.team.manage",
  "tenant.settings.read",
  "tenant.settings.manage",
  "tenant.audit.read",
  "tenant.support.export"
] as const;

export type Capability = (typeof capabilities)[number];

export const tenantReadCapabilities = [
  "tenant.overview.read",
  "tenant.media.read",
  "tenant.studio.read",
  "tenant.playlist.read",
  "tenant.release.read",
  "tenant.screen.read",
  "tenant.team.read",
  "tenant.settings.read"
] as const satisfies readonly Capability[];

export const tenantWriteCapabilities = [
  "tenant.media.write",
  "tenant.playlist.write"
] as const satisfies readonly Capability[];

const tenantPublishCapabilities = [
  "tenant.playlist.publish"
] as const satisfies readonly Capability[];

const tenantStudioAuthorCapabilities = [
  "tenant.studio.create",
  "tenant.studio.edit_own",
  "tenant.studio.motion.edit",
  "tenant.studio.render"
] as const satisfies readonly Capability[];

const tenantStudioManageCapabilities = [
  "tenant.studio.edit_all",
  "tenant.studio.archive",
  "tenant.studio.template.manage",
  "tenant.studio.job.manage"
] as const satisfies readonly Capability[];

const tenantManageCapabilities = [
  "tenant.playlist.archive",
  "tenant.screen.manage",
  "tenant.team.manage",
  "tenant.settings.manage",
  "tenant.audit.read",
  "tenant.support.export"
] as const satisfies readonly Capability[];

export const roleCapabilityMatrix: Readonly<
  Record<HumanRole, readonly Capability[]>
> = {
  platform_owner: capabilities,
  platform_admin: capabilities.filter((capability) => capability !== "platform.user.manage"),
  platform_support: [
    "platform.tenant.read",
    "platform.audit.read",
    "platform.system.read",
    ...tenantReadCapabilities,
    "tenant.audit.read",
    "tenant.support.export"
  ],
  platform_viewer: ["platform.tenant.read", "platform.system.read"],
  tenant_owner: [
    ...tenantReadCapabilities,
    ...tenantWriteCapabilities,
    ...tenantStudioAuthorCapabilities,
    ...tenantStudioManageCapabilities,
    ...tenantPublishCapabilities,
    ...tenantManageCapabilities
  ],
  tenant_admin: [
    ...tenantReadCapabilities,
    ...tenantWriteCapabilities,
    ...tenantStudioAuthorCapabilities,
    ...tenantStudioManageCapabilities,
    ...tenantPublishCapabilities,
    ...tenantManageCapabilities
  ],
  tenant_editor: [
    ...tenantReadCapabilities,
    ...tenantWriteCapabilities,
    ...tenantStudioAuthorCapabilities
  ],
  tenant_viewer: tenantReadCapabilities
};

export type CapabilityDecision = Readonly<{
  allowed: boolean;
  capability: Capability;
  reason: "allowed" | "missing_capability";
}>;

export function getCapabilitiesForRoles(roles: readonly HumanRole[]): Capability[] {
  return [...new Set(roles.flatMap((role) => roleCapabilityMatrix[role]))];
}

export function hasCapability(
  rolesOrCapabilities: readonly (HumanRole | Capability)[],
  capability: Capability
): boolean {
  return rolesOrCapabilities.some((roleOrCapability) =>
    roleOrCapability === capability ||
    (
      roleOrCapability in roleCapabilityMatrix &&
      roleCapabilityMatrix[roleOrCapability as HumanRole].includes(capability)
    )
  );
}

export function decideCapability(
  roles: readonly (HumanRole | Capability)[],
  capability: Capability
): CapabilityDecision {
  return hasCapability(roles, capability)
    ? { allowed: true, capability, reason: "allowed" }
    : { allowed: false, capability, reason: "missing_capability" };
}

export class MissingCapabilityError extends Error {
  readonly capability: Capability;
  readonly code = "missing_capability" as const;

  constructor(capability: Capability) {
    super(`Missing required capability: ${capability}`);
    this.name = "MissingCapabilityError";
    this.capability = capability;
  }
}

export function requireCapability(
  roles: readonly (HumanRole | Capability)[],
  capability: Capability
): void {
  if (!hasCapability(roles, capability)) {
    throw new MissingCapabilityError(capability);
  }
}
