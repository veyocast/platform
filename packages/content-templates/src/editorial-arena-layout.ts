import type { PlayerDynamicTemplatePayload } from "@veyocast/contracts";

export const editorialArenaCanvas = {
  landscape: { height: 1080, width: 1920 },
  portrait: { height: 1920, width: 1080 }
} as const;

export type EditorialArenaViewportFit = {
  insetX: number;
  insetY: number;
  mode: "contain" | "cover";
  scale: number;
};

export function resolveEditorialArenaViewportFit(
  viewport: { height: number; width: number },
  orientation: PlayerDynamicTemplatePayload["orientation"]
): EditorialArenaViewportFit {
  const canvas = editorialArenaCanvas[orientation];
  if (viewport.width <= 0 || viewport.height <= 0) {
    return { insetX: 0, insetY: 0, mode: "contain", scale: 0 };
  }
  const orientationMatches = orientation === "portrait"
    ? viewport.height >= viewport.width
    : viewport.width >= viewport.height;
  const mode = orientationMatches ? "cover" : "contain";
  const scale = mode === "cover"
    ? Math.max(viewport.width / canvas.width, viewport.height / canvas.height)
    : Math.min(viewport.width / canvas.width, viewport.height / canvas.height);
  return {
    insetX: mode === "cover"
      ? Math.max(0, (canvas.width - viewport.width / scale) / 2)
      : 0,
    insetY: mode === "cover"
      ? Math.max(0, (canvas.height - viewport.height / scale) / 2)
      : 0,
    mode,
    scale
  };
}

export const editorialArenaFrameMetrics = {
  landscape: {
    contentBottom: 92,
    contentTop: 196,
    footerBottom: 29,
    footerHeight: 44,
    frame: 20,
    gutterX: 52,
    headerHeight: 146,
    headerTop: 32
  },
  portrait: {
    contentBottom: 86,
    contentTop: 202,
    footerBottom: 24,
    footerHeight: 42,
    frame: 20,
    gutterX: 38,
    headerHeight: 144,
    headerTop: 38
  }
} as const;

export const sportStandingRowsPerPage = 10;

export const sportResultsRowsPerPage = {
  landscape: 6,
  portrait: 5
} as const;

export const priceLayoutMetrics = {
  landscape: {
    columns: 2,
    contentHeight: 792,
    panelPaddingY: 24,
    rowGap: 10,
    rowHeight: 82
  },
  portrait: {
    columns: 2,
    contentHeight: 1632,
    panelPaddingY: 20,
    rowGap: 10,
    rowHeight: 86
  }
} as const;

export function priceRowsThatFit(
  orientation: PlayerDynamicTemplatePayload["orientation"]
) {
  const metrics = priceLayoutMetrics[orientation];
  return Math.floor(
    (metrics.contentHeight - 2 * metrics.panelPaddingY + metrics.rowGap) /
      (metrics.rowHeight + metrics.rowGap)
  );
}

export function sportColumnCount(
  orientation: PlayerDynamicTemplatePayload["orientation"],
  itemCount: number
) {
  return orientation === "landscape" && itemCount > 10 ? 2 : 1;
}

export function sportRowsPerColumn(
  orientation: PlayerDynamicTemplatePayload["orientation"],
  itemCount: number
) {
  return Math.ceil(itemCount / sportColumnCount(orientation, itemCount));
}

export function sportRowHeight(
  orientation: PlayerDynamicTemplatePayload["orientation"],
  itemCount: number
) {
  const availableRowsHeight = orientation === "landscape" ? 696 : 1504;
  const rowGap = orientation === "landscape" ? 8 : 10;
  const minRowHeight = orientation === "landscape" ? 58 : 62;
  const maxRowHeight = orientation === "landscape" ? 116 : 132;
  const rows = Math.max(1, sportRowsPerColumn(orientation, itemCount));
  return clamp(
    minRowHeight,
    Math.floor((availableRowsHeight - (rows - 1) * rowGap) / rows),
    maxRowHeight
  );
}

export function paginateEditorialRows<T>(items: T[], pageSize = 20): T[][] {
  if (!items.length) return [[]];
  const pages: T[][] = [];
  for (let index = 0; index < items.length; index += pageSize) {
    pages.push(items.slice(index, index + pageSize));
  }
  return pages;
}

function clamp(minimum: number, value: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}
