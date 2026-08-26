"use client";

import { useEffect, useMemo, useState } from "react";

import { Button, StatusPill } from "@veyocast/ui";

import { updateProduct } from "./actions";
import { ProductLogoControl } from "./product-logo-control";
import styles from "./products.module.css";
import type { ProductView } from "./types";

const allColumns = [
  ["category", "Categorie"],
  ["price", "Prijs"],
  ["vat", "Btw"],
  ["unit", "Eenheid"],
  ["barcode", "Barcode"]
] as const;
type OptionalColumn = (typeof allColumns)[number][0];

export function ProductTable({
  canWrite,
  canUploadLogo,
  products
}: {
  canWrite: boolean;
  canUploadLogo: boolean;
  products: ProductView[];
}) {
  const [query, setQuery] = useState("");
  const [columns, setColumns] = useState<OptionalColumn[]>(
    allColumns.map(([column]) => column)
  );
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem("veyocast-products-columns-v1");
    if (!stored) return;
    try {
      const values = JSON.parse(stored) as unknown;
      if (Array.isArray(values)) {
        const allowed = new Set(allColumns.map(([column]) => column));
        setColumns(values.filter((value): value is OptionalColumn =>
          typeof value === "string" && allowed.has(value as OptionalColumn)
        ));
      }
    } catch {
      window.localStorage.removeItem("veyocast-products-columns-v1");
    }
  }, []);

  const visible = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("nl-NL");
    return needle
      ? products.filter((product) =>
          [product.name, product.category, product.externalId, product.slug]
            .filter(Boolean)
            .some((value) => value!.toLocaleLowerCase("nl-NL").includes(needle))
        )
      : products;
  }, [products, query]);

  function toggleColumn(column: OptionalColumn) {
    setColumns((current) => {
      const next = current.includes(column)
        ? current.filter((value) => value !== column)
        : [...current, column];
      window.localStorage.setItem(
        "veyocast-products-columns-v1",
        JSON.stringify(next)
      );
      return next;
    });
  }

  async function copyShortcode(shortcode: string) {
    await navigator.clipboard.writeText(shortcode);
    setCopied(shortcode);
    window.setTimeout(() => setCopied(null), 1800);
  }

  return (
    <>
      <div className={styles.toolbar}>
        <div className="field">
          <label htmlFor="product-search">Producten zoeken</label>
          <input
            id="product-search"
            onChange={(event) => setQuery(event.currentTarget.value)}
            placeholder="Naam, categorie of artikelnummer"
            type="search"
            value={query}
          />
        </div>
        <fieldset className={styles.columnPicker}>
          <legend>Kolommen</legend>
          {allColumns.map(([column, label]) => (
            <label key={column}>
              <input
                checked={columns.includes(column)}
                onChange={() => toggleColumn(column)}
                type="checkbox"
              />
              {label}
            </label>
          ))}
        </fieldset>
      </div>

      <p className="work-panel__meta" role="status">
        {visible.length} van {products.length} producten zichtbaar
      </p>

      <div className={styles.productList}>
        {visible.map((product) => {
          const nameShortcode = `{{product:${product.slug}:name}}`;
          const priceShortcode = `{{product:${product.slug}:price}}`;
          return (
            <form
              action={updateProduct}
              className={styles.productRow}
              id={`product-${product.id}`}
              key={product.id}
            >
              <input name="productId" type="hidden" value={product.id} />
              <input name="revision" type="hidden" value={product.revision} />
              <div className={styles.identity}>
                <div className={styles.rowTitle}>
                  <strong>{product.name}</strong>
                  <StatusPill
                    label={product.active ? "Actief" : "Inactief"}
                    tone={product.active ? "success" : "neutral"}
                  />
                </div>
                <span>{product.externalId ?? product.slug}</span>
                <ProductLogoControl
                  canRemove={canWrite}
                  canUpload={canUploadLogo}
                  logoUrl={product.logoUrl}
                  productId={product.id}
                  productName={product.name}
                  revision={product.revision}
                />
                <div className={styles.shortcodes}>
                  <button onClick={() => void copyShortcode(nameShortcode)} type="button">
                    Naamcode kopiëren
                  </button>
                  <button onClick={() => void copyShortcode(priceShortcode)} type="button">
                    Prijscode kopiëren
                  </button>
                  {copied === nameShortcode || copied === priceShortcode ? (
                    <span role="status">Gekopieerd</span>
                  ) : null}
                </div>
              </div>
              <label>
                <span>Naam</span>
                <input
                  defaultValue={product.name}
                  disabled={!canWrite}
                  maxLength={160}
                  name="name"
                  required
                />
              </label>
              {columns.includes("category") ? (
                <label>
                  <span>Categorie</span>
                  <input
                    defaultValue={product.category ?? ""}
                    disabled={!canWrite}
                    maxLength={160}
                    name="category"
                  />
                </label>
              ) : <input name="category" type="hidden" value={product.category ?? ""} />}
              {columns.includes("price") ? (
                <label>
                  <span>Prijs</span>
                  <input
                    defaultValue={product.priceCents === null
                      ? ""
                      : (product.priceCents / 100).toFixed(2).replace(".", ",")}
                    disabled={!canWrite}
                    inputMode="decimal"
                    name="price"
                  />
                </label>
              ) : <input name="price" type="hidden" value={product.priceCents === null ? "" : product.priceCents / 100} />}
              {columns.includes("vat") ? (
                <label>
                  <span>Btw %</span>
                  <input
                    defaultValue={product.vatRate ?? ""}
                    disabled={!canWrite}
                    inputMode="decimal"
                    name="vatRate"
                  />
                </label>
              ) : <input name="vatRate" type="hidden" value={product.vatRate ?? ""} />}
              {columns.includes("unit") ? (
                <label>
                  <span>Eenheid</span>
                  <input
                    defaultValue={product.unit ?? ""}
                    disabled={!canWrite}
                    maxLength={80}
                    name="unit"
                  />
                </label>
              ) : <input name="unit" type="hidden" value={product.unit ?? ""} />}
              {columns.includes("barcode") ? (
                <label>
                  <span>Barcode</span>
                  <input
                    defaultValue={product.barcode ?? ""}
                    disabled={!canWrite}
                    maxLength={80}
                    name="barcode"
                  />
                </label>
              ) : <input name="barcode" type="hidden" value={product.barcode ?? ""} />}
              <label className={styles.description}>
                <span>Beschrijving</span>
                <input
                  defaultValue={product.description ?? ""}
                  disabled={!canWrite}
                  maxLength={1000}
                  name="description"
                />
              </label>
              <label className={styles.activeToggle}>
                <input
                  defaultChecked={product.active}
                  disabled={!canWrite}
                  name="active"
                  type="checkbox"
                />
                Actief
              </label>
              <Button disabled={!canWrite} size="sm" type="submit" variant="secondary">
                Regel opslaan
              </Button>
            </form>
          );
        })}
      </div>
    </>
  );
}
