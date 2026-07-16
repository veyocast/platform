export const platformRoles = [
  "platform_owner",
  "platform_admin",
  "platform_support",
  "platform_viewer"
] as const;

export const tenantRoles = [
  "tenant_owner",
  "tenant_admin",
  "tenant_editor",
  "tenant_viewer"
] as const;

export const tenantStatuses = ["active", "paused", "archived"] as const;

export const invitationStatuses = ["pending", "accepted", "revoked", "expired"] as const;

export type PlatformRole = (typeof platformRoles)[number];
export type TenantRole = (typeof tenantRoles)[number];
export type TenantStatus = (typeof tenantStatuses)[number];
export type InvitationStatus = (typeof invitationStatuses)[number];

export const platformTenantMutationRoles = ["platform_owner", "platform_admin"] as const satisfies readonly PlatformRole[];
export const tenantAdministrationRoles = ["tenant_owner", "tenant_admin"] as const satisfies readonly TenantRole[];
export const tenantWriteRoles = ["tenant_owner", "tenant_admin", "tenant_editor"] as const satisfies readonly TenantRole[];
