export const PRICE_LIST_METRICS = {
  landscape: {
    capacityPerColumn: 9,
    canvasHeight: 1080,
    canvasWidth: 1920,
    columnGap: 64,
    columnWidth: 864,
    contentTop: 200,
    mediaSize: 64,
    rowHeight: 88,
    safeMargin: 64
  },
  portrait: {
    capacityPerColumn: 17,
    canvasHeight: 1920,
    canvasWidth: 1080,
    columnGap: 32,
    columnWidth: 476,
    contentTop: 200,
    mediaSize: 64,
    rowHeight: 96,
    safeMargin: 48
  }
} as const;

export type PriceListOrientation = keyof typeof PRICE_LIST_METRICS;
export type PriceListColumn = "left" | "right";
export type PriceListPhotoMode = "hide" | "show";
export type PriceListCategoryPhotoMode = "hide" | "inherit" | "show";

export type ResolvedPriceListItem = {
  description: string;
  formattedPrice: string;
  id: string;
  image:
    | { alt: string; kind: "image"; objectPosition: string; url: string }
    | { kind: "empty" };
  name: string;
  photoVisible: boolean;
};

export type ResolvedPriceListSection = {
  column: PriceListColumn;
  id: string;
  name: string;
  order: number;
  products: ResolvedPriceListItem[];
};

export type ResolvedPriceListRow =
  | { continuation: boolean; id: string; kind: "category"; name: string }
  | { item: ResolvedPriceListItem; kind: "product" };

export type PriceListRenderPage = {
  columns: Record<PriceListColumn, ResolvedPriceListRow[]>;
  pageCount: number;
  pageIndex: number;
};

export function resolvePriceListPhotoVisibility(
  slideMode: PriceListPhotoMode,
  categoryMode: PriceListCategoryPhotoMode
) {
  if (categoryMode === "show") return true;
  if (categoryMode === "hide") return false;
  return slideMode === "show";
}

export function paginatePriceList(
  sections: ResolvedPriceListSection[],
  orientation: PriceListOrientation
): PriceListRenderPage[] {
  const capacity = PRICE_LIST_METRICS[orientation].capacityPerColumn;
  const left = paginatePriceListColumn(
    sections.filter((section) => section.column === "left"),
    capacity
  );
  const right = paginatePriceListColumn(
    sections.filter((section) => section.column === "right"),
    capacity
  );
  const pageCount = Math.max(left.length, right.length, 1);
  return Array.from({ length: pageCount }, (_, pageIndex) => ({
    columns: {
      left: left[pageIndex] ?? [],
      right: right[pageIndex] ?? []
    },
    pageCount,
    pageIndex
  }));
}

export function priceListCapacityReport(
  sections: ResolvedPriceListSection[],
  orientation: PriceListOrientation
) {
  const selectedRows = { left: 0, right: 0 };
  for (const section of sections) {
    if (!section.products.length) continue;
    selectedRows[section.column] += section.products.length + 1;
  }
  const pages = paginatePriceList(sections, orientation);
  return {
    capacityPerColumn: PRICE_LIST_METRICS[orientation].capacityPerColumn,
    pageCount: pages.length,
    pages,
    selectedRows
  };
}

function paginatePriceListColumn(
  sections: ResolvedPriceListSection[],
  capacity: number
) {
  const pages: ResolvedPriceListRow[][] = [];
  let current: ResolvedPriceListRow[] = [];
  const flush = () => {
    if (current.length) pages.push(current);
    current = [];
  };

  for (const section of stableOrder(sections)) {
    const products = section.products.filter(Boolean);
    if (!products.length) continue;
    if (capacity - current.length < 2) flush();
    current.push(categoryRow(section, false, pages.length));
    for (const product of products) {
      if (current.length === capacity) {
        flush();
        current.push(categoryRow(section, true, pages.length));
      }
      current.push({ item: product, kind: "product" });
    }
  }
  flush();
  return pages;
}

function categoryRow(
  section: ResolvedPriceListSection,
  continuation: boolean,
  pageIndex: number
): ResolvedPriceListRow {
  return {
    continuation,
    id: `${section.id}:${continuation ? "continuation" : "category"}:${pageIndex}`,
    kind: "category",
    name: section.name
  };
}

function stableOrder<T extends { id: string; order: number }>(items: T[]) {
  return [...items].sort(
    (left, right) => left.order - right.order || left.id.localeCompare(right.id)
  );
}
