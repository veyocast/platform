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
      const categoryIndex = [...new Set(allProducts.map((item) => item.category))]
        .sort((left, right) => left.localeCompare(right, "nl-NL"))
        .indexOf(product.category);
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
  const [query, setQuery] = useState("");
  const [categoryOrder, setCategoryOrder] = useState<string[]>(() =>
    [...new Set(availableProducts.map((item) => item.category))].sort((a, b) =>
      a.localeCompare(b, "nl-NL")
    )
  );
  const categories = useMemo(() => categoryOrder.filter((category) =>
    items.some((item) => item.category === category)
  ), [categoryOrder, items]);
  const configuration = useMemo<PriceListSlideConfig>(() => ({
    sections: categories.flatMap((category) =>
      (["left", "right"] as const).flatMap((column, columnIndex) => {
        const categoryProducts = items
          .filter((item) => item.selected && item.category === category && item.column === column)
          .sort((left, right) => left.order - right.order || left.id.localeCompare(right.id));
        if (!categoryProducts.length) return [];
        const sectionId = deterministicUuid(`${category}:${column}`);
        return [{
          categoryId: category,
          categoryNameOverride: null,
          column,
          id: sectionId,
          order: categories.indexOf(category) * 2 + columnIndex,
          photoMode: categoryPhotoModes[category] ?? "inherit",
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
  }), [categories, categoryPhotoModes, items, slidePhotoMode, title]);

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
        item.category === selected.category && item.column === selected.column
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

      {categories.map((category) => {
        const categoryItems = items.filter((item) => item.category === category);
        const visibleCategoryItems = categoryItems.filter((item) => {
          const haystack = `${item.name} ${item.description} ${item.category}`.toLocaleLowerCase("nl-NL");
          return haystack.includes(query.trim().toLocaleLowerCase("nl-NL"));
        });
        if (query.trim() && visibleCategoryItems.length === 0) return null;
        const selectedCount = categoryItems.filter((item) => item.selected).length;
        return (
          <section className={styles.priceListCategoryEditor} key={category}>
            <header>
              <div><strong title={category}>{category}</strong><span>{selectedCount} van {categoryItems.length} geselecteerd</span></div>
              <div className={styles.priceListCategoryOrder}>
                <Button aria-label={`${category} omhoog`} onClick={() => moveCategory(category, -1)} size="sm" type="button" variant="ghost"><ArrowUp aria-hidden="true" /></Button>
                <Button aria-label={`${category} omlaag`} onClick={() => moveCategory(category, 1)} size="sm" type="button" variant="ghost"><ArrowDown aria-hidden="true" /></Button>
              </div>
              <label>
                <span>Foto’s</span>
                <select
                  aria-label={`Foto-instelling ${category}`}
                  onChange={(event) => setCategoryPhotoModes((current) => ({
                    ...current,
                    [category]: event.currentTarget.value as "hide" | "inherit" | "show"
                  }))}
                  value={categoryPhotoModes[category] ?? "inherit"}
                >
                  <option value="inherit">Gebruik slide-instelling</option>
                  <option value="show">Toon productfoto’s</option>
                  <option value="hide">Verberg productfoto’s</option>
                </select>
              </label>
            </header>
            <div className={styles.priceListSelectActions}>
              <Button onClick={() => setItems((current) => current.map((item) => item.category === category ? { ...item, selected: true } : item))} size="sm" type="button" variant="secondary">Selecteer alles</Button>
              <Button onClick={() => setItems((current) => current.map((item) => item.category === category ? { ...item, selected: false } : item))} size="sm" type="button" variant="ghost">Deselecteer alles</Button>
              <Button onClick={() => setItems((current) => current.map((item) => item.category === category ? { ...item, column: "left" } : item))} size="sm" type="button" variant="ghost">Alles links</Button>
              <Button onClick={() => setItems((current) => current.map((item) => item.category === category ? { ...item, column: "right" } : item))} size="sm" type="button" variant="ghost">Alles rechts</Button>
            </div>
            <ul>
              {visibleCategoryItems.sort((a, b) => a.order - b.order).map((product) => (
                <li key={product.id}>
                  <label>
                    <input checked={product.selected} onChange={(event) => patchItem(product.id, { selected: event.currentTarget.checked })} type="checkbox" />
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
