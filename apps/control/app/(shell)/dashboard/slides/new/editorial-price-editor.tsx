"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useDroppable,
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
import { useEffect, useMemo, useState } from "react";
import { ArrowLeftRight, ChevronDown, ChevronUp, GripVertical } from "lucide-react";

import type {
  EditorialFocalPoint,
  EditorialPriceListConfiguration,
  EditorialPricePhotoMode
} from "@veyocast/contracts";
import { priceRowsThatFit } from "@veyocast/content-templates";
import { Button } from "@veyocast/ui";

import styles from "../../dynamic-content.module.css";

export type EditorialPriceProductOption = {
  category: string;
  currency: string;
  description: string | null;
  hasImage: boolean;
  id: string;
  name: string;
  priceCents: number;
  sortOrder: number;
};

type ColumnId = "left" | "right";
type PriceGroup = { category: string; id: string; productIds: string[] };
type PriceColumns = Record<ColumnId, PriceGroup[]>;

export function EditorialPriceEditor({
  defaultPhotoMode,
  maxItems,
  onChange,
  orientation,
  products,
  sourceId
}: {
  defaultPhotoMode: EditorialPricePhotoMode;
  maxItems: number;
  onChange: (value: string) => void;
  orientation: "landscape" | "portrait";
  products: EditorialPriceProductOption[];
  sourceId: string;
}) {
  const [columns, setColumns] = useState<PriceColumns>({ left: [], right: [] });
  const [categoryPhotoModes, setCategoryPhotoModes] = useState<
    Record<string, "inherit" | EditorialPricePhotoMode>
  >({});
  const [productFocalPoints, setProductFocalPoints] = useState<
    Record<string, EditorialFocalPoint>
  >({});
  const productById = useMemo(
    () => new Map(products.map((product) => [product.id, product])),
    [products]
  );
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    const selected = products.slice(0, Math.max(1, maxItems));
    const grouped = groupsForProducts(selected);
    const midpoint = Math.ceil(grouped.length / 2);
    setColumns({
      left: grouped.slice(0, midpoint),
      right: grouped.slice(midpoint).map((group) => ({
        ...group,
        id: groupId("right", group.category)
      }))
    });
    setCategoryPhotoModes({});
    setProductFocalPoints(Object.fromEntries(
      selected.filter((product) => product.hasImage).map((product) => [
        product.id,
        { x: 0.5, y: 0.5 }
      ])
    ));
  }, [maxItems, products, sourceId]);

  const configuration = useMemo<EditorialPriceListConfiguration>(() => ({
    categoryPhotoModes,
    columns: {
      left: serializeGroups(columns.left),
      right: serializeGroups(columns.right)
    },
    productFocalPoints
  }), [categoryPhotoModes, columns, productFocalPoints]);
  const serialized = JSON.stringify(configuration);

  useEffect(() => onChange(serialized), [onChange, serialized]);

  const capacity = priceRowsThatFit(orientation);
  const usage = {
    left: rowCount(columns.left),
    right: rowCount(columns.right)
  };
  const overflow = usage.left > capacity || usage.right > capacity;
  const selectedIds = new Set(
    [...columns.left, ...columns.right].flatMap((group) => group.productIds)
  );

  function handleDragEnd(event: DragEndEvent) {
    if (!event.over || event.active.id === event.over.id) return;
    const activeId = String(event.active.id);
    const overId = String(event.over.id);
    setColumns((current) => moveSortable(current, activeId, overId, productById));
  }

  function toggleProduct(product: EditorialPriceProductOption) {
    setColumns((current) => {
      const location = findProduct(current, product.id);
      if (location) {
        return removeProduct(current, location.column, location.groupIndex, product.id);
      }
      const target: ColumnId = rowCount(current.left) <= rowCount(current.right)
        ? "left"
        : "right";
      const next = cloneColumns(current);
      const group = next[target].find((entry) => entry.category === product.category);
      if (group) group.productIds.push(product.id);
      else next[target].push(newGroup(target, product.category, [product.id]));
      return next;
    });
  }

  function moveGroup(column: ColumnId, groupIndex: number, direction: -1 | 1) {
    setColumns((current) => {
      const targetIndex = groupIndex + direction;
      if (targetIndex < 0 || targetIndex >= current[column].length) return current;
      return {
        ...current,
        [column]: arrayMove(current[column], groupIndex, targetIndex)
      };
    });
  }

  function transferGroup(column: ColumnId, groupIndex: number) {
    setColumns((current) => {
      const target: ColumnId = column === "left" ? "right" : "left";
      const next = cloneColumns(current);
      const [group] = next[column].splice(groupIndex, 1);
      if (!group) return current;
      const existing = next[target].find((item) => item.category === group.category);
      if (existing) existing.productIds.push(...group.productIds);
      else next[target].push({ ...group, id: groupId(target, group.category) });
      return next;
    });
  }

  return (
    <section className={styles.editorialPriceEditor} aria-labelledby="price-order-title">
      <header>
        <div>
          <span>Prijslijstindeling</span>
          <h3 id="price-order-title">Selecteren en ordenen</h3>
        </div>
        <p>Categorieën tellen als rij. Sleep met muis of toetsenbord, of gebruik de verplaatsknoppen.</p>
      </header>

      <div className={styles.editorialProductPicker}>
        {products.map((product) => (
          <label key={product.id}>
            <input
              checked={selectedIds.has(product.id)}
              onChange={() => toggleProduct(product)}
              type="checkbox"
            />
            <span><strong>{product.name}</strong><small>{product.category}</small></span>
            <b>{formatPrice(product.priceCents, product.currency)}</b>
          </label>
        ))}
      </div>

      <DndContext
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
        sensors={sensors}
      >
        <div className={styles.editorialPriceColumns}>
          {(["left", "right"] as const).map((column) => (
            <PriceColumn
              capacity={capacity}
              categoryPhotoModes={categoryPhotoModes}
              column={column}
              groups={columns[column]}
              key={column}
              onCategoryMode={(category, mode) => setCategoryPhotoModes(
                (current) => ({ ...current, [category]: mode })
              )}
              onFocalPoint={(productId, point) => setProductFocalPoints(
                (current) => ({ ...current, [productId]: point })
              )}
              onMoveGroup={moveGroup}
              onTransferGroup={transferGroup}
              productById={productById}
              productFocalPoints={productFocalPoints}
              usage={usage[column]}
            />
          ))}
        </div>
      </DndContext>

      {overflow ? (
        <p className={styles.editorialOverflow} role="alert">
          Te veel rijen: verplaats of verwijder de gemarkeerde inhoud voordat je publiceert.
        </p>
      ) : null}
      <input
        aria-label="Prijslijst past binnen beide kolommen"
        checked={!overflow}
        className={styles.validationControl}
        onChange={() => undefined}
        required
        type="checkbox"
      />
      <input name="priceListJson" type="hidden" value={serialized} />
      <input name="priceOverflow" type="hidden" value={overflow ? "1" : "0"} />
      <input name="priceDefaultPhotoMode" type="hidden" value={defaultPhotoMode} />
    </section>
  );
}

function PriceColumn({
  capacity,
  categoryPhotoModes,
  column,
  groups,
  onCategoryMode,
  onFocalPoint,
  onMoveGroup,
  onTransferGroup,
  productById,
  productFocalPoints,
  usage
}: {
  capacity: number;
  categoryPhotoModes: Record<string, "inherit" | EditorialPricePhotoMode>;
  column: ColumnId;
  groups: PriceGroup[];
  onCategoryMode: (category: string, mode: "inherit" | EditorialPricePhotoMode) => void;
  onFocalPoint: (productId: string, point: EditorialFocalPoint) => void;
  onMoveGroup: (column: ColumnId, index: number, direction: -1 | 1) => void;
  onTransferGroup: (column: ColumnId, index: number) => void;
  productById: Map<string, EditorialPriceProductOption>;
  productFocalPoints: Record<string, EditorialFocalPoint>;
  usage: number;
}) {
  const droppable = useDroppable({ id: column });
  return (
    <section
      className={styles.editorialPriceColumn}
      data-overflow={usage > capacity}
      ref={droppable.setNodeRef}
    >
      <header><strong>{column === "left" ? "Links" : "Rechts"}</strong><span>{usage} / {capacity} rijen gebruikt</span></header>
      <SortableContext items={groups.map((group) => group.id)} strategy={verticalListSortingStrategy}>
        {groups.map((group, index) => (
          <SortableGroup
            categoryMode={categoryPhotoModes[group.category] ?? "inherit"}
            column={column}
            group={group}
            index={index}
            key={group.id}
            onCategoryMode={onCategoryMode}
            onFocalPoint={onFocalPoint}
            onMoveGroup={onMoveGroup}
            onTransferGroup={onTransferGroup}
            productById={productById}
            productFocalPoints={productFocalPoints}
          />
        ))}
      </SortableContext>
      {!groups.length ? <p>Sleep of selecteer producten voor deze kolom.</p> : null}
    </section>
  );
}

function SortableGroup({
  categoryMode,
  column,
  group,
  index,
  onCategoryMode,
  onFocalPoint,
  onMoveGroup,
  onTransferGroup,
  productById,
  productFocalPoints
}: {
  categoryMode: "inherit" | EditorialPricePhotoMode;
  column: ColumnId;
  group: PriceGroup;
  index: number;
  onCategoryMode: (category: string, mode: "inherit" | EditorialPricePhotoMode) => void;
  onFocalPoint: (productId: string, point: EditorialFocalPoint) => void;
  onMoveGroup: (column: ColumnId, index: number, direction: -1 | 1) => void;
  onTransferGroup: (column: ColumnId, index: number) => void;
  productById: Map<string, EditorialPriceProductOption>;
  productFocalPoints: Record<string, EditorialFocalPoint>;
}) {
  const sortable = useSortable({ id: group.id });
  return (
    <article
      className={styles.editorialPriceGroup}
      ref={sortable.setNodeRef}
      style={{ transform: CSS.Transform.toString(sortable.transform), transition: sortable.transition }}
    >
      <header>
        <button aria-label={`${group.category} verslepen`} type="button" {...sortable.attributes} {...sortable.listeners}><GripVertical aria-hidden="true" /></button>
        <strong>{group.category}</strong>
        <label><span>Foto’s</span><select value={categoryMode} onChange={(event) => onCategoryMode(group.category, event.currentTarget.value as "inherit" | EditorialPricePhotoMode)}><option value="inherit">Slide-instelling</option><option value="show">Tonen</option><option value="reserve-empty">Leeg reserveren</option></select></label>
        <div>
          <Button aria-label={`${group.category} omhoog`} onClick={() => onMoveGroup(column, index, -1)} size="sm" type="button" variant="ghost"><ChevronUp aria-hidden="true" /></Button>
          <Button aria-label={`${group.category} omlaag`} onClick={() => onMoveGroup(column, index, 1)} size="sm" type="button" variant="ghost"><ChevronDown aria-hidden="true" /></Button>
          <Button aria-label={`${group.category} naar andere kolom`} onClick={() => onTransferGroup(column, index)} size="sm" type="button" variant="ghost"><ArrowLeftRight aria-hidden="true" /></Button>
        </div>
      </header>
      <SortableContext items={group.productIds} strategy={verticalListSortingStrategy}>
        {group.productIds.map((productId) => {
          const product = productById.get(productId);
          return product ? (
            <SortableProduct
              focalPoint={productFocalPoints[productId] ?? { x: 0.5, y: 0.5 }}
              key={productId}
              onFocalPoint={onFocalPoint}
              product={product}
            />
          ) : null;
        })}
      </SortableContext>
    </article>
  );
}

function SortableProduct({ focalPoint, onFocalPoint, product }: {
  focalPoint: EditorialFocalPoint;
  onFocalPoint: (productId: string, point: EditorialFocalPoint) => void;
  product: EditorialPriceProductOption;
}) {
  const sortable = useSortable({ id: product.id });
  return (
    <div className={styles.editorialPriceProduct} ref={sortable.setNodeRef} style={{ transform: CSS.Transform.toString(sortable.transform), transition: sortable.transition }}>
      <button aria-label={`${product.name} verslepen`} type="button" {...sortable.attributes} {...sortable.listeners}><GripVertical aria-hidden="true" /></button>
      <span><strong>{product.name}</strong><small>{product.description || "Geen omschrijving"}</small></span>
      <b>{formatPrice(product.priceCents, product.currency)}</b>
      {product.hasImage ? (
        <fieldset><legend>Focal point {product.name}</legend><label>X <input max="100" min="0" onChange={(event) => onFocalPoint(product.id, { ...focalPoint, x: Number(event.currentTarget.value) / 100 })} type="range" value={Math.round(focalPoint.x * 100)} /></label><label>Y <input max="100" min="0" onChange={(event) => onFocalPoint(product.id, { ...focalPoint, y: Number(event.currentTarget.value) / 100 })} type="range" value={Math.round(focalPoint.y * 100)} /></label></fieldset>
      ) : null}
    </div>
  );
}

function moveSortable(
  columns: PriceColumns,
  activeId: string,
  overId: string,
  productById: Map<string, EditorialPriceProductOption>
) {
  const activeGroup = findGroup(columns, activeId);
  if (activeGroup) {
    const overGroup = findGroup(columns, overId);
    const targetColumn = overId === "left" || overId === "right"
      ? overId
      : overGroup?.column;
    if (!targetColumn) return columns;
    const next = cloneColumns(columns);
    const [group] = next[activeGroup.column].splice(activeGroup.index, 1);
    if (!group) return columns;
    const targetIndex = overGroup?.column === targetColumn
      ? overGroup.index
      : next[targetColumn].length;
    next[targetColumn].splice(targetIndex, 0, {
      ...group,
      id: groupId(targetColumn, group.category)
    });
    return next;
  }
  const activeProduct = findProduct(columns, activeId);
  if (!activeProduct) return columns;
  const overProduct = findProduct(columns, overId);
  const overGroup = findGroup(columns, overId);
  const targetColumn = overProduct?.column ?? overGroup?.column;
  const targetGroupIndex = overProduct?.groupIndex ?? overGroup?.index;
  if (!targetColumn || targetGroupIndex === undefined) return columns;
  const product = productById.get(activeId);
  if (!product) return columns;
  const next = removeProduct(
    columns,
    activeProduct.column,
    activeProduct.groupIndex,
    activeId
  );
  let groupIndex = next[targetColumn].findIndex(
    (group) => group.category === product.category
  );
  if (groupIndex < 0) {
    next[targetColumn].splice(
      Math.min(targetGroupIndex, next[targetColumn].length),
      0,
      newGroup(targetColumn, product.category, [])
    );
    groupIndex = next[targetColumn].findIndex(
      (group) => group.category === product.category
    );
  }
  const targetProducts = next[targetColumn][groupIndex]!.productIds;
  const overProductIndex = overProduct && overProduct.column === targetColumn &&
    next[targetColumn][groupIndex]?.category === product.category
    ? targetProducts.indexOf(overId)
    : targetProducts.length;
  targetProducts.splice(Math.max(0, overProductIndex), 0, activeId);
  return next;
}

function groupsForProducts(products: EditorialPriceProductOption[]) {
  const groups: PriceGroup[] = [];
  for (const product of products) {
    let group = groups.find((entry) => entry.category === product.category);
    if (!group) {
      group = newGroup("left", product.category, []);
      groups.push(group);
    }
    group.productIds.push(product.id);
  }
  return groups;
}

function serializeGroups(groups: PriceGroup[]) {
  return groups.flatMap((group) => [
    { category: group.category, kind: "category" as const },
    ...group.productIds.map((productId) => ({ kind: "product" as const, productId }))
  ]);
}

function rowCount(groups: PriceGroup[]) {
  return groups.reduce((count, group) => count + 1 + group.productIds.length, 0);
}

function newGroup(column: ColumnId, category: string, productIds: string[]): PriceGroup {
  return { category, id: groupId(column, category), productIds };
}

function groupId(column: ColumnId, category: string) {
  return `group:${column}:${category}`;
}

function cloneColumns(columns: PriceColumns): PriceColumns {
  return {
    left: columns.left.map((group) => ({ ...group, productIds: [...group.productIds] })),
    right: columns.right.map((group) => ({ ...group, productIds: [...group.productIds] }))
  };
}

function findGroup(columns: PriceColumns, id: string) {
  for (const column of ["left", "right"] as const) {
    const index = columns[column].findIndex((group) => group.id === id);
    if (index >= 0) return { column, index };
  }
  return null;
}

function findProduct(columns: PriceColumns, productId: string) {
  for (const column of ["left", "right"] as const) {
    for (let groupIndex = 0; groupIndex < columns[column].length; groupIndex += 1) {
      if (columns[column][groupIndex]!.productIds.includes(productId)) {
        return { column, groupIndex };
      }
    }
  }
  return null;
}

function removeProduct(
  columns: PriceColumns,
  column: ColumnId,
  groupIndex: number,
  productId: string
) {
  const next = cloneColumns(columns);
  const group = next[column][groupIndex];
  if (!group) return next;
  group.productIds = group.productIds.filter((id) => id !== productId);
  if (!group.productIds.length) next[column].splice(groupIndex, 1);
  return next;
}

function formatPrice(priceCents: number, currency: string) {
  return new Intl.NumberFormat("nl-NL", { currency, style: "currency" })
    .format(priceCents / 100);
}
