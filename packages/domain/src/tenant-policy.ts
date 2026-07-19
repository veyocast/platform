import type { TenantStatus } from "./identity";

export const tenantOperations = [
  "read",
  "mutate",
  "publish",
  "pair",
  "existing_playback"
] as const;

export type TenantOperation = (typeof tenantOperations)[number];

export type TenantOperationDecision = Readonly<{
  allowed: boolean;
  reason: "allowed" | "tenant_paused" | "tenant_archived";
}>;

export function decideTenantOperation(
  status: TenantStatus,
  operation: TenantOperation
): TenantOperationDecision {
  if (status === "active") {
    return { allowed: true, reason: "allowed" };
  }

  if (status === "paused") {
    return operation === "read" || operation === "existing_playback"
      ? { allowed: true, reason: "allowed" }
      : { allowed: false, reason: "tenant_paused" };
  }

  return operation === "existing_playback"
    ? { allowed: true, reason: "allowed" }
    : { allowed: false, reason: "tenant_archived" };
}
