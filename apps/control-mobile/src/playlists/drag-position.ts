export const playlistDragItemStride = 148;

export function playlistDropTarget({
  currentIndex,
  itemCount,
  itemStride = playlistDragItemStride,
  translationY
}: {
  currentIndex: number;
  itemCount: number;
  itemStride?: number;
  translationY: number;
}) {
  if (
    !Number.isFinite(currentIndex) ||
    !Number.isFinite(itemCount) ||
    !Number.isFinite(itemStride) ||
    !Number.isFinite(translationY) ||
    itemCount <= 0 ||
    itemStride <= 0
  ) {
    return Math.max(0, Math.trunc(currentIndex) || 0);
  }
  const lastIndex = Math.max(0, Math.trunc(itemCount) - 1);
  const origin = Math.min(Math.max(0, Math.trunc(currentIndex)), lastIndex);
  const offset = Math.round(translationY / itemStride);
  return Math.min(Math.max(0, origin + offset), lastIndex);
}
