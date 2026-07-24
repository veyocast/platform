import {
  studioFps,
  studioFontRegistryVersion,
  studioFormats,
  studioLimits,
  studioSchemaVersion,
  type StudioFormatId
} from "./constants";
import { parseStudioDocument, type StudioDocument, type StudioElement } from "./schema";

export function createEmptyStudioDocument(
  formatId: StudioFormatId = "landscape-hd",
  options: Readonly<{
    background?: string;
    durationMs?: number;
    motionEnabled?: boolean;
    templateId?: string;
  }> = {}
): StudioDocument {
  const format = studioFormats.find((candidate) => candidate.id === formatId);
  if (!format) {
    throw new Error(`Onbekend Studio-formaat: ${formatId}`);
  }

  return parseStudioDocument({
    schemaVersion: studioSchemaVersion,
    artboard: {
      width: format.width,
      height: format.height,
      orientation: format.orientation,
      background: {
        kind: "solid",
        color: options.background ?? "#FAFAF7"
      },
      safeArea: {
        top: studioLimits.safeAreaInset,
        right: studioLimits.safeAreaInset,
        bottom: studioLimits.safeAreaInset,
        left: studioLimits.safeAreaInset
      }
    },
    motion: {
      enabled: options.motionEnabled ?? false,
      durationMs: options.durationMs ?? 10_000,
      fps: studioFps
    },
    elements: [],
    metadata: {
      templateId: options.templateId,
      fontRegistryVersion: studioFontRegistryVersion,
      tenantBrandApplied: false
    }
  });
}

export function normalizeStudioElementOrder(
  elements: readonly StudioElement[]
): StudioElement[] {
  return [...elements]
    .sort((left, right) => left.zIndex - right.zIndex)
    .map((element, index) => ({ ...element, zIndex: index }));
}

export function updateStudioElement(
  document: StudioDocument,
  elementId: string,
  update: Partial<StudioElement>
): StudioDocument {
  return parseStudioDocument({
    ...document,
    elements: document.elements.map((element) =>
      element.id === elementId ? { ...element, ...update, id: element.id } : element
    )
  });
}

export function removeStudioElements(
  document: StudioDocument,
  elementIds: readonly string[]
): StudioDocument {
  const removed = new Set(elementIds);
  return parseStudioDocument({
    ...document,
    elements: normalizeStudioElementOrder(
      document.elements
        .filter((element) => !removed.has(element.id))
        .map((element) =>
          element.groupId && removed.has(element.groupId)
            ? { ...element, groupId: undefined }
            : element
        )
    )
  });
}

export function moveStudioElement(
  document: StudioDocument,
  elementId: string,
  targetIndex: number
): StudioDocument {
  const ordered = normalizeStudioElementOrder(document.elements);
  const sourceIndex = ordered.findIndex((element) => element.id === elementId);
  if (sourceIndex === -1) return document;

  const [element] = ordered.splice(sourceIndex, 1);
  if (!element) return document;
  ordered.splice(Math.max(0, Math.min(targetIndex, ordered.length)), 0, element);
  return parseStudioDocument({
    ...document,
    elements: normalizeStudioElementOrder(ordered)
  });
}
