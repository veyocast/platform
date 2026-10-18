import { z } from "zod";

const id = z.string().uuid();
const sha256 = z.string().regex(/^[a-f0-9]{64}$/);
const color = z.string().regex(/^#[a-f0-9]{6}$/i);
export const mediaFrameFocusSchema = z.enum(["center", "top", "bottom", "left", "right"]);
export const mediaFrameThemeSchema = z.enum(["fieldflow", "onzetrots-tv"]);
export const mediaFrameBackgroundPresetSchema = z.enum(["stadium", "dark", "light", "gradient", "stripes", "clubmuur"]);

/** Only tenant asset identities cross the write boundary, never signed or local URLs. */
export const mediaFrameBackgroundSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("preset"), preset: mediaFrameBackgroundPresetSchema }).strict(),
  z.object({ kind: z.literal("image"), mediaAssetId: id, position: mediaFrameFocusSchema }).strict(),
]);

/** Source keeps these values, but rawmedia has no text/logo/footer overlay. */
export const mediaFrameSourceMetadataSchema = z.object({
  title: z.string().max(400),
  headline: z.string().max(200),
  subtitle: z.string().max(400),
  body: z.string().max(4_000),
  footer: z.string().max(400),
  font: z.enum(["Inter", "Manrope", "Arial", "Condensed", "Serif", "Brush"]),
  scale: z.number().int().min(50).max(150),
  alignment: z.enum(["left", "center", "right"]),
  safeMargin: z.number().min(2).max(12),
  showLogo: z.boolean(),
  showFooter: z.boolean(),
  motion: z.enum(["rustig", "dynamisch", "geen"]),
}).strict();

export const mediaFrameSettingsSchema = z.object({
  schemaVersion: z.literal(1),
  name: z.string().trim().min(2).max(120),
  orientation: z.enum(["landscape", "portrait"]),
  durationSeconds: z.number().int().min(3).max(3_600),
  fitMode: z.enum(["cover", "contain"]),
  focus: mediaFrameFocusSchema,
  appearance: z.object({
    themeId: mediaFrameThemeSchema,
    accentColor: color,
    background: mediaFrameBackgroundSchema,
  }).strict(),
  sourceMetadata: mediaFrameSourceMetadataSchema,
}).strict().superRefine((value, context) => {
  if (new TextEncoder().encode(JSON.stringify(value)).byteLength > 16_384) {
    context.addIssue({ code: "custom", message: "Het media-ontwerp is groter dan 16 KiB." });
  }
});

export const mediaFrameExpectedSourceSchema = z.object({
  role: z.enum(["media", "background"]),
  mediaAssetId: id,
  variantId: id,
  checksumSha256: sha256,
  byteSize: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
}).strict();
export const mediaFrameExpectedSourcesSchema = z.array(mediaFrameExpectedSourceSchema).min(1).max(2)
  .superRefine((sources, context) => {
    if (sources.filter(source => source.role === "media").length !== 1 || new Set(sources.map(source => source.role)).size !== sources.length) {
      context.addIssue({ code: "custom", message: "Elke bronrol moet eenmaal voorkomen, met precies één mediabron." });
    }
  });

const commandIdentity = { tenantId: id, frameId: id, idempotencyKey: id };
export const mediaFrameCommandSchema = z.discriminatedUnion("operation", [
  z.object({ ...commandIdentity, operation: z.literal("create"), expectedRevision: z.literal(0), sourceAssetId: id, isPrimary: z.boolean().optional(), expectedSources: mediaFrameExpectedSourcesSchema, settings: mediaFrameSettingsSchema }).strict(),
  z.object({ ...commandIdentity, operation: z.literal("save"), expectedRevision: z.number().int().positive(), expectedSources: mediaFrameExpectedSourcesSchema, settings: mediaFrameSettingsSchema }).strict(),
  z.object({ ...commandIdentity, operation: z.literal("duplicate"), expectedRevision: z.number().int().positive(), newFrameId: id }).strict(),
  z.object({ ...commandIdentity, operation: z.literal("archive"), expectedRevision: z.number().int().positive() }).strict(),
  z.object({ ...commandIdentity, operation: z.literal("restore"), expectedRevision: z.number().int().positive() }).strict(),
]).superRefine((command, context) => {
  if (command.operation === "create" || command.operation === "save") {
    const media = command.expectedSources.find(source => source.role === "media");
    const background = command.expectedSources.find(source => source.role === "background");
    if (command.operation === "create" && media?.mediaAssetId !== command.sourceAssetId) {
      context.addIssue({ code: "custom", path: ["expectedSources"], message: "De mediabron hoort bij hetzelfde upload-ID." });
    }
    const appearance = command.settings.appearance.background;
    if (appearance.kind === "image" ? background?.mediaAssetId !== appearance.mediaAssetId : Boolean(background)) {
      context.addIssue({ code: "custom", path: ["expectedSources"], message: "De achtergrondbron moet exact bij het gekozen beeld horen." });
    }
  }
});

/** Frozen manifest data. This adds no new media item kind or playback lifecycle. */
export const mediaFramePlaybackBackgroundSchema = z.object({
  schemaVersion: z.literal(1),
  themeId: mediaFrameThemeSchema,
  accentColor: color,
  background: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("preset"), preset: mediaFrameBackgroundPresetSchema }).strict(),
    z.object({ kind: z.literal("image"), mediaAssetId: id, checksumSha256: sha256, position: mediaFrameFocusSchema }).strict(),
  ]),
}).strict();

export type MediaFrameSettings = z.infer<typeof mediaFrameSettingsSchema>;
export type MediaFrameExpectedSource = z.infer<typeof mediaFrameExpectedSourceSchema>;
export type MediaFrameCommand = z.infer<typeof mediaFrameCommandSchema>;
export type MediaFramePlaybackBackground = z.infer<typeof mediaFramePlaybackBackgroundSchema>;

export const mediaFrameOverridesSchema = z.object({
  durationSeconds: z.literal(true).optional(), fitMode: z.literal(true).optional(),
  cropFocusX: z.literal(true).optional(), cropFocusY: z.literal(true).optional(),
  displayTitle: z.literal(true).optional(), accessibilityName: z.literal(true).optional(),
  backgroundColor: z.literal(true).optional(),
}).strict();
export const mediaFrameProvenanceSchema = z.object({
  schemaVersion: z.literal(1), tenantId: id, frameId: id, versionId: id,
  versionNumber: z.number().int().positive(), settings: mediaFrameSettingsSchema,
  overrides: mediaFrameOverridesSchema,
  sourceAssets: z.array(z.object({
    role: z.enum(["media", "background"]), mediaAssetId: id, variantId: id,
    checksumSha256: sha256, byteSize: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    storageBucket: z.literal("tenant-media"), storagePath: z.string().min(1).max(2048),
    mimeType: z.enum(["image/gif", "image/jpeg", "image/png", "image/svg+xml", "image/webp", "video/mp4"]),
    width: z.number().int().positive().nullable(), height: z.number().int().positive().nullable(),
    durationSeconds: z.number().positive().nullable(),
  }).strict()).min(1).max(2),
}).strict().superRefine((value, context) => {
  const refs = value.sourceAssets, background = value.settings.appearance.background;
  if (refs.filter(ref => ref.role === "media").length !== 1 || new Set(refs.map(ref => ref.role)).size !== refs.length || (background.kind === "image" ? !refs.some(ref => ref.role === "background" && ref.mediaAssetId === background.mediaAssetId && ref.mimeType.startsWith("image/")) : refs.some(ref => ref.role === "background"))) context.addIssue({ code: "custom", message: "De bevroren bronrollen passen niet bij het media-ontwerp." });
  if (refs.some(ref => !ref.storagePath.startsWith(`tenants/${value.tenantId}/assets/${ref.mediaAssetId}/`) || ref.storagePath.split("/").some(part => part === "." || part === "..") || (/[\\?#]/.test(ref.storagePath) || Array.from(ref.storagePath).some(character => character.charCodeAt(0) < 32)))) context.addIssue({ code: "custom", message: "De bevroren bron heeft geen veilig tenantpad." });
});
export type MediaFrameProvenance = z.infer<typeof mediaFrameProvenanceSchema>;

/** Existing playlist video bound; invalid input remains editable, never clipped. */
export function mediaFrameSourceDurationLimit(source: { kind: "image" | "video"; durationSeconds: number | null; maximumDurationSeconds?: number }): number {
  if (source.kind === "image") return 3600;
  if (source.maximumDurationSeconds !== undefined) return Number.isSafeInteger(source.maximumDurationSeconds) && source.maximumDurationSeconds >= 5 && source.maximumDurationSeconds <= 3600 ? source.maximumDurationSeconds : 0;
  return source.durationSeconds !== null && Number.isFinite(source.durationSeconds) && source.durationSeconds > 0 ? Math.max(5, Math.min(3600, Math.ceil(source.durationSeconds))) : 0;
}

export function mediaFrameFocusCoordinates(focus: z.infer<typeof mediaFrameFocusSchema>) {
  return { center: { x: 0.5, y: 0.5 }, top: { x: 0.5, y: 0 }, bottom: { x: 0.5, y: 1 }, left: { x: 0, y: 0.5 }, right: { x: 1, y: 0.5 } }[focus];
}

export function mediaFrameDefaultSettings(source: { title: string; kind: "image" | "video"; durationSeconds: number | null }): MediaFrameSettings {
  const name = source.title.trim().slice(0, 120);
  return mediaFrameSettingsSchema.parse({ schemaVersion: 1, name: name.length >= 2 ? name : "Media", orientation: "landscape", durationSeconds: source.kind === "video" && source.durationSeconds ? Math.max(3, Math.ceil(source.durationSeconds)) : 12, fitMode: "cover", focus: "center",
    appearance: { themeId: "onzetrots-tv", accentColor: "#1763ed", background: { kind: "preset", preset: "stadium" } },
    sourceMetadata: { title: "", headline: "", subtitle: "", body: "", footer: "", font: "Inter", scale: 100, alignment: "left", safeMargin: 5, showLogo: true, showFooter: true, motion: "rustig" } });
}
