import { z } from "zod";

export const ledScoresCanvasSchemaVersion = 1 as const;
export const ledScoresCanvasMaximumLayers = 16;
export const ledScoresCanvasMaximumAssets = 24;

export const ledScoresCanvasMomentKeys = [
  "goalOwn",
  "goalOpponent",
  "goalUnknown",
  "lineupHome",
  "lineupAway",
  "matchStart",
  "halfTime",
  "matchEnd"
] as const;

export const ledScoresCanvasTextBindings = [
  "headline",
  "secondaryText",
  "homeTeam",
  "awayTeam",
  "homeScore",
  "awayScore",
  "score",
  "previousScore",
  "clock",
  "period",
  "scoringTeam",
  "scorerName",
  "scorerNumber",
  "eventLabel"
] as const;

export const ledScoresCanvasImageBindings = [
  "scorerPhoto",
  "homeLogo",
  "awayLogo",
  "scoringTeamLogo"
] as const;

export type LedScoresCanvasMomentKey =
  (typeof ledScoresCanvasMomentKeys)[number];
export type LedScoresCanvasTextBinding =
  (typeof ledScoresCanvasTextBindings)[number];
export type LedScoresCanvasImageBinding =
  (typeof ledScoresCanvasImageBindings)[number];
export type LedScoresCanvasOrientation = "landscape" | "portrait";

const uuidSchema = z.string().uuid();
const colorSchema = z.string().regex(/^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/i);
const layerIdSchema = z.string().regex(/^[a-z][a-z0-9-]{0,63}$/);
const fontWeightSchema = z.union([
  z.literal(400),
  z.literal(500),
  z.literal(600),
  z.literal(700),
  z.literal(800),
  z.literal(900)
]);

const layerBase = {
  animation: z.enum(["none", "fade", "rise", "zoom", "wipe"]).default("none"),
  height: z.number().min(8).max(3_840),
  id: layerIdSchema,
  locked: z.boolean().default(false),
  name: z.string().trim().min(1).max(80),
  opacity: z.number().min(0).max(1).default(1),
  rotation: z.number().min(-180).max(180).default(0),
  visible: z.boolean().default(true),
  width: z.number().min(8).max(3_840),
  x: z.number().min(-1_920).max(3_840),
  y: z.number().min(-1_920).max(3_840),
  zIndex: z.number().int().min(0).max(ledScoresCanvasMaximumLayers - 1)
};

const textLayerSchema = z.strictObject({
  ...layerBase,
  align: z.enum(["left", "center", "right"]).default("left"),
  backgroundColor: colorSchema.nullable().default(null),
  binding: z.enum(ledScoresCanvasTextBindings).nullable().default(null),
  cornerRadius: z.number().min(0).max(240).default(0),
  fill: colorSchema,
  fontFamily: z.enum(["Inter", "Inter Tight"]),
  fontSize: z.number().min(16).max(360),
  fontWeight: fontWeightSchema,
  letterSpacing: z.number().min(-10).max(40).default(0),
  lineHeight: z.number().min(0.8).max(2).default(1),
  padding: z.number().min(0).max(160).default(0),
  text: z.string().max(240),
  type: z.literal("text"),
  verticalAlign: z.enum(["top", "middle", "bottom"]).default("middle")
}).superRefine((layer, context) => {
  if (!layer.binding && !layer.text.trim()) {
    context.addIssue({
      code: "custom",
      message: "Een tekstlaag heeft tekst of een databinding nodig.",
      path: ["text"]
    });
  }
});

const imageLayerSchema = z.strictObject({
  ...layerBase,
  binding: z.enum(ledScoresCanvasImageBindings).nullable().default(null),
  cornerRadius: z.number().min(0).max(960).default(0),
  focusX: z.number().min(0).max(1).default(0.5),
  focusY: z.number().min(0).max(1).default(0.5),
  mediaAssetId: uuidSchema.nullable().default(null),
  objectFit: z.enum(["cover", "contain"]).default("cover"),
  type: z.literal("image")
}).superRefine((layer, context) => {
  if (!layer.binding && !layer.mediaAssetId) {
    context.addIssue({
      code: "custom",
      message: "Een beeldlaag heeft media of een databinding nodig.",
      path: ["mediaAssetId"]
    });
  }
  if (layer.binding && layer.mediaAssetId) {
    context.addIssue({
      code: "custom",
      message: "Een beeldlaag gebruikt één bron: media of een databinding.",
      path: ["binding"]
    });
  }
});

const shapeLayerSchema = z.strictObject({
  ...layerBase,
  cornerRadius: z.number().min(0).max(960).default(0),
  fill: colorSchema,
  shape: z.enum(["rectangle", "ellipse", "line"]),
  stroke: colorSchema.nullable().default(null),
  strokeWidth: z.number().min(0).max(32).default(0),
  type: z.literal("shape")
});

const lineupLayerSchema = z.strictObject({
  ...layerBase,
  accentColor: colorSchema,
  cardColor: colorSchema,
  columns: z.number().int().min(1).max(6),
  gap: z.number().min(0).max(96).default(24),
  showName: z.boolean().default(true),
  showNumber: z.boolean().default(true),
  showPhoto: z.boolean().default(true),
  textColor: colorSchema,
  type: z.literal("lineup")
});

export const ledScoresCanvasLayerSchema = z.discriminatedUnion("type", [
  textLayerSchema,
  imageLayerSchema,
  shapeLayerSchema,
  lineupLayerSchema
]);

const backgroundSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    color: colorSchema,
    kind: z.literal("solid")
  }),
  z.strictObject({
    angle: z.number().min(0).max(360),
    from: colorSchema,
    kind: z.literal("gradient"),
    to: colorSchema
  }),
  z.strictObject({
    focusX: z.number().min(0).max(1).default(0.5),
    focusY: z.number().min(0).max(1).default(0.5),
    kind: z.literal("media"),
    mediaAssetId: uuidSchema,
    objectFit: z.enum(["cover", "contain"]).default("cover"),
    overlayColor: colorSchema.default("#0a0a0a"),
    overlayOpacity: z.number().min(0).max(1).default(0)
  })
]);

export const ledScoresCanvasSceneSchema = z.strictObject({
  background: backgroundSchema,
  layers: z.array(ledScoresCanvasLayerSchema).max(ledScoresCanvasMaximumLayers),
  orientation: z.enum(["landscape", "portrait"])
}).superRefine((scene, context) => {
  const ids = new Set<string>();
  const zIndexes = new Set<number>();
  const canvasWidth = scene.orientation === "landscape" ? 1_920 : 1_080;
  const canvasHeight = scene.orientation === "landscape" ? 1_080 : 1_920;
  for (const [index, layer] of scene.layers.entries()) {
    if (ids.has(layer.id)) {
      context.addIssue({
        code: "custom",
        message: `Laag-ID ${layer.id} komt meer dan één keer voor.`,
        path: ["layers", index, "id"]
      });
    }
    if (zIndexes.has(layer.zIndex)) {
      context.addIssue({
        code: "custom",
        message: `Laagpositie ${layer.zIndex} komt meer dan één keer voor.`,
        path: ["layers", index, "zIndex"]
      });
    }
    ids.add(layer.id);
    zIndexes.add(layer.zIndex);
    if (
      layer.x < -canvasWidth || layer.x > canvasWidth * 2 ||
      layer.y < -canvasHeight || layer.y > canvasHeight * 2
    ) {
      context.addIssue({
        code: "custom",
        message: "De laag staat te ver buiten het canvas.",
        path: ["layers", index]
      });
    }
  }
});

const pairedSceneSchema = z.strictObject({
  landscape: ledScoresCanvasSceneSchema,
  portrait: ledScoresCanvasSceneSchema
}).superRefine((pair, context) => {
  if (pair.landscape.orientation !== "landscape") {
    context.addIssue({ code: "custom", message: "De liggende compositie heeft de verkeerde schermstand.", path: ["landscape", "orientation"] });
  }
  if (pair.portrait.orientation !== "portrait") {
    context.addIssue({ code: "custom", message: "De staande compositie heeft de verkeerde schermstand.", path: ["portrait", "orientation"] });
  }
});

const sceneRecordShape = Object.fromEntries(
  ledScoresCanvasMomentKeys.map((key) => [key, pairedSceneSchema])
) as Record<LedScoresCanvasMomentKey, typeof pairedSceneSchema>;

export const ledScoresCanvasExperienceSchema = z.strictObject({
  scenes: z.strictObject(sceneRecordShape),
  schemaVersion: z.literal(ledScoresCanvasSchemaVersion)
});

export type LedScoresCanvasLayer = z.infer<typeof ledScoresCanvasLayerSchema>;
export type LedScoresCanvasScene = z.infer<typeof ledScoresCanvasSceneSchema>;
export type LedScoresCanvasExperience = z.infer<
  typeof ledScoresCanvasExperienceSchema
>;
export type LedScoresCanvasTextValues = Partial<
  Record<LedScoresCanvasTextBinding, string>
>;
export type LedScoresCanvasImageValues = Partial<
  Record<LedScoresCanvasImageBinding, string | null>
>;
export type LedScoresCanvasLineupPlayer = Readonly<{
  id: string | null;
  name: string;
  number: string | null;
  photoUrl: string | null;
}>;
export type LedScoresCanvasValues = Readonly<{
  images: LedScoresCanvasImageValues;
  lineup: readonly LedScoresCanvasLineupPlayer[];
  media?: Readonly<Record<string, string>>;
  text: LedScoresCanvasTextValues;
}>;

export type LedScoresCanvasRenderLayer =
  | (Extract<LedScoresCanvasLayer, { type: "text" }> & {
      resolvedText: string;
    })
  | (Extract<LedScoresCanvasLayer, { type: "image" }> & {
      resolvedUrl: string | null;
    })
  | Extract<LedScoresCanvasLayer, { type: "shape" }>
  | (Extract<LedScoresCanvasLayer, { type: "lineup" }> & {
      players: readonly LedScoresCanvasLineupPlayer[];
    });

export function parseLedScoresCanvasExperience(input: unknown) {
  return ledScoresCanvasExperienceSchema.parse(input);
}

export function safeParseLedScoresCanvasExperience(input: unknown) {
  return ledScoresCanvasExperienceSchema.safeParse(input);
}

export function compileLedScoresCanvasScene(
  scene: LedScoresCanvasScene,
  values: LedScoresCanvasValues
): LedScoresCanvasRenderLayer[] {
  return scene.layers
    .filter((layer) => layer.visible)
    .sort((left, right) => left.zIndex - right.zIndex || left.id.localeCompare(right.id))
    .map((layer) => {
      if (layer.type === "text") {
        return {
          ...layer,
          resolvedText: layer.binding
            ? values.text[layer.binding] ?? layer.text
            : layer.text
        };
      }
      if (layer.type === "image") {
        return {
          ...layer,
          resolvedUrl: layer.binding
            ? values.images[layer.binding] ?? null
            : layer.mediaAssetId
              ? values.media?.[layer.mediaAssetId] ?? null
              : null
        };
      }
      if (layer.type === "lineup") {
        return { ...layer, players: values.lineup.slice(0, 24) };
      }
      return layer;
    });
}

export function ledScoresCanvasAssetIds(
  experience: LedScoresCanvasExperience
) {
  const ids = new Set<string>();
  for (const key of ledScoresCanvasMomentKeys) {
    for (const orientation of ["landscape", "portrait"] as const) {
      const scene = experience.scenes[key][orientation];
      if (scene.background.kind === "media") {
        ids.add(scene.background.mediaAssetId);
      }
      for (const layer of scene.layers) {
        if (layer.type === "image" && layer.mediaAssetId) {
          ids.add(layer.mediaAssetId);
        }
      }
    }
  }
  return [...ids].sort();
}

export function ledScoresCanvasDimensions(orientation: LedScoresCanvasOrientation) {
  return orientation === "landscape"
    ? { height: 1_080, width: 1_920 }
    : { height: 1_920, width: 1_080 };
}

export function createDefaultLedScoresCanvasExperience(): LedScoresCanvasExperience {
  return parseLedScoresCanvasExperience({
    scenes: {
      goalOwn: goalScenePair("#ff5c20", "#0a0a0a", "DOELPUNT", "GOAAAL!"),
      goalOpponent: goalScenePair("#c7322b", "#fafaf7", "TEGENDOELPUNT", "Tegendoelpunt"),
      goalUnknown: goalScenePair("#315cff", "#fafaf7", "DOELPUNT", "Doelpunt"),
      lineupHome: lineupScenePair("#ff5c20", "Onze opstelling"),
      lineupAway: lineupScenePair("#315cff", "Opstelling bezoekers"),
      matchStart: matchMomentScenePair("#ff5c20", "De wedstrijd begint", "Samen voor de winst"),
      halfTime: matchMomentScenePair("#315cff", "Rust", "Even op adem komen"),
      matchEnd: matchMomentScenePair("#ff5c20", "Einde wedstrijd", "Bedankt voor jullie support")
    },
    schemaVersion: ledScoresCanvasSchemaVersion
  });
}

export function copyLedScoresCanvasSceneToOrientation(
  scene: LedScoresCanvasScene,
  orientation: LedScoresCanvasOrientation
) {
  if (scene.orientation === orientation) {
    return ledScoresCanvasSceneSchema.parse(JSON.parse(JSON.stringify(scene)));
  }
  const source = ledScoresCanvasDimensions(scene.orientation);
  const target = ledScoresCanvasDimensions(orientation);
  const xScale = target.width / source.width;
  const yScale = target.height / source.height;
  const fontScale = Math.sqrt(xScale * yScale);
  return ledScoresCanvasSceneSchema.parse({
    ...scene,
    layers: scene.layers.map((layer) => ({
      ...layer,
      ...(layer.type === "text"
        ? { fontSize: clamp(layer.fontSize * fontScale, 16, 360) }
        : {}),
      ...(layer.type === "lineup" && orientation === "portrait"
        ? { columns: Math.min(layer.columns, 2) }
        : {}),
      height: clamp(layer.height * yScale, 8, target.height),
      width: clamp(layer.width * xScale, 8, target.width),
      x: clamp(layer.x * xScale, 0, target.width - 8),
      y: clamp(layer.y * yScale, 0, target.height - 8)
    })),
    orientation
  });
}

function goalScenePair(
  accent: string,
  foreground: string,
  eventLabel: string,
  headline: string
) {
  return {
    landscape: scene("landscape", accent, [
      shape("accent-panel", "Accentvlak", 0, 0, 720, 1_080, 0, accent),
      text("goal-label", "Moment", 96, 88, 560, 84, 1, "eventLabel", eventLabel, 38, foreground, 800),
      text("goal-headline", "Hoofdtekst", 96, 184, 760, 226, 2, "headline", headline, 136, foreground, 900),
      text("score", "Stand", 96, 430, 660, 220, 3, "score", "4 – 2", 184, foreground, 900),
      text("scorer-name", "Spelernaam", 96, 700, 760, 100, 4, "scorerName", "D. Jansen", 64, foreground, 800),
      text("scorer-number", "Rugnummer", 96, 808, 420, 70, 5, "scorerNumber", "#9", 42, foreground, 700),
      image("scorer-photo", "Spelersfoto", 1_010, 84, 780, 912, 6, "scorerPhoto")
    ]),
    portrait: scene("portrait", accent, [
      shape("accent-panel", "Accentvlak", 0, 0, 1_080, 760, 0, accent),
      text("goal-label", "Moment", 72, 76, 936, 72, 1, "eventLabel", eventLabel, 34, foreground, 800),
      text("goal-headline", "Hoofdtekst", 72, 160, 936, 210, 2, "headline", headline, 112, foreground, 900),
      text("score", "Stand", 72, 390, 936, 230, 3, "score", "4 – 2", 176, foreground, 900),
      image("scorer-photo", "Spelersfoto", 72, 820, 936, 720, 4, "scorerPhoto"),
      text("scorer-name", "Spelernaam", 72, 1_574, 936, 104, 5, "scorerName", "D. Jansen", 68, "#fafaf7", 800),
      text("scorer-number", "Rugnummer", 72, 1_690, 936, 70, 6, "scorerNumber", "#9", 44, "#ff5c20", 700)
    ])
  };
}

function lineupScenePair(accent: string, headline: string) {
  return {
    landscape: scene("landscape", "#0a0a0a", [
      shape("header-panel", "Kopvlak", 0, 0, 1_920, 244, 0, "#151719"),
      text("lineup-label", "Teamsoort", 72, 44, 420, 54, 1, "eventLabel", "THUISTEAM", 28, accent, 800),
      text("lineup-headline", "Titel", 72, 98, 1_120, 104, 2, "headline", headline, 72, "#fafaf7", 900),
      text("lineup-team", "Teamnaam", 1_270, 98, 570, 96, 3, "scoringTeam", "Duindorp SV", 44, "#fafaf7", 700, "right"),
      lineup("lineup-grid", 72, 286, 1_776, 706, 4, accent, 4)
    ]),
    portrait: scene("portrait", "#0a0a0a", [
      shape("header-panel", "Kopvlak", 0, 0, 1_080, 340, 0, "#151719"),
      text("lineup-label", "Teamsoort", 56, 54, 968, 54, 1, "eventLabel", "THUISTEAM", 28, accent, 800),
      text("lineup-headline", "Titel", 56, 116, 968, 116, 2, "headline", headline, 68, "#fafaf7", 900),
      text("lineup-team", "Teamnaam", 56, 242, 968, 64, 3, "scoringTeam", "Duindorp SV", 34, "#fafaf7", 700),
      lineup("lineup-grid", 56, 390, 968, 1_390, 4, accent, 2)
    ])
  };
}

function matchMomentScenePair(
  accent: string,
  headline: string,
  secondaryText: string
) {
  return {
    landscape: scene("landscape", "#0a0a0a", [
      shape("accent-bar", "Accentlijn", 0, 0, 1_920, 20, 0, accent),
      text("period", "Wedstrijdmoment", 120, 110, 1_680, 64, 1, "period", "WEDSTRIJD", 30, accent, 800, "center"),
      text("headline", "Titel", 120, 194, 1_680, 160, 2, "headline", headline, 104, "#fafaf7", 900, "center"),
      text("home-team", "Thuisteam", 120, 500, 590, 110, 3, "homeTeam", "Duindorp SV", 50, "#fafaf7", 800, "center"),
      text("score", "Stand", 710, 430, 500, 210, 4, "score", "0 – 0", 156, "#fafaf7", 900, "center"),
      text("away-team", "Uitteam", 1_210, 500, 590, 110, 5, "awayTeam", "Bezoekers", 50, "#fafaf7", 800, "center"),
      text("clock", "Wedstrijdklok", 650, 714, 620, 100, 6, "clock", "00:00", 62, accent, 800, "center"),
      text("secondary", "Subtekst", 360, 860, 1_200, 74, 7, "secondaryText", secondaryText, 34, "#fafaf7", 500, "center")
    ]),
    portrait: scene("portrait", "#0a0a0a", [
      shape("accent-bar", "Accentlijn", 0, 0, 1_080, 22, 0, accent),
      text("period", "Wedstrijdmoment", 72, 132, 936, 64, 1, "period", "WEDSTRIJD", 30, accent, 800, "center"),
      text("headline", "Titel", 72, 226, 936, 240, 2, "headline", headline, 88, "#fafaf7", 900, "center"),
      text("home-team", "Thuisteam", 72, 616, 936, 96, 3, "homeTeam", "Duindorp SV", 48, "#fafaf7", 800, "center"),
      text("score", "Stand", 72, 760, 936, 260, 4, "score", "0 – 0", 168, "#fafaf7", 900, "center"),
      text("away-team", "Uitteam", 72, 1_070, 936, 96, 5, "awayTeam", "Bezoekers", 48, "#fafaf7", 800, "center"),
      text("clock", "Wedstrijdklok", 72, 1_300, 936, 110, 6, "clock", "00:00", 68, accent, 800, "center"),
      text("secondary", "Subtekst", 72, 1_516, 936, 150, 7, "secondaryText", secondaryText, 38, "#fafaf7", 500, "center")
    ])
  };
}

function scene(
  orientation: LedScoresCanvasOrientation,
  backgroundColor: string,
  layers: LedScoresCanvasLayer[]
): LedScoresCanvasScene {
  return {
    background: { color: backgroundColor, kind: "solid" },
    layers,
    orientation
  };
}

function text(
  id: string,
  name: string,
  x: number,
  y: number,
  width: number,
  height: number,
  zIndex: number,
  binding: LedScoresCanvasTextBinding,
  fallback: string,
  fontSize: number,
  fill: string,
  fontWeight: 400 | 500 | 600 | 700 | 800 | 900,
  align: "left" | "center" | "right" = "left"
): LedScoresCanvasLayer {
  return {
    align,
    animation: zIndex <= 1 ? "fade" : "rise",
    backgroundColor: null,
    binding,
    cornerRadius: 0,
    fill,
    fontFamily: "Inter Tight",
    fontSize,
    fontWeight,
    height,
    id,
    letterSpacing: 0,
    lineHeight: 1,
    locked: false,
    name,
    opacity: 1,
    padding: 0,
    rotation: 0,
    text: fallback,
    type: "text",
    verticalAlign: "middle",
    visible: true,
    width,
    x,
    y,
    zIndex
  };
}

function image(
  id: string,
  name: string,
  x: number,
  y: number,
  width: number,
  height: number,
  zIndex: number,
  binding: LedScoresCanvasImageBinding
): LedScoresCanvasLayer {
  return {
    animation: "zoom",
    binding,
    cornerRadius: 40,
    focusX: 0.5,
    focusY: 0.3,
    height,
    id,
    locked: false,
    mediaAssetId: null,
    name,
    objectFit: "cover",
    opacity: 1,
    rotation: 0,
    type: "image",
    visible: true,
    width,
    x,
    y,
    zIndex
  };
}

function shape(
  id: string,
  name: string,
  x: number,
  y: number,
  width: number,
  height: number,
  zIndex: number,
  fill: string
): LedScoresCanvasLayer {
  return {
    animation: "wipe",
    cornerRadius: 0,
    fill,
    height,
    id,
    locked: false,
    name,
    opacity: 1,
    rotation: 0,
    shape: "rectangle",
    stroke: null,
    strokeWidth: 0,
    type: "shape",
    visible: true,
    width,
    x,
    y,
    zIndex
  };
}

function lineup(
  id: string,
  x: number,
  y: number,
  width: number,
  height: number,
  zIndex: number,
  accentColor: string,
  columns: number
): LedScoresCanvasLayer {
  return {
    accentColor,
    animation: "rise",
    cardColor: "#151719e6",
    columns,
    gap: 20,
    height,
    id,
    locked: false,
    name: "Opstellingsraster",
    opacity: 1,
    rotation: 0,
    showName: true,
    showNumber: true,
    showPhoto: true,
    textColor: "#fafaf7",
    type: "lineup",
    visible: true,
    width,
    x,
    y,
    zIndex
  };
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, Math.round(value * 100) / 100));
}
