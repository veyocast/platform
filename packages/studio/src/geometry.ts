import type { StudioElement } from "./schema";

export type StudioRect = Readonly<{
  height: number;
  width: number;
  x: number;
  y: number;
}>;

export type StudioViewportTransform = Readonly<{
  offsetX: number;
  offsetY: number;
  scale: number;
}>;

export function fitStudioArtboard(
  artboard: Readonly<{ height: number; width: number }>,
  viewport: Readonly<{ height: number; width: number }>,
  padding = 48
): StudioViewportTransform {
  const availableWidth = Math.max(1, viewport.width - padding * 2);
  const availableHeight = Math.max(1, viewport.height - padding * 2);
  const scale = Math.min(
    availableWidth / artboard.width,
    availableHeight / artboard.height,
    1
  );
  return {
    offsetX: (viewport.width - artboard.width * scale) / 2,
    offsetY: (viewport.height - artboard.height * scale) / 2,
    scale
  };
}

export function snapStudioRect(
  rect: StudioRect,
  guides: readonly number[],
  threshold = 8
): Readonly<{ rect: StudioRect; snappedX?: number; snappedY?: number }> {
  const horizontal = [rect.x, rect.x + rect.width / 2, rect.x + rect.width];
  const vertical = [rect.y, rect.y + rect.height / 2, rect.y + rect.height];
  const xMatch = nearestGuide(horizontal, guides, threshold);
  const yMatch = nearestGuide(vertical, guides, threshold);
  return {
    rect: {
      ...rect,
      x: xMatch ? rect.x + xMatch.delta : rect.x,
      y: yMatch ? rect.y + yMatch.delta : rect.y
    },
    snappedX: xMatch?.guide,
    snappedY: yMatch?.guide
  };
}

export function alignStudioElements(
  elements: readonly StudioElement[],
  alignment: "left" | "center" | "right" | "top" | "middle" | "bottom"
): StudioElement[] {
  if (elements.length < 2) return [...elements];
  const bounds = selectionBounds(elements);
  return elements.map((element) => {
    switch (alignment) {
      case "left":
        return { ...element, x: bounds.x };
      case "center":
        return { ...element, x: bounds.x + (bounds.width - element.width) / 2 };
      case "right":
        return { ...element, x: bounds.x + bounds.width - element.width };
      case "top":
        return { ...element, y: bounds.y };
      case "middle":
        return { ...element, y: bounds.y + (bounds.height - element.height) / 2 };
      case "bottom":
        return { ...element, y: bounds.y + bounds.height - element.height };
    }
  });
}

export function distributeStudioElements(
  elements: readonly StudioElement[],
  axis: "horizontal" | "vertical"
): StudioElement[] {
  if (elements.length < 3) return [...elements];
  const sorted = [...elements].sort((left, right) =>
    axis === "horizontal" ? left.x - right.x : left.y - right.y
  );
  const first = sorted[0];
  const last = sorted.at(-1);
  if (!first || !last) return [...elements];
  const totalSize = sorted.reduce(
    (sum, element) => sum + (axis === "horizontal" ? element.width : element.height),
    0
  );
  const start = axis === "horizontal" ? first.x : first.y;
  const end = axis === "horizontal"
    ? last.x + last.width
    : last.y + last.height;
  const gap = (end - start - totalSize) / (sorted.length - 1);
  let cursor = start;
  const positions = new Map<string, number>();
  for (const element of sorted) {
    positions.set(element.id, cursor);
    cursor += (axis === "horizontal" ? element.width : element.height) + gap;
  }
  return elements.map((element) =>
    axis === "horizontal"
      ? { ...element, x: positions.get(element.id) ?? element.x }
      : { ...element, y: positions.get(element.id) ?? element.y }
  );
}

function nearestGuide(
  points: readonly number[],
  guides: readonly number[],
  threshold: number
) {
  let best: { delta: number; guide: number } | undefined;
  for (const point of points) {
    for (const guide of guides) {
      const delta = guide - point;
      if (Math.abs(delta) <= threshold && (!best || Math.abs(delta) < Math.abs(best.delta))) {
        best = { delta, guide };
      }
    }
  }
  return best;
}

function selectionBounds(elements: readonly StudioElement[]): StudioRect {
  const minimumX = Math.min(...elements.map((element) => element.x));
  const minimumY = Math.min(...elements.map((element) => element.y));
  const maximumX = Math.max(...elements.map((element) => element.x + element.width));
  const maximumY = Math.max(...elements.map((element) => element.y + element.height));
  return {
    x: minimumX,
    y: minimumY,
    width: maximumX - minimumX,
    height: maximumY - minimumY
  };
}
