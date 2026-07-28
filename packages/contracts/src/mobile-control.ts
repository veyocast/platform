import { z } from "zod";

import { safeActionErrorSchema } from "./errors";

const uuid = z.string().uuid();
const instant = z.string().datetime({ offset: true });

export const mobileApiVersion = "2026-07-28" as const;

export const mobileApiMetaSchema = z
  .object({
    requestId: z.string().min(8).max(128),
    version: z.literal(mobileApiVersion)
  })
  .strict();

export const mobileApiErrorEnvelopeSchema = z
  .object({
    error: safeActionErrorSchema,
    meta: mobileApiMetaSchema
  })
  .strict();

export const mobileTenantSchema = z
  .object({
    id: uuid,
    name: z.string().min(1).max(160),
    roleLabel: z.string().min(1).max(80),
    slug: z.string().min(1).max(120),
    status: z.enum(["active", "suspended", "archived"]),
    capabilities: z.array(z.string().min(1)).readonly()
  })
  .strict();

export const mobileSessionSchema = z
  .object({
    assuranceLevel: z.enum(["aal1", "aal2"]),
    email: z.string().email(),
    tenants: z.array(mobileTenantSchema).readonly(),
    userId: uuid,
    userName: z.string().min(1).max(160)
  })
  .strict();

export const mobileSessionEnvelopeSchema = z
  .object({
    data: mobileSessionSchema,
    meta: mobileApiMetaSchema
  })
  .strict();

export const mobileStatusToneSchema = z.enum([
  "critical",
  "info",
  "neutral",
  "success",
  "warning"
]);

export const mobileCockpitSignalSchema = z
  .object({
    actionHref: z.string().startsWith("/"),
    actionLabel: z.string().min(1).max(80),
    id: z.string().min(1).max(160),
    message: z.string().min(1).max(500),
    occurredAt: instant.nullable(),
    title: z.string().min(1).max(160),
    tone: mobileStatusToneSchema
  })
  .strict();

export const mobileCockpitSchema = z
  .object({
    generatedAt: instant,
    mediaProcessing: z.number().int().nonnegative(),
    pendingPublications: z.number().int().nonnegative(),
    screensAttention: z.number().int().nonnegative(),
    screensOnline: z.number().int().nonnegative(),
    signals: z.array(mobileCockpitSignalSchema).readonly()
  })
  .strict();

export const mobileCockpitEnvelopeSchema = z
  .object({
    data: mobileCockpitSchema,
    meta: mobileApiMetaSchema
  })
  .strict();

export const mobileScreenStatusSchema = z.enum([
  "attention",
  "offline",
  "online",
  "pairing",
  "unknown"
]);

export const mobileScreenSummarySchema = z
  .object({
    activeReleaseLabel: z.string().max(200).nullable(),
    appVersion: z.string().max(80).nullable(),
    id: uuid,
    lastErrorCode: z.string().max(120).nullable(),
    lastSeenAt: instant.nullable(),
    location: z.string().max(200).nullable(),
    name: z.string().min(1).max(160),
    status: mobileScreenStatusSchema
  })
  .strict();

export const mobileScreensEnvelopeSchema = z
  .object({
    data: z
      .object({
        items: z.array(mobileScreenSummarySchema).readonly(),
        nextCursor: z.string().max(512).nullable(),
        total: z.number().int().nonnegative()
      })
      .strict(),
    meta: mobileApiMetaSchema
  })
  .strict();

export const mobilePairingCodeSchema = z
  .string()
  .trim()
  .regex(/^[A-Z0-9]{6,12}$/);

export const mobilePairingClaimRequestSchema = z
  .object({
    code: mobilePairingCodeSchema,
    idempotencyKey: z.string().uuid(),
    screenId: uuid
  })
  .strict();

export const mobilePairingClaimSchema = z
  .object({
    code: mobilePairingCodeSchema,
    deviceId: uuid,
    screenId: uuid,
    status: z.literal("paired")
  })
  .strict();

export const mobilePlayerCommandTypeSchema = z.enum([
  "CLEAR_PLAYER_CACHE",
  "FORCE_UNPAIR",
  "RECOVER_PAIRING",
  "RELOAD_PLAYER"
]);

export const mobilePlayerCommandRequestSchema = z
  .object({
    commandType: mobilePlayerCommandTypeSchema,
    idempotencyKey: z.string().uuid(),
    screenId: uuid,
    ttlSeconds: z.number().int().min(30).max(3600).default(300)
  })
  .strict();

export const mobilePlayerCommandSchema = z
  .object({
    commandType: mobilePlayerCommandTypeSchema,
    createdAt: instant,
    expiresAt: instant,
    id: uuid,
    status: z.enum([
      "waiting",
      "delivered",
      "acknowledged",
      "completed",
      "failed",
      "expired"
    ])
  })
  .strict();

export const mobileMediaAssetSchema = z
  .object({
    createdAt: instant,
    id: uuid,
    mimeType: z.string().min(1).max(160),
    name: z.string().min(1).max(240),
    processingStatus: z.enum(["failed", "processing", "ready"]),
    sizeBytes: z.number().int().nonnegative(),
    thumbnailUrl: z.string().url().nullable()
  })
  .strict();

export const mobilePlaylistSchema = z
  .object({
    id: uuid,
    itemCount: z.number().int().nonnegative(),
    name: z.string().min(1).max(160),
    publishedVersion: z.number().int().nonnegative().nullable(),
    status: z.enum(["archived", "draft", "published"]),
    updatedAt: instant
  })
  .strict();

export type MobileApiErrorEnvelope = z.infer<
  typeof mobileApiErrorEnvelopeSchema
>;
export type MobileCockpit = z.infer<typeof mobileCockpitSchema>;
export type MobilePairingClaimRequest = z.infer<
  typeof mobilePairingClaimRequestSchema
>;
export type MobilePlayerCommandRequest = z.infer<
  typeof mobilePlayerCommandRequestSchema
>;
export type MobileScreenSummary = z.infer<typeof mobileScreenSummarySchema>;
export type MobileSession = z.infer<typeof mobileSessionSchema>;
