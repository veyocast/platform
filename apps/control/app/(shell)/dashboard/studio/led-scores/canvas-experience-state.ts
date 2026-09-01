import {
  copyLedScoresCanvasSceneToOrientation,
  ledScoresCanvasExperienceSchema,
  ledScoresCanvasMaximumLayers,
  type LedScoresCanvasExperience,
  type LedScoresCanvasImageBinding,
  type LedScoresCanvasLayer,
  type LedScoresCanvasMomentKey,
  type LedScoresCanvasOrientation,
  type LedScoresCanvasScene,
  type LedScoresCanvasTextBinding,
  type LedScoresCanvasTextValues
} from "@veyocast/contracts";

const historyLimit = 50;

const basePreviewText: Required<LedScoresCanvasTextValues> = {
  awayScore: "2",
  awayTeam: "Bezoekers",
  clock: "38:24",
  eventLabel: "DOELPUNT",
  headline: "GOOOAAAL!",
  homeScore: "4",
  homeTeam: "Duindorp SV",
  period: "EERSTE HELFT",
  previousScore: "3 – 2",
  score: "4 – 2",
  scorerName: "D. Jansen",
  scorerNumber: "#9",
  scoringTeam: "Duindorp SV",
  secondaryText: "Voor de club"
};

export function ledScoresCanvasPreviewText(
  moment: LedScoresCanvasMomentKey
): Required<LedScoresCanvasTextValues> {
  if (moment === "goalOpponent") {
    return { ...basePreviewText, eventLabel: "TEGENDOELPUNT", headline: "Tegendoelpunt", scoringTeam: "Bezoekers" };
  }
  if (moment === "goalUnknown") {
    return { ...basePreviewText, headline: "Doelpunt" };
  }
  if (moment === "lineupHome") {
    return { ...basePreviewText, eventLabel: "THUISTEAM", headline: "Onze opstelling", score: "0 – 0" };
  }
  if (moment === "lineupAway") {
    return { ...basePreviewText, eventLabel: "UITTEAM", headline: "Opstelling bezoekers", score: "0 – 0", scoringTeam: "Bezoekers" };
  }
  if (moment === "matchStart") {
    return { ...basePreviewText, awayScore: "0", clock: "00:00", eventLabel: "AFTRAP", headline: "De wedstrijd begint", homeScore: "0", period: "VOOR DE WEDSTRIJD", previousScore: "0 – 0", score: "0 – 0", secondaryText: "Samen voor de winst" };
  }
  if (moment === "halfTime") {
    return { ...basePreviewText, clock: "45:00", eventLabel: "RUST", headline: "Rust", period: "RUST", secondaryText: "Even op adem komen" };
  }
  if (moment === "matchEnd") {
    return { ...basePreviewText, clock: "90:00", eventLabel: "EINDSTAND", headline: "Einde wedstrijd", period: "AFGELOPEN", secondaryText: "Bedankt voor jullie support" };
  }
  return { ...basePreviewText };
}

export type LedScoresCanvasEditorState = {
  changeRevision: number;
  experience: LedScoresCanvasExperience;
  future: LedScoresCanvasExperience[];
  past: LedScoresCanvasExperience[];
  selectedLayerId: string | null;
};

export type LedScoresCanvasEditorAction =
  | { experience: LedScoresCanvasExperience; type: "sync" }
  | { layerId: string | null; type: "select" }
  | {
      moment: LedScoresCanvasMomentKey;
      orientation: LedScoresCanvasOrientation;
      scene: LedScoresCanvasScene;
      selectedLayerId?: string | null;
      type: "replace-scene";
    }
  | {
      layer: LedScoresCanvasLayer;
      moment: LedScoresCanvasMomentKey;
      orientation: LedScoresCanvasOrientation;
      type: "add-layer";
    }
  | {
      layerId: string;
      moment: LedScoresCanvasMomentKey;
      orientation: LedScoresCanvasOrientation;
      patch: Partial<LedScoresCanvasLayer>;
      type: "update-layer";
    }
  | {
      layerId: string;
      moment: LedScoresCanvasMomentKey;
      orientation: LedScoresCanvasOrientation;
      type: "remove-layer";
    }
  | {
      layerId: string;
      moment: LedScoresCanvasMomentKey;
      orientation: LedScoresCanvasOrientation;
      toIndex: number;
      type: "move-layer";
    }
  | {
      from: LedScoresCanvasOrientation;
      moment: LedScoresCanvasMomentKey;
      to: LedScoresCanvasOrientation;
      type: "copy-orientation";
    }
  | { type: "undo" }
  | { type: "redo" };

export function createLedScoresCanvasEditorState(
  experience: LedScoresCanvasExperience
): LedScoresCanvasEditorState {
  return {
    changeRevision: 0,
    experience: ledScoresCanvasExperienceSchema.parse(experience),
    future: [],
    past: [],
    selectedLayerId: null
  };
}

export function ledScoresCanvasEditorReducer(
  state: LedScoresCanvasEditorState,
  action: LedScoresCanvasEditorAction
): LedScoresCanvasEditorState {
  if (action.type === "sync") {
    const parsed = ledScoresCanvasExperienceSchema.safeParse(action.experience);
    if (!parsed.success) return state;
    return {
      ...state,
      experience: parsed.data,
      future: [],
      past: [],
      selectedLayerId: selectedLayerExists(parsed.data, state.selectedLayerId)
        ? state.selectedLayerId
        : null
    };
  }
  if (action.type === "select") {
    return { ...state, selectedLayerId: action.layerId };
  }
  if (action.type === "undo") {
    const previous = state.past.at(-1);
    if (!previous) return state;
    return {
      ...state,
      changeRevision: state.changeRevision + 1,
      experience: previous,
      future: [state.experience, ...state.future].slice(0, historyLimit),
      past: state.past.slice(0, -1),
      selectedLayerId: selectedLayerExists(previous, state.selectedLayerId)
        ? state.selectedLayerId
        : null
    };
  }
  if (action.type === "redo") {
    const [next, ...future] = state.future;
    if (!next) return state;
    return {
      ...state,
      changeRevision: state.changeRevision + 1,
      experience: next,
      future,
      past: [...state.past, state.experience].slice(-historyLimit),
      selectedLayerId: selectedLayerExists(next, state.selectedLayerId)
        ? state.selectedLayerId
        : null
    };
  }

  if (action.type === "copy-orientation") {
    const source = sceneAt(state.experience, action.moment, action.from);
    const copied = copyLedScoresCanvasSceneToOrientation(source, action.to);
    return commitScene(state, action.moment, action.to, copied, null);
  }

  const currentScene = sceneAt(state.experience, action.moment, action.orientation);
  if (action.type === "replace-scene") {
    return commitScene(
      state,
      action.moment,
      action.orientation,
      action.scene,
      action.selectedLayerId === undefined
        ? state.selectedLayerId
        : action.selectedLayerId
    );
  }
  if (action.type === "add-layer") {
    if (currentScene.layers.length >= ledScoresCanvasMaximumLayers) return state;
    const layer = { ...action.layer, zIndex: currentScene.layers.length };
    return commitScene(
      state,
      action.moment,
      action.orientation,
      { ...currentScene, layers: [...currentScene.layers, layer] },
      layer.id
    );
  }
  if (action.type === "update-layer") {
    const layers = currentScene.layers.map((layer) =>
      layer.id === action.layerId
        ? ({ ...layer, ...action.patch, id: layer.id, type: layer.type } as LedScoresCanvasLayer)
        : layer
    );
    return commitScene(
      state,
      action.moment,
      action.orientation,
      { ...currentScene, layers },
      action.layerId
    );
  }
  if (action.type === "remove-layer") {
    const layers = normalizeZIndexes(
      currentScene.layers.filter((layer) => layer.id !== action.layerId)
    );
    return commitScene(
      state,
      action.moment,
      action.orientation,
      { ...currentScene, layers },
      state.selectedLayerId === action.layerId ? null : state.selectedLayerId
    );
  }

  const ordered = [...currentScene.layers].sort(byZIndex);
  const fromIndex = ordered.findIndex((layer) => layer.id === action.layerId);
  if (fromIndex < 0) return state;
  const [moved] = ordered.splice(fromIndex, 1);
  if (!moved) return state;
  const toIndex = clamp(Math.round(action.toIndex), 0, ordered.length);
  ordered.splice(toIndex, 0, moved);
  return commitScene(
    state,
    action.moment,
    action.orientation,
    { ...currentScene, layers: normalizeZIndexes(ordered) },
    action.layerId
  );
}

export function sceneAt(
  experience: LedScoresCanvasExperience,
  moment: LedScoresCanvasMomentKey,
  orientation: LedScoresCanvasOrientation
) {
  return experience.scenes[moment][orientation];
}

export function createTextLayer(
  scene: LedScoresCanvasScene,
  binding: LedScoresCanvasTextBinding | null = null
): LedScoresCanvasLayer {
  const dimensions = sceneDimensions(scene.orientation);
  const width = Math.round(dimensions.width * 0.56);
  const height = Math.round(dimensions.height * 0.13);
  return {
    align: "left",
    animation: "rise",
    backgroundColor: null,
    binding,
    cornerRadius: 0,
    fill: "#fafaf7",
    fontFamily: "Inter Tight",
    fontSize: scene.orientation === "landscape" ? 72 : 64,
    fontWeight: 800,
    height,
    id: uniqueLayerId(scene, binding ?? "tekst"),
    letterSpacing: 0,
    lineHeight: 1,
    locked: false,
    name: binding ? "Dynamische tekst" : "Tekst",
    opacity: 1,
    padding: 0,
    rotation: 0,
    text: binding ? fallbackForTextBinding(binding) : "Nieuwe tekst",
    type: "text",
    verticalAlign: "middle",
    visible: true,
    width,
    x: Math.round((dimensions.width - width) / 2),
    y: Math.round((dimensions.height - height) / 2),
    zIndex: scene.layers.length
  };
}

export function createImageLayer(
  scene: LedScoresCanvasScene,
  source:
    | { binding: LedScoresCanvasImageBinding; mediaAssetId?: never }
    | { binding?: never; mediaAssetId: string }
): LedScoresCanvasLayer {
  const dimensions = sceneDimensions(scene.orientation);
  const width = Math.round(dimensions.width * (scene.orientation === "landscape" ? 0.34 : 0.7));
  const height = Math.round(dimensions.height * 0.52);
  const binding = "binding" in source ? source.binding ?? null : null;
  const mediaAssetId = "mediaAssetId" in source && typeof source.mediaAssetId === "string"
    ? source.mediaAssetId
    : null;
  return {
    animation: "zoom",
    binding,
    cornerRadius: 32,
    focusX: 0.5,
    focusY: 0.35,
    height,
    id: uniqueLayerId(scene, binding ?? "media"),
    locked: false,
    mediaAssetId,
    name: binding ? "Dynamisch beeld" : "Afbeelding",
    objectFit: "cover",
    opacity: 1,
    rotation: 0,
    type: "image",
    visible: true,
    width,
    x: Math.round((dimensions.width - width) / 2),
    y: Math.round((dimensions.height - height) / 2),
    zIndex: scene.layers.length
  };
}

export function createShapeLayer(scene: LedScoresCanvasScene): LedScoresCanvasLayer {
  const dimensions = sceneDimensions(scene.orientation);
  const width = Math.round(dimensions.width * 0.48);
  const height = Math.round(dimensions.height * 0.3);
  return {
    animation: "wipe",
    cornerRadius: 32,
    fill: "#ff5c20",
    height,
    id: uniqueLayerId(scene, "vorm"),
    locked: false,
    name: "Vorm",
    opacity: 1,
    rotation: 0,
    shape: "rectangle",
    stroke: null,
    strokeWidth: 0,
    type: "shape",
    visible: true,
    width,
    x: Math.round((dimensions.width - width) / 2),
    y: Math.round((dimensions.height - height) / 2),
    zIndex: scene.layers.length
  };
}

export function createLineupLayer(scene: LedScoresCanvasScene): LedScoresCanvasLayer {
  const dimensions = sceneDimensions(scene.orientation);
  const inset = Math.round(dimensions.width * 0.06);
  return {
    accentColor: "#ff5c20",
    animation: "rise",
    cardColor: "#151719e6",
    columns: scene.orientation === "landscape" ? 4 : 2,
    gap: 20,
    height: Math.round(dimensions.height * 0.68),
    id: uniqueLayerId(scene, "opstelling"),
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
    width: dimensions.width - inset * 2,
    x: inset,
    y: Math.round(dimensions.height * 0.23),
    zIndex: scene.layers.length
  };
}

export function clampLayerRect(
  scene: LedScoresCanvasScene,
  rect: Pick<LedScoresCanvasLayer, "height" | "width" | "x" | "y">
) {
  const dimensions = sceneDimensions(scene.orientation);
  const width = clamp(round(rect.width), 8, Math.min(3_840, dimensions.width * 2));
  const height = clamp(round(rect.height), 8, Math.min(3_840, dimensions.height * 2));
  return {
    height,
    width,
    x: clamp(round(rect.x), -dimensions.width, dimensions.width * 2),
    y: clamp(round(rect.y), -dimensions.height, dimensions.height * 2)
  };
}

function commitScene(
  state: LedScoresCanvasEditorState,
  moment: LedScoresCanvasMomentKey,
  orientation: LedScoresCanvasOrientation,
  scene: LedScoresCanvasScene,
  selectedLayerId: string | null
) {
  const candidate = {
    ...state.experience,
    scenes: {
      ...state.experience.scenes,
      [moment]: {
        ...state.experience.scenes[moment],
        [orientation]: scene
      }
    }
  };
  const parsed = ledScoresCanvasExperienceSchema.safeParse(candidate);
  if (!parsed.success) return state;
  return {
    ...state,
    changeRevision: state.changeRevision + 1,
    experience: parsed.data,
    future: [],
    past: [...state.past, state.experience].slice(-historyLimit),
    selectedLayerId
  };
}

function selectedLayerExists(
  experience: LedScoresCanvasExperience,
  selectedLayerId: string | null
) {
  if (!selectedLayerId) return false;
  return Object.values(experience.scenes).some((pair) =>
    pair.landscape.layers.some((layer) => layer.id === selectedLayerId) ||
    pair.portrait.layers.some((layer) => layer.id === selectedLayerId)
  );
}

function normalizeZIndexes(layers: LedScoresCanvasLayer[]) {
  return layers.map((layer, zIndex) => ({ ...layer, zIndex }));
}

function byZIndex(left: LedScoresCanvasLayer, right: LedScoresCanvasLayer) {
  return left.zIndex - right.zIndex || left.id.localeCompare(right.id);
}

function uniqueLayerId(scene: LedScoresCanvasScene, seed: string) {
  const base = seed
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 54) || "laag";
  const safeBase = /^[a-z]/.test(base) ? base : `laag-${base}`;
  const ids = new Set(scene.layers.map((layer) => layer.id));
  if (!ids.has(safeBase)) return safeBase;
  let suffix = 2;
  while (ids.has(`${safeBase}-${suffix}`)) suffix += 1;
  return `${safeBase}-${suffix}`;
}

function fallbackForTextBinding(binding: LedScoresCanvasTextBinding) {
  return ({
    awayScore: "2",
    awayTeam: "Bezoekers",
    clock: "38:24",
    eventLabel: "DOELPUNT",
    headline: "GOOOAAAL!",
    homeScore: "4",
    homeTeam: "Duindorp SV",
    period: "EERSTE HELFT",
    previousScore: "3 – 2",
    score: "4 – 2",
    scorerName: "D. Jansen",
    scorerNumber: "#9",
    scoringTeam: "Duindorp SV",
    secondaryText: "Voor de club"
  } satisfies Record<LedScoresCanvasTextBinding, string>)[binding];
}

function sceneDimensions(orientation: LedScoresCanvasOrientation) {
  return orientation === "landscape"
    ? { height: 1_080, width: 1_920 }
    : { height: 1_920, width: 1_080 };
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}
