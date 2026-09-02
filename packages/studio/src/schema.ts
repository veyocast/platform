import { z } from "zod";

import {
  studioAnimationPresets,
  studioFonts,
  studioFps,
  studioFontRegistryVersions,
  studioLimits,
  studioSchemaVersion
} from "./constants";

const colorSchema = z.string().regex(
  /^#[0-9A-F]{6}([0-9A-F]{2})?$/i,
  "Gebruik een hexkleur met zes of acht tekens."
);
const elementIdSchema = z.string().regex(/^[a-z0-9][a-z0-9_-]{2,63}$/i);
const uuidSchema = z.string().uuid();

const animationSchema = z.object({
  preset: z.enum(studioAnimationPresets),
  durationMs: z.number().int().min(0).max(5_000),
  delayMs: z.number().int().min(0).max(10_000).default(0),
  easing: z.enum(["linear", "ease-in", "ease-out", "ease-in-out"]).default("ease-out"),
  distance: z.number().min(0).max(1_920).default(96),
  intensity: z.number().min(0).max(1).default(0.16)
});

export const studioElementTimingSchema = z.object({
  startMs: z.number().int().min(0).max(studioLimits.maxDocumentDurationMs),
  endMs: z.number().int().min(1).max(studioLimits.maxDocumentDurationMs),
  entry: animationSchema.optional(),
  exit: animationSchema.optional(),
  continuous: animationSchema.optional()
}).refine((timing) => timing.endMs > timing.startMs, {
  message: "De eindtijd moet na de starttijd liggen."
});

const shadowSchema = z.object({
  color: colorSchema,
  blur: z.number().min(0).max(80),
  offsetX: z.number().min(-80).max(80),
  offsetY: z.number().min(-80).max(80),
  opacity: z.number().min(0).max(1)
});

const borderSchema = z.object({
  color: colorSchema,
  width: z.number().min(0).max(24)
});

const baseElementSchema = z.object({
  id: elementIdSchema,
  name: z.string().trim().min(1).max(80),
  x: z.number().min(-7_680).max(15_360),
  y: z.number().min(-7_680).max(15_360),
  width: z.number().min(1).max(15_360),
  height: z.number().min(1).max(15_360),
  rotation: z.number().min(-360).max(360).default(0),
  opacity: z.number().min(0).max(1).default(1),
  visible: z.boolean().default(true),
  locked: z.boolean().default(false),
  zIndex: z.number().int().min(0).max(studioLimits.maxElements - 1),
  groupId: elementIdSchema.optional(),
  timing: studioElementTimingSchema.optional()
});

const textElementSchema = baseElementSchema.extend({
  type: z.literal("text"),
  text: z.string().max(studioLimits.maxTextLength),
  fontFamily: z.enum(studioFonts.map((font) => font.family)),
  fontWeight: z.union([
    z.literal(400),
    z.literal(500),
    z.literal(600),
    z.literal(700),
    z.literal(800)
  ]),
  fontSize: z.number().min(12).max(360),
  lineHeight: z.number().min(0.8).max(2.4).default(1.1),
  letterSpacing: z.number().min(-10).max(40).default(0),
  fill: colorSchema,
  align: z.enum(["left", "center", "right"]).default("left"),
  verticalAlign: z.enum(["top", "middle", "bottom"]).default("top"),
  autoFit: z.boolean().default(false),
  backgroundColor: colorSchema.optional(),
  cornerRadius: z.number().min(0).max(160).default(0),
  padding: z.number().min(0).max(160).default(0),
  border: borderSchema.optional(),
  shadow: shadowSchema.optional()
});

const imageElementSchema = baseElementSchema.extend({
  type: z.literal("image"),
  mediaAssetId: uuidSchema,
  variant: z.enum(["original", "thumbnail", "player_1080p"]).default("original"),
  objectFit: z.enum(["cover", "contain"]).default("cover"),
  focusX: z.number().min(0).max(1).default(0.5),
  focusY: z.number().min(0).max(1).default(0.5),
  cornerRadius: z.number().min(0).max(320).default(0),
  border: borderSchema.optional(),
  shadow: shadowSchema.optional(),
  alt: z.string().trim().max(240).default("")
});

const videoElementSchema = baseElementSchema.extend({
  type: z.literal("video"),
  mediaAssetId: uuidSchema,
  variant: z.literal("player_1080p").default("player_1080p"),
  objectFit: z.enum(["cover", "contain"]).default("cover"),
  focusX: z.number().min(0).max(1).default(0.5),
  focusY: z.number().min(0).max(1).default(0.5),
  muted: z.literal(true).default(true),
  loop: z.literal(true).default(true),
  startOffsetMs: z.number().int().min(0).max(studioLimits.maxDocumentDurationMs).default(0),
  alt: z.string().trim().max(240).default("")
});

const fillSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("solid"), color: colorSchema }),
  z.object({
    kind: z.literal("linear-gradient"),
    from: colorSchema,
    to: colorSchema,
    angle: z.number().min(0).max(360)
  })
]);

const shapeElementSchema = baseElementSchema.extend({
  type: z.literal("shape"),
  shape: z.enum(["rectangle", "ellipse", "line"]),
  fill: fillSchema,
  cornerRadius: z.number().min(0).max(320).default(0),
  border: borderSchema.optional(),
  shadow: shadowSchema.optional()
});

const iconElementSchema = baseElementSchema.extend({
  type: z.literal("icon"),
  icon: z.enum([
    "activity",
    "calendar",
    "clock",
    "heart",
    "image",
    "info",
    "location",
    "megaphone",
    "shield",
    "star",
    "trophy",
    "users"
  ]),
  fill: colorSchema,
  strokeWidth: z.number().min(0).max(16).default(0)
});

const qrElementSchema = baseElementSchema.extend({
  type: z.literal("qr"),
  value: z.string().trim().min(1).max(1_024),
  foreground: colorSchema.default("#0A0A0A"),
  background: colorSchema.default("#FAFAF7"),
  errorCorrection: z.enum(["L", "M", "Q", "H"]).default("M")
});

const placeholderElementSchema = baseElementSchema.extend({
  type: z.literal("placeholder"),
  slot: z.enum(["photo", "sponsor-logo", "tenant-logo"]),
  label: z.string().trim().min(1).max(80),
  fill: colorSchema,
  stroke: colorSchema
});

const groupElementSchema = baseElementSchema.extend({
  type: z.literal("group"),
  childIds: z.array(elementIdSchema).min(2).max(studioLimits.maxElements)
});

export const studioElementSchema = z.discriminatedUnion("type", [
  textElementSchema,
  imageElementSchema,
  videoElementSchema,
  shapeElementSchema,
  iconElementSchema,
  qrElementSchema,
  placeholderElementSchema,
  groupElementSchema
]);

const artboardSchema = z.object({
  width: z.union([z.literal(1920), z.literal(1080)]),
  height: z.union([z.literal(1080), z.literal(1920)]),
  orientation: z.enum(["landscape", "portrait"]),
  background: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("transparent") }),
    z.object({ kind: z.literal("solid"), color: colorSchema }),
    z.object({
      kind: z.literal("linear-gradient"),
      from: colorSchema,
      to: colorSchema,
      angle: z.number().min(0).max(360)
    })
  ]),
  safeArea: z.object({
    top: z.number().min(0).max(480),
    right: z.number().min(0).max(480),
    bottom: z.number().min(0).max(480),
    left: z.number().min(0).max(480)
  })
}).superRefine((artboard, context) => {
  const expectedLandscape =
    artboard.width === 1920 &&
    artboard.height === 1080 &&
    artboard.orientation === "landscape";
  const expectedPortrait =
    artboard.width === 1080 &&
    artboard.height === 1920 &&
    artboard.orientation === "portrait";
  if (!expectedLandscape && !expectedPortrait) {
    context.addIssue({
      code: "custom",
      message: "Het artboard moet liggend HD of staand HD zijn."
    });
  }
});

export const studioDocumentSchema = z.object({
  schemaVersion: z.literal(studioSchemaVersion),
  artboard: artboardSchema,
  motion: z.object({
    enabled: z.boolean(),
    durationMs: z.number().int()
      .min(studioLimits.minDocumentDurationMs)
      .max(studioLimits.maxDocumentDurationMs),
    fps: z.literal(studioFps)
  }),
  elements: z.array(studioElementSchema).max(studioLimits.maxElements),
  metadata: z.object({
    templateId: z.string().trim().max(120).optional(),
    createdFromRevisionId: uuidSchema.optional(),
    fontRegistryVersion: z.enum(studioFontRegistryVersions),
    tenantBrandApplied: z.boolean().default(false)
  })
}).superRefine((document, context) => {
  const ids = new Set<string>();
  for (const [index, element] of document.elements.entries()) {
    if (ids.has(element.id)) {
      context.addIssue({
        code: "custom",
        message: `Laag-ID ${element.id} komt meer dan één keer voor.`,
        path: ["elements", index, "id"]
      });
    }
    ids.add(element.id);
    if (element.timing && element.timing.endMs > document.motion.durationMs) {
      context.addIssue({
        code: "custom",
        message: "Laagtiming valt buiten de documentduur.",
        path: ["elements", index, "timing", "endMs"]
      });
    }
  }
  for (const [index, element] of document.elements.entries()) {
    const group = element.groupId
      ? document.elements.find((candidate) => candidate.id === element.groupId)
      : undefined;
    if (element.groupId && group?.type !== "group") {
      context.addIssue({
        code: "custom",
        message: "De gekoppelde groep bestaat niet.",
        path: ["elements", index, "groupId"]
      });
    }
    if (
      element.type === "group" &&
      element.childIds.some((childId) => {
        const child = document.elements.find((candidate) => candidate.id === childId);
        return !child || child.groupId !== element.id;
      })
    ) {
      context.addIssue({
        code: "custom",
        message: "De groepsleden en laagkoppelingen komen niet overeen.",
        path: ["elements", index, "childIds"]
      });
    }
  }
  const videos = document.elements.flatMap((element, index) =>
    element.type === "video" ? [{ element, index }] : []
  );
  if (videos.length > 1) {
    context.addIssue({
      code: "custom",
      message: "Studio ondersteunt maximaal één deterministische achtergrondvideo.",
      path: ["elements"]
    });
  }
  for (const { element, index } of videos) {
    if (
      element.x !== 0 ||
      element.y !== 0 ||
      element.width !== document.artboard.width ||
      element.height !== document.artboard.height ||
      element.rotation !== 0 ||
      element.zIndex !== 0 ||
      !element.locked ||
      document.artboard.background.kind !== "transparent"
    ) {
      context.addIssue({
        code: "custom",
        message: "Een achtergrondvideo vult en vergrendelt het transparante canvas op laag 0.",
        path: ["elements", index]
      });
    }
  }
});

export type StudioDocument = z.infer<typeof studioDocumentSchema>;
export type StudioElement = z.infer<typeof studioElementSchema>;
export type StudioElementTiming = z.infer<typeof studioElementTimingSchema>;

export function parseStudioDocument(input: unknown): StudioDocument {
  return studioDocumentSchema.parse(input);
}

export function safeParseStudioDocument(input: unknown) {
  return studioDocumentSchema.safeParse(input);
}
