import { hasCapability } from "@veyocast/auth";

import { requireTenantControlSession } from "../../../../../lib/control-session";
import { StatusPill } from "../../../_components/shell-primitives";
import { SitesProductsWorkspace } from "./sites-products-workspace";
import { loadProductsWorkspace } from "./data";
import { loadFrozenProductPrices } from "./frozen-product-prices.server";
import type { ProductPriceEvidence } from "./frozen-product-prices";
import styles from "./products.module.css";

type ProductsPageProps = Readonly<{
  searchParams: Promise<{ fout?: string; succes?: string }>;
}>;

export default async function ProductsPage({
  searchParams,
}: ProductsPageProps) {
  const session = await requireTenantControlSession("tenant.product.read");
  const query = await searchParams;
  const data = session.isLive
    ? await loadProductsWorkspace(session.tenantId!)
    : {
        error: false,
        imports: [],
        catalog: {
          products: [],
          count: 0,
          total: 0,
          active: 0,
          categories: [],
          categoriesComplete: true,
          offset: 0,
          pageSize: 50 as const,
        },
        manualSources: [],
      };
  const priceEvidence: ProductPriceEvidence =
    session.isLive && session.tenantId
      ? await loadFrozenProductPrices(session.tenantId)
      : { status: "none", products: {} };
  const canWrite =
    session.isLive &&
    session.tenantStatus === "active" &&
    hasCapability(session.capabilities, "tenant.product.write");
  const canUploadLogo =
    canWrite && hasCapability(session.capabilities, "tenant.media.write");
  return (
    <>
      {!session.isLive ? (
        <p className="notice notice--warning" role="status">
          De productcatalogus is tijdelijk niet beschikbaar. Je opgeslagen
          menu’s blijven behouden. Probeer later opnieuw.
        </p>
      ) : null}
      {data.error ? (
        <p className="notice notice--critical" role="alert">
          <strong>Productcatalogus niet beschikbaar.</strong> Er is niets
          gewijzigd. Vernieuw de pagina of probeer later opnieuw.
        </p>
      ) : null}
      {query.fout ? (
        <p className="notice notice--critical" role="alert">
          <strong>Productwijziging niet opgeslagen.</strong>{" "}
          {productErrors[query.fout] ?? productErrors.opslaan}
        </p>
      ) : null}
      {query.succes ? (
        <p className="notice notice--success" role="status">
          {query.succes === "geimporteerd"
            ? "De gecontroleerde productregels zijn toegepast. Open je menuontwerp om de actuele producten en prijzen over te nemen."
            : query.succes === "verwijderd"
              ? "Het product is verwijderd uit je assortiment. Opgeslagen menu’s en publicaties blijven behouden."
              : "De productregel is opgeslagen."}
        </p>
      ) : null}

      <SitesProductsWorkspace
        key={session.tenantId ?? "unconfigured"}
        priceEvidence={priceEvidence}
        catalog={data.catalog}
        canRead={session.isLive && Boolean(session.tenantId)}
        manualSources={data.manualSources}
        canWrite={canWrite}
        canUploadLogo={canUploadLogo}
      />

      <section className="workspace-section" aria-labelledby="imports-title">
        <div className="workspace-section__header">
          <div>
            <h2 className="workspace-section__title" id="imports-title">
              Importgeschiedenis
            </h2>
            <p className="work-panel__meta">
              Iedere werkmap blijft herleidbaar; het oorspronkelijke bestand
              zelf wordt niet opgeslagen.
            </p>
          </div>
        </div>
        <div className={styles.importList}>
          {data.imports.map((item) => (
            <a
              href={`/dashboard/integrations/twelve-products/imports/${item.id}`}
              key={item.id}
            >
              <span>
                <strong>{item.fileName}</strong>
                <small>
                  {item.sheetName} · {item.rowCount} regels
                </small>
              </span>
              <StatusPill
                label={
                  item.status === "applied"
                    ? "Toegepast"
                    : item.status === "draft"
                      ? "Controleren"
                      : "Geannuleerd"
                }
                tone={
                  item.status === "applied"
                    ? "success"
                    : item.status === "draft"
                      ? "warning"
                      : "neutral"
                }
              />
            </a>
          ))}
          {!data.imports.length ? (
            <p className="work-panel__meta">Nog geen imports uitgevoerd.</p>
          ) : null}
        </div>
      </section>
    </>
  );
}

const productErrors: Record<string, string> = {
  configuratie: "De live omgeving is niet beschikbaar.",
  artikelnummer:
    "Dit artikelnummer is al in gebruik in deze bron. Kies een ander nummer; er is niets opgeslagen.",
  conflict:
    "Iemand anders wijzigde deze productregel. Vernieuw en probeer opnieuw.",
  invoer: "Controleer de naam, prijs en btw-waarde.",
  opslaan: "De server bevestigde de wijziging niet veilig.",
};
