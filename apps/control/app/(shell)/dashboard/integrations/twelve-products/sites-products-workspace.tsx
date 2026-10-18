"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  LayoutTemplate,
  Loader2,
  Package,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@veyocast/ui";
import {
  listProductsPage,
  manageProduct,
  setProductAvailability,
} from "./actions";
import { ProductLogoControl } from "./product-logo-control";
import { ProductImportDialog } from "./product-import-dialog";
import type { ProductAvailabilityCommand, ProductView } from "./types";
import type { ProductPriceEvidence } from "./frozen-product-prices";
import styles from "./sites-products.module.css";
import {
  initialProductCatalogFilters,
  unavailableProductCatalogMessage,
  type ProductCatalogFilters,
  type ProductCatalogPage,
} from "./catalog-model";
export function SitesProductsWorkspace({
  catalog: initialCatalog,
  canRead,
  canWrite,
  canUploadLogo,
  manualSources,
  priceEvidence = { status: "none", products: {} },
}: {
  catalog: ProductCatalogPage | null;
  canRead: boolean;
  priceEvidence?: ProductPriceEvidence;
  canWrite: boolean;
  canUploadLogo: boolean;
  manualSources: Array<{ id: string; name: string }>;
}) {
  const [availabilityOverrides, setAvailabilityOverrides] = useState<
    Record<string, { active: boolean; revision: number }>
  >({});
  const [catalog, setCatalog] = useState(initialCatalog);
  const [filters, setFilters] = useState<ProductCatalogFilters>(
    initialProductCatalogFilters,
  );
  const [readGeneration, setReadGeneration] = useState(0);
  const [loading, setLoading] = useState(false);
  const [readError, setReadError] = useState<string | null>(null);
  const loadedKey = useRef(JSON.stringify(initialProductCatalogFilters));
  useEffect(() => {
    if (loadedKey.current === JSON.stringify(initialProductCatalogFilters))
      setCatalog(initialCatalog);
  }, [initialCatalog]);
  useEffect(() => {
    if (
      !canRead ||
      (loadedKey.current === JSON.stringify(filters) && readGeneration === 0)
    ) {
      setLoading(false);
      setReadError(null);
      return;
    }
    let alive = true;
    setLoading(true);
    setReadError(null);
    const timer = setTimeout(() => {
      void listProductsPage(filters)
        .then((result) => {
          if (!alive) return;
          if (result.ok) {
            setCatalog(result.page);
            loadedKey.current = JSON.stringify(filters);
          } else setReadError(result.message);
        })
        .catch(() => {
          if (alive) setReadError(unavailableProductCatalogMessage);
        })
        .finally(() => {
          if (alive) setLoading(false);
        });
    }, 250);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [filters, readGeneration, canRead]);
  const products = (catalog?.products ?? []).map((product) => {
    const override = availabilityOverrides[product.id];
    return override && override.revision > product.revision
      ? { ...product, ...override }
      : product;
  });
  const [availabilityPending, setAvailabilityPending] = useState<string | null>(
    null,
  );
  const [availabilityErrors, setAvailabilityErrors] = useState<
    Record<string, { message: string; conflict: boolean }>
  >({});
  const availabilityAttempts = useRef(
    new Map<string, ProductAvailabilityCommand>(),
  );
  function clearAvailabilityError(productId: string) {
    setAvailabilityErrors((current) => {
      const next = { ...current };
      delete next[productId];
      return next;
    });
  }
  async function confirmAvailability(attempt: ProductAvailabilityCommand) {
    if (!canWrite || availabilityPending) return;
    const { productId } = attempt;
    const isCurrent = () =>
      availabilityAttempts.current.get(productId)?.idempotencyKey ===
      attempt.idempotencyKey;
    setAvailabilityPending(productId);
    try {
      const result = await setProductAvailability(attempt);
      if (!isCurrent()) return;
      if (!result.ok) {
        setAvailabilityErrors((current) => ({
          ...current,
          [productId]: { message: result.message, conflict: result.conflict },
        }));
        return;
      }
      setAvailabilityOverrides((current) => ({
        ...current,
        [productId]: { active: result.active, revision: result.revision },
      }));
      availabilityAttempts.current.delete(productId);
      clearAvailabilityError(productId);
      setReadGeneration((current) => current + 1);
    } catch {
      if (isCurrent())
        setAvailabilityErrors((current) => ({
          ...current,
          [productId]: {
            conflict: false,
            message:
              "De verbinding werd onderbroken. Je eerdere wijziging is nog niet bevestigd; de catalogus kan al zijn bijgewerkt. Bevestig de wijziging opnieuw.",
          },
        }));
    } finally {
      setAvailabilityPending((current) =>
        current === productId ? null : current,
      );
    }
  }
  async function toggleAvailability(product: ProductView) {
    if (!canWrite || availabilityPending || availabilityErrors[product.id])
      return;
    // A newer read does not change the original uncertain command. Its explicit
    // confirmation retrieves that receipt, even after a concurrent later edit.
    let attempt = availabilityAttempts.current.get(product.id);
    if (!attempt) {
      attempt = {
        productId: product.id,
        expectedRevision: product.revision,
        active: !product.active,
        idempotencyKey: crypto.randomUUID(),
        values: {
          name: product.name,
          description: product.description,
          category: product.category,
          priceCents: product.priceCents,
          vatRate: product.vatRate,
          unit: product.unit,
          barcode: product.barcode,
          externalId: product.externalId,
        },
      };
      availabilityAttempts.current.set(product.id, attempt);
    }
    await confirmAvailability(attempt);
  }
  const [commandKey, setCommandKey] = useState("");
  const [removing, setRemoving] = useState<ProductView | null>(null);
  const { query, category, availability } = filters;
  const [editing, setEditing] = useState<ProductView | null>(null);
  function edit(product?: ProductView) {
    setCommandKey(crypto.randomUUID());
    setEditing(
      product ?? {
        id: "",
        name: "",
        priceCents: null,
        active: true,
        category: "",
        externalId: "",
        unit: "stuk",
        description: "",
        barcode: "",
        vatRate: null,
        revision: 0,
        slug: "",
        logoAssetId: null,
        logoUrl: null,
        updatedAt: "",
        customFields: {},
      },
    );
  }
  const categories = catalog?.categories ?? [];
  const visible = products;
  const euro = (cents: number | null) =>
    cents === null
      ? "Geen prijs"
      : new Intl.NumberFormat("nl-NL", {
          style: "currency",
          currency: "EUR",
        }).format(cents / 100);
  const changes = products.filter(
    (product) =>
      product.priceCents !== null &&
      priceEvidence.products[product.id]?.capturedCatalogCents.some(
        (price) => price !== product.priceCents,
      ),
  );
  return (
    <div className="admin-page sync-products">
      <header className="section-header">
        <div>
          <div className="eyebrow">BEHEER / KANTINE</div>
          <h1>Een frisse kaart voor je club.</h1>
          <p>Beheer je producten. Werk prijzen bewust bij op je schermen.</p>
        </div>
        <div className="header-actions">
          <ProductImportDialog disabled={!canWrite} />
          <button
            className="btn btn-primary"
            type="button"
            disabled={!canWrite}
            onClick={() => edit()}
          >
            <Plus size={18} />
            Product toevoegen
          </button>
        </div>
      </header>
      <div className="grid-3">
        <div className="card ad-metric">
          <span className="ad-square">
            <Package size={18} />
          </span>
          <span className="muted">Producten</span>
          <strong>{canRead && catalog ? catalog.total : "—"}</strong>
        </div>
        <div className="card ad-metric">
          <span className="ad-square">
            <CheckCircle2 size={18} />
          </span>
          <span className="muted">Beschikbaar</span>
          <strong>{canRead && catalog ? catalog.active : "—"}</strong>
        </div>
        <div className="card ad-metric">
          <span className="ad-square">
            <Pencil size={18} />
          </span>
          <span className="muted">Gewijzigde prijzen</span>
          <strong>
            {canRead && catalog && priceEvidence.status === "available"
              ? changes.length
              : "—"}
          </strong>
          <small>
            {priceEvidence.status === "unavailable"
              ? "Vergelijking tijdelijk niet beschikbaar"
              : `${catalog && catalog.total > products.length ? "Op deze pagina · " : ""}Ten opzichte van vastgelegde catalogusprijzen`}
          </small>
        </div>
      </div>
      {changes.length ? (
        <div className="ad-price-banner">
          <div>
            <strong>
              {changes.length} prijswijzigingen{" "}
              {catalog && catalog.total > products.length
                ? "op deze pagina"
                : "staan klaar"}
            </strong>
            <p>
              De laatst bevestigde menukaarten bevatten nog een eerdere
              catalogusprijs. Plaatsingsprijzen kunnen bewust afwijken.
            </p>
          </div>
          <Link
            className="btn btn-secondary"
            href="/dashboard/slides/menu-studio"
          >
            Prijzen bekijken <ArrowRight size={18} />
          </Link>
        </div>
      ) : null}
      {Object.entries(availabilityErrors).map(([productId, error]) => {
        const attempt = availabilityAttempts.current.get(productId);
        const name = attempt?.values.name ?? "Dit product";
        return (
          <div
            className="notice notice--critical"
            role="alert"
            id={`availability-error-${productId}`}
            key={productId}
          >
            <strong>{name}</strong> · {error.message}{" "}
            {error.conflict ? (
              <Button
                type="button"
                variant="secondary"
                disabled={Boolean(availabilityPending)}
                onClick={() => {
                  availabilityAttempts.current.delete(productId);
                  clearAvailabilityError(productId);
                  setReadGeneration((current) => current + 1);
                }}
              >
                Nieuwste lijst laden
              </Button>
            ) : attempt ? (
              <Button
                type="button"
                variant="secondary"
                disabled={Boolean(availabilityPending)}
                aria-label={`${name}: wijziging opnieuw bevestigen`}
                onClick={() => void confirmAvailability(attempt)}
              >
                Opnieuw bevestigen
              </Button>
            ) : null}
          </div>
        );
      })}
      {readError && (
        <p className="notice notice--critical" role="alert">
          {readError}{" "}
          <Button
            type="button"
            variant="secondary"
            disabled={loading}
            onClick={() => setReadGeneration((current) => current + 1)}
          >
            Opnieuw laden
          </Button>
        </p>
      )}
      {loading && (
        <p role="status">
          <Loader2 size={16} className="vc-spin" />
          Producten laden…
        </p>
      )}
      <section
        className="card"
        aria-label="Productcatalogus"
        aria-busy={loading}
      >
        <div className="ad-toolbar">
          <label className="ad-search">
            <Search size={18} />
            <input
              type="search"
              aria-label="Producten zoeken"
              placeholder="Zoek product of artikelnummer"
              value={query}
              maxLength={120}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  query: event.target.value,
                  offset: 0,
                }))
              }
            />
          </label>
          <select
            aria-label="Categorie"
            value={category}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                category: event.target.value,
                offset: 0,
              }))
            }
          >
            <option value="">Alle categorieën</option>
            {category && !categories.includes(category) && (
              <option value={category}>{category}</option>
            )}
            {categories.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
          <select
            aria-label="Beschikbaarheid"
            value={availability}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                availability: event.target
                  .value as ProductCatalogFilters["availability"],
                offset: 0,
              }))
            }
          >
            <option value="all">Alle producten</option>
            <option value="active">Beschikbaar</option>
            <option value="inactive">Niet beschikbaar</option>
          </select>
        </div>
        <div className="ad-table-wrap">
          <table className="ad-table">
            <thead>
              <tr>
                <th scope="col">Product</th>
                <th scope="col">Categorie</th>
                <th scope="col">Catalogusprijs</th>
                <th scope="col">In bevestigde menu’s</th>
                <th scope="col">Beschikbaar</th>
                <th scope="col">
                  <span className="sync-sr-only">Acties</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {visible.map((product) => (
                <tr key={product.id} id={`product-${product.id}`}>
                  <td>
                    <strong>{product.name}</strong>
                    <small>
                      #{product.externalId ?? product.id.slice(0, 8)}
                    </small>
                  </td>
                  <td>{product.category ?? "Overig"}</td>
                  <td>
                    <b>{euro(product.priceCents)}</b>
                  </td>
                  <td>
                    {priceEvidence.status === "unavailable"
                      ? "Niet beschikbaar"
                      : priceEvidence.products[product.id]?.displayCents
                          .map((price) => euro(price))
                          .join(" / ") || "Niet bevestigd"}
                  </td>
                  <td>
                    <button
                      className={styles.availability}
                      type="button"
                      data-active={product.active}
                      aria-pressed={product.active}
                      aria-label={`${product.name}: ${product.active ? "beschikbaar, klik om uit te zetten" : "niet beschikbaar, klik om aan te zetten"}`}
                      disabled={
                        !canWrite ||
                        Boolean(availabilityPending) ||
                        loading ||
                        Boolean(availabilityErrors[product.id])
                      }
                      aria-describedby={
                        availabilityErrors[product.id]
                          ? `availability-error-${product.id}`
                          : undefined
                      }
                      onClick={() => void toggleAvailability(product)}
                    >
                      <i />
                      {availabilityPending === product.id
                        ? "Opslaan…"
                        : product.active
                          ? "Beschikbaar"
                          : "Uit assortiment"}
                    </button>
                  </td>
                  <td>
                    <div className="row">
                      <button
                        className="btn btn-ghost"
                        type="button"
                        disabled={!canWrite}
                        aria-label={`${product.name} bewerken`}
                        onClick={() => edit(product)}
                      >
                        <Pencil size={16} />
                        Bewerken
                      </button>
                      <Button
                        variant="ghost"
                        type="button"
                        disabled={!canWrite}
                        aria-label={`${product.name} verwijderen`}
                        onClick={() => {
                          setCommandKey(crypto.randomUUID());
                          setRemoving(product);
                        }}
                      >
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {catalog && !visible.length && !loading && !readError ? (
          <div className="empty">
            <Search size={36} />
            <h2>Geen producten gevonden</h2>
            <p>
              {catalog?.total
                ? "Pas je zoekterm of categorie aan."
                : "Importeer de actuele Twelve-export. Controleer de regels voordat je ze aan je catalogus toevoegt."}
            </p>
          </div>
        ) : null}
      </section>
      <p className="muted" role="status">
        {catalog
          ? `${visible.length ? catalog.offset + 1 : 0}–${catalog.offset + visible.length} van ${catalog.count}`
          : "Niet geladen"}{" "}
        producten · Prijzen komen uit de immutable menu’s van de laatst met een
        frame bevestigde release. Dit is geen live beeldregistratie.
      </p>
      {catalog && catalog.count > catalog.pageSize && (
        <nav className="row" aria-label="Productpagina’s">
          <Button
            variant="secondary"
            type="button"
            disabled={loading || catalog.offset === 0}
            onClick={() =>
              setFilters((current) => ({
                ...current,
                offset: Math.max(0, catalog.offset - catalog.pageSize),
              }))
            }
          >
            Vorige producten
          </Button>
          <Button
            variant="secondary"
            type="button"
            disabled={
              loading ||
              catalog.offset + catalog.products.length >= catalog.count
            }
            onClick={() =>
              setFilters((current) => ({
                ...current,
                offset: catalog.offset + catalog.pageSize,
              }))
            }
          >
            Volgende producten
          </Button>
        </nav>
      )}
      {catalog && !catalog.categoriesComplete && (
        <p className="muted">
          De keuzelijst toont de eerste 200 categorieën. Zoek op categorienaam
          voor de overige categorieën.
        </p>
      )}
      <Link className="btn btn-ghost" href="/dashboard/slides/menu-studio/new">
        <LayoutTemplate size={18} />
        Open Menu Studio
        <ArrowRight size={17} />
      </Link>
      <Dialog
        open={Boolean(editing)}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing?.id ? "Product bewerken" : "Product toevoegen"}
            </DialogTitle>
            <DialogDescription>
              Pas je catalogus aan. Opgeslagen en gepubliceerde menu’s behouden
              hun inhoud totdat je ze bijwerkt.
            </DialogDescription>
          </DialogHeader>
          {editing && (
            <form
              action={manageProduct}
              key={`${editing.id}:${editing.revision}`}
            >
              <DialogBody>
                <input
                  type="hidden"
                  name="action"
                  value={editing.id ? "update" : "create"}
                />
                <input type="hidden" name="idempotencyKey" value={commandKey} />
                <input type="hidden" name="productId" value={editing.id} />
                <input type="hidden" name="revision" value={editing.revision} />
                <div className={styles.form}>
                  {!editing.id && (
                    <label className="demo-field">
                      <span id="product-source-label">Productbron</span>
                      {manualSources.length ? (
                        <select
                          name="dataSourceId"
                          aria-labelledby="product-source-label"
                          required
                          defaultValue={manualSources[0]!.id}
                        >
                          {manualSources.map((source) => (
                            <option key={source.id} value={source.id}>
                              {source.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span>
                          Voeg eerst een handmatige productbron toe via{" "}
                          <Link href="/dashboard/data-sources">
                            Databronnen
                          </Link>
                          . Geïmporteerde producten behouden hun
                          Twelve-herkomst.
                        </span>
                      )}
                    </label>
                  )}
                  <div className={styles.two}>
                    <label className="demo-field">
                      <span>Productnaam</span>
                      <input
                        name="name"
                        defaultValue={editing.name}
                        required
                        maxLength={160}
                      />
                    </label>
                    <label className="demo-field">
                      <span>Prijs (€)</span>
                      <input
                        name="price"
                        defaultValue={
                          editing.priceCents === null
                            ? ""
                            : (editing.priceCents / 100)
                                .toFixed(2)
                                .replace(".", ",")
                        }
                        inputMode="decimal"
                        pattern="[0-9]+([.,][0-9]{1,2})?"
                        placeholder="2,50"
                      />
                    </label>
                  </div>
                  <div className={styles.two}>
                    <label className="demo-field">
                      <span id="product-category-label">Categorie</span>
                      <input
                        name="category"
                        aria-labelledby="product-category-label"
                        defaultValue={editing.category ?? ""}
                        list="sites-product-categories"
                        maxLength={160}
                      />
                      <datalist id="sites-product-categories">
                        {category && !categories.includes(category) && (
                          <option value={category}>{category}</option>
                        )}
                        {categories.map((item) => (
                          <option key={item}>{item}</option>
                        ))}
                      </datalist>
                    </label>
                    <label className="demo-field">
                      <span>Eenheid</span>
                      <input
                        name="unit"
                        defaultValue={editing.unit ?? ""}
                        maxLength={80}
                      />
                    </label>
                  </div>
                  <label className="demo-field">
                    <span id="product-external-label">Artikelnummer</span>
                    <input
                      name="externalId"
                      aria-labelledby="product-external-label"
                      aria-describedby="product-external-help"
                      defaultValue={editing.externalId ?? ""}
                      maxLength={160}
                    />
                    <small id="product-external-help">
                      Een volgende import gebruikt het artikelnummer om dezelfde
                      productregel bij te werken.
                    </small>
                  </label>
                  <div className={styles.two}>
                    <label className="demo-field">
                      <span>Btw (%)</span>
                      <input
                        name="vatRate"
                        defaultValue={editing.vatRate ?? ""}
                        inputMode="decimal"
                      />
                    </label>
                    <label className="demo-field">
                      <span>Barcode</span>
                      <input
                        name="barcode"
                        defaultValue={editing.barcode ?? ""}
                        maxLength={80}
                      />
                    </label>
                  </div>
                  <label className="demo-field">
                    <span>Omschrijving</span>
                    <textarea
                      name="description"
                      defaultValue={editing.description ?? ""}
                      rows={2}
                      maxLength={1000}
                    />
                  </label>
                  <label className={styles.checkLabel}>
                    <input
                      name="active"
                      type="checkbox"
                      defaultChecked={editing.active}
                    />
                    Beschikbaar voor de menukaart
                  </label>
                  {editing.id && (
                    <ProductLogoControl
                      canRemove={canWrite}
                      canUpload={canUploadLogo}
                      logoUrl={editing.logoUrl}
                      productId={editing.id}
                      productName={editing.name}
                      revision={editing.revision}
                    />
                  )}
                </div>
              </DialogBody>
              <DialogFooter>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setEditing(null)}
                >
                  Annuleren
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={!canWrite || (!editing.id && !manualSources.length)}
                >
                  Product opslaan
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={Boolean(removing)}
        onOpenChange={(open) => {
          if (!open) setRemoving(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Product verwijderen?</DialogTitle>
            <DialogDescription>
              {removing?.name} verdwijnt uit je assortiment. Opgeslagen menu’s
              en publicaties behouden hun inhoud.
            </DialogDescription>
          </DialogHeader>
          {removing && (
            <form action={manageProduct}>
              <input name="action" type="hidden" value="delete" />
              <input name="productId" type="hidden" value={removing.id} />
              <input name="revision" type="hidden" value={removing.revision} />
              <input name="idempotencyKey" type="hidden" value={commandKey} />
              <DialogFooter>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setRemoving(null)}
                >
                  Annuleren
                </Button>
                <Button
                  type="submit"
                  variant="destructive"
                  disabled={!canWrite}
                >
                  Verwijderen
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
