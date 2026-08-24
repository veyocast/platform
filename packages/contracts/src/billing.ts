import { z } from "zod";

export const billingStateSchema = z.enum(["draft", "trialing", "active", "grace", "restricted", "suspended", "ended"]);
export const billingPlaybackModeSchema = z.enum(["tenant_content", "tenant_content_with_warning", "veyocast_billing_splash", "veyocast_verification_splash", "system_suspended"]);

export const playerEntitlementPayloadSchema = z.object({
  billingState: billingStateSchema,
  canActivateNetNewScreen: z.boolean(),
  canManageBilling: z.boolean(),
  canPairReplacement: z.boolean(),
  canPublish: z.boolean(),
  canRecoverPlayer: z.boolean(),
  deviceId: z.string().uuid(),
  hardStopAt: z.string().datetime().nullable(),
  issuedAt: z.string().datetime(),
  playbackMode: billingPlaybackModeSchema,
  reason: z.string().min(1).max(120),
  revision: z.number().int().positive(),
  screenId: z.string().uuid(),
  tenantId: z.string().uuid(),
  validUntil: z.string().datetime()
});

export const signedPlayerEntitlementSchema = z.object({
  algorithm: z.literal("Ed25519"),
  keyId: z.string().min(1).max(80),
  payload: playerEntitlementPayloadSchema,
  publicKey: z.string().min(32),
  signature: z.string().min(32)
});

export type PlayerEntitlementPayload = z.infer<typeof playerEntitlementPayloadSchema>;
export type SignedPlayerEntitlement = z.infer<typeof signedPlayerEntitlementSchema>;
export type BillingPlaybackMode = z.infer<typeof billingPlaybackModeSchema>;
