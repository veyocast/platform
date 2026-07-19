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
export type HumanRole = PlatformRole | TenantRole;

export function isPlatformRole(role: HumanRole): role is PlatformRole {
  return (platformRoles as readonly string[]).includes(role);
}

export function isTenantRole(role: HumanRole): role is TenantRole {
  return (tenantRoles as readonly string[]).includes(role);
}
