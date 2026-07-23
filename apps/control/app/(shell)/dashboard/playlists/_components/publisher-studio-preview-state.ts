export type PreviewOffset = {
  end: number;
  id: string;
  start: number;
};

export function buildPreviewOffsets(
  items: Array<{ durationSeconds: number; id: string }>
): PreviewOffset[] {
  let elapsed = 0;
  return items.map((item) => {
    const start = elapsed;
    elapsed += item.durationSeconds;
    return { end: elapsed, id: item.id, start };
  });
}

export function resolvePreviewPosition(
  offsets: PreviewOffset[],
  value: number
) {
  const index = offsets.findIndex(
    (offset, offsetIndex) =>
      value >= offset.start &&
      (value < offset.end || offsetIndex === offsets.length - 1)
  );
  if (index < 0) return null;
  const offset = offsets[index];
  if (!offset) return null;
  return {
    elapsedSeconds: Math.max(0, Math.min(offset.end - offset.start, value - offset.start)),
    index
  };
}
