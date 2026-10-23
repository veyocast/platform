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
  DialogTrigger,
  StatusPill,
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
import { prepareMenuPriceCandidatesAction, publishMenuPriceCandidatesAction, readMenuPriceCandidatesAction, readMenuPriceImpactAction } from "./menu-price-actions";
import { menuPriceCandidatesSchema, menuPriceEditorHref, prepareMenuPriceCandidatesSchema, publishMenuPriceCandidatesSchema, type MenuPriceActionResult, type MenuPriceCandidates, type MenuPriceImpact, type PrepareMenuPriceCandidates, type PublishMenuPriceCandidates } from "./menu-price-model";
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
  initialPriceImpact,
  canPreparePrices = false,
  canPublishPrices = false,
  priceActorScope,
}: {
  catalog: ProductCatalogPage | null;
  canRead: boolean;
  priceEvidence?: ProductPriceEvidence;
  initialPriceImpact?: MenuPriceActionResult<MenuPriceImpact>;
  canPreparePrices?: boolean;
  canPublishPrices?: boolean;
  priceActorScope?: string;
  canWrite: boolean;
  canUploadLogo: boolean;
  manualSources: Array<{ id: string; name: string }>;
}) {
  const [priceImpact, setPriceImpact] = useState(initialPriceImpact?.ok ? initialPriceImpact.data : null);
  useEffect(() => { setPriceImpact(initialPriceImpact?.ok ? initialPriceImpact.data : null); }, [initialPriceImpact]);
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
            {canRead && priceImpact?.status === "ready" && priceImpact.complete
              ? priceImpact.changedProducts
              : "—"}
          </strong>
          <small>
            {priceImpact?.status === "ready" && priceImpact.complete
              ? "Volledige catalogus · vastgelegde menuprijzen"
              : "Volledige prijscontrole niet beschikbaar"}
          </small>
        </div>
      </div>
      <MenuPriceReview key={priceActorScope ?? "unavailable"} initialImpact={initialPriceImpact} canRead={canRead} canPrepare={canPreparePrices} canPublish={canPublishPrices} actorScope={priceActorScope} onImpact={setPriceImpact} />
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
        <div className={`ad-table-wrap ${styles.catalogTable}`}>
          <table className="sync-data-table">
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

type PriceRecovery = {
  version: 1;
  scope: string;
  prepare: PrepareMenuPriceCandidates | null;
  publish: PublishMenuPriceCandidates | null;
  receipt: MenuPriceCandidates | null;
  uncertain: boolean;
};
const priceScopePattern = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}:[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
function emptyPriceRecovery(scope: string): PriceRecovery {
  return { version: 1, scope, prepare: null, publish: null, receipt: null, uncertain: false };
}
function parsePriceRecovery(raw: string, scope: string): PriceRecovery {
  if (raw.length > 4_194_304) throw Error("PRICE_RECOVERY_INVALID");
  const value = JSON.parse(raw) as PriceRecovery;
  if (!value || Object.keys(value).sort().join() !== "prepare,publish,receipt,scope,uncertain,version" || value.version !== 1 || value.scope !== scope || typeof value.uncertain !== "boolean" || value.prepare && value.publish) throw Error("PRICE_RECOVERY_INVALID");
  if (value.prepare !== null) value.prepare = prepareMenuPriceCandidatesSchema.parse(value.prepare);
  if (value.publish !== null) value.publish = publishMenuPriceCandidatesSchema.parse(value.publish);
  if (value.receipt !== null) {
    value.receipt = menuPriceCandidatesSchema.parse(value.receipt);
    if (value.receipt.captureActorId !== scope.split(":")[1]) throw Error("PRICE_RECOVERY_SCOPE");
    if (new Set(value.receipt.candidates.map(item => item.slideId)).size !== value.receipt.candidates.length) throw Error("PRICE_RECOVERY_INVALID");
    if (value.prepare && (value.receipt.captureKey !== value.prepare.idempotencyKey || value.receipt.candidates.length !== value.prepare.selections.length || value.receipt.candidates.some(item => !value.prepare!.selections.some(selected => selected.slideId === item.slideId)))) throw Error("PRICE_RECOVERY_SCOPE");
  }
  if (value.publish && (!value.receipt || value.publish.captureActorId !== value.receipt.captureActorId || value.publish.captureKey !== value.receipt.captureKey)) throw Error("PRICE_RECOVERY_SCOPE");
  if (value.publish && value.publish.candidates.some(item => !value.receipt!.candidates.some(candidate => candidate.slideId === item.slideId && candidate.versionId === item.versionId))) throw Error("PRICE_RECOVERY_SCOPE");
  return value;
}

/** Each authenticated actor gets an independent, durable pair of explicit commands. */
function MenuPriceReview({ initialImpact, canRead, canPrepare, canPublish, actorScope, onImpact }: {
  initialImpact?: MenuPriceActionResult<MenuPriceImpact>;
  canRead: boolean;
  canPrepare: boolean;
  canPublish: boolean;
  actorScope?: string;
  onImpact: (value: MenuPriceImpact | null) => void;
}) {
  const scope = actorScope ?? "", storageKey = `veyocast:menu-prices:v1:${scope}`;
  const [open, setOpen] = useState(false), [hydrated, setHydrated] = useState(false), [storageBlocked, setStorageBlocked] = useState(false);
  const [impact, setImpact] = useState<MenuPriceImpact | null>(initialImpact?.ok ? initialImpact.data : null);
  const [stale, setStale] = useState(false), [selected, setSelected] = useState<string[]>([]), [selectedCandidates, setSelectedCandidates] = useState<string[]>([]);
  const [recovery, setRecovery] = useState(() => emptyPriceRecovery(scope));
  const current = useRef(recovery), alive = useRef(false), inFlight = useRef(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(initialImpact && !initialImpact.ok ? initialImpact.error : null), [message, setMessage] = useState<string | null>(null);
  const money = (cents: number) => new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(cents / 100);
  const prices = (values: number[]) => values.map(money).join(" / ");
  const pending = recovery.prepare !== null || recovery.publish !== null;

  function persist(next: PriceRecovery) {
    parsePriceRecovery(JSON.stringify(next), scope);
    sessionStorage.setItem(storageKey, JSON.stringify(next));
    current.current = next; setRecovery(next);
  }
  function restore() {
    try {
      if (!priceScopePattern.test(scope)) throw Error("PRICE_SCOPE_UNAVAILABLE");
      const raw = sessionStorage.getItem(storageKey), restored = raw ? parsePriceRecovery(raw, scope) : emptyPriceRecovery(scope);
      // A page may have closed after transmission but before receiving its receipt.
      restored.uncertain = Boolean(restored.prepare || restored.publish);
      current.current = restored; setRecovery(restored); setStorageBlocked(false);
      setSelected(restored.prepare?.selections.map(item => item.slideId) ?? []);
      setSelectedCandidates(restored.publish?.candidates.map(item => item.slideId) ?? []);
      if (restored.uncertain) setMessage("Een eerdere opdracht is nog niet bevestigd. Bevestig uitsluitend dezelfde opdracht opnieuw; je oorspronkelijke keuzes blijven bewaard.");
    } catch {
      setStorageBlocked(true); setError("Je herstelgegevens konden niet veilig worden gelezen. Er wordt geen prijsopdracht verstuurd. Herstel browseropslag en lees je herstelgegevens opnieuw.");
    }
    setHydrated(true);
  }
  useEffect(() => {
    alive.current = true; restore();
    return () => { alive.current = false; };
    // The parent keys this controller by the authenticated tenant and actor.
  }, []);

  async function loadImpact(append = false) {
    if (!canRead || inFlight.current) return;
    inFlight.current = true; setBusy(true); setError(null);
    try {
      const previous = impact, offset = append ? previous?.rows.length ?? 0 : 0;
      const result = await readMenuPriceImpactAction({ offset, limit: 20 });
      if (!alive.current) return;
      if (!result.ok) { setStale(true); onImpact(null); setError(result.error); return; }
      const next = result.data, changed = previous?.reviewHash !== next.reviewHash;
      if (append && changed) {
        // A page from a new review cannot stand in for its missing first page.
        setImpact(null); setSelected([]); setStale(true); onImpact(null);
        setMessage("De prijzen of menu’s zijn gewijzigd. Je selectie is gewist. Lees de volledige impact opnieuw en kies daarna bewust je concepten."); return;
      }
      if (append && !changed && next.status === "ready") {
        if (!previous || next.offset !== previous.rows.length || next.rows.some(row => previous.rows.some(old => old.productId === row.productId))) throw Error("PRICE_PAGE_INVALID");
        setImpact({ ...next, offset: 0, rows: [...previous.rows, ...next.rows] });
      } else {
        setImpact(next); setSelected([]);
      }
      setStale(next.status !== "ready" || !next.complete); onImpact(next.status === "ready" && next.complete ? next : null);
      if (next.status !== "ready") setError(next.error ?? "De volledige impact is niet beschikbaar. Er wordt niets voorbereid. Lees de prijscontrole opnieuw.");
    } catch {
      if (alive.current) { setStale(true); onImpact(null); setError("De prijscontrole kon niet volledig worden gelezen. Je huidige gegevens zijn behouden; lees de volledige impact opnieuw voordat je bevestigt."); }
    } finally { if (alive.current) { inFlight.current = false; setBusy(false); } }
  }
  function verifyReceipt(value: MenuPriceCandidates, command: PrepareMenuPriceCandidates | PublishMenuPriceCandidates, capture: MenuPriceCandidates | null) {
    const ids = "selections" in command ? command.selections.map(item => item.slideId) : capture?.candidates.map(item => item.slideId) ?? [];
    if (value.captureActorId !== scope.split(":")[1] || value.captureKey !== ("selections" in command ? command.idempotencyKey : command.captureKey) || value.candidates.length !== ids.length || new Set(value.candidates.map(item => item.slideId)).size !== ids.length || value.candidates.some(item => !ids.includes(item.slideId))) throw Error("PRICE_RECEIPT_MISMATCH");
    if ("candidates" in command && value.candidates.some(item => capture?.candidates.find(expected => expected.slideId === item.slideId)?.versionId !== item.versionId)) throw Error("PRICE_RECEIPT_MISMATCH");
  }
  async function write(kind: "prepare" | "publish") {
    if (!hydrated || storageBlocked || inFlight.current || !priceScopePattern.test(scope) || !(kind === "prepare" ? canPrepare : canPublish)) return;
    const before = current.current;
    let command: PrepareMenuPriceCandidates | PublishMenuPriceCandidates;
    try {
      if (kind === "prepare") {
        if (before.publish) return;
        if (!before.prepare && (before.receipt || stale || !impact?.complete || impact.status !== "ready" || impact.hasMore || !selected.length || selected.length > 25)) return;
        command = before.prepare ?? prepareMenuPriceCandidatesSchema.parse({ reviewHash: impact!.reviewHash, idempotencyKey: crypto.randomUUID(), selections: selected.map(slideId => {
          const menu = impact!.menus.find(item => item.slideId === slideId);
          if (!menu?.canPrepare) throw Error("PRICE_SELECTION_CHANGED");
          return { slideId, basisVersionId: menu.basisVersionId, expectedRevision: menu.expectedRevision };
        }) });
      } else {
        if (before.prepare) return;
        if (!before.publish && (!before.receipt || stale || !selectedCandidates.length)) return;
        command = before.publish ?? publishMenuPriceCandidatesSchema.parse({ captureActorId: before.receipt!.captureActorId, captureKey: before.receipt!.captureKey, idempotencyKey: crypto.randomUUID(), candidates: selectedCandidates.map(slideId => {
          const candidate = before.receipt!.candidates.find(item => item.slideId === slideId);
          if (!candidate || candidate.state !== "draft") throw Error("PRICE_SELECTION_CHANGED");
          return { slideId, versionId: candidate.versionId, expectedRevision: candidate.editRevision };
        }) });
      }
      persist(kind === "prepare" ? { ...before, prepare: command as PrepareMenuPriceCandidates } : { ...before, publish: command as PublishMenuPriceCandidates });
    } catch {
      setStorageBlocked(true); setError("De volledige opdracht kon niet veilig worden bewaard. Er is niets verstuurd. Herstel browseropslag en lees je herstelgegevens opnieuw."); return;
    }
    inFlight.current = true; setBusy(true); setError(null); setMessage(null);
    try {
      const result = kind === "prepare" ? await prepareMenuPriceCandidatesAction(command as PrepareMenuPriceCandidates) : await publishMenuPriceCandidatesAction(command as PublishMenuPriceCandidates);
      if (!alive.current) return;
      if (result.ok) {
        verifyReceipt(result.data, command, before.receipt);
        // Both responses contain the complete capture, including unselected drafts.
        persist({ ...emptyPriceRecovery(scope), receipt: result.data });
        setSelected([]); setSelectedCandidates([]);
        setMessage(kind === "prepare" ? "De prijsversie is vastgelegd in de gekozen concepten. Er is nog niets gepubliceerd. Kies apart welke kandidaten je wilt publiceren." : "De publicatieopdracht is bevestigd. Controleer de voorbereiding hieronder; dit betekent niet dat de nieuwe prijzen al op TV actief zijn.");
      } else {
        if (result.conflict || result.rejected && !before.uncertain) {
          persist({ ...before, prepare: null, publish: null, uncertain: false }); setStale(true); setSelected([]); setSelectedCandidates([]);
        } else persist({ ...current.current, uncertain: true });
        setError(result.error);
      }
    } catch {
      if (alive.current) {
        try { persist({ ...current.current, uncertain: true }); }
        catch { setStorageBlocked(true); }
        setError("De opdracht is nog niet bevestigd. Je oorspronkelijke opdracht blijft bewaard; bevestig dezelfde opdracht opnieuw zodra je verbinding en rechten beschikbaar zijn.");
      }
    } finally { if (alive.current) { inFlight.current = false; setBusy(false); } }
  }
  async function readStatus() {
    const before = current.current, actor = before.receipt?.captureActorId ?? scope.split(":")[1], captureKey = before.receipt?.captureKey ?? before.prepare?.idempotencyKey;
    if (!canRead || inFlight.current || !captureKey || !actor) return;
    inFlight.current = true; setBusy(true); setError(null);
    try {
      const result = await readMenuPriceCandidatesAction({ captureActorId: actor, captureKey });
      if (!alive.current) return;
      if (!result.ok) { setError(result.error); return; }
      if (result.data.captureActorId !== actor || result.data.captureKey !== captureKey) throw Error("PRICE_RECEIPT_MISMATCH");
      if (before.prepare) verifyReceipt(result.data, before.prepare, null);
      if (before.receipt && (result.data.candidates.length !== before.receipt.candidates.length || result.data.candidates.some(candidate => before.receipt!.candidates.find(old => old.slideId === candidate.slideId)?.versionId !== candidate.versionId))) throw Error("PRICE_RECEIPT_MISMATCH");
      try { persist({ ...before, receipt: result.data }); }
      catch { setStorageBlocked(true); throw Error("PRICE_RECOVERY_UNAVAILABLE"); }
      setSelectedCandidates(before.publish?.candidates.map(item => item.slideId) ?? []); setStale(false);
      setMessage("De voorbereidingsstatus is opnieuw gelezen. Een gereedstaande kandidaat is nog geen bevestigde TV-activatie.");
    } catch {
      if (alive.current) setError("De status kon niet veilig worden bevestigd of bewaard. Je oorspronkelijke opdracht blijft behouden; controleer je verbinding en browseropslag en probeer het lezen opnieuw.");
    } finally { if (alive.current) { inFlight.current = false; setBusy(false); } }
  }
  async function newReview() {
    if (pending || busy) return;
    try { persist(emptyPriceRecovery(scope)); setSelectedCandidates([]); setMessage(null); await loadImpact(); }
    catch { setStorageBlocked(true); setError("Je eerdere resultaat kon niet veilig worden afgesloten. Herstel browseropslag en lees je herstelgegevens opnieuw."); }
  }
  const readyImpact = impact?.status === "ready" && impact.complete;
  const canConfirm = canPrepare && hydrated && !storageBlocked && !busy && !pending && !stale && readyImpact && impact?.hasMore === false && selected.length > 0;
  return <Dialog open={open} onOpenChange={value => { if (!busy) setOpen(value); }}>
    <div className={`ad-price-banner ${styles.priceBanner}`}>
      <div><strong>{readyImpact ? `${impact.changedProducts} prijswijzigingen · ${impact.affectedMenus} menu’s` : "Menuprijzen controleren"}</strong><p>Cataloguswijzigingen veranderen je TV-prijzen niet automatisch. Controleer het verschil en kies bewust welke concepten je bijwerkt.</p></div>
      <DialogTrigger asChild><Button type="button" variant="secondary" disabled={!canRead || !hydrated} onClick={() => { if (!current.current.prepare && !current.current.publish && !current.current.receipt) void loadImpact(); }}>Prijzen bijwerken <ArrowRight size={18} aria-hidden="true" /></Button></DialogTrigger>
    </div>
      <DialogContent size="wide" className={styles.priceDialog}>
        <DialogHeader className={styles.priceHeader}><DialogTitle>Prijzen bijwerken</DialogTitle><DialogDescription>Controleer de prijzen en het bereik. Leg een prijsversie vast in expliciet gekozen concepten; publiceer nieuwe kandidaten daarna met een aparte bevestiging.</DialogDescription></DialogHeader>
        <DialogBody className={styles.priceBody}>
          <p className={styles.priceSafety}>Bestaande actieve versies blijven spelen tot een nieuwe publicatie volledig is voorbereid en de activatie werkelijk is bevestigd.</p>
          {busy && <p role="status"><Loader2 size={16} className="vc-spin" aria-hidden="true" /> Bezig met bevestigen of controleren…</p>}
          {message && <p role="status">{message}</p>}
          {error && <p className={styles.priceError} role="alert">{error}</p>}
          {storageBlocked && <Button type="button" variant="secondary" disabled={busy} onClick={restore}>Herstelgegevens opnieuw lezen</Button>}
          {pending && <div className={styles.pricePending}><strong>Eerdere opdracht nog niet bevestigd</strong><p>Er wordt geen nieuwe opdracht gemaakt. Je oorspronkelijke selectie en opdracht blijven bewaard, ook na herladen.</p><Button type="button" variant="primary" disabled={busy || storageBlocked || !(recovery.prepare ? canPrepare : canPublish)} onClick={() => void write(recovery.prepare ? "prepare" : "publish")}>Dezelfde opdracht opnieuw bevestigen</Button><Button type="button" variant="secondary" disabled={busy || storageBlocked} onClick={() => void readStatus()}>Bestaande opdracht controleren</Button></div>}
          {!recovery.receipt && <>
            <div className={styles.priceSectionHeading}><h3>Prijsverschillen</h3><Button type="button" variant="secondary" disabled={busy || pending} onClick={() => void loadImpact()}>Volledige impact opnieuw lezen</Button></div>
            {readyImpact ? <>
              <dl className={styles.priceImpact}><div><dt>Menu’s</dt><dd>{impact.affectedMenus}</dd></div><div><dt>Plaatsingen</dt><dd>{impact.affectedPlacements}</dd></div><div><dt>Playlists</dt><dd>{impact.affectedPlaylists}</dd></div></dl>
              <p>Huidig schermbereik: {impact.desiredScreens} gewenst · {impact.confirmedScreens} bevestigd · {impact.unknownScreens} onbekend. Deze aantallen zijn geen activatiebevestiging van nieuwe prijzen.</p>
              {impact.reviewRequiredProducts > 0 && <p className={styles.priceError}>{impact.reviewRequiredProducts} producten vragen controle van hun vastgelegde prijs. Een onbekende catalogusbaseline wordt niet als een plaatsingsprijs behandeld.</p>}
              {impact.rows.length ? <div className={`ad-table-wrap ${styles.priceTable}`} tabIndex={0} role="region" aria-label="Alle prijsverschillen"><table className="sync-data-table"><caption>Vastgelegde prijzen tegenover de huidige catalogus</caption><thead><tr><th scope="col">Product</th><th scope="col">Vastgelegde prijs</th><th scope="col">Nieuwe catalogusprijs</th></tr></thead><tbody>{impact.rows.map(row => <tr key={row.productId}><th scope="row">{row.name}<small>{row.affectedMenus} menu’s</small></th><td>{row.previousCatalogPrices.length ? <><span className="ad-price-old">{prices(row.previousCatalogPrices)}</span><small>Vastgelegde catalogusprijs</small></> : <><span>{prices(row.previousDisplayPrices) || "Niet bekend"}</span><small>Catalogusbaseline onbekend</small></>}{row.overridePrices.length > 0 && <p>Plaatsingsprijs blijft behouden: {prices(row.overridePrices)}</p>}</td><td><strong>{money(row.nextCatalogPrice)}</strong>{row.unpriced && <small>Controle nodig vóór bijwerken</small>}</td></tr>)}</tbody></table><dl className={styles.priceList} aria-label="Prijsverschillen per product">{impact.rows.map(row => <div className={styles.priceDifference} data-price-product={row.productId} key={row.productId}>
                <dt>Product</dt><dd><strong>{row.name}</strong><small>{row.affectedMenus} menu’s</small></dd>
                <dt>Vastgelegde prijs</dt><dd>{row.previousCatalogPrices.length ? <><span className="ad-price-old">{prices(row.previousCatalogPrices)}</span><small>Vastgelegde catalogusprijs</small></> : <><span>{prices(row.previousDisplayPrices) || "Niet bekend"}</span><small>Catalogusbaseline onbekend</small></>}{row.overridePrices.length > 0 && <p>Plaatsingsprijs blijft behouden: {prices(row.overridePrices)}</p>}</dd>
                <dt>Nieuwe catalogusprijs</dt><dd><strong>{money(row.nextCatalogPrice)}</strong>{row.unpriced && <small>Controle nodig vóór bijwerken</small>}</dd>
              </div>)}</dl></div> : <p role="status">Er zijn geen prijsverschillen gevonden. Er wordt geen prijsversie aangemaakt.</p>}
              {impact.hasMore && <><p>Er zijn meer prijsregels. Lees die ook voordat je de gekozen concepten bevestigt.</p><Button type="button" variant="secondary" disabled={busy || pending} onClick={() => void loadImpact(true)}>Meer prijsverschillen tonen</Button></>}
              <fieldset className={styles.priceChoices} disabled={busy || pending || stale || !canPrepare || storageBlocked}><legend>Kies de concepten die je bijwerkt</legend><p>Er is niets vooraf geselecteerd. Je kunt maximaal 25 concepten per opdracht kiezen.</p>{impact.menus.map(menu => <label className={styles.priceChoice} key={menu.slideId}><input type="checkbox" checked={selected.includes(menu.slideId)} disabled={!menu.canPrepare || !selected.includes(menu.slideId) && selected.length >= 25} onChange={event => { const checked = event.currentTarget.checked; setSelected(value => checked ? [...value, menu.slideId] : value.filter(id => id !== menu.slideId)); }} /><span><strong>{menu.name}</strong><small>{menu.changedProducts} prijswijzigingen · {menu.preservedOverrides} behouden plaatsingsprijzen</small>{menu.playlists.length > 0 && <small>Playlists: {menu.playlists.map(item => item.name).join(" · ")}</small>}{menu.blockedReason && <small>{menu.blockedReason}</small>}</span></label>)}</fieldset>
            </> : <p>De volledige prijscontrole is nog niet beschikbaar. Lees de impact opnieuw; ontbrekende gegevens worden niet als nul weergegeven.</p>}
          </>}
          {recovery.receipt && <section className={styles.priceResults} aria-label="Nieuwe prijskandidaten"><div className={styles.priceSectionHeading}><h3>Nieuwe prijskandidaten</h3><Button type="button" variant="secondary" disabled={busy || storageBlocked} onClick={() => void readStatus()}>Status opnieuw lezen</Button></div><p>Een vastgelegd concept wordt pas een nieuwe kandidaat na je aparte publicatieopdracht. Ook een gereedstaande kandidaat is nog niet op TV actief.</p><fieldset className={styles.priceChoices} disabled={busy || pending || stale || !canPublish || storageBlocked}><legend>Kies welke kandidaten je publiceert</legend>{recovery.receipt.candidates.map(candidate => <label className={styles.priceChoice} key={candidate.slideId}><input type="checkbox" checked={selectedCandidates.includes(candidate.slideId)} disabled={candidate.state !== "draft"} onChange={event => { const checked = event.currentTarget.checked; setSelectedCandidates(value => checked ? [...value, candidate.slideId] : value.filter(id => id !== candidate.slideId)); }} /><span><strong>{candidate.name}</strong><StatusPill label={candidate.state === "draft" ? "Concept vastgelegd" : candidate.state === "pending" ? "Voorbereiding loopt" : candidate.state === "failed" ? "Voorbereiding mislukt" : "Kandidaat gereed"} tone={candidate.state === "failed" ? "critical" : "neutral"} /></span></label>)}</fieldset><ul className={styles.priceDestinations}>{recovery.receipt.candidates.map(candidate => <li key={candidate.slideId}><Link href={menuPriceEditorHref(candidate)}>Open {candidate.name}</Link>{candidate.state === "failed" && <p>De voorbereiding is mislukt. Je vastgelegde prijsversie blijft behouden. <Link href={`/dashboard/slides/${candidate.slideId}`}>Open de versiestatus en herstel de voorbereiding</Link>; lees daarna de status opnieuw. Publiceer deze versie niet nogmaals als nieuw concept.</p>}{candidate.playlists.length ? <ul>{candidate.playlists.map(playlist => <li key={playlist.id}><Link href={`/dashboard/playlists/${playlist.id}`}>{playlist.name}</Link></li>)}</ul> : <p>Dit menu heeft nog geen playlistplaatsing.</p>}</li>)}</ul><p>Zodra een kandidaat gereed is, kies je in de genoemde playlist bij dit menu <strong>Nieuwste Studio-versie</strong>, sla je de playlist op en doorloop je <strong>Publiceren</strong>. Controleer daar de gewenste en werkelijk bevestigde versie per scherm.</p>{!pending && <Button type="button" variant="secondary" disabled={busy || storageBlocked} onClick={() => void newReview()}>Andere menu’s controleren</Button>}</section>}
          {!canPrepare && <p>Je kunt de prijscontrole bekijken. Vraag een beheerder met rechten om menu’s te bewerken om concepten bij te werken.</p>}
        </DialogBody>
        <DialogFooter className={styles.priceFooter} aside={pending ? "Oorspronkelijke opdracht behouden" : recovery.receipt ? `${selectedCandidates.length} kandidaten gekozen` : `${selected.length} concepten gekozen`}><Button type="button" variant="secondary" disabled={busy} onClick={() => setOpen(false)}>Sluiten</Button>{!pending && (recovery.receipt ? <Button type="button" variant="primary" disabled={busy || !hydrated || storageBlocked || stale || !canPublish || !selectedCandidates.length} onClick={() => void write("publish")}>Nieuwe kandidaten publiceren</Button> : <Button type="button" variant="primary" disabled={!canConfirm} onClick={() => void write("prepare")}>Prijsversie vastleggen</Button>)}</DialogFooter>
      </DialogContent>
  </Dialog>;
}
