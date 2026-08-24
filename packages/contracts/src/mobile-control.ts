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

export const mobileCreateScreenRequestSchema = z
  .object({
    location: z.string().trim().max(160).nullable(),
    name: z.string().trim().min(2).max(120),
    orientation: z.enum(["landscape", "portrait"]),
    resolutionHeight: z.number().int().min(240).max(4320),
    resolutionWidth: z.number().int().min(320).max(7680)
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

export const mobileCreatePlaylistRequestSchema = z
  .object({
    description: z.string().trim().max(500).nullable(),
    name: z.string().trim().min(2).max(120)
  })
  .strict();

export const mobilePlaylistItemSchema = z
  .object({
    durationSeconds: z.number().int().min(5).max(3600),
    fitMode: z.enum(["contain", "cover"]),
    id: uuid,
    mediaAssetId: uuid,
    mimeType: z.string().min(1).max(160),
    muted: z.boolean(),
    sortOrder: z.number().int().nonnegative(),
    title: z.string().min(1).max(240)
  })
  .strict();

export const mobilePlaylistTargetSchema = z
  .object({
    id: uuid,
    lastSeenAt: instant.nullable(),
    name: z.string().min(1).max(160),
    status: z.enum(["blocked", "ready", "warning"])
  })
  .strict();

export const mobilePlaylistDetailSchema = z
  .object({
    description: z.string().max(500).nullable(),
    id: uuid,
    items: z.array(mobilePlaylistItemSchema).readonly(),
    name: z.string().min(1).max(160),
    publishTargets: z.array(mobilePlaylistTargetSchema).readonly(),
    readyMedia: z.array(mobileMediaAssetSchema).readonly(),
    revision: z.number().int().nonnegative(),
    status: z.enum(["archived", "draft", "published"])
  })
  .strict();

export const mobilePlaylistPublishRequestSchema = z
  .object({
    confirmWarnings: z.boolean(),
    expectedRevision: z.number().int().nonnegative(),
    idempotencyKey: uuid,
    releaseNotes: z.string().trim().max(500).nullable(),
    screenIds: z.array(uuid).min(1).max(100)
  })
  .strict();

export const mobilePlaylistPublishResultSchema = z
  .object({
    actualRevision: z.number().int().nonnegative(),
    outcome: z.enum(["applied", "conflict"]),
    releaseId: uuid.nullable()
  })
  .strict();

export const mobilePlaylistMutationRequestSchema = z.discriminatedUnion(
  "operation",
  [
    z
      .object({
        expectedRevision: z.number().int().nonnegative(),
        idempotencyKey: uuid,
        mediaAssetId: uuid,
        operation: z.literal("add_item")
      })
      .strict(),
    z
      .object({
        expectedRevision: z.number().int().nonnegative(),
        idempotencyKey: uuid,
        itemId: uuid,
        operation: z.literal("move_item"),
        targetPosition: z.number().int().min(0).max(999)
      })
      .strict(),
    z
      .object({
        expectedRevision: z.number().int().nonnegative(),
        displayName: z.string().trim().min(2).max(120),
        fitMode: z.enum(["contain", "cover"]),
        idempotencyKey: uuid,
        itemId: uuid,
        muted: z.boolean(),
        operation: z.literal("update_item"),
        durationSeconds: z.number().int().min(5).max(3600)
      })
      .strict(),
    z
      .object({
        expectedRevision: z.number().int().nonnegative(),
        idempotencyKey: uuid,
        itemId: uuid,
        operation: z.literal("remove_item")
      })
      .strict()
  ]
);

export const mobilePlaylistMutationResultSchema = z
  .object({
    actualRevision: z.number().int().nonnegative(),
    outcome: z.enum(["applied", "conflict"])
  })
  .strict();

export const mobileContentSchema = z
  .object({
    media: z.array(mobileMediaAssetSchema).readonly(),
    playlists: z.array(mobilePlaylistSchema).readonly()
  })
  .strict();

export const mobileContentEnvelopeSchema = z
  .object({
    data: mobileContentSchema,
    meta: mobileApiMetaSchema
  })
  .strict();

export const mobileEngageCampaignSchema = z
  .object({
    endsAt: instant.nullable(),
    id: uuid,
    kind: z.enum(["poll", "motm"]),
    optionCount: z.number().int().min(2).max(24),
    publicId: uuid,
    question: z.string().min(2).max(160),
    startsAt: instant.nullable(),
    status: z.enum(["draft", "scheduled", "live", "closed", "archived"]),
    title: z.string().min(2).max(160),
    totalVotes: z.number().int().nonnegative(),
    updatedAt: instant
  })
  .strict();

export const mobileEngageWorkspaceSchema = z
  .object({
    campaigns: z.array(mobileEngageCampaignSchema).readonly(),
    enabled: z.boolean()
  })
  .strict();

export const mobileEngageWorkspaceEnvelopeSchema = z
  .object({
    data: mobileEngageWorkspaceSchema,
    meta: mobileApiMetaSchema
  })
  .strict();

export const mobileEngageTransitionRequestSchema = z
  .object({
    campaignId: uuid,
    idempotencyKey: uuid,
    targetStatus: z.enum(["live", "closed"])
  })
  .strict();

export const mobileEngageTransitionResultSchema = z
  .object({
    campaignId: uuid,
    outcome: z.enum(["applied", "already_applied", "replayed"]),
    status: z.enum(["live", "closed"])
  })
  .strict();

export const mobileDeletionRequestSchema = z
  .object({
    executedAt: instant.nullable(),
    id: uuid,
    requestedAt: instant,
    requestNumber: z.number().int().positive(),
    status: z.enum([
      "approved",
      "blocked",
      "cancelled",
      "executed",
      "legal_review",
      "requested"
    ])
  })
  .strict();

export const mobileDeletionRequestsEnvelopeSchema = z
  .object({
    data: z.array(mobileDeletionRequestSchema).readonly(),
    meta: mobileApiMetaSchema
  })
  .strict();

export const mobileNotificationPreferencesSchema = z
  .object({
    approvalRequested: z.boolean(),
    mediaFailed: z.boolean(),
    playerError: z.boolean(),
    publicationCompleted: z.boolean(),
    screenOffline: z.boolean()
  })
  .strict();

export const mobileNotificationPreferencesEnvelopeSchema = z
  .object({
    data: mobileNotificationPreferencesSchema,
    meta: mobileApiMetaSchema
  })
  .strict();

export const mobileDeviceRegistrationSchema = z
  .object({
    appVersion: z.string().trim().min(1).max(80),
    locale: z.string().trim().max(32).nullable(),
    pushToken: z.string().trim().min(16).max(4096),
    timezone: z.string().trim().max(120).nullable()
  })
  .strict();

export type MobileApiErrorEnvelope = z.infer<
  typeof mobileApiErrorEnvelopeSchema
>;
export type MobileCockpit = z.infer<typeof mobileCockpitSchema>;
export type MobileDeviceRegistration = z.infer<
  typeof mobileDeviceRegistrationSchema
>;
export type MobileEngageTransitionRequest = z.infer<
  typeof mobileEngageTransitionRequestSchema
>;
export type MobileEngageWorkspace = z.infer<
  typeof mobileEngageWorkspaceSchema
>;
export type MobileCreatePlaylistRequest = z.infer<
  typeof mobileCreatePlaylistRequestSchema
>;
export type MobileCreateScreenRequest = z.infer<
  typeof mobileCreateScreenRequestSchema
>;
export type MobileNotificationPreferences = z.infer<
  typeof mobileNotificationPreferencesSchema
>;
export type MobilePlaylistDetail = z.infer<typeof mobilePlaylistDetailSchema>;
export type MobilePlaylistMutationRequest = z.infer<
  typeof mobilePlaylistMutationRequestSchema
>;
export type MobilePlaylistPublishRequest = z.infer<
  typeof mobilePlaylistPublishRequestSchema
>;
export type MobilePairingClaimRequest = z.infer<
  typeof mobilePairingClaimRequestSchema
>;
export type MobilePlayerCommandRequest = z.infer<
  typeof mobilePlayerCommandRequestSchema
>;
export type MobileScreenSummary = z.infer<typeof mobileScreenSummarySchema>;
export type MobileSession = z.infer<typeof mobileSessionSchema>;
