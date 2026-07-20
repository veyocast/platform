import type { PlatformRole, TenantRole } from "./identity";

export type TeamMutationDecision = Readonly<{
  allowed: boolean;
  reason:
    | "allowed"
    | "insufficient_role"
    | "last_owner"
    | "self_lockout";
}>;

export function decideTenantRoleMutation(input: Readonly<{
  actorRole: TenantRole;
  isSelf: boolean;
  nextRole: TenantRole | null;
  ownerCount: number;
  targetRole: TenantRole;
}>): TeamMutationDecision {
  if (input.isSelf) return denied("self_lockout");

  if (
    input.targetRole === "tenant_owner" &&
    input.nextRole !== "tenant_owner" &&
    input.ownerCount <= 1
  ) {
    return denied("last_owner");
  }

  if (input.actorRole === "tenant_owner") {
    return { allowed: true, reason: "allowed" };
  }

  if (
    input.actorRole === "tenant_admin" &&
    input.targetRole !== "tenant_owner" &&
    input.nextRole !== "tenant_owner"
  ) {
    return { allowed: true, reason: "allowed" };
  }

  return denied("insufficient_role");
}

export function decidePlatformRoleMutation(input: Readonly<{
  actorRole: PlatformRole;
  isSelf: boolean;
  nextRole: PlatformRole | null;
  ownerCount: number;
  targetRole: PlatformRole | null;
}>): TeamMutationDecision {
  if (input.actorRole !== "platform_owner") return denied("insufficient_role");
  if (input.isSelf) return denied("self_lockout");

  if (
    input.targetRole === "platform_owner" &&
    input.nextRole !== "platform_owner" &&
    input.ownerCount <= 1
  ) {
    return denied("last_owner");
  }

  return { allowed: true, reason: "allowed" };
}

function denied(reason: Exclude<TeamMutationDecision["reason"], "allowed">) {
  return { allowed: false, reason } as const;
}
