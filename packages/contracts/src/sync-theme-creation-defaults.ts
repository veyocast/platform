import { z } from "zod";

const themeId = z.enum(["fieldflow", "onzetrots-tv"]);
const revision = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);

/** Source preferences for new designs only; no live rollout authority. */
export const syncThemeCreationDefaultsSchema = z.object({
  accent: z.string().regex(/^#[a-f0-9]{6}$/i),
  font: z.enum(["Manrope", "Inter", "Georgia", "Arial"]),
  mode: z.enum(["light", "dark", "auto"]),
  scale: z.number().int().min(90).max(120),
  background: z.enum(["clubkleur", "gradient", "stadium"]),
  motion: z.enum(["rustig", "geen", "dynamisch"]),
  showLogo: z.boolean(),
}).strict();
export type SyncThemeCreationDefaults = z.infer<typeof syncThemeCreationDefaultsSchema>;

export const syncThemeDefaultsProfileSchema = z.object({
  themeId,
  themeVersion: z.enum(["1.0.0", "11.0.0"]),
  revision,
  configured: z.boolean(),
  defaults: syncThemeCreationDefaultsSchema.nullable(),
}).strict().superRefine((value, context) => {
  if (value.themeVersion !== (value.themeId === "fieldflow" ? "1.0.0" : "11.0.0"))
    context.addIssue({ code: "custom", message: "De themaversie hoort niet bij het pakket." });
  if (value.configured ? value.defaults === null || value.revision === 0 : value.defaults !== null || value.revision !== 0)
    context.addIssue({ code: "custom", message: "De opgeslagen voorkeuren en revisie horen niet bij elkaar." });
});
export type SyncThemeDefaultsProfile = z.infer<typeof syncThemeDefaultsProfileSchema>;

export const syncThemeDefaultsReadModelSchema = z.object({
  schemaVersion: z.literal(1),
  tenantId: z.string().uuid(),
  defaultThemeId: themeId.nullable(),
  profiles: z.array(syncThemeDefaultsProfileSchema).length(2),
}).strict().superRefine((value, context) => {
  if (new Set(value.profiles.map(profile => profile.themeId)).size !== 2)
    context.addIssue({ code: "custom", message: "Beide thema's moeten afzonderlijk worden bevestigd." });
});
export type SyncThemeDefaultsReadModel = z.infer<typeof syncThemeDefaultsReadModelSchema>;

export const syncThemeDefaultsCommandSchema = z.object({
  tenantId: z.string().uuid(), themeId, expectedRevision: revision,
  defaults: syncThemeCreationDefaultsSchema, idempotencyKey: z.string().uuid(),
}).strict();
export type SyncThemeDefaultsCommand = z.infer<typeof syncThemeDefaultsCommandSchema>;

export const syncThemeDefaultsAckSchema = z.object({
  schemaVersion: z.literal(1), outcome: z.enum(["applied", "noop"]),
  tenantId: z.string().uuid(), themeId, revision: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
  defaults: syncThemeCreationDefaultsSchema,
}).strict();
export type SyncThemeDefaultsAck = z.infer<typeof syncThemeDefaultsAckSchema>;

/** The original command remains unchanged; only a completely bound ACK counts. */
export function parseSyncThemeDefaultsAck(input: unknown, command: SyncThemeDefaultsCommand): SyncThemeDefaultsAck | null {
  if (!syncThemeDefaultsCommandSchema.safeParse(command).success) return null;
  const parsed = syncThemeDefaultsAckSchema.safeParse(input);
  if (!parsed.success) return null;
  const value = parsed.data;
  const expected = command.expectedRevision + (value.outcome === "applied" ? 1 : 0);
  if (!Number.isSafeInteger(expected) || value.tenantId !== command.tenantId || value.themeId !== command.themeId
    || value.revision !== expected || !Object.entries(command.defaults).every(([key, field]) => value.defaults[key as keyof SyncThemeCreationDefaults] === field)) return null;
  return value;
}
