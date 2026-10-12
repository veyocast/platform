import { z } from "zod";

export const screenCompositionLayoutSchema = z.enum(["full", "sidebar", "bottom", "three"]);
export const screenContentZoneIdSchema = z.enum(["main", "side", "bottom"]);
const percentage = (minimum: number, maximum: number) => z.number().int()
  .min(minimum).max(maximum).refine((value) => value % 5 === 0, "Use steps of five percent.");

export const screenCompositionZoneSchema = z.object({
  id: screenContentZoneIdSchema,
  playlistId: z.string().uuid(),
  fallbackReleaseId: z.string().uuid().optional()
}).strict();

export const screenCompositionDraftSchema = z.object({
  schemaVersion: z.literal(1),
  layout: screenCompositionLayoutSchema,
  orientation: z.enum(["landscape", "portrait"]),
  mainWidthPercent: percentage(50, 80).default(70),
  bottomHeightPercent: percentage(15, 35).default(20),
  zones: z.array(screenCompositionZoneSchema).min(1).max(3)
}).strict().superRefine((value, context) => {
  const expected = compositionZoneIds(value.layout);
  const actual = value.zones.map(({ id }) => id);
  if (actual.length !== expected.length || new Set(actual).size !== actual.length
    || expected.some((id) => !actual.includes(id))) {
    context.addIssue({ code: "custom", path: ["zones"], message: "The layout requires exactly its named content zones." });
  }
});

export const publishedScreenCompositionSchema = z.object({
  id: z.string().uuid(),
  revision: z.number().int().positive(),
  configuration: screenCompositionDraftSchema,
  bindings: z.array(z.object({
    zoneId: screenContentZoneIdSchema,
    playlistId: z.string().uuid(),
    releaseId: z.string().uuid(),
    publicationId: z.string().uuid(),
    configRevision: z.number().int().positive(),
    fallbackReleaseId: z.string().uuid().optional()
  }).strict()).min(1).max(3)
}).strict().superRefine((value, context) => {
  const zones = value.configuration.zones;
  if (value.bindings.length !== zones.length || zones.some((zone) =>
    value.bindings.filter((binding) => binding.zoneId === zone.id
      && binding.playlistId === zone.playlistId).length !== 1)) {
    context.addIssue({ code: "custom", path: ["bindings"], message: "Each zone needs exactly one matching immutable binding." });
  }
});

export function compositionZoneIds(layout: z.infer<typeof screenCompositionLayoutSchema>) {
  return (layout === "full" ? ["main"] : layout === "sidebar" ? ["main", "side"]
    : layout === "bottom" ? ["main", "bottom"] : ["main", "side", "bottom"]) as Array<z.infer<typeof screenContentZoneIdSchema>>;
}

/** Logical percentages; Players apply contain independently inside each zone. */
export function screenCompositionGeometry(configuration: z.infer<typeof screenCompositionDraftSchema>) {
  const side = configuration.layout === "sidebar" || configuration.layout === "three";
  const bottom = configuration.layout === "bottom" || configuration.layout === "three";
  const mainWidth = side ? configuration.mainWidthPercent : 100;
  const topHeight = bottom ? 100 - configuration.bottomHeightPercent : 100;
  return compositionZoneIds(configuration.layout).map((id) => ({
    id,
    left: id === "side" ? mainWidth : 0,
    top: id === "bottom" ? topHeight : 0,
    width: id === "bottom" ? 100 : id === "side" ? 100 - mainWidth : mainWidth,
    height: id === "bottom" ? configuration.bottomHeightPercent : topHeight,
    audio: id === "main"
  }));
}

export type ScreenCompositionDraft = z.infer<typeof screenCompositionDraftSchema>;
export type PublishedScreenComposition = z.infer<typeof publishedScreenCompositionSchema>;
