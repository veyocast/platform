/** Shared geometry for PNG/preview, React and Static LG. Canvas units, not pixels
 * from one fixed screen. Callers pass the measured content area after header/footer.
 * Self-contained for the trusted LG bundle.
 */
export function resolveSportListLayout(input: {
  orientation: "landscape" | "portrait";
  slideType: string;
  itemCount: number;
  contentHeight?: number;
  columns?: number;
  minimumRowHeight?: number;
}) {
  const portrait = input.orientation === "portrait";
  const standing = input.slideType.indexOf("standing") !== -1;
  const columns = !portrait && input.columns === 2 ? 2 : 1;
  const gap = standing ? (portrait ? 14 : 6) : 12;
  const contentHeight = Math.max(1, Math.min(8192,
    Number.isFinite(input.contentHeight) && Number(input.contentHeight) > 0
      ? Number(input.contentHeight) : portrait ? 1560 : 798));
  const minimumRowHeight = input.minimumRowHeight || (standing ? (portrait ? 220 : 70) : portrait ? 180 : 90);
  const rowsPerColumn = Math.max(1, Math.floor((contentHeight + gap) / (minimumRowHeight + gap)));
  const capacity = Math.min(100, rowsPerColumn * columns);
  // A layout has one normal row height, independent of the current record
  // count. Short pages intentionally leave unused space below their rows;
  // only records beyond this geometry-derived capacity create a new page.
  const rowHeight = Math.max(minimumRowHeight,
    (contentHeight - gap * (rowsPerColumn - 1)) / rowsPerColumn);
  return { capacity, columns, contentHeight, gap, minimumRowHeight, rowHeight, rowsPerColumn,
    textScale: Math.min(1.25, Math.max(1, Math.sqrt(rowHeight / minimumRowHeight))) };
}
