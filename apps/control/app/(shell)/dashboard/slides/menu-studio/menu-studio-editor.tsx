"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Columns2,
  ExternalLink,
  GripVertical,
  Image as ImageIcon,
  Images,
  Layers3,
  Monitor,
  PackagePlus,
  Plus,
  Redo2,
  Save,
  Search,
  Send,
  Smartphone,
  Trash2,
  Type,
  Undo2,
  Video,
  X,
  ZoomIn,
  ZoomOut
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type DragEvent as ReactDragEvent
} from "react";

import {
  MenuScene,
  resolveMenuScenePages,
  type MenuSceneAsset
} from "@veyocast/content-templates";
import {
  type MenuAssetReference,
  type MenuBlock,
  type MenuDocumentV2,
  type MenuProductGroupPlacement,
  type MenuProductPlacement,
  type MenuStudioCommand
} from "@veyocast/contracts";
import {
  applyMenuStudioCommand,
  commitMenuStudioHistory,
  createMenuStudioHistory,
  redoMenuStudioHistory,
  undoMenuStudioHistory,
  type MenuStudioHistory
} from "@veyocast/domain";
import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@veyocast/ui";

import { ThemePicker } from "../_components/theme-picker";

import {
  createMenuStudioDraft,
  publishMenuStudio,
  saveMenuStudioCommand,
  setMenuStudioOrientation
} from "./actions";
import styles from "./menu-studio.module.css";

const dutchProductCollator = new Intl.Collator("nl-NL", {
  numeric: true,
  sensitivity: "base"
});

export type MenuStudioProductOption = {
  available: boolean;
  category: string;
  currency: string;
  description: string;
  id: string;
  name: string;
  priceCents: number;
  sourceId: string;
  sourceKind: "manual_products" | "twelve_excel";
  sourceRevision: string;
  taxMode: "inclusive" | "exclusive" | "not-applicable";
  taxRateBps?: number;
  unitKey?: string;
};

export type MenuStudioMediaOption = {
  assetVersion: string;
  id: string;
  kind: "animation" | "image" | "logo" | "video";
  mimeType: string;
  name: string;
  posterAssetVersion?: string;
  posterUrl?: string;
  sha256: string;
  tintable: boolean;
  url: string;
};

export function MenuStudioEditor({
  initialDocument,
  defaultThemeId,
  initialOrientation,
  linkedGroupsEnabled,
  media,
  mediaEnabled,
  mode,
  products,
  publishEnabled,
  slideId,
  sourceId,
  sourceName,
  templateVersionIds
}: {
  defaultThemeId: MenuDocumentV2["theme"]["themeId"];
  initialDocument: MenuDocumentV2;
  initialOrientation: "landscape" | "portrait";
  linkedGroupsEnabled: boolean;
  media: MenuStudioMediaOption[];
  mediaEnabled: boolean;
  mode: "create" | "edit";
  products: MenuStudioProductOption[];
  publishEnabled: boolean;
  slideId?: string;
  sourceId: string;
  sourceName: string;
  templateVersionIds: Partial<Record<"landscape" | "portrait", string>>;
}) {
  const router = useRouter();
  const [history, setHistoryState] = useState(() => createMenuStudioHistory(initialDocument));
  const historyRef = useRef(history);
  const [orientation, setOrientation] = useState<"landscape" | "portrait">(initialOrientation);
  const [pageIndex, setPageIndex] = useState(0);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [contentOverflow, setContentOverflow] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<"build" | "preview" | "library">("preview");
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);
  const [productCategoryFilter, setProductCategoryFilter] = useState("all");
  const [status, setStatus] = useState<"error" | "published" | "saved" | "saving" | "unsaved">(
    mode === "edit" ? "saved" : "unsaved"
  );
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const busyRef = useRef(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const document = history.present;
  const page = document.pages[0]!;
  const productCategories = useMemo(() => Array.from(
    new Set(products.map((product) => product.category))
  ).sort(dutchProductCollator.compare), [products]);
  const visibleProducts = useMemo(() => products
    .filter((product) => productCategoryFilter === "all" || product.category === productCategoryFilter)
    .sort((left, right) => dutchProductCollator.compare(left.name, right.name) ||
      dutchProductCollator.compare(left.category, right.category)), [productCategoryFilter, products]);
  const scenePages = resolveMenuScenePages(document, orientation);
  const activePageIndex = Math.min(pageIndex, Math.max(0, scenePages.length - 1));
  const selectedBlock = page.blocks.find((block) => block.id === selectedBlockId) ?? null;
  const selectedGroup = page.blocks.flatMap((block) =>
    block.type === "category"
      ? block.productNodes.flatMap((node) =>
          node.kind === "product-group" && node.id === selectedGroupId
            ? [{ category: block, group: node }]
            : []
        )
      : []
  )[0] ?? null;
  const assets = media.reduce<Record<string, MenuSceneAsset>>((result, asset) => {
    result[asset.id] = {
      kind: asset.kind,
      mimeType: asset.mimeType,
      posterUrl: asset.posterUrl,
      url: asset.url
    };
    return result;
  }, {});
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => setHydrated(true), []);

  const setHistory = (next: MenuStudioHistory) => {
    historyRef.current = next;
    setHistoryState(next);
  };

  async function executeOperation(
    operation: MenuStudioCommand["operation"]
  ): Promise<MenuDocumentV2 | null> {
    if (busyRef.current) return null;
    const current = historyRef.current;
    const command: MenuStudioCommand = {
      baseRevision: current.present.revision,
      operation,
      operationId: crypto.randomUUID()
    };
    const mutation = applyMenuStudioCommand(
      current.present,
      command,
      new Date().toISOString()
    );
    if (!mutation.ok) {
      setMessage(mutation.message);
      setStatus("error");
      return null;
    }
    const optimistic = commitMenuStudioHistory(current, mutation.document);
    setHistory(optimistic);
    setMessage(null);
    if (mode === "create" || !slideId) {
      setStatus("unsaved");
      return mutation.document;
    }
    busyRef.current = true;
    setStatus("saving");
    const result = await saveMenuStudioCommand({ command, slideId });
    busyRef.current = false;
    if (!result.ok) {
      setHistory(current);
      setMessage(result.message);
      setStatus("error");
      return null;
    }
    const confirmed = { ...optimistic, present: result.document };
    setHistory(confirmed);
    setStatus("saved");
    return result.document;
  }

  async function restoreHistory(direction: "redo" | "undo") {
    if (busyRef.current) return;
    const current = historyRef.current;
    const targetHistory = direction === "undo"
      ? undoMenuStudioHistory(current)
      : redoMenuStudioHistory(current);
    if (targetHistory.present === current.present) return;
    if (mode === "create" || !slideId) {
      setHistory(targetHistory);
      setStatus("unsaved");
      return;
    }
    const target = targetHistory.present;
    const command: MenuStudioCommand = {
      baseRevision: current.present.revision,
      operation: {
        assets: target.assets,
        kind: "restore-content",
        pages: target.pages,
        providerSnapshot: target.providerSnapshot ?? null,
        theme: target.theme,
        title: target.title ?? null
      },
      operationId: crypto.randomUUID()
    };
    busyRef.current = true;
    setStatus("saving");
    const result = await saveMenuStudioCommand({ command, slideId });
    busyRef.current = false;
    if (!result.ok) {
      setMessage(result.message);
      setStatus("error");
      return;
    }
    setHistory({ ...targetHistory, present: result.document });
    setMessage(null);
    setStatus("saved");
  }

  async function toggleProduct(product: MenuStudioProductOption) {
    const currentPage = historyRef.current.present.pages[0]!;
    const existing = findProduct(currentPage.blocks, product.id);
    if (existing) {
      await executeOperation({
        categoryBlockId: existing.category.id,
        kind: "remove-product-node",
        nodeId: existing.node.id,
        pageId: currentPage.id
      });
      return;
    }
    const grouped = findGroupedProduct(currentPage.blocks, product.id);
    if (grouped) {
      const removed = grouped.group.secondaryLineItems.find(
        (line) => line.kind === "linked-product" && line.productRef.productId === product.id
      );
      const secondaryLineItems = grouped.group.secondaryLineItems.filter(
        (line) => line.kind !== "linked-product" || line.productRef.productId !== product.id
      ).map((line, order) => ({ ...line, order }));
      if (!secondaryLineItems.length) {
        await executeOperation({
          categoryBlockId: grouped.category.id,
          kind: "remove-product-node",
          nodeId: grouped.group.id,
          pageId: currentPage.id
        });
      } else {
        const hasLinked = secondaryLineItems.some((line) => line.kind === "linked-product");
        await executeOperation({
          categoryBlockId: grouped.category.id,
          kind: "upsert-product-node",
          node: {
            ...grouped.group,
            ...(grouped.group.pricePolicy === "from" && !hasLinked ? {
              pricePolicy: "shared" as const,
              sharedPrice: removed?.kind === "linked-product"
                ? removed.snapshotFallback.price
                : grouped.group.sharedPrice
            } : {}),
            secondaryLineItems
          },
          pageId: currentPage.id
        });
      }
      return;
    }
    let category = findCategory(currentPage.blocks, product.category);
    if (!category) {
      const block = categoryBlock(product, currentPage.blocks, currentPage.portraitColumns);
      const next = await executeOperation({ block, kind: "add-block", pageId: currentPage.id });
      if (!next) return;
      category = next.pages[0]!.blocks.find(
        (candidate): candidate is Extract<MenuBlock, { type: "category" }> =>
          candidate.id === block.id && candidate.type === "category"
      );
    }
    if (!category) return;
    await executeOperation({
      categoryBlockId: category.id,
      kind: "upsert-product-node",
      node: productPlacement(product, category.productNodes.length),
      pageId: historyRef.current.present.pages[0]!.id
    });
  }

  async function placeProduct(product: MenuStudioProductOption) {
    const blocks = historyRef.current.present.pages[0]!.blocks;
    if (findProduct(blocks, product.id) || findGroupedProduct(blocks, product.id)) {
      setMessage(`${product.name} staat al in dit menu; er is niets gedupliceerd.`);
      setStatus("error");
      return;
    }
    await toggleProduct(product);
  }

  async function placeCategory(categoryName: string) {
    const currentPage = historyRef.current.present.pages[0]!;
    if (findCategory(currentPage.blocks, categoryName)) {
      setMessage(`${categoryName} staat al in dit menu; er is niets gedupliceerd.`);
      setStatus("error");
      return;
    }
    const representative = products.find((product) => product.category === categoryName);
    if (!representative) return;
    await executeOperation({
      block: categoryBlock(representative, currentPage.blocks, currentPage.portraitColumns),
      kind: "add-block",
      pageId: currentPage.id
    });
  }

  async function makeGroup(product: MenuStudioProductOption) {
    const currentPage = historyRef.current.present.pages[0]!;
    const existing = findProduct(currentPage.blocks, product.id);
    if (!existing) return;
    const group: MenuProductGroupPlacement = {
      availabilityPolicy: {
        groupUnavailableWhenNoLinkedProducts: true,
        hideUnavailableLinkedProducts: true,
        keepFreeTextWhenLinkedUnavailable: true
      },
      display: { maxLines: 2, separator: "dot" },
      id: crypto.randomUUID(),
      kind: "product-group",
      order: existing.node.order,
      pricePolicy: "shared",
      secondaryLineItems: [
        {
          id: crypto.randomUUID(),
          kind: "linked-product",
          order: 0,
          productRef: existing.node.productRef,
          snapshotFallback: existing.node.snapshotFallback
        }
      ],
      sharedPrice: existing.node.snapshotFallback.price,
      title: product.name
    };
    const result = await executeOperation({
      categoryBlockId: existing.category.id,
      group,
      kind: "group-product-nodes",
      nodeIds: [existing.node.id],
      pageId: currentPage.id
    });
    if (result) setSelectedGroupId(group.id);
  }

  async function updateGroup(
    categoryId: string,
    group: MenuProductGroupPlacement,
    policy: MenuProductGroupPlacement["pricePolicy"]
  ) {
    const firstLinked = group.secondaryLineItems.find(
      (line) => line.kind === "linked-product"
    );
    await executeOperation({
      categoryBlockId: categoryId,
      kind: "upsert-product-node",
      node: {
        ...group,
        pricePolicy: policy,
        ...(policy === "shared" && firstLinked
          ? { sharedPrice: firstLinked.snapshotFallback.price }
          : { sharedPrice: undefined })
      },
      pageId: historyRef.current.present.pages[0]!.id
    });
  }

  async function replaceBlock(block: MenuBlock) {
    await executeOperation({ block, kind: "replace-block", pageId: page.id });
  }

  async function moveBlock(blockId: string, direction: "down" | "up") {
    const blocks = historyRef.current.present.pages[0]!.blocks;
    const index = blocks.findIndex((block) => block.id === blockId);
    if (index < 0) return;
    const beforeBlockId = direction === "up"
      ? blocks[index - 1]?.id ?? null
      : blocks[index + 2]?.id ?? null;
    if ((direction === "up" && index === 0) || (direction === "down" && index === blocks.length - 1)) return;
    await executeOperation({ beforeBlockId, blockId, kind: "move-block", pageId: page.id });
  }

  async function linkProductToSelectedGroup(product: MenuStudioProductOption) {
    const currentPage = historyRef.current.present.pages[0]!;
    const selected = currentPage.blocks.flatMap((block) =>
      block.type === "category"
        ? block.productNodes.flatMap((node) =>
            node.kind === "product-group" && node.id === selectedGroupId
              ? [{ category: block, group: node }]
              : []
          )
        : []
    )[0];
    if (!selected || findProduct(currentPage.blocks, product.id) || findGroupedProduct(currentPage.blocks, product.id)) return;
    const placement = productPlacement(product, 0);
    if (selected.group.pricePolicy === "shared" && selected.group.sharedPrice && !samePrice(
      selected.group.sharedPrice,
      placement.snapshotFallback.price
    )) {
      setStatus("error");
      setMessage("Dit gekoppelde product heeft een andere prijs of prijseenheid. Kies eerst Vanafprijs of Afzonderlijk; er is niets gewijzigd.");
      return;
    }
    await executeOperation({
      categoryBlockId: selected.category.id,
      kind: "upsert-product-node",
      node: {
        ...selected.group,
        secondaryLineItems: [
          ...selected.group.secondaryLineItems,
          {
            id: crypto.randomUUID(),
            kind: "linked-product",
            order: selected.group.secondaryLineItems.length,
            productRef: placement.productRef,
            snapshotFallback: placement.snapshotFallback
          }
        ]
      },
      pageId: currentPage.id
    });
  }

  async function ungroup(categoryId: string, group: MenuProductGroupPlacement) {
    const products = group.secondaryLineItems.flatMap((line, index) =>
      line.kind === "linked-product"
        ? [{
            id: crypto.randomUUID(),
            kind: "product" as const,
            order: index,
            productRef: line.productRef,
            snapshotFallback: line.snapshotFallback
          }]
        : []
    );
    if (!products.length) {
      setStatus("error");
      setMessage("Deze groep bevat alleen vrije tekst. Voeg eerst een gekoppeld product toe of verwijder de groep als geheel.");
      return;
    }
    const result = await executeOperation({
      categoryBlockId: categoryId,
      groupId: group.id,
      kind: "ungroup-product-node",
      pageId: page.id,
      products
    });
    if (result) setSelectedGroupId(null);
  }

  async function replaceBlockAsset(block: MenuBlock, asset: MenuStudioMediaOption) {
    const asLogo = block.type === "logo";
    if (!await attachMedia(asset, asLogo ? "logo" : asset.kind)) return;
    if (block.type === "image" || block.type === "video" || block.type === "logo") {
      await replaceBlock({ ...block, assetId: asset.id });
    }
  }

  async function addSimpleBlock(type: "promo" | "text") {
    const currentPage = historyRef.current.present.pages[0]!;
    const base = {
      id: crypto.randomUUID(),
      layout: floatingLayout(currentPage.blocks),
      order: currentPage.blocks.length
    };
    const block: MenuBlock = type === "text"
      ? { ...base, role: "note", text: "Vers bereid, met aandacht geserveerd.", type: "text" }
      : { ...base, body: "Vraag naar de mogelijkheden.", title: "Special van vandaag", type: "promo" };
    await executeOperation({ block, kind: "add-block", pageId: currentPage.id });
  }

  async function attachMedia(
    asset: MenuStudioMediaOption,
    manifestKind: MenuAssetReference["kind"] = asset.kind
  ) {
    const manifestAsset: MenuAssetReference = {
      assetId: asset.id,
      assetVersion: asset.assetVersion,
      kind: manifestKind,
      ...(asset.posterAssetVersion ? { posterAssetVersion: asset.posterAssetVersion } : {}),
      sha256: asset.sha256,
      status: "ready"
    };
    if (!historyRef.current.present.assets.some((candidate) => candidate.assetId === asset.id)) {
      const attached = await executeOperation({ asset: manifestAsset, kind: "attach-asset" });
      if (!attached) return false;
    }
    return true;
  }

  async function addMediaBlock(
    asset: MenuStudioMediaOption,
    placement: "media" | "logo" = "media"
  ) {
    if (!await attachMedia(asset, placement === "logo" ? "logo" : asset.kind)) return;
    const currentPage = historyRef.current.present.pages[0]!;
    const base = {
      id: crypto.randomUUID(),
      layout: floatingLayout(currentPage.blocks),
      order: currentPage.blocks.length
    };
    const appearance = {
      fit: "cover" as const,
      focalPoint: { x: 0.5, y: 0.5 },
      opacity: 1
    };
    const block: MenuBlock = asset.kind === "video" || asset.kind === "animation"
      ? {
          ...base,
          appearance,
          assetId: asset.id,
          playback: { autoplay: true, loop: true, muted: true, startMs: 0 },
          type: "video"
        }
      : placement === "logo" || asset.kind === "logo"
        ? {
            ...base,
            assetId: asset.id,
            color: { mode: "original" },
            type: "logo"
          }
        : {
            ...base,
            appearance,
            assetId: asset.id,
            type: "image"
          };
    await executeOperation({ block, kind: "add-block", pageId: currentPage.id });
  }

  async function setHeaderLogo(asset: MenuStudioMediaOption) {
    if (!await attachMedia(asset, "logo")) return;
    await executeOperation({
      kind: "set-theme",
      theme: {
        ...historyRef.current.present.theme,
        brand: {
          ...historyRef.current.present.theme.brand,
          logoAssetId: asset.id
        }
      }
    });
  }

  async function addCategories(categoryNames: string[]) {
    for (const categoryName of categoryNames) {
      await placeCategory(categoryName);
    }
  }

  async function addMediaSelection(
    assetIds: string[],
    placement: "logo" | "media" | "menu-logo"
  ) {
    for (const assetId of assetIds) {
      const asset = media.find((candidate) => candidate.id === assetId);
      if (!asset) continue;
      if (placement === "menu-logo") {
        await setHeaderLogo(asset);
      } else {
        await addMediaBlock(asset, placement);
      }
    }
  }

  async function handleCanvasDrop(event: ReactDragEvent<HTMLElement>) {
    event.preventDefault();
    event.stopPropagation();
    stageRef.current?.removeAttribute("data-drop-active");
    const payload = readMenuStudioDragPayload(event);
    if (!payload) return;
    if (payload.kind === "element") {
      if (payload.element === "text" || payload.element === "promo") {
        await addSimpleBlock(payload.element);
      }
      return;
    }
    if (payload.kind === "category") {
      await placeCategory(payload.categoryName);
      return;
    }
    if (payload.kind === "product") {
      const product = products.find((candidate) => candidate.id === payload.productId);
      if (product) await placeProduct(product);
      return;
    }
    const asset = media.find((candidate) => candidate.id === payload.assetId);
    if (asset) await addMediaBlock(asset, payload.placement);
  }

  function handleDragEnd(event: DragEndEvent) {
    if (!event.over || event.active.id === event.over.id || busyRef.current) return;
    const blocks = historyRef.current.present.pages[0]!.blocks;
    const oldIndex = blocks.findIndex((block) => block.id === event.active.id);
    const overIndex = blocks.findIndex((block) => block.id === event.over?.id);
    if (oldIndex < 0 || overIndex < 0) return;
    const ordered = arrayMove(blocks, oldIndex, overIndex);
    const nextIndex = ordered.findIndex((block) => block.id === event.active.id) + 1;
    void executeOperation({
      beforeBlockId: ordered[nextIndex]?.id ?? null,
      blockId: String(event.active.id),
      kind: "move-block",
      pageId: historyRef.current.present.pages[0]!.id
    });
  }

  function createDraft() {
    if (mode !== "create" || isPending) return;
    startTransition(async () => {
      setStatus("saving");
      const templateVersionId = templateVersionIds[orientation];
      if (!templateVersionId) {
        setMessage(`Er is geen gepubliceerd ${orientation === "portrait" ? "staand" : "liggend"} prijslijsttemplate beschikbaar.`);
        setStatus("error");
        return;
      }
      const result = await createMenuStudioDraft({
        dataSourceId: sourceId,
        document: historyRef.current.present,
        name: historyRef.current.present.title || "Nieuw menu",
        templateVersionId
      });
      if (!result.ok) {
        setMessage(result.message);
        setStatus("error");
        return;
      }
      setStatus("saved");
      router.push(`/dashboard/slides/menu-studio/${result.slideId}?succes=Concept+opgeslagen`);
    });
  }

  async function changeOrientation(nextOrientation: "landscape" | "portrait") {
    if (nextOrientation === orientation || busyRef.current || isPending) return;
    const templateVersionId = templateVersionIds[nextOrientation];
    if (!templateVersionId) {
      setMessage(`Er is geen gepubliceerd ${nextOrientation === "portrait" ? "staand" : "liggend"} prijslijsttemplate beschikbaar.`);
      setStatus("error");
      return;
    }
    if (mode === "create" || !slideId) {
      setOrientation(nextOrientation);
      setPageIndex(0);
      setMessage(null);
      setStatus("unsaved");
      return;
    }

    busyRef.current = true;
    setStatus("saving");
    setMessage(null);
    const current = historyRef.current;
    const result = await setMenuStudioOrientation({
      expectedRevision: current.present.revision,
      operationId: crypto.randomUUID(),
      orientation: nextOrientation,
      slideId,
      templateVersionId
    });
    busyRef.current = false;
    if (!result.ok) {
      setMessage(result.message);
      setStatus("error");
      return;
    }
    setHistory({ ...current, present: result.document });
    setOrientation(nextOrientation);
    setPageIndex(0);
    setStatus("saved");
  }

  async function changePortraitColumns(columnCount: 1 | 2) {
    const current = historyRef.current.present;
    if (portraitColumnCount(
      current.pages[0]!.blocks,
      current.pages[0]!.portraitColumns
    ) === columnCount || busyRef.current || isPending) return;
    const pages = current.pages.map((currentPage) => ({
      ...currentPage,
      portraitColumns: columnCount,
      blocks: currentPage.blocks.map((block) => {
        if (block.type !== "category" && block.type !== "product-group") return block;
        const landscapeMidpoint = block.layout.landscape.x + block.layout.landscape.w / 2;
        const left = landscapeMidpoint <= 960;
        return {
          ...block,
          layout: {
            ...block.layout,
            portrait: columnCount === 1
              ? { h: 1388, rotation: 0, w: 936, x: 72, y: 348 }
              : { h: 1388, rotation: 0, w: 458, x: left ? 72 : 550, y: 348 }
          }
        };
      })
    }));
    await executeOperation({
      assets: current.assets,
      kind: "restore-content",
      pages,
      providerSnapshot: current.providerSnapshot ?? null,
      theme: current.theme,
      title: current.title ?? null
    });
    setPageIndex(0);
  }

  function publish() {
    if (!slideId || isPending || busyRef.current) return;
    startTransition(async () => {
      setMessage(null);
      setStatus("saving");
      const result = await publishMenuStudio({
        expectedRevision: historyRef.current.present.revision,
        slideId
      });
      if (!result.ok) {
        setMessage(result.message);
        setStatus("error");
        return;
      }
      setStatus("published");
      setMessage("Immutable release aangemaakt. De Player wisselt pas op een veilige item- of loopgrens.");
    });
  }

  function closeProductGroup() {
    setSelectedGroupId(null);
  }

  function commitMenuTitle(input: HTMLInputElement) {
    const title = input.value.trim();
    const currentTitle = historyRef.current.present.title ?? "";
    if (title === currentTitle) return;
    if (title.length < 2) {
      input.value = currentTitle;
      setMessage("Geef het menu een naam van minimaal 2 tekens. De opgeslagen naam is behouden.");
      setStatus("error");
      return;
    }
    void executeOperation({ kind: "set-title", title });
  }

  return (
    <div className={styles.studio} data-hydrated={hydrated || undefined} data-mobile-panel={mobilePanel}>
      <header className={styles.toolbar}>
        <div className={styles.titleField}>
          <label htmlFor="menu-title"><span>Menunaam</span><small>Bewerkbaar</small></label>
          <input
            defaultValue={document.title ?? ""}
            id="menu-title"
            key={`${document.id}:${document.title ?? ""}`}
            maxLength={120}
            minLength={2}
            onBlur={(event) => commitMenuTitle(event.currentTarget)}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur();
            }}
            placeholder="Geef dit menu een naam"
            required
          />
          <small>Naam op de slide en in Slides · automatisch opgeslagen · {sourceName} · revisie {document.revision}</small>
        </div>
        <div className={styles.toolActions}>
          <Button
            aria-label="Wijziging ongedaan maken"
            disabled={!history.past.length || isPending || status === "saving"}
            onClick={() => void restoreHistory("undo")}
            size="sm"
            variant="ghost"
          ><Undo2 aria-hidden="true" /></Button>
          <Button
            aria-label="Wijziging opnieuw uitvoeren"
            disabled={!history.future.length || isPending || status === "saving"}
            onClick={() => void restoreHistory("redo")}
            size="sm"
            variant="ghost"
          ><Redo2 aria-hidden="true" /></Button>
          <Status status={status} />
          {mode === "create" ? (
            <Button disabled={isPending || status === "saving"} onClick={createDraft}>
              <Save aria-hidden="true" /> Concept opslaan
            </Button>
          ) : (
            <Button
              disabled={!publishEnabled || isPending || status === "saving"}
              onClick={publish}
              title={publishEnabled ? "Maak een immutable publicatie" : "Publiceren of Player-uitrol staat voor deze tenant uit"}
            >
              <Send aria-hidden="true" /> Publiceren
            </Button>
          )}
        </div>
      </header>

      {message ? (
        <p className={status === "error" ? "notice notice--critical" : "notice notice--success"} role={status === "error" ? "alert" : "status"}>
          {status === "error" ? <AlertTriangle aria-hidden="true" /> : <CheckCircle2 aria-hidden="true" />} {message}
        </p>
      ) : null}

      <nav aria-label="Mobiele Menu Studio-panelen" className={styles.mobileTabs}>
        {(["build", "preview", "library"] as const).map((panel) => (
          <button
            aria-current={mobilePanel === panel ? "page" : undefined}
            key={panel}
            onClick={() => setMobilePanel(panel)}
            type="button"
          >{panel === "build" ? "Opbouw" : panel === "preview" ? "Voorbeeld" : "Bibliotheek"}</button>
        ))}
      </nav>

      <div className={styles.workspace}>
        <aside className={`${styles.panel} ${styles.buildPanel}`}>
          <PanelHeading icon={<Layers3 aria-hidden="true" />} title="Opbouw" />
          <div className={styles.quickAdd}>
            <button
              draggable
              onClick={() => void addSimpleBlock("text")}
              onDragStart={(event) => setMenuStudioDragPayload(event, { element: "text", kind: "element" })}
              type="button"
            ><Type aria-hidden="true" />Tekst</button>
            <button
              draggable
              onClick={() => void addSimpleBlock("promo")}
              onDragStart={(event) => setMenuStudioDragPayload(event, { element: "promo", kind: "element" })}
              type="button"
            ><Plus aria-hidden="true" />Promo</button>
            {selectedGroup ? (
              <button
                draggable
                onClick={() => void executeOperation({
                  categoryBlockId: selectedGroup.category.id,
                  kind: "upsert-product-node",
                  node: appendFreeTextLine(selectedGroup.group),
                  pageId: page.id
                })}
                onDragStart={(event) => setMenuStudioDragPayload(event, {
                  element: "free-text",
                  kind: "element"
                })}
                type="button"
              ><Type aria-hidden="true" />Vrije subregel</button>
            ) : null}
          </div>
          <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd} sensors={sensors}>
            <SortableContext items={page.blocks.map((block) => block.id)} strategy={verticalListSortingStrategy}>
              <ol className={styles.layerList}>
                {page.blocks.map((block) => (
                  <SortableBlock
                    block={block}
                    disabled={status === "saving"}
                    key={block.id}
                    onMove={(direction) => void moveBlock(block.id, direction)}
                    onRemove={() => void executeOperation({
                      blockId: block.id,
                      kind: "remove-block",
                      pageId: page.id
                    })}
                    onRenameCategory={(labelOverride) => void executeOperation({
                      categoryBlockId: block.id,
                      kind: "rename-category",
                      labelOverride,
                      pageId: page.id
                    })}
                    onSelect={() => {
                      setSelectedBlockId(block.id);
                      setSelectedGroupId(null);
                    }}
                    onSelectGroup={(groupId) => {
                      setSelectedBlockId(block.id);
                      setSelectedGroupId(groupId);
                    }}
                    onUpdateGroup={(categoryId, group, policy) => void updateGroup(categoryId, group, policy)}
                    selected={selectedBlockId === block.id}
                  />
                ))}
              </ol>
            </SortableContext>
          </DndContext>
          {!page.blocks.length ? <p className={styles.emptyCopy}>Kies producten of voeg een blok toe.</p> : null}
          {selectedBlock ? (
            <BlockInspector
              block={selectedBlock}
              media={media}
              onChange={(block) => void replaceBlock(block)}
              onReplaceAsset={(asset) => void replaceBlockAsset(selectedBlock, asset)}
              orientation={orientation}
            />
          ) : (
            <p className={styles.inspectorHint}>Selecteer een element voor stijl-, layout- en media-instellingen.</p>
          )}
          {selectedGroup ? (
            <GroupInspector
              categoryId={selectedGroup.category.id}
              group={selectedGroup.group}
              onChange={(group) => void executeOperation({
                categoryBlockId: selectedGroup.category.id,
                kind: "upsert-product-node",
                node: group,
                pageId: page.id
              })}
              onAddFreeText={() => void executeOperation({
                categoryBlockId: selectedGroup.category.id,
                kind: "upsert-product-node",
                node: appendFreeTextLine(selectedGroup.group),
                pageId: page.id
              })}
              onLinkProduct={(product) => void linkProductToSelectedGroup(product)}
              onClose={closeProductGroup}
              onUngroup={() => void ungroup(selectedGroup.category.id, selectedGroup.group)}
              products={products}
            />
          ) : null}
        </aside>

        <main className={styles.previewPanel}>
          <div className={styles.previewToolbar}>
            <span>Live MenuScene</span>
            <div>
              <button aria-label="Uitzoomen" disabled={zoom <= 0.5} onClick={() => setZoom((value) => Math.max(0.5, value - 0.25))} type="button"><ZoomOut aria-hidden="true" /></button>
              <button aria-label="Inzoomen" disabled={zoom >= 2} onClick={() => setZoom((value) => Math.min(2, value + 0.25))} type="button"><ZoomIn aria-hidden="true" /></button>
              <button
                aria-pressed={orientation === "landscape"}
                disabled={!templateVersionIds.landscape || status === "saving"}
                onClick={() => void changeOrientation("landscape")}
                type="button"
              ><Monitor aria-hidden="true" />Liggend</button>
              <button
                aria-pressed={orientation === "portrait"}
                disabled={!templateVersionIds.portrait || status === "saving"}
                onClick={() => void changeOrientation("portrait")}
                type="button"
              ><Smartphone aria-hidden="true" />Staand</button>
            </div>
            {orientation === "portrait" ? (
              <div aria-label="Kolommen in staande modus" className={styles.portraitColumnPicker} role="group">
                <span><Columns2 aria-hidden="true" /> Indeling staand</span>
                <button
                  aria-pressed={portraitColumnCount(page.blocks, page.portraitColumns) === 1}
                  disabled={status === "saving"}
                  onClick={() => void changePortraitColumns(1)}
                  type="button"
                >1 kolom</button>
                <button
                  aria-pressed={portraitColumnCount(page.blocks, page.portraitColumns) === 2}
                  disabled={status === "saving"}
                  onClick={() => void changePortraitColumns(2)}
                  type="button"
                >2 kolommen</button>
              </div>
            ) : null}
          </div>
          <div
            aria-label="Compositiecanvas; sleep hier categorieën, producten en media naartoe"
            className={styles.stage}
            data-orientation={orientation}
            onDragEnterCapture={(event) => {
              event.preventDefault();
              event.currentTarget.dataset.dropActive = "true";
            }}
            onDragLeaveCapture={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                event.currentTarget.removeAttribute("data-drop-active");
              }
            }}
            onDragOverCapture={(event) => {
              event.preventDefault();
              event.dataTransfer.dropEffect = "copy";
            }}
            onDropCapture={(event) => void handleCanvasDrop(event)}
            ref={stageRef}
            role="region"
          >
            <div
              aria-hidden="true"
              className={styles.canvasDropOverlay}
              onDragOver={(event) => {
                event.preventDefault();
                event.dataTransfer.dropEffect = "copy";
              }}
              onDrop={(event) => void handleCanvasDrop(event)}
            >Laat los om op het canvas te plaatsen</div>
            <MenuScene
              alignment="top"
              assets={assets}
              document={document}
              onContentFit={setContentOverflow}
              orientation={orientation}
              pageIndex={activePageIndex}
              zoom={zoom}
            />
          </div>
          <div className={styles.pageControls}>
            <button aria-label="Vorige menupagina" disabled={activePageIndex === 0} onClick={() => setPageIndex((value) => Math.max(0, value - 1))} type="button"><ChevronLeft aria-hidden="true" /></button>
            <span>Pagina {activePageIndex + 1} / {Math.max(1, scenePages.length)}</span>
            <button aria-label="Volgende menupagina" disabled={activePageIndex >= scenePages.length - 1} onClick={() => setPageIndex((value) => Math.min(scenePages.length - 1, value + 1))} type="button"><ChevronRight aria-hidden="true" /></button>
          </div>
          {scenePages[activePageIndex]?.underfilled ? (
            <p className={styles.spaceSuggestion} role="status">Veel ruimte over — voeg een afbeelding, aanbieding of video toe.</p>
          ) : null}
          <p className={styles.canvasMeta} data-overflow={contentOverflow || undefined} role="status">
            {orientation === "portrait" ? "1080 × 1920" : "1920 × 1080"} · zoom {Math.round(zoom * 100)}% · {contentOverflow
              ? "Inhoud past na fontmeting niet veilig; publicatie kan onleesbaar worden. Splits de groep of verkort labels."
              : "DOM gemeten, safe area bewaakt"}
          </p>
        </main>

        <aside className={`${styles.panel} ${styles.libraryPanel}`}>
          <PanelHeading icon={<PackagePlus aria-hidden="true" />} title="Bibliotheek" />
          <section className={styles.librarySection}>
            <h3>Art direction</h3>
            <ThemePicker
              defaultThemeId={defaultThemeId}
              label="Thema voor deze menuversie"
              onChange={(themeId) => void executeOperation({
                kind: "set-theme",
                theme: { ...document.theme, themeId }
              })}
              value={document.theme.themeId}
            />
            <button
              className={styles.modeToggle}
              onClick={() => void executeOperation({
                kind: "set-theme",
                theme: { ...document.theme, mode: document.theme.mode === "light" ? "dark" : "light" }
              })}
              type="button"
            >Modus: {document.theme.mode === "light" ? "Licht" : "Donker"}</button>
          </section>

          <section className={styles.librarySection}>
            <h3>Categorieën <span>{productCategories.length}</span></h3>
            <button
              className={styles.libraryLauncher}
              onClick={() => setCategoryPickerOpen(true)}
              type="button"
            >
              <Layers3 aria-hidden="true" />
              <span><strong>Categorieën kiezen</strong><small>Selecteer één of meerdere categorieblokken in een pop-up.</small></span>
              <Plus aria-hidden="true" />
            </button>
          </section>

          <section className={styles.librarySection}>
            <h3>Producten <span>{visibleProducts.length} / {products.length}</span></h3>
            <label className={styles.productFilter}>
              <span>Filter op categorie</span>
              <select
                onChange={(event) => setProductCategoryFilter(event.currentTarget.value)}
                value={productCategoryFilter}
              >
                <option value="all">Alle categorieën</option>
                {productCategories.map((categoryName) => (
                  <option key={categoryName} value={categoryName}>{categoryName}</option>
                ))}
              </select>
            </label>
            {selectedGroup ? (
              <div className={styles.activeGroupBar} role="status">
                <span><strong>Actieve productgroep</strong><small>{selectedGroup.group.title}</small></span>
                <button onClick={closeProductGroup} type="button"><X aria-hidden="true" /> Klaar</button>
              </div>
            ) : null}
            <div className={styles.productLibrary}>
              {visibleProducts.map((product) => {
                const selected = Boolean(
                  findProduct(page.blocks, product.id) || findGroupedProduct(page.blocks, product.id)
                );
                const canGroup = Boolean(findProduct(page.blocks, product.id));
                const canLinkToGroup = Boolean(selectedGroup) && !selected;
                return (
                  <article data-selected={selected} key={product.id}>
                    <button
                      draggable={!selected}
                      onClick={() => void toggleProduct(product)}
                      onDragStart={(event) => setMenuStudioDragPayload(event, {
                        kind: "product",
                        productId: product.id
                      })}
                      type="button"
                    >
                      <span><strong>{product.name}</strong><small>{product.category}</small></span>
                      <b>{formatPrice(product.priceCents, product.currency)}</b>
                    </button>
                    {canGroup && linkedGroupsEnabled ? (
                      <button className={styles.groupButton} onClick={() => void makeGroup(product)} type="button">
                        <PackagePlus aria-hidden="true" /> Maak productgroep
                      </button>
                    ) : null}
                    {canLinkToGroup && linkedGroupsEnabled ? (
                      <button className={styles.groupButton} onClick={() => void linkProductToSelectedGroup(product)} type="button">
                        <Plus aria-hidden="true" /> Koppel aan actieve groep
                      </button>
                    ) : null}
                  </article>
                );
              })}
            </div>
          </section>

          <section className={styles.librarySection}>
            <div className={styles.sectionTitleRow}>
              <h3>Media <span>{media.length}</span></h3>
              <Link href="/dashboard/media">Beheren <ExternalLink aria-hidden="true" /></Link>
            </div>
            {mediaEnabled && media.length ? (
              <button
                className={styles.libraryLauncher}
                onClick={() => setMediaPickerOpen(true)}
                type="button"
              >
                <Images aria-hidden="true" />
                <span><strong>Media kiezen</strong><small>Zoek afbeeldingen, video’s en logo’s en voeg ze gericht toe.</small></span>
                <Plus aria-hidden="true" />
              </button>
            ) : (
              <p className={styles.emptyCopy}>{mediaEnabled
                ? "Upload eerst gevalideerde media in de mediabibliotheek."
                : "Media-elementen staan voor deze tenant nog uit."}</p>
            )}
          </section>
        </aside>
      </div>
      <CategoryPickerDialog
        busy={isPending || status === "saving"}
        categories={productCategories}
        onAdd={addCategories}
        onOpenChange={setCategoryPickerOpen}
        open={categoryPickerOpen}
        placedCategories={new Set(page.blocks.flatMap((block) => block.type === "category"
          ? [block.source.sourceName]
          : []))}
        products={products}
      />
      <MediaPickerDialog
        busy={isPending || status === "saving"}
        media={media}
        onAdd={addMediaSelection}
        onOpenChange={setMediaPickerOpen}
        open={mediaPickerOpen}
      />
    </div>
  );
}

function CategoryPickerDialog({
  busy,
  categories,
  onAdd,
  onOpenChange,
  open,
  placedCategories,
  products
}: {
  busy: boolean;
  categories: string[];
  onAdd: (categoryNames: string[]) => Promise<void>;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  placedCategories: Set<string>;
  products: MenuStudioProductOption[];
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const normalizedQuery = query.trim().toLocaleLowerCase("nl-NL");
  const visibleCategories = categories.filter((categoryName) =>
    !normalizedQuery || categoryName.toLocaleLowerCase("nl-NL").includes(normalizedQuery)
  );

  useEffect(() => {
    if (!open) {
      setQuery("");
      setSelected([]);
    }
  }, [open]);

  const toggle = (categoryName: string) => setSelected((current) => current.includes(categoryName)
    ? current.filter((candidate) => candidate !== categoryName)
    : [...current, categoryName]);

  const submit = async () => {
    if (!selected.length || submitting || busy) return;
    setSubmitting(true);
    await onAdd(selected);
    setSubmitting(false);
    onOpenChange(false);
  };

  return (
    <Dialog
      onOpenChange={(nextOpen) => {
        if (!submitting) onOpenChange(nextOpen);
      }}
      open={open}
    >
      <DialogContent className={styles.pickerDialog} closeLabel="Categorieën sluiten">
        <DialogHeader>
          <DialogTitle>Categorieën toevoegen</DialogTitle>
          <DialogDescription>
            Kies één of meerdere categorieblokken. Producten voeg je daarna vanuit de productlijst toe.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className={styles.pickerBody}>
          <label className={styles.pickerSearch}>
            <Search aria-hidden="true" />
            <span>Categorieën zoeken</span>
            <input
              onChange={(event) => setQuery(event.currentTarget.value)}
              placeholder="Zoek op categorienaam"
              type="search"
              value={query}
            />
          </label>
          {visibleCategories.length ? (
            <div className={styles.categoryPickerGrid}>
              {visibleCategories.map((categoryName) => {
                const placed = placedCategories.has(categoryName);
                const productCount = products.filter((product) => product.category === categoryName).length;
                return (
                  <label data-placed={placed || undefined} key={categoryName}>
                    <input
                      checked={selected.includes(categoryName)}
                      disabled={placed || submitting || busy}
                      onChange={() => toggle(categoryName)}
                      type="checkbox"
                    />
                    <Layers3 aria-hidden="true" />
                    <span><strong>{categoryName}</strong><small>{placed ? "Al toegevoegd" : `${productCount} ${productCount === 1 ? "product" : "producten"}`}</small></span>
                  </label>
                );
              })}
            </div>
          ) : (
            <p className={styles.emptyCopy}>Geen categorieën gevonden. Pas je zoekopdracht aan.</p>
          )}
        </DialogBody>
        <DialogFooter aside={`${selected.length} geselecteerd`}>
          <Button disabled={submitting} onClick={() => onOpenChange(false)} type="button" variant="secondary">Annuleren</Button>
          <Button disabled={!selected.length || submitting || busy} onClick={() => void submit()} type="button">
            <Plus aria-hidden="true" /> {submitting ? "Toevoegen…" : `${selected.length || ""} ${selected.length === 1 ? "categorie" : "categorieën"} toevoegen`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type MediaPlacement = "logo" | "media" | "menu-logo";

function MediaPickerDialog({
  busy,
  media,
  onAdd,
  onOpenChange,
  open
}: {
  busy: boolean;
  media: MenuStudioMediaOption[];
  onAdd: (assetIds: string[], placement: MediaPlacement) => Promise<void>;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  const [kind, setKind] = useState<"all" | "image" | "video">("all");
  const [placement, setPlacement] = useState<MediaPlacement>("media");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const normalizedQuery = query.trim().toLocaleLowerCase("nl-NL");
  const compatibleMedia = media.filter((asset) => placement === "media" ||
    asset.kind === "image" || asset.kind === "logo");
  const visibleMedia = compatibleMedia.filter((asset) => {
    const matchesQuery = !normalizedQuery || asset.name.toLocaleLowerCase("nl-NL").includes(normalizedQuery);
    const matchesKind = kind === "all" || (kind === "video"
      ? asset.kind === "video" || asset.kind === "animation"
      : asset.kind !== "video" && asset.kind !== "animation");
    return matchesQuery && matchesKind;
  });

  useEffect(() => {
    if (!open) {
      setKind("all");
      setPlacement("media");
      setQuery("");
      setSelected([]);
    }
  }, [open]);

  const choosePlacement = (nextPlacement: MediaPlacement) => {
    setPlacement(nextPlacement);
    setKind(nextPlacement === "media" ? kind : "image");
    setSelected((current) => {
      const allowed = current.filter((assetId) => {
        const asset = media.find((candidate) => candidate.id === assetId);
        return asset && (nextPlacement === "media" || asset.kind === "image" || asset.kind === "logo");
      });
      return nextPlacement === "menu-logo" ? allowed.slice(0, 1) : allowed;
    });
  };

  const toggle = (assetId: string) => setSelected((current) => {
    if (current.includes(assetId)) return current.filter((candidate) => candidate !== assetId);
    return placement === "menu-logo" ? [assetId] : [...current, assetId];
  });

  const submit = async () => {
    if (!selected.length || submitting || busy) return;
    setSubmitting(true);
    await onAdd(selected, placement);
    setSubmitting(false);
    onOpenChange(false);
  };

  return (
    <Dialog
      onOpenChange={(nextOpen) => {
        if (!submitting) onOpenChange(nextOpen);
      }}
      open={open}
    >
      <DialogContent className={styles.pickerDialog} closeLabel="Media sluiten">
        <DialogHeader>
          <DialogTitle>Media toevoegen</DialogTitle>
          <DialogDescription>
            Zoek gevalideerde media en kies hoe deze in het menu wordt geplaatst.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className={styles.pickerBody}>
          <fieldset className={styles.placementPicker}>
            <legend>Plaatsing</legend>
            <div>
              {(["media", "logo", "menu-logo"] as const).map((option) => (
                <button
                  aria-pressed={placement === option}
                  key={option}
                  onClick={() => choosePlacement(option)}
                  type="button"
                >{option === "media" ? "Op het canvas" : option === "logo" ? "Als logoblok" : "Als menulogo"}</button>
              ))}
            </div>
          </fieldset>
          <div className={styles.pickerToolbar}>
            <label className={styles.pickerSearch}>
              <Search aria-hidden="true" />
              <span>Media zoeken</span>
              <input
                onChange={(event) => setQuery(event.currentTarget.value)}
                placeholder="Zoek op medianaam"
                type="search"
                value={query}
              />
            </label>
            <label className={styles.pickerFilter}>Type
              <select
                disabled={placement !== "media"}
                onChange={(event) => setKind(event.currentTarget.value as typeof kind)}
                value={kind}
              >
                <option value="all">Alle media</option>
                <option value="image">Afbeeldingen</option>
                <option value="video">Video en animatie</option>
              </select>
            </label>
          </div>
          {visibleMedia.length ? (
            <div className={styles.mediaPickerGrid}>
              {visibleMedia.map((asset) => (
                <label data-selected={selected.includes(asset.id) || undefined} key={asset.id}>
                  <input
                    checked={selected.includes(asset.id)}
                    disabled={submitting || busy}
                    onChange={() => toggle(asset.id)}
                    type={placement === "menu-logo" ? "radio" : "checkbox"}
                  />
                  {asset.kind === "video" || asset.kind === "animation"
                    ? <Video aria-hidden="true" />
                    : <ImageIcon aria-hidden="true" />}
                  <span><strong>{asset.name}</strong><small>{mediaKindLabel(asset.kind)}</small></span>
                </label>
              ))}
            </div>
          ) : (
            <p className={styles.emptyCopy}>Geen passende media gevonden. Pas je zoekopdracht of plaatsing aan.</p>
          )}
        </DialogBody>
        <DialogFooter aside={`${selected.length} geselecteerd`}>
          <Button disabled={submitting} onClick={() => onOpenChange(false)} type="button" variant="secondary">Annuleren</Button>
          <Button disabled={!selected.length || submitting || busy} onClick={() => void submit()} type="button">
            <Plus aria-hidden="true" /> {submitting ? "Toevoegen…" : `${selected.length || ""} ${selected.length === 1 ? "item" : "items"} toevoegen`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SortableBlock({
  block,
  disabled,
  onMove,
  onRemove,
  onRenameCategory,
  onSelect,
  onSelectGroup,
  selected,
  onUpdateGroup
}: {
  block: MenuBlock;
  disabled: boolean;
  onMove: (direction: "down" | "up") => void;
  onRemove: () => void;
  onRenameCategory: (labelOverride: string | null) => void;
  onSelect: () => void;
  onSelectGroup: (groupId: string) => void;
  selected: boolean;
  onUpdateGroup: (
    categoryId: string,
    group: MenuProductGroupPlacement,
    policy: MenuProductGroupPlacement["pricePolicy"]
  ) => void;
}) {
  const sortable = useSortable({ disabled, id: block.id });
  const style = {
    transform: CSS.Transform.toString(sortable.transform),
    transition: sortable.transition
  };
  return (
    <li data-selected={selected || undefined} ref={sortable.setNodeRef} style={style}>
      <button
        aria-label={`Versleep ${blockLabel(block)}`}
        className={styles.dragHandle}
        {...sortable.attributes}
        {...sortable.listeners}
        type="button"
      ><GripVertical aria-hidden="true" /></button>
      <div>
        <button className={styles.blockSelect} onClick={onSelect} type="button">
          <strong>{blockLabel(block)}</strong>
          <span>{selected ? "Geselecteerd" : "Inspecteren"}</span>
        </button>
        <small>{blockDetail(block)}</small>
        {block.type === "category" ? (
          <label className={styles.inlineField}>
            <span>Zichtbaar categorielabel</span>
            <input
              defaultValue={block.labelOverride ?? block.source.sourceName}
              key={`${block.id}:${block.labelOverride ?? "source"}`}
              maxLength={56}
              onBlur={(event) => {
                const value = event.currentTarget.value.trim();
                onRenameCategory(value && value !== block.source.sourceName ? value : null);
              }}
            />
            <small>Bron: {block.source.sourceName} · {block.source.sourceCategoryId}</small>
          </label>
        ) : null}
        {block.type === "category" ? block.productNodes.map((node) => node.kind === "product-group" ? (
          <div className={styles.groupPolicy} key={node.id}>
            <button onClick={() => onSelectGroup(node.id)} type="button">{node.title} bewerken</button>
            <label>
              <span>Prijsweergave</span>
            <select
              aria-label={`Prijsweergave voor ${node.title}`}
              onChange={(event) => onUpdateGroup(
                block.id,
                node,
                event.currentTarget.value as MenuProductGroupPlacement["pricePolicy"]
              )}
              value={node.pricePolicy}
            >
              <option value="from">Vanafprijs</option>
              <option value="shared">Gedeelde prijs</option>
              <option value="separate">Afzonderlijk</option>
            </select>
            </label>
          </div>
        ) : null) : null}
      </div>
      <div className={styles.layerActions}>
        <button aria-label={`${blockLabel(block)} omhoog`} onClick={() => onMove("up")} type="button"><ChevronUp aria-hidden="true" /></button>
        <button aria-label={`${blockLabel(block)} omlaag`} onClick={() => onMove("down")} type="button"><ChevronDown aria-hidden="true" /></button>
        <button aria-label={`Verwijder ${blockLabel(block)}`} className={styles.removeButton} onClick={onRemove} type="button"><Trash2 aria-hidden="true" /></button>
      </div>
    </li>
  );
}

function BlockInspector({
  block,
  media,
  onChange,
  onReplaceAsset,
  orientation
}: {
  block: MenuBlock;
  media: MenuStudioMediaOption[];
  onChange: (block: MenuBlock) => void;
  onReplaceAsset: (asset: MenuStudioMediaOption) => void;
  orientation: "landscape" | "portrait";
}) {
  const layout = block.layout[orientation];
  const appearance = block.type === "image" || block.type === "video"
    ? block.orientationAppearance?.[orientation] ?? block.appearance
    : null;
  const currentAsset = block.type === "image" || block.type === "video" || block.type === "logo"
    ? media.find((asset) => asset.id === block.assetId)
    : null;
  const compatibleMedia = media.filter((asset) =>
    block.type === "video"
      ? asset.kind === "video"
      : block.type === "image" || block.type === "logo"
        ? asset.kind !== "video"
        : false
  );
  const setLayout = (key: "h" | "rotation" | "w" | "x" | "y", value: number) => {
    onChange({
      ...block,
      layout: {
        ...block.layout,
        [orientation]: { ...layout, [key]: value }
      }
    });
  };
  const setAppearance = (
    next: Extract<MenuBlock, { type: "image" | "video" }>["appearance"]
  ) => {
    if (block.type !== "image" && block.type !== "video") return;
    onChange({
      ...block,
      orientationAppearance: {
        ...block.orientationAppearance,
        [orientation]: next
      }
    });
  };
  return (
    <section aria-label={`Inspector voor ${blockLabel(block)}`} className={styles.inspector}>
      <header><span>Inspector</span><h3>{blockLabel(block)}</h3></header>
      <div className={styles.inspectorGrid}>
        {(["x", "y", "w", "h", "rotation"] as const).map((key) => (
          <NumericField
            key={key}
            label={key === "rotation" ? "Rotatie" : key.toUpperCase()}
            min={key === "w" || key === "h" ? 1 : key === "rotation" ? -180 : -7680}
            onCommit={(value) => setLayout(key, value)}
            value={layout[key]}
          />
        ))}
      </div>
      <div className={styles.inspectorChecks}>
        <label><input checked={block.hidden === true} onChange={(event) => onChange({ ...block, hidden: event.currentTarget.checked })} type="checkbox" /> Verborgen</label>
        <label><input checked={block.locked === true} onChange={(event) => onChange({ ...block, locked: event.currentTarget.checked })} type="checkbox" /> Layout vergrendeld</label>
      </div>
      {block.type === "text" ? (
        <label className={styles.inspectorField}>Tekst
          <textarea defaultValue={block.text} maxLength={500} onBlur={(event) => onChange({ ...block, text: event.currentTarget.value.trim() })} />
        </label>
      ) : null}
      {block.type === "promo" ? (
        <>
          <label className={styles.inspectorField}>Titel
            <input defaultValue={block.title} maxLength={120} onBlur={(event) => {
              const title = event.currentTarget.value.trim();
              if (title) onChange({ ...block, title });
            }} />
          </label>
          <label className={styles.inspectorField}>Toelichting
            <textarea defaultValue={block.body ?? ""} maxLength={240} onBlur={(event) => onChange({ ...block, body: event.currentTarget.value.trim() || null })} />
          </label>
        </>
      ) : null}
      {block.type === "image" || block.type === "video" ? (
        <>
          <label className={styles.inspectorField}>Beeldvulling
            <select onChange={(event) => onChange({
              ...block,
              orientationAppearance: {
                ...block.orientationAppearance,
                [orientation]: {
                  ...appearance!,
                  fit: event.currentTarget.value as "contain" | "cover" | "fill"
                }
              }
            })} value={appearance!.fit}>
              <option value="contain">Contain</option>
              <option value="cover">Cover</option>
              <option value="fill">Fill</option>
            </select>
          </label>
          <div className={styles.inspectorGrid}>
            <NumericField label="Focus X" max={1} min={0} onCommit={(x) => setAppearance({ ...appearance!, focalPoint: { ...appearance!.focalPoint, x } })} step={0.05} value={appearance!.focalPoint.x} />
            <NumericField label="Focus Y" max={1} min={0} onCommit={(y) => setAppearance({ ...appearance!, focalPoint: { ...appearance!.focalPoint, y } })} step={0.05} value={appearance!.focalPoint.y} />
          </div>
        </>
      ) : null}
      {block.type === "image" ? (
        <>
          <label className={styles.inspectorField}>Alt-/redactiebeschrijving
            <input defaultValue={block.alt ?? ""} maxLength={180} onBlur={(event) => onChange({ ...block, alt: event.currentTarget.value.trim() || null })} />
          </label>
          <label className={styles.inspectorField}>Bijschrift
            <input defaultValue={block.caption ?? ""} maxLength={180} onBlur={(event) => onChange({ ...block, caption: event.currentTarget.value.trim() || null })} />
          </label>
        </>
      ) : null}
      {block.type === "video" ? (
        <>
          <div className={styles.inspectorChecks}>
            <label><input checked={block.playback.autoplay} onChange={(event) => onChange({ ...block, playback: { ...block.playback, autoplay: event.currentTarget.checked } })} type="checkbox" /> Automatisch afspelen</label>
            <label><input checked={block.playback.loop} onChange={(event) => onChange({ ...block, playback: { ...block.playback, loop: event.currentTarget.checked } })} type="checkbox" /> Herhalen</label>
          </div>
          <div className={styles.inspectorGrid}>
            <NumericField label="Start (ms)" min={0} onCommit={(startMs) => onChange({ ...block, playback: { ...block.playback, startMs } })} value={block.playback.startMs} />
            <NumericField label="Einde (ms)" min={1} onCommit={(endMs) => onChange({ ...block, playback: { ...block.playback, endMs } })} value={block.playback.endMs ?? Math.max(1, block.playback.startMs + 1)} />
          </div>
          <p className={styles.inspectorNote}>Video blijft altijd gedempt; poster- en codec-fallback worden bij publicatie vastgezet.</p>
        </>
      ) : null}
      {block.type === "logo" ? (
        <>
          <label className={styles.inspectorField}>Kleurmodus
            <select disabled={currentAsset?.mimeType !== "image/svg+xml" || !currentAsset.tintable} onChange={(event) => {
              const mode = event.currentTarget.value as "monochrome" | "original" | "palette";
              onChange({
                ...block,
                color: mode === "original" ? { mode } : { mode, token: "accent" }
              });
            }} value={block.color.mode}>
              <option value="original">Origineel</option>
              <option value="monochrome">Monochroom</option>
              <option value="palette">Themapalet</option>
            </select>
          </label>
          {currentAsset?.mimeType !== "image/svg+xml" || !currentAsset.tintable ? (
            <p className={styles.inspectorNote}>{currentAsset?.mimeType === "image/svg+xml" ? "Dit meerkleurige SVG-logo blijft in de originele kleur." : "Rasterlogo’s blijven verplicht in de originele kleur."}</p>
          ) : null}
          {block.color.mode !== "original" ? (
            <label className={styles.inspectorField}>Semantische kleur
              <select onChange={(event) => onChange({ ...block, color: { ...block.color, token: event.currentTarget.value as "accent" | "accent-ink" | "support" } })} value={block.color.token ?? "accent"}>
                <option value="accent">Accent</option>
                <option value="support">Support</option>
                <option value="accent-ink">Veilige accent-ink</option>
              </select>
            </label>
          ) : null}
        </>
      ) : null}
      {compatibleMedia.length ? (
        <label className={styles.inspectorField}>Asset vervangen
          <select defaultValue="" onChange={(event) => {
            const asset = compatibleMedia.find((candidate) => candidate.id === event.currentTarget.value);
            if (asset) onReplaceAsset(asset);
            event.currentTarget.value = "";
          }}>
            <option value="">Kies een immutable assetversie…</option>
            {compatibleMedia.map((asset) => <option key={asset.id} value={asset.id}>{asset.name}</option>)}
          </select>
        </label>
      ) : null}
    </section>
  );
}

function GroupInspector({
  categoryId,
  group,
  onAddFreeText,
  onChange,
  onClose,
  onLinkProduct,
  onUngroup,
  products
}: {
  categoryId: string;
  group: MenuProductGroupPlacement;
  onAddFreeText: () => void;
  onChange: (group: MenuProductGroupPlacement) => void;
  onClose: () => void;
  onLinkProduct: (product: MenuStudioProductOption) => void;
  onUngroup: () => void;
  products: MenuStudioProductOption[];
}) {
  const [dropActive, setDropActive] = useState(false);
  const updateLines = (lines: MenuProductGroupPlacement["secondaryLineItems"]) => onChange({
    ...group,
    secondaryLineItems: lines.map((line, order) => ({ ...line, order }))
  });
  const moveLine = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= group.secondaryLineItems.length) return;
    updateLines(arrayMove(group.secondaryLineItems, index, target));
  };
  const replaceLinkedProduct = (index: number, product: MenuStudioProductOption) => {
    const line = group.secondaryLineItems[index];
    if (!line || line.kind !== "linked-product") return;
    const replacement = productPlacement(product, 0);
    const lines = [...group.secondaryLineItems];
    lines[index] = {
      ...line,
      labelOverride: null,
      productRef: replacement.productRef,
      snapshotFallback: replacement.snapshotFallback
    };
    updateLines(lines);
  };
  const handleDrop = (event: ReactDragEvent<HTMLElement>) => {
    event.preventDefault();
    setDropActive(false);
    const payload = readMenuStudioDragPayload(event);
    if (payload?.kind === "product") {
      const product = products.find((candidate) => candidate.id === payload.productId);
      if (product) onLinkProduct(product);
    } else if (payload?.kind === "element" && payload.element === "free-text") {
      onAddFreeText();
    }
  };
  return (
    <section aria-label={`Productgroep ${group.title} bewerken`} className={styles.inspector}>
      <header className={styles.inspectorHeader}>
        <div><span>Productgroep</span><h3>{group.title}</h3></div>
        <button aria-label={`Productgroep ${group.title} sluiten`} onClick={onClose} type="button"><X aria-hidden="true" /></button>
      </header>
      <p className={styles.inspectorNote}>Categorie {categoryId}. Gekoppelde regels houden hun bron-ID; vrije regels blijven presentatie-inhoud.</p>
      <div
        aria-label="Sleep een product of vrije subregel naar deze productgroep"
        className={styles.groupDropZone}
        data-drop-active={dropActive || undefined}
        onDragEnterCapture={(event) => {
          event.preventDefault();
          setDropActive(true);
        }}
        onDragLeaveCapture={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDropActive(false);
        }}
        onDragOverCapture={(event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = "copy";
        }}
        onDropCapture={handleDrop}
        role="region"
      >Sleep een product of vrije subregel hierheen, of gebruik de knoppen.</div>
      <label className={styles.inspectorField}>Groepsnaam
        <input defaultValue={group.title} maxLength={120} onBlur={(event) => {
          const title = event.currentTarget.value.trim();
          if (title) onChange({ ...group, title });
        }} />
      </label>
      <div className={styles.groupLinesEditor}>
        {group.secondaryLineItems.map((line, index) => (
          <article key={line.id}>
            <span>{line.kind === "linked-product" ? `Gekoppeld · ${line.productRef.source}` : "Vrije invoer"}</span>
            <input
              aria-label={`${line.kind === "linked-product" ? "Gekoppelde subregel" : "Vrije subregel"} ${index + 1}`}
              defaultValue={line.kind === "free-text" ? line.label : line.labelOverride ?? line.snapshotFallback.variantLabel ?? line.snapshotFallback.name}
              maxLength={24}
              onBlur={(event) => {
                const label = event.currentTarget.value.trim();
                if (!label) return;
                const lines = [...group.secondaryLineItems];
                lines[index] = line.kind === "free-text"
                  ? { ...line, label }
                  : { ...line, labelOverride: label === line.snapshotFallback.name ? null : label };
                updateLines(lines);
              }}
            />
            {line.kind === "linked-product" ? (
              <LinkedProductSource
                current={products.find((product) => product.id === line.productRef.productId)}
                line={line}
                onReplace={(product) => replaceLinkedProduct(index, product)}
                products={products}
              />
            ) : null}
            <div className={styles.groupLineActions}>
              <button aria-label={`${index + 1} omhoog`} onClick={() => moveLine(index, -1)} type="button"><ChevronUp aria-hidden="true" /></button>
              <button aria-label={`${index + 1} omlaag`} onClick={() => moveLine(index, 1)} type="button"><ChevronDown aria-hidden="true" /></button>
              <button aria-label={`${index + 1} verwijderen`} disabled={group.secondaryLineItems.length === 1} onClick={() => updateLines(group.secondaryLineItems.filter((candidate) => candidate.id !== line.id))} type="button"><Trash2 aria-hidden="true" /></button>
            </div>
          </article>
        ))}
      </div>
      <button className={styles.inspectorAction} onClick={onAddFreeText} type="button"><Plus aria-hidden="true" /> Vrije invoer toevoegen</button>
      <div className={styles.inspectorGrid}>
        <label className={styles.inspectorField}>Scheiding
          <select onChange={(event) => onChange({ ...group, display: { ...group.display, separator: event.currentTarget.value as "comma" | "dot" | "slash" } })} value={group.display.separator}>
            <option value="dot">Punt</option><option value="comma">Komma</option><option value="slash">Slash</option>
          </select>
        </label>
        <label className={styles.inspectorField}>Regels
          <select onChange={(event) => onChange({ ...group, display: { ...group.display, maxLines: Number(event.currentTarget.value) as 1 | 2 } })} value={group.display.maxLines}>
            <option value={1}>1 regel</option><option value={2}>2 regels</option>
          </select>
        </label>
      </div>
      <button className={styles.inspectorAction} onClick={onUngroup} type="button">Groep splitsen naar gekoppelde producten</button>
      <button className={styles.inspectorDone} onClick={onClose} type="button"><CheckCircle2 aria-hidden="true" /> Klaar met productgroep</button>
    </section>
  );
}

function LinkedProductSource({
  current,
  line,
  onReplace,
  products
}: {
  current?: MenuStudioProductOption;
  line: Extract<MenuProductGroupPlacement["secondaryLineItems"][number], { kind: "linked-product" }>;
  onReplace: (product: MenuStudioProductOption) => void;
  products: MenuStudioProductOption[];
}) {
  const stale = Boolean(
    current && current.sourceRevision !== (line.productRef.sourceRevision ?? "")
  );
  const status = !current
    ? "Bronproduct ontbreekt; de veilige publicatiesnapshot blijft zichtbaar."
    : !current.available
      ? "Bronproduct is niet beschikbaar; het ingestelde beschikbaarheidsbeleid wordt toegepast."
      : stale
        ? `Nieuwere bronrevisie ${current.sourceRevision} beschikbaar; de snapshot wijzigt pas na bijwerken.`
        : `Bronrevisie ${line.productRef.sourceRevision ?? "onbekend"} is actueel.`;
  return (
    <div className={styles.linkedSource} data-needs-reconcile={!current || stale || !current.available || undefined}>
      <p role={!current || stale ? "status" : undefined}>{status}</p>
      <label>Bronproduct wisselen
        <select onChange={(event) => {
          const product = products.find((candidate) => candidate.id === event.currentTarget.value);
          if (product) onReplace(product);
        }} value={line.productRef.productId}>
          {!current ? <option value={line.productRef.productId}>Ontbrekend · snapshot behouden</option> : null}
          {products.map((product) => (
            <option key={product.id} value={product.id}>{product.name} · {product.sourceKind === "twelve_excel" ? "Twelve" : "Handmatig"}</option>
          ))}
        </select>
      </label>
      {current && stale ? (
        <button onClick={() => onReplace(current)} type="button">Snapshot bijwerken</button>
      ) : null}
    </div>
  );
}

function NumericField({
  label,
  max,
  min,
  onCommit,
  step = 1,
  value
}: {
  label: string;
  max?: number;
  min: number;
  onCommit: (value: number) => void;
  step?: number;
  value: number;
}) {
  return (
    <label className={styles.inspectorField}>{label}
      <input
        defaultValue={value}
        key={`${label}:${value}`}
        max={max}
        min={min}
        onBlur={(event) => {
          const numeric = Number(event.currentTarget.value);
          if (Number.isFinite(numeric)) onCommit(Math.min(max ?? Number.POSITIVE_INFINITY, Math.max(min, numeric)));
        }}
        step={step}
        type="number"
      />
    </label>
  );
}

function Status({ status }: { status: "error" | "published" | "saved" | "saving" | "unsaved" }) {
  const label = status === "saving" ? "Opslaan…"
    : status === "saved" ? "Opgeslagen"
      : status === "published" ? "Gepubliceerd"
        : status === "error" ? "Herstel nodig"
          : "Concept";
  return <span className={styles.saveStatus} data-status={status}>{status === "error" ? <AlertTriangle aria-hidden="true" /> : <CheckCircle2 aria-hidden="true" />}{label}</span>;
}

function PanelHeading({ icon, title }: { icon: React.ReactNode; title: string }) {
  return <header className={styles.panelHeading}>{icon}<div><span>Menu Studio</span><h2>{title}</h2></div></header>;
}

function categoryBlock(
  product: MenuStudioProductOption,
  blocks: MenuBlock[],
  explicitPortraitColumns?: 1 | 2
): Extract<MenuBlock, { type: "category" }> {
  const categories = blocks.filter((block) => block.type === "category");
  const useLeft = categories.filter((block) => block.layout.landscape.x < 960).length <=
    categories.filter((block) => block.layout.landscape.x >= 960).length;
  const useTwoPortraitColumns = portraitColumnCount(blocks, explicitPortraitColumns) === 2;
  const source = product.sourceKind === "twelve_excel"
    ? {
        providerConnectionId: product.sourceId,
        source: "twelve" as const,
        sourceCategoryId: slugId(product.category),
        sourceName: product.category
      }
    : {
        source: "manual" as const,
        sourceCategoryId: slugId(product.category),
        sourceName: product.category
      };
  return {
    id: crypto.randomUUID(),
    layout: {
      landscape: { h: 704, rotation: 0, w: 846, x: useLeft ? 96 : 978, y: 248 },
      portrait: useTwoPortraitColumns
        ? { h: 1388, rotation: 0, w: 458, x: useLeft ? 72 : 550, y: 348 }
        : { h: 1388, rotation: 0, w: 936, x: 72, y: 348 }
    },
    order: blocks.length,
    productNodes: [],
    source,
    type: "category"
  };
}

function productPlacement(product: MenuStudioProductOption, order: number): MenuProductPlacement {
  const productRef = product.sourceKind === "twelve_excel"
    ? {
        productId: product.id,
        providerConnectionId: product.sourceId,
        source: "twelve" as const
      }
    : { productId: product.id, source: "manual" as const };
  return {
    id: crypto.randomUUID(),
    kind: "product",
    order,
    snapshotFallback: {
      available: product.available,
      name: product.name,
      price: {
        amountMinor: product.priceCents,
        currency: product.currency,
        taxMode: product.taxMode,
        ...(product.taxRateBps !== undefined ? { taxRateBps: product.taxRateBps } : {}),
        ...(product.unitKey ? { unitKey: product.unitKey } : {})
      }
    },
    productRef: { ...productRef, sourceRevision: product.sourceRevision }
  };
}

function findCategory(blocks: MenuBlock[], name: string) {
  return blocks.find(
    (block): block is Extract<MenuBlock, { type: "category" }> =>
      block.type === "category" && block.source.sourceName === name
  );
}

function portraitColumnCount(blocks: MenuBlock[], explicit?: 1 | 2): 1 | 2 {
  if (explicit) return explicit;
  return blocks.some((block) =>
    (block.type === "category" || block.type === "product-group") && block.layout.portrait.w < 700
  ) ? 2 : 1;
}

function findProduct(blocks: MenuBlock[], productId: string) {
  for (const block of blocks) {
    if (block.type !== "category") continue;
    const node = block.productNodes.find(
      (candidate): candidate is MenuProductPlacement =>
        candidate.kind === "product" && candidate.productRef.productId === productId
    );
    if (node) return { category: block, node };
  }
  return null;
}

function findGroupedProduct(blocks: MenuBlock[], productId: string) {
  for (const block of blocks) {
    if (block.type !== "category") continue;
    const group = block.productNodes.find(
      (candidate): candidate is MenuProductGroupPlacement =>
        candidate.kind === "product-group" && candidate.secondaryLineItems.some(
          (line) => line.kind === "linked-product" && line.productRef.productId === productId
        )
    );
    if (group) return { category: block, group };
  }
  return null;
}

function appendFreeTextLine(group: MenuProductGroupPlacement): MenuProductGroupPlacement {
  return {
    ...group,
    secondaryLineItems: [
      ...group.secondaryLineItems,
      {
        id: crypto.randomUUID(),
        kind: "free-text",
        label: "Vrije invoer",
        order: group.secondaryLineItems.length,
        presentationOnly: true
      }
    ]
  };
}

const menuStudioDragMime = "application/x-veyocast-menu-studio";
let activeMenuStudioDragPayload: MenuStudioDragPayload | null = null;

type MenuStudioDragPayload =
  | { categoryName: string; kind: "category" }
  | { element: "free-text" | "promo" | "text"; kind: "element" }
  | { assetId: string; kind: "media"; placement: "logo" | "media" }
  | { kind: "product"; productId: string };

function setMenuStudioDragPayload(
  event: ReactDragEvent<HTMLElement>,
  payload: MenuStudioDragPayload
) {
  activeMenuStudioDragPayload = payload;
  event.dataTransfer.effectAllowed = "copy";
  event.dataTransfer.setData(menuStudioDragMime, JSON.stringify(payload));
  event.dataTransfer.setData("text/plain", "VeyoCast Menu Studio-element");
}

function readMenuStudioDragPayload(
  event: ReactDragEvent<HTMLElement>
): MenuStudioDragPayload | null {
  let candidate: unknown = activeMenuStudioDragPayload;
  try {
    const serialized = event.dataTransfer.getData(menuStudioDragMime);
    if (serialized) candidate = JSON.parse(serialized) as unknown;
    activeMenuStudioDragPayload = null;
    const parsed = candidate;
    if (!parsed || typeof parsed !== "object") return null;
    const value = parsed as Record<string, unknown>;
    if (value.kind === "category" && typeof value.categoryName === "string") {
      return { categoryName: value.categoryName, kind: "category" };
    }
    if (value.kind === "product" && typeof value.productId === "string") {
      return { kind: "product", productId: value.productId };
    }
    if (
      value.kind === "element" &&
      (value.element === "free-text" || value.element === "promo" || value.element === "text")
    ) {
      return { element: value.element, kind: "element" };
    }
    if (
      value.kind === "media" &&
      typeof value.assetId === "string" &&
      (value.placement === "logo" || value.placement === "media")
    ) {
      return { assetId: value.assetId, kind: "media", placement: value.placement };
    }
  } catch {
    activeMenuStudioDragPayload = null;
    return null;
  }
  return null;
}

function floatingLayout(blocks: MenuBlock[]) {
  const floating = blocks.filter((block) =>
    block.type !== "category" && block.type !== "product-group" && !block.hidden
  );
  const slots = [
    [1490, 760, 718, 1510], [1150, 760, 388, 1510], [810, 760, 72, 1510],
    [1490, 560, 718, 1280], [1150, 560, 388, 1280], [810, 560, 72, 1280],
    [470, 760, 718, 1050], [130, 760, 388, 1050], [470, 560, 72, 1050]
  ] as const;
  for (const [landscapeX, landscapeY, portraitX, portraitY] of slots) {
    const candidate = {
      landscape: { h: 170, rotation: 0, w: 300, x: landscapeX, y: landscapeY },
      portrait: { h: 190, rotation: 0, w: 290, x: portraitX, y: portraitY }
    };
    if (floating.every((block) =>
      !overlaps(candidate.landscape, block.layout.landscape) &&
      !overlaps(candidate.portrait, block.layout.portrait)
    )) return candidate;
  }
  return {
    landscape: { h: 170, rotation: 0, w: 300, x: 130, y: 560 },
    portrait: { h: 190, rotation: 0, w: 290, x: 718, y: 820 }
  };
}

function overlaps(
  left: { h: number; w: number; x: number; y: number },
  right: { h: number; w: number; x: number; y: number }
) {
  return left.x < right.x + right.w && left.x + left.w > right.x &&
    left.y < right.y + right.h && left.y + left.h > right.y;
}

function blockLabel(block: MenuBlock) {
  if (block.type === "category") return block.labelOverride ?? block.source.sourceName;
  if (block.type === "product-group") return block.group.title;
  if (block.type === "promo") return block.title;
  if (block.type === "text") return block.text || "Tekstblok";
  if (block.type === "video") return "Videoblok";
  if (block.type === "logo") return "Logoblok";
  return "Afbeelding";
}

function blockDetail(block: MenuBlock) {
  if (block.type === "category") return `${block.productNodes.length} onderdelen`;
  if (block.type === "product-group") return `${block.group.secondaryLineItems.length} regels`;
  return block.type;
}

function formatPrice(cents: number, currency: string) {
  return new Intl.NumberFormat("nl-NL", { currency, style: "currency" }).format(cents / 100);
}

function mediaKindLabel(kind: MenuStudioMediaOption["kind"]) {
  if (kind === "video") return "Video";
  if (kind === "animation") return "Animatie";
  if (kind === "logo") return "Logo";
  return "Afbeelding";
}

function samePrice(
  left: MenuProductPlacement["snapshotFallback"]["price"],
  right: MenuProductPlacement["snapshotFallback"]["price"]
) {
  return left.amountMinor === right.amountMinor &&
    left.currency === right.currency &&
    left.taxMode === right.taxMode &&
    (left.taxRateBps ?? null) === (right.taxRateBps ?? null) &&
    (left.unitKey ?? null) === (right.unitKey ?? null);
}

function slugId(value: string) {
  const slug = value.normalize("NFKD").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return slug || crypto.randomUUID();
}
