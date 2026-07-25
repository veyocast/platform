import { hasCapability } from "@veyocast/auth";
import { SummaryStrip } from "@veyocast/ui";

import { requireTenantControlSession } from "../../../../lib/control-session";
import { PageHeader, StatusPill } from "../../_components/shell-primitives";
import { ProductImportDialog } from "./product-import-dialog";
import { ProductTable } from "./product-table";
import { loadProductsWorkspace } from "./data";
import styles from "./products.module.css";

type ProductsPageProps = Readonly<{
  searchParams: Promise<{ fout?: string; succes?: string }>;
}>;

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const session = await requireTenantControlSession("tenant.product.read");
  const query = await searchParams;
  const data = session.isLive
    ? await loadProductsWorkspace(session.tenantId!)
    : { error: false, imports: [], products: [] };
  const canWrite =
    session.isLive &&
    session.tenantStatus === "active" &&
    hasCapability(session.capabilities, "tenant.product.write");
  const activeCount = data.products.filter((product) => product.active).length;
  const categories = new Set(
    data.products.flatMap((product) => product.category ? [product.category] : [])
  ).size;

  return (
    <>
      <PageHeader
        actions={<ProductImportDialog disabled={!canWrite} />}
        description="Beheer producten en prijzen als gecontroleerde Excel-snapshot voor Studio-slides."
        eyebrow={session.tenant}
        title="Productcatalogus"
      />
      {!session.isLive ? (
        <p className="notice notice--warning" role="status">
          Configureer Supabase om echte productcatalogi te importeren.
        </p>
      ) : null}
      {data.error ? (
        <p className="notice notice--critical" role="alert">
          <strong>Productcatalogus niet beschikbaar.</strong> Er is niets gewijzigd.
          Vernieuw de pagina of probeer later opnieuw.
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
            ? "De gecontroleerde productregels zijn toegepast. Studio gebruikt bij een nieuwe render een immutable snapshot."
            : "De productregel is opgeslagen."}
        </p>
      ) : null}

      <SummaryStrip
        items={[
          { label: "Actieve producten", value: String(activeCount) },
          { label: "Categorieën", value: String(categories) },
          { label: "Imports", value: String(data.imports.length) }
        ]}
      />

      <section className="workspace-section" aria-labelledby="products-title">
        <div className="workspace-section__header">
          <div>
            <h2 className="workspace-section__title" id="products-title">Producten</h2>
            <p className="work-panel__meta">
              Wijzig waarden rechtstreeks per productregel. Een shortcode wordt
              pas bij genereren naar een vaste waarde omgezet.
            </p>
          </div>
          <StatusPill label={`${data.products.length} totaal`} tone="neutral" />
        </div>
        {data.products.length ? (
          <ProductTable canWrite={canWrite} products={data.products} />
        ) : (
          <div className={styles.empty}>
            <h3>Nog geen producten</h3>
            <p>
              Importeer de actuele Twelve-export. VeyoCast stelt daarna normale
              kolomnamen voor voordat iets aan de catalogus wordt toegevoegd.
            </p>
            <ProductImportDialog disabled={!canWrite} />
          </div>
        )}
      </section>

      <section className="workspace-section" aria-labelledby="imports-title">
        <div className="workspace-section__header">
          <div>
            <h2 className="workspace-section__title" id="imports-title">Importgeschiedenis</h2>
            <p className="work-panel__meta">
              Iedere werkmap blijft herleidbaar; het oorspronkelijke bestand zelf
              wordt niet opgeslagen.
            </p>
          </div>
        </div>
        <div className={styles.importList}>
          {data.imports.map((item) => (
            <a href={`/dashboard/products/imports/${item.id}`} key={item.id}>
              <span>
                <strong>{item.fileName}</strong>
                <small>{item.sheetName} · {item.rowCount} regels</small>
              </span>
              <StatusPill
                label={item.status === "applied" ? "Toegepast" : item.status === "draft" ? "Controleren" : "Geannuleerd"}
                tone={item.status === "applied" ? "success" : item.status === "draft" ? "warning" : "neutral"}
              />
            </a>
          ))}
          {!data.imports.length ? <p className="work-panel__meta">Nog geen imports uitgevoerd.</p> : null}
        </div>
      </section>
    </>
  );
}

const productErrors: Record<string, string> = {
  configuratie: "De live omgeving is niet beschikbaar.",
  conflict: "Iemand anders wijzigde deze productregel. Vernieuw en probeer opnieuw.",
  invoer: "Controleer de naam, prijs en btw-waarde.",
  opslaan: "De server bevestigde de wijziging niet veilig."
};
