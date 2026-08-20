"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Search } from "lucide-react";

import {
  priceListCapacityReport,
  resolvePriceListPhotoVisibility,
  type ResolvedPriceListSection
} from "@veyocast/content-templates";
import type { PriceListSlideConfig } from "@veyocast/contracts";
import { Button } from "@veyocast/ui";

import styles from "../../dynamic-content.module.css";

export type PriceListProductOption = {
  available: boolean;
  category: string;
  dataSourceId: string | null;
  description: string;
  id: string;
  imageMediaAssetId: string | null;
  name: string;
  priceCents: number;
  sourceCategoryId: string;
  sortOrder: number;
};

type ProductState = PriceListProductOption & {
  column: "left" | "right";
  order: number;
  selected: boolean;
};

export function PriceListConfigurator({
  dataSourceId,
  onConfigurationChange,
  orientation,
  products,
  title
}: {
  dataSourceId: string;
  onConfigurationChange: (value: string) => void;
  orientation: string;
  products: PriceListProductOption[];
  title: string;
}) {
  const availableProducts = useMemo(
    () => products.filter((product) =>
      product.available &&
      (product.dataSourceId === dataSourceId || product.dataSourceId === null)
    ),
    [dataSourceId, products]
  );
  const [items, setItems] = useState<ProductState[]>(() =>
    availableProducts.map((product, index, allProducts) => {
      const categoryIndex = [...new Set(allProducts.map((item) => item.sourceCategoryId))]
        .sort((left, right) => left.localeCompare(right, "nl-NL"))
        .indexOf(product.sourceCategoryId);
      return {
        ...product,
        column: categoryIndex % 2 === 0 ? "left" : "right",
        order: index,
        selected: index < 200
      };
    })
  );
  const [slidePhotoMode, setSlidePhotoMode] = useState<"hide" | "show">("show");
  const [categoryPhotoModes, setCategoryPhotoModes] = useState<
    Record<string, "hide" | "inherit" | "show">
  >({});
  const [categoryLabels, setCategoryLabels] = useState<Record<string, string>>({});
  const [query, setQuery] = useState("");
  const [draggedProductId, setDraggedProductId] = useState<string | null>(null);
  const [dragAnnouncement, setDragAnnouncement] = useState("");
  const [categoryOrder, setCategoryOrder] = useState<string[]>(() =>
    [...new Set(availableProducts.map((item) => item.sourceCategoryId))].sort((a, b) =>
      a.localeCompare(b, "nl-NL")
    )
  );
  const categories = useMemo(() => categoryOrder.filter((sourceCategoryId) =>
    items.some((item) => item.sourceCategoryId === sourceCategoryId)
  ), [categoryOrder, items]);
  const configuration = useMemo<PriceListSlideConfig>(() => ({
    sections: categories.flatMap((sourceCategoryId) =>
      (["left", "right"] as const).flatMap((column, columnIndex) => {
        const categoryProducts = items
          .filter((item) => item.selected && item.sourceCategoryId === sourceCategoryId && item.column === column)
          .sort((left, right) => left.order - right.order || left.id.localeCompare(right.id));
        if (!categoryProducts.length) return [];
        const sourceCategoryName = categoryProducts[0]!.category;
        const sectionId = deterministicUuid(`${dataSourceId}:${sourceCategoryId}:${column}`);
        return [{
          categoryId: sourceCategoryName,
          categoryIdentity: {
            providerConnectionId: dataSourceId,
            sourceCategoryId
          },
          categoryNameOverride: categoryLabels[sourceCategoryId]?.trim() || null,
          column,
          expectedRevision: 0,
          id: sectionId,
          order: categories.indexOf(sourceCategoryId) * 2 + columnIndex,
          photoMode: categoryPhotoModes[sourceCategoryId] ?? "inherit",
          products: categoryProducts.map((product, index) => ({
            descriptionOverride: null,
            id: deterministicUuid(`${sectionId}:${product.id}`),
            imageAssetIdOverride: null,
            imageFocalPointOverride: null,
            nameOverride: null,
            order: index,
            priceCentsOverride: null,
            productId: product.id,
            visible: true
          }))
        }];
      })
    ),
    slidePhotoMode,
    title: title.trim() || "Prijslijst"
  }), [categories, categoryLabels, categoryPhotoModes, dataSourceId, items, slidePhotoMode, title]);

  const report = useMemo(() => {
    const resolved: ResolvedPriceListSection[] = configuration.sections.map((section) => ({
      column: section.column,
      id: section.id,
      name: section.categoryNameOverride ?? section.categoryId,
      order: section.order,
      products: section.products.map((placement) => {
        const product = items.find((item) => item.id === placement.productId)!;
        const photoVisible = resolvePriceListPhotoVisibility(
          configuration.slidePhotoMode,
          section.photoMode
        );
        return {
          description: product.description,
          formattedPrice: formatPrice(product.priceCents),
          id: placement.id,
          image: photoVisible && product.imageMediaAssetId
            ? { alt: product.name, kind: "image" as const, objectPosition: "50% 50%", url: "preview" }
            : { kind: "empty" as const },
          name: product.name,
          photoVisible
        };
      })
    }));
    return priceListCapacityReport(
      resolved,
      orientation === "portrait" ? "portrait" : "landscape"
    );
  }, [configuration, items, orientation]);
  const selectedProductCount = items.filter((item) => item.selected).length;

  useEffect(() => {
    onConfigurationChange(JSON.stringify(configuration));
  }, [configuration, onConfigurationChange]);

  function patchItem(id: string, patch: Partial<ProductState>) {
    setItems((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item));
  }

  function moveItem(id: string, direction: -1 | 1) {
    setItems((current) => {
      const selected = current.find((item) => item.id === id);
      if (!selected) return current;
      const siblings = current.filter((item) =>
        item.sourceCategoryId === selected.sourceCategoryId && item.column === selected.column
      ).sort((left, right) => left.order - right.order);
      const index = siblings.findIndex((item) => item.id === id);
      const target = siblings[index + direction];
      if (!target) return current;
      return current.map((item) => item.id === selected.id
        ? { ...item, order: target.order }
        : item.id === target.id
          ? { ...item, order: selected.order }
          : item);
    });
  }

  function moveCategory(category: string, direction: -1 | 1) {
    setCategoryOrder((current) => {
      const index = current.indexOf(category);
      const targetIndex = index + direction;
      if (index < 0 || targetIndex < 0 || targetIndex >= current.length) return current;
      const next = [...current];
      [next[index], next[targetIndex]] = [next[targetIndex]!, next[index]!];
      return next;
    });
  }

  function dropItem(targetId: string) {
    if (!draggedProductId || draggedProductId === targetId) return;
    const movingItem = items.find((item) => item.id === draggedProductId);
    const targetItem = items.find((item) => item.id === targetId);
    if (
      !movingItem || !targetItem ||
      movingItem.sourceCategoryId !== targetItem.sourceCategoryId
    ) return;
    setItems((current) => {
      const moving = current.find((item) => item.id === draggedProductId);
      const target = current.find((item) => item.id === targetId);
      if (!moving || !target || moving.sourceCategoryId !== target.sourceCategoryId) {
        return current;
      }
      return current.map((item) => {
        if (item.id === moving.id) {
          return { ...item, column: target.column, order: target.order };
        }
        if (
          item.id !== moving.id &&
          item.sourceCategoryId === target.sourceCategoryId &&
          item.column === target.column &&
          item.order >= target.order
        ) {
          return { ...item, order: item.order + 1 };
        }
        return item;
      });
    });
    setDragAnnouncement(
      `${movingItem.name} staat voor ${targetItem.name} in de kolom ${targetItem.column === "left" ? "links" : "rechts"}.`
    );
    setDraggedProductId(null);
  }

  return (
    <div className={styles.priceListBuilder}>
      <fieldset className={styles.priceListPhotoMode}>
        <legend>Productfoto’s</legend>
        <label><input checked={slidePhotoMode === "show"} onChange={() => setSlidePhotoMode("show")} type="radio" /> Productfoto’s tonen</label>
        <label><input checked={slidePhotoMode === "hide"} onChange={() => setSlidePhotoMode("hide")} type="radio" /> Geen productfoto’s</label>
      </fieldset>

      <label className={styles.priceListSearch}>
        <Search aria-hidden="true" />
        <span className="sr-only">Zoek producten</span>
        <input
          onChange={(event) => setQuery(event.currentTarget.value)}
          placeholder="Zoek op product, omschrijving of categorie"
          type="search"
          value={query}
        />
      </label>
      <p aria-live="polite" className="sr-only">{dragAnnouncement}</p>

      {categories.map((sourceCategoryId) => {
        const categoryItems = items.filter((item) => item.sourceCategoryId === sourceCategoryId);
        const category = categoryItems[0]?.category ?? "Overig";
        const visibleCategoryItems = categoryItems.filter((item) => {
          const haystack = `${item.name} ${item.description} ${item.category}`.toLocaleLowerCase("nl-NL");
          return haystack.includes(query.trim().toLocaleLowerCase("nl-NL"));
        });
        if (query.trim() && visibleCategoryItems.length === 0) return null;
        const selectedCount = categoryItems.filter((item) => item.selected).length;
        return (
          <section className={styles.priceListCategoryEditor} key={sourceCategoryId}>
            <header>
              <div><strong title={category}>{category}</strong><span>{selectedCount} van {categoryItems.length} geselecteerd</span></div>
              <div className={styles.priceListCategoryOrder}>
                <Button aria-label={`${category} omhoog`} onClick={() => moveCategory(sourceCategoryId, -1)} size="sm" type="button" variant="ghost"><ArrowUp aria-hidden="true" /></Button>
                <Button aria-label={`${category} omlaag`} onClick={() => moveCategory(sourceCategoryId, 1)} size="sm" type="button" variant="ghost"><ArrowDown aria-hidden="true" /></Button>
              </div>
              <label>
                <span>Foto’s</span>
                <select
                  aria-label={`Foto-instelling ${category}`}
                  onChange={(event) => setCategoryPhotoModes((current) => ({
                    ...current,
                    [sourceCategoryId]: event.currentTarget.value as "hide" | "inherit" | "show"
                  }))}
                  value={categoryPhotoModes[sourceCategoryId] ?? "inherit"}
                >
                  <option value="inherit">Gebruik slide-instelling</option>
                  <option value="show">Toon productfoto’s</option>
                  <option value="hide">Verberg productfoto’s</option>
                </select>
              </label>
              <label>
                <span>Schermnaam</span>
                <input
                  aria-label={`Schermnaam voor ${category}`}
                  maxLength={28}
                  onChange={(event) => setCategoryLabels((current) => ({
                    ...current,
                    [sourceCategoryId]: event.currentTarget.value
                  }))}
                  placeholder={category}
                  value={categoryLabels[sourceCategoryId] ?? ""}
                />
              </label>
            </header>
            <div className={styles.priceListSelectActions}>
              <Button onClick={() => setItems((current) => current.map((item) => item.sourceCategoryId === sourceCategoryId ? { ...item, selected: true } : item))} size="sm" type="button" variant="secondary">Selecteer alles</Button>
              <Button onClick={() => setItems((current) => current.map((item) => item.sourceCategoryId === sourceCategoryId ? { ...item, selected: false } : item))} size="sm" type="button" variant="ghost">Deselecteer alles</Button>
              <Button onClick={() => setItems((current) => current.map((item) => item.sourceCategoryId === sourceCategoryId ? { ...item, column: "left" } : item))} size="sm" type="button" variant="ghost">Alles links</Button>
              <Button onClick={() => setItems((current) => current.map((item) => item.sourceCategoryId === sourceCategoryId ? { ...item, column: "right" } : item))} size="sm" type="button" variant="ghost">Alles rechts</Button>
            </div>
            <ul>
              {visibleCategoryItems.sort((a, b) => a.order - b.order).map((product) => (
                <li
                  draggable
                  key={product.id}
                  onDragEnd={() => setDraggedProductId(null)}
                  onDragOver={(event) => {
                    if (draggedProductId) event.preventDefault();
                  }}
                  onDragStart={(event) => {
                    setDraggedProductId(product.id);
                    event.dataTransfer.effectAllowed = "move";
                    event.dataTransfer.setData("text/plain", product.id);
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    dropItem(product.id);
                  }}
                  title="Sleep om te ordenen; gebruik de pijlknoppen als toetsenbord- of touchalternatief"
                >
                  <label>
                    <input
                      checked={product.selected}
                      disabled={!product.selected && selectedProductCount >= 200}
                      onChange={(event) => {
                        if (event.currentTarget.checked && selectedProductCount >= 200) return;
                        patchItem(product.id, { selected: event.currentTarget.checked });
                      }}
                      type="checkbox"
                    />
                    <span><strong title={product.name}>{product.name}</strong><small title={product.description || undefined}>{product.description || "Geen omschrijving"} · {formatPrice(product.priceCents)}</small></span>
                  </label>
                  <select aria-label={`Kolom voor ${product.name}`} onChange={(event) => patchItem(product.id, { column: event.currentTarget.value as "left" | "right" })} value={product.column}>
                    <option value="left">Links</option><option value="right">Rechts</option>
                  </select>
                  <Button aria-label={`${product.name} omhoog`} onClick={() => moveItem(product.id, -1)} size="sm" type="button" variant="ghost"><ArrowUp aria-hidden="true" /></Button>
                  <Button aria-label={`${product.name} omlaag`} onClick={() => moveItem(product.id, 1)} size="sm" type="button" variant="ghost"><ArrowDown aria-hidden="true" /></Button>
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      <div className={styles.priceListCapacity} role="status">
        <strong>{report.pageCount} {report.pageCount === 1 ? "slide" : "slides"}</strong>
        <span>{configuration.sections.length} categoriesegmenten + {selectedProductCount} producten</span>
        <span>Pagina 1 — Links: {report.pages[0]?.columns.left.length ?? 0} van {report.capacityPerColumn} rijen · Rechts: {report.pages[0]?.columns.right.length ?? 0} van {report.capacityPerColumn} rijen</span>
        <span>Totaal gekozen — Links: {report.selectedRows.left} rijen · Rechts: {report.selectedRows.right} rijen</span>
        <span>Veilige capaciteit: {report.capacityPerColumn} rijen per kolom per slide</span>
      </div>
      {selectedProductCount > 200 ? (
        <p className="notice notice--critical" role="alert">
          Selecteer maximaal 200 producten. Er is niets afgesneden; deselecteer
          producten voordat je de slide opslaat.
        </p>
      ) : null}
    </div>
  );
}

function deterministicUuid(value: string) {
  const hex = Array.from({ length: 4 }, (_, chunk) => {
    let hash = 2166136261;
    const input = `${value}:${chunk}`;
    for (let index = 0; index < input.length; index += 1) {
      hash ^= input.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16).padStart(8, "0");
  }).join("");
  const versioned = `${hex.slice(0, 12)}4${hex.slice(13, 16)}8${hex.slice(17)}`;
  return `${versioned.slice(0, 8)}-${versioned.slice(8, 12)}-${versioned.slice(12, 16)}-${versioned.slice(16, 20)}-${versioned.slice(20, 32)}`;
}

function formatPrice(priceCents: number) {
  return new Intl.NumberFormat("nl-NL", { currency: "EUR", style: "currency" }).format(priceCents / 100);
}
