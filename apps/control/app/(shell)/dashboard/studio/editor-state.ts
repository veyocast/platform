import {
  moveStudioElement,
  normalizeStudioElementOrder,
  parseStudioDocument,
  removeStudioElements,
  type StudioDocument,
  type StudioElement,
  type StudioElementTiming
} from "@veyocast/studio";

export type StudioSaveState =
  | "conflict"
  | "dirty"
  | "error"
  | "offline"
  | "saved"
  | "saving";

export type StudioEditorState = {
  document: StudioDocument;
  draftRevision: number;
  future: StudioDocument[];
  looping: boolean;
  past: StudioDocument[];
  playing: boolean;
  playheadMs: number;
  saveState: StudioSaveState;
  selectedIds: string[];
  zoom: number;
};

export type StudioEditorAction =
  | { element: StudioElement; type: "element/add" }
  | {
      elementId: string;
      patch: Partial<StudioElement>;
      type: "element/update";
    }
  | {
      element: StudioElement;
      elementId: string;
      type: "element/replace";
    }
  | { elementId: string; targetIndex: number; type: "element/move" }
  | { elementIds: string[]; type: "element/remove" }
  | { elementId: string; type: "element/duplicate" }
  | {
      deltaX: number;
      deltaY: number;
      elementIds?: string[];
      type: "element/nudge";
    }
  | { elementId: string; type: "element/toggle-lock" }
  | { elementId: string; type: "element/toggle-visible" }
  | {
      background: StudioDocument["artboard"]["background"];
      type: "document/background";
    }
  | { durationMs: number; type: "document/duration" }
  | {
      alignment: "bottom" | "center" | "left" | "middle" | "right" | "top";
      elementIds?: string[];
      type: "selection/align";
    }
  | {
      axis: "horizontal" | "vertical";
      elementIds?: string[];
      type: "selection/distribute";
    }
  | { elementIds?: string[]; type: "selection/group" }
  | { groupId: string; type: "selection/ungroup" }
  | {
      elementId: string;
      timing: StudioElementTiming | undefined;
      type: "element/timing";
    }
  | { additive?: boolean; elementId: string | null; type: "selection/set" }
  | { elementIds: string[]; type: "selection/replace" }
  | { type: "history/redo" }
  | { type: "history/undo" }
  | { playing?: boolean; type: "playback/toggle" }
  | { looping?: boolean; type: "playback/loop" }
  | { type: "playback/reset" }
  | { playheadMs: number; type: "playback/seek" }
  | { document: StudioDocument; revision: number; type: "document/replace" }
  | { revision?: number; saveState: StudioSaveState; type: "save/state" }
  | { type: "zoom/in" }
  | { type: "zoom/out" }
  | { type: "zoom/reset" }
  | { type: "zoom/set"; zoom: number };

const historyLimit = 80;

export function createStudioEditorState(
  document: StudioDocument,
  draftRevision: number
): StudioEditorState {
  return {
    document: parseStudioDocument(document),
    draftRevision,
    future: [],
    looping: true,
    past: [],
    playing: false,
    playheadMs: 0,
    saveState: "saved",
    selectedIds: [],
    zoom: 1
  };
}

export function studioEditorReducer(
  state: StudioEditorState,
  action: StudioEditorAction
): StudioEditorState {
  switch (action.type) {
    case "selection/set": {
      if (!action.elementId) return { ...state, selectedIds: [] };
      const selectedIds = action.additive
        ? state.selectedIds.includes(action.elementId)
          ? state.selectedIds.filter((id) => id !== action.elementId)
          : [...state.selectedIds, action.elementId]
        : [action.elementId];
      return { ...state, selectedIds };
    }
    case "selection/replace":
      return {
        ...state,
        selectedIds: [
          ...new Set(
            action.elementIds.filter((id) =>
              state.document.elements.some((element) => element.id === id)
            )
          )
        ]
      };
    case "element/add":
      return commitDocument(
        state,
        parseStudioDocument({
          ...state.document,
          elements: normalizeStudioElementOrder([
            ...state.document.elements,
            action.element
          ])
        }),
        [action.element.id]
      );
    case "element/update":
      return commitDocument(
        state,
        parseStudioDocument({
          ...state.document,
          elements: state.document.elements.map((element) =>
            element.id === action.elementId
              ? { ...element, ...action.patch, id: element.id }
              : element
          )
        })
      );
    case "element/replace":
      return commitDocument(
        state,
        parseStudioDocument({
          ...state.document,
          elements: state.document.elements.map((element) =>
            element.id === action.elementId ? action.element : element
          )
        }),
        [action.element.id]
      );
    case "element/move":
      return commitDocument(
        state,
        moveStudioElement(
          state.document,
          action.elementId,
          action.targetIndex
        )
      );
    case "element/remove":
      return commitDocument(
        state,
        removeStudioElements(state.document, action.elementIds),
        state.selectedIds.filter((id) => !action.elementIds.includes(id))
      );
    case "element/duplicate": {
      const source = state.document.elements.find(
        (element) => element.id === action.elementId
      );
      if (!source || source.type === "group") return state;
      const id = uniqueElementId(
        state.document,
        `${source.id}-copy`
      );
      const duplicate = {
        ...source,
        groupId: undefined,
        id,
        locked: false,
        name: `${source.name} kopie`,
        x: source.x + 32,
        y: source.y + 32,
        zIndex: state.document.elements.length
      } as StudioElement;
      return commitDocument(
        state,
        parseStudioDocument({
          ...state.document,
          elements: [...state.document.elements, duplicate]
        }),
        [id]
      );
    }
    case "element/nudge": {
      const ids = new Set(action.elementIds ?? state.selectedIds);
      if (!ids.size) return state;
      return commitDocument(
        state,
        parseStudioDocument({
          ...state.document,
          elements: state.document.elements.map((element) =>
            ids.has(element.id) && !element.locked
              ? {
                  ...element,
                  x: element.x + action.deltaX,
                  y: element.y + action.deltaY
                }
              : element
          )
        })
      );
    }
    case "element/toggle-lock": {
      const element = state.document.elements.find(
        (candidate) => candidate.id === action.elementId
      );
      if (!element) return state;
      if (element.type === "group") {
        const childIds = new Set(element.childIds);
        return commitDocument(
          state,
          parseStudioDocument({
            ...state.document,
            elements: state.document.elements.map((candidate) =>
              candidate.id === element.id || childIds.has(candidate.id)
                ? { ...candidate, locked: !element.locked }
                : candidate
            )
          })
        );
      }
      return studioEditorReducer(state, {
        elementId: element.id,
        patch: { locked: !element.locked },
        type: "element/update"
      });
    }
    case "element/toggle-visible": {
      const element = state.document.elements.find(
        (candidate) => candidate.id === action.elementId
      );
      if (!element) return state;
      if (element.type === "group") {
        const childIds = new Set(element.childIds);
        return commitDocument(
          state,
          parseStudioDocument({
            ...state.document,
            elements: state.document.elements.map((candidate) =>
              candidate.id === element.id || childIds.has(candidate.id)
                ? { ...candidate, visible: !element.visible }
                : candidate
            )
          })
        );
      }
      return studioEditorReducer(state, {
        elementId: element.id,
        patch: { visible: !element.visible },
        type: "element/update"
      });
    }
    case "document/background":
      return commitDocument(
        state,
        parseStudioDocument({
          ...state.document,
          artboard: {
            ...state.document.artboard,
            background: action.background
          }
        })
      );
    case "document/duration": {
      const durationMs = Math.max(
        1_000,
        Math.min(30_000, Math.round(action.durationMs / 500) * 500)
      );
      return commitDocument(
        {
          ...state,
          playheadMs: Math.min(state.playheadMs, durationMs)
        },
        parseStudioDocument({
          ...state.document,
          motion: {
            ...state.document.motion,
            durationMs
          },
          elements: state.document.elements.map((element) => {
            if (!element.timing) return element;
            const endMs = Math.max(
              1,
              Math.min(element.timing.endMs, durationMs)
            );
            const startMs = Math.max(
              0,
              Math.min(element.timing.startMs, Math.max(0, endMs - 500))
            );
            return {
              ...element,
              timing: { ...element.timing, endMs, startMs }
            };
          })
        })
      );
    }
    case "selection/align": {
      const ids = new Set(action.elementIds ?? state.selectedIds);
      const elements = state.document.elements.filter(
        (element) => ids.has(element.id) && element.type !== "group"
      );
      if (elements.length < 2) return state;
      const left = Math.min(...elements.map((element) => element.x));
      const right = Math.max(
        ...elements.map((element) => element.x + element.width)
      );
      const top = Math.min(...elements.map((element) => element.y));
      const bottom = Math.max(
        ...elements.map((element) => element.y + element.height)
      );
      return commitDocument(
        state,
        parseStudioDocument({
          ...state.document,
          elements: state.document.elements.map((element) => {
            if (!ids.has(element.id) || element.type === "group" || element.locked) {
              return element;
            }
            if (action.alignment === "left") return { ...element, x: left };
            if (action.alignment === "right") {
              return { ...element, x: right - element.width };
            }
            if (action.alignment === "center") {
              return { ...element, x: left + (right - left - element.width) / 2 };
            }
            if (action.alignment === "top") return { ...element, y: top };
            if (action.alignment === "bottom") {
              return { ...element, y: bottom - element.height };
            }
            return {
              ...element,
              y: top + (bottom - top - element.height) / 2
            };
          })
        })
      );
    }
    case "selection/distribute": {
      const ids = new Set(action.elementIds ?? state.selectedIds);
      const elements = state.document.elements
        .filter((element) => ids.has(element.id) && element.type !== "group")
        .sort((left, right) =>
          action.axis === "horizontal"
            ? left.x - right.x
            : left.y - right.y
        );
      if (elements.length < 3) return state;
      const first = elements[0];
      const last = elements.at(-1);
      if (!first || !last) return state;
      const occupied = elements.reduce(
        (total, element) =>
          total + (action.axis === "horizontal" ? element.width : element.height),
        0
      );
      const span =
        action.axis === "horizontal"
          ? last.x + last.width - first.x
          : last.y + last.height - first.y;
      const gap = (span - occupied) / (elements.length - 1);
      let cursor = action.axis === "horizontal" ? first.x : first.y;
      const positions = new Map<string, number>();
      for (const element of elements) {
        positions.set(element.id, cursor);
        cursor +=
          (action.axis === "horizontal" ? element.width : element.height) + gap;
      }
      return commitDocument(
        state,
        parseStudioDocument({
          ...state.document,
          elements: state.document.elements.map((element) => {
            const position = positions.get(element.id);
            if (position === undefined || element.locked) return element;
            return action.axis === "horizontal"
              ? { ...element, x: position }
              : { ...element, y: position };
          })
        })
      );
    }
    case "selection/group": {
      const ids = new Set(action.elementIds ?? state.selectedIds);
      const children = state.document.elements.filter(
        (element) =>
          ids.has(element.id) &&
          element.type !== "group" &&
          !element.groupId
      );
      if (children.length < 2) return state;
      const id = uniqueElementId(state.document, "group");
      const left = Math.min(...children.map((element) => element.x));
      const right = Math.max(
        ...children.map((element) => element.x + element.width)
      );
      const top = Math.min(...children.map((element) => element.y));
      const bottom = Math.max(
        ...children.map((element) => element.y + element.height)
      );
      const group: StudioElement = {
        childIds: children.map((element) => element.id),
        height: bottom - top,
        id,
        locked: false,
        name: "Groep",
        opacity: 1,
        rotation: 0,
        type: "group",
        visible: true,
        width: right - left,
        x: left,
        y: top,
        zIndex: state.document.elements.length
      };
      return commitDocument(
        state,
        parseStudioDocument({
          ...state.document,
          elements: normalizeStudioElementOrder([
            ...state.document.elements.map((element) =>
              ids.has(element.id) ? { ...element, groupId: id } : element
            ),
            group
          ])
        }),
        [id]
      );
    }
    case "selection/ungroup": {
      const group = state.document.elements.find(
        (element) => element.id === action.groupId && element.type === "group"
      );
      if (!group || group.type !== "group") return state;
      return commitDocument(
        state,
        parseStudioDocument({
          ...state.document,
          elements: normalizeStudioElementOrder(
            state.document.elements
              .filter((element) => element.id !== group.id)
              .map((element) =>
                element.groupId === group.id
                  ? { ...element, groupId: undefined }
                  : element
              )
          )
        }),
        [...group.childIds]
      );
    }
    case "element/timing":
      return studioEditorReducer(state, {
        elementId: action.elementId,
        patch: { timing: action.timing },
        type: "element/update"
      });
    case "history/undo": {
      const document = state.past.at(-1);
      if (!document) return state;
      return {
        ...state,
        document,
        future: [state.document, ...state.future].slice(0, historyLimit),
        past: state.past.slice(0, -1),
        saveState: "dirty"
      };
    }
    case "history/redo": {
      const [document, ...future] = state.future;
      if (!document) return state;
      return {
        ...state,
        document,
        future,
        past: [...state.past, state.document].slice(-historyLimit),
        saveState: "dirty"
      };
    }
    case "playback/toggle":
      return {
        ...state,
        playing: action.playing ?? !state.playing
      };
    case "playback/loop":
      return { ...state, looping: action.looping ?? !state.looping };
    case "playback/reset":
      return { ...state, playheadMs: 0, playing: false };
    case "playback/seek":
      return {
        ...state,
        playheadMs: Math.max(
          0,
          Math.min(action.playheadMs, state.document.motion.durationMs)
        )
      };
    case "document/replace":
      return {
        ...createStudioEditorState(action.document, action.revision),
        saveState: "saved"
      };
    case "save/state":
      return {
        ...state,
        draftRevision: action.revision ?? state.draftRevision,
        saveState: action.saveState
      };
    case "zoom/in":
      return { ...state, zoom: Math.min(2, state.zoom + 0.1) };
    case "zoom/out":
      return { ...state, zoom: Math.max(0.35, state.zoom - 0.1) };
    case "zoom/reset":
      return { ...state, zoom: 1 };
    case "zoom/set":
      return {
        ...state,
        zoom: Math.max(0.05, Math.min(8, action.zoom))
      };
  }
}

function commitDocument(
  state: StudioEditorState,
  document: StudioDocument,
  selectedIds = state.selectedIds
): StudioEditorState {
  if (document === state.document) return state;
  return {
    ...state,
    document,
    future: [],
    past: [...state.past, state.document].slice(-historyLimit),
    saveState: "dirty",
    selectedIds
  };
}

function uniqueElementId(document: StudioDocument, seed: string) {
  const normalized =
    seed
      .toLocaleLowerCase("nl-NL")
      .replaceAll(/[^a-z0-9_-]+/g, "-")
      .replaceAll(/^-+|-+$/g, "")
      .slice(0, 54) || "element";
  let id = normalized;
  let suffix = 2;
  const ids = new Set(document.elements.map((element) => element.id));
  while (ids.has(id)) {
    id = `${normalized}-${suffix}`;
    suffix += 1;
  }
  return id;
}
