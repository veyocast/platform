import {menuDocumentV2Schema,type MenuBlock,type MenuMoney,type MenuProductGroupPlacement,type MenuProductPlacement} from "@veyocast/contracts";

export const MENU_SCENE_RENDERER_VERSION = "2.0.0";
export const MENU_SCENE_CONTENT_FIT_VERSION = "dom-measured-2.0.0";

export function resolveMenuProductPrice(product: MenuProductPlacement): MenuMoney {
  return { ...product.snapshotFallback.price, amountMinor: product.priceOverrideMinor ?? product.snapshotFallback.price.amountMinor };
}

export const menuSceneCanvases = {
  landscape: { height: 1080, width: 1920 },
  portrait: { height: 1920, width: 1080 }
} as const;

export const menuSceneZones = {
  landscape: {
    body: { h: 704, w: 1728, x: 96, y: 248 },
    footer: { h: 48, w: 1728, x: 96, y: 984 },
    header: { h: 152, w: 1728, x: 96, y: 72 }
  },
  portrait: {
    body: { h: 1388, w: 936, x: 72, y: 348 },
    footer: { h: 64, w: 936, x: 72, y: 1760 },
    header: { h: 228, w: 936, x: 72, y: 96 }
  }
} as const;

export type ProductTitleDensity = "default" | "compact" | "dense";

export function resolveProductTitleDensity(value: string): ProductTitleDensity {
  const length = Array.from(value.trim()).length;
  if (length > 36) return "dense";
  if (length > 24) return "compact";
  return "default";
}

export function resolveMenuSceneScale(
  stage: { height: number; width: number },
  orientation: keyof typeof menuSceneCanvases
) {
  const canvas = menuSceneCanvases[orientation];
  if (stage.width <= 0 || stage.height <= 0) return 0;
  return Math.min(stage.width / canvas.width, stage.height / canvas.height);
}

export type MenuSceneAsset = {
  kind: "animation" | "image" | "logo" | "video";
  mimeType?: string;
  posterUrl?: string;
  url: string;
};

export type MenuSceneRow =
  | { continuation: boolean; id: string; kind: "category"; label: string; subtitle: string }
  | { id: string; kind: "product"; product: MenuProductPlacement }
  | { group: MenuProductGroupPlacement; id: string; kind: "product-group" };

type MenuFlowBlock = Extract<MenuBlock, { type: "category" | "product-group" }>;
export type MenuFloatingBlock = Exclude<MenuBlock, MenuFlowBlock>;

export type ResolvedMenuScenePage = {
  columnCount: 1 | 2;
  columns: { left: MenuSceneRow[]; right: MenuSceneRow[] };
  durationMs: number;
  floatingBlocks: MenuFloatingBlock[];
  id: string;
  pageCount: number;
  pageIndex: number;
  sourcePageId: string;
  underfilled: boolean;
};

export function resolveMenuScenePages(
  value: unknown,
  orientation: keyof typeof menuSceneCanvases
): ResolvedMenuScenePage[] {
  const parsed = menuDocumentV2Schema.safeParse(value);
  if (!parsed.success) return [];
  const result: Omit<ResolvedMenuScenePage, "pageCount" | "pageIndex">[] = [];
  for (const page of [...parsed.data.pages].sort(
    (left, right) => left.order - right.order || left.id.localeCompare(right.id)
  )) {
    const flowing = page.blocks.filter(
      (block): block is MenuFlowBlock =>
        block.type === "category" || block.type === "product-group"
    );
    const floatingBlocks = page.blocks.filter(
      (block): block is MenuFloatingBlock =>
        block.type !== "category" && block.type !== "product-group"
    );
    const columnCount = orientation === "landscape"
      ? 2
      : page.portraitColumns ?? (flowing.some(
          (block) => block.type === "category" && block.flowAcrossColumns
        ) || usesTwoPortraitColumns(flowing) ? 2 : 1);
    const columnFlow = distributeColumnFlow(flowing, orientation, columnCount);
    const byColumn = orientation === "portrait" && columnCount === 1
      ? { left: columnFlow, right: [] }
      : {
          left: columnFlow.filter((block) => blockColumn(block, orientation) === "left"),
          right: columnFlow.filter((block) => blockColumn(block, orientation) === "right")
        };
    const left = paginateColumn(
      byColumn.left,
      orientation,
      firstPageCapacity(floatingBlocks, orientation, "left")
    );
    const right = paginateColumn(
      byColumn.right,
      orientation,
      firstPageCapacity(floatingBlocks, orientation, "right")
    );
    const derivedCount = Math.max(1, left.length, right.length);
    for (let index = 0; index < derivedCount; index += 1) {
      const activeFloatingBlocks = index === 0
        ? floatingBlocks.filter((block) => !block.hidden)
        : [];
      result.push({
        columnCount,
        columns: { left: left[index] ?? [], right: right[index] ?? [] },
        durationMs: page.durationMs ?? 8_000,
        floatingBlocks: index === 0 ? floatingBlocks : [],
        id: `${page.id}:scene:${index}`,
        sourcePageId: page.id,
        underfilled: orientation === "portrait" && activeFloatingBlocks.length === 0 &&
          rowCost(left[index] ?? []) < 14
      });
    }
  }
  return result.map((page, pageIndex) => ({
    ...page,
    pageCount: result.length,
    pageIndex
  }));
}

export function resolveMenuGroupPrice(group: MenuProductGroupPlacement) {
  const linkedPrices = group.secondaryLineItems.flatMap((line) =>
    line.kind === "linked-product" && line.snapshotFallback.available
      ? [line.snapshotFallback.price]
      : []
  );
  if (group.pricePolicy === "separate") return "";
  if (group.pricePolicy === "shared") {
    return group.sharedPrice ? formatMenuMoney(group.sharedPrice) : "";
  }
  const lowest = linkedPrices.reduce<MenuMoney | null>((current, price) => {
    if (!current || price.amountMinor < current.amountMinor) return price;
    return current;
  }, null);
  return lowest ? `Vanaf ${formatMenuMoney(lowest)}` : "";
}

export function formatMenuMoney(money: MenuMoney) {
  try {
    return new Intl.NumberFormat("nl-NL", {
      currency: money.currency,
      style: "currency"
    }).format(money.amountMinor / 100);
  } catch {
    return `${money.currency} ${(money.amountMinor / 100).toFixed(2)}`;
  }
}

function paginateColumn(
  blocks: MenuFlowBlock[],
  orientation: keyof typeof menuSceneCanvases,
  reservedFirstPageCapacity?: number
) {
  const capacity = orientation === "portrait" ? 20 : 8;
  const headingCost = orientation === "portrait" ? 2 : 1;
  const pages: MenuSceneRow[][] = [];
  let current: MenuSceneRow[] = [];
  let used = 0;
  let pageCapacity = Math.min(capacity, reservedFirstPageCapacity ?? capacity);
  const flush = () => {
    if (current.length) pages.push(current);
    current = [];
    used = 0;
    pageCapacity = capacity;
  };

  for (const block of [...blocks].sort(
    (left, right) => left.order - right.order || left.id.localeCompare(right.id)
  )) {
    if (block.type === "product-group") {
      const cost = groupCost(block.group);
      if (used + cost > pageCapacity) flush();
      current.push({ group: block.group, id: block.id, kind: "product-group" });
      used += cost;
      continue;
    }
    const nodes = [...block.productNodes].sort(
      (left, right) => left.order - right.order || left.id.localeCompare(right.id)
    );
    if (!nodes.length) continue;
    let offset = 0;
    let continuation = false;
    const headingVisible = block.headingVisible !== false;
    while (offset < nodes.length) {
      const remaining = pageCapacity - used;
      const minimumNodeCount = Math.min(3, nodes.length - offset);
      const minimumCost = (headingVisible ? headingCost : 0) + nodes
        .slice(offset, offset + minimumNodeCount)
        .reduce((total, node) => total + nodeCost(node), 0);
      if (used > 0 && remaining < minimumCost) {
        flush();
        continue;
      }
      if (headingVisible) {
        current.push({
          continuation,
          id: `${block.id}:${continuation ? "continuation" : "category"}:${pages.length}`,
          kind: "category",
          label: block.labelOverride ?? block.source.sourceName,
          subtitle: block.subtitle ?? ""
        });
        used += headingCost;
      }
      const startOffset = offset;
      while (offset < nodes.length) {
        const node = nodes[offset]!;
        const cost = nodeCost(node);
        if (used + cost > pageCapacity) break;
        current.push(node.kind === "product"
          ? { id: node.id, kind: "product", product: node }
          : { group: node, id: node.id, kind: "product-group" });
        used += cost;
        offset += 1;
      }
      const remainder = nodes.length - offset;
      if (remainder > 0 && remainder < 3 && offset - startOffset > 3) {
        const moveCount = 3 - remainder;
        current.splice(-moveCount, moveCount);
        offset -= moveCount;
        used = rowCost(current, orientation);
      }
      if (offset < nodes.length) {
        flush();
        continuation = true;
      }
    }
  }
  flush();
  return pages;
}

function distributeColumnFlow(
  blocks: MenuFlowBlock[],
  orientation: keyof typeof menuSceneCanvases,
  columnCount: 1 | 2
): MenuFlowBlock[] {
  if (columnCount === 1) return blocks;
  return blocks.flatMap((block) => {
    if (block.type !== "category" || !block.flowAcrossColumns) return [block];
    const nodes = [...block.productNodes].sort(
      (left, right) => left.order - right.order || left.id.localeCompare(right.id)
    );
    if (nodes.length < 2) return [{
      ...block,
      layout: columnFlowLayout(block.layout, orientation, "left")
    }];
    const totalCost = nodes.reduce((total, node) => total + nodeCost(node), 0);
    let leftCost = 0;
    let splitIndex = 1;
    for (let index = 0; index < nodes.length - 1; index += 1) {
      leftCost += nodeCost(nodes[index]!);
      splitIndex = index + 1;
      if (leftCost >= totalCost / 2) break;
    }
    return [
      {
        ...block,
        id: `${block.id}:left`,
        layout: columnFlowLayout(block.layout, orientation, "left"),
        productNodes: nodes.slice(0, splitIndex)
      },
      {
        ...block,
        id: `${block.id}:right`,
        layout: columnFlowLayout(block.layout, orientation, "right"),
        productNodes: nodes.slice(splitIndex)
      }
    ];
  });
}

function columnFlowLayout(
  layout: MenuFlowBlock["layout"],
  orientation: keyof typeof menuSceneCanvases,
  column: "left" | "right"
) {
  const body = menuSceneZones[orientation];
  const gap = orientation === "portrait" ? 20 : 36;
  const width = (body.body.w - gap) / 2;
  const x = body.body.x + (column === "right" ? width + gap : 0);
  return {
    ...layout,
    [orientation]: { ...layout[orientation], w: width, x }
  };
}

function firstPageCapacity(
  blocks: MenuFloatingBlock[],
  orientation: keyof typeof menuSceneCanvases,
  column: "left" | "right"
) {
  const base = orientation === "portrait" ? 22 : 8;
  const body = menuSceneZones[orientation].body;
  const columnWidth = orientation === "portrait"
    ? body.w
    : (body.w - 36) / 2;
  const columnLeft = orientation === "portrait" || column === "left"
    ? body.x
    : body.x + columnWidth + 36;
  const columnRight = columnLeft + columnWidth;
  const firstBlockTop = blocks.reduce<number>((top, block) => {
    if (block.hidden) return top;
    const layout = block.layout[orientation];
    const blockRight = layout.x + layout.w;
    if (blockRight <= columnLeft || layout.x >= columnRight) return top;
    return Math.min(top, layout.y - body.y);
  }, body.h);
  if (firstBlockTop >= body.h) return base;
  const rowHeight = orientation === "portrait" ? 70 : 78;
  const reserved = Math.floor(Math.max(0, firstBlockTop - 24) / rowHeight);
  return Math.max(3, Math.min(base, reserved));
}

function groupCost(group: MenuProductGroupPlacement) {
  const titleLines = Math.max(1, Math.ceil(group.title.length / 36));
  return Math.max(group.display.maxLines, titleLines + group.display.maxLines - 1);
}

function nodeCost(node: MenuProductPlacement | MenuProductGroupPlacement) {
  if (node.kind === "product-group") return groupCost(node);
  const name = node.nameOverride ?? node.snapshotFallback.name;
  const nameLines = Math.max(1, Math.ceil(name.length / 36));
  const metaLines = node.snapshotFallback.variantLabel ? 1 : 0;
  return Math.max(1, Math.ceil((nameLines * 36 + metaLines * 20 + 14) / 70));
}

function rowCost(
  rows: MenuSceneRow[],
  orientation: keyof typeof menuSceneCanvases = "portrait"
) {
  const headingCost = orientation === "portrait" ? 2 : 1;
  return rows.reduce((total, row) => total + (
    row.kind === "category"
      ? headingCost
      : row.kind === "product-group"
        ? groupCost(row.group)
        : nodeCost(row.product)
  ), 0);
}

function blockColumn(
  block: MenuFlowBlock,
  orientation: keyof typeof menuSceneCanvases
) {
  const layout = block.layout[orientation];
  return layout.x + layout.w / 2 <= menuSceneCanvases[orientation].width / 2
    ? "left"
    : "right";
}

function usesTwoPortraitColumns(blocks: MenuFlowBlock[]) {
  return blocks.some((block) => block.layout.portrait.w < 700);
}
