import { notFound } from "next/navigation";
import { Button, StatusPill, SummaryStrip } from "@veyocast/ui";

import { requireTenantControlSession } from "../../../../../../lib/control-session";
import { PageHeader } from "../../../../_components/shell-primitives";
import { applyProductImport, remapProductImport } from "../../actions";
import { loadProductImport } from "../../data";
import styles from "../../products.module.css";

type ImportPageProps = Readonly<{
  params: Promise<{ importId: string }>;
  searchParams: Promise<{ fout?: string; succes?: string }>;
}>;

export default async function ProductImportPage({
  params,
  searchParams
}: ImportPageProps) {
  const session = await requireTenantControlSession("tenant.product.read");
  const { importId } = await params;
  const query = await searchParams;
  if (!session.isLive || !session.tenantId) notFound();
  const data = await loadProductImport(session.tenantId, importId);
  if (!data) notFound();
  const isDraft = data.status === "draft";

  return (
    <>
      <PageHeader
        actions={<a className="button-link button-link--secondary" href="/dashboard/products">Terug naar producten</a>}
        description={`Tabblad ${data.sheetName} uit ${data.fileName}. Controleer mapping en voorbeeld vóór toepassen.`}
        eyebrow={session.tenant}
        status={{
          label: isDraft ? "Controle nodig" : data.status === "applied" ? "Toegepast" : "Geannuleerd",
          tone: isDraft ? "warning" : data.status === "applied" ? "success" : "neutral"
        }}
        title="Excel-import controleren"
      />
      {query.fout ? (
        <p className="notice notice--critical" role="alert">
          <strong>Import niet bijgewerkt.</strong>{" "}
          {importErrors[query.fout] ?? importErrors.toepassen}
        </p>
      ) : null}
      {query.succes === "mapping" ? (
        <p className="notice notice--success" role="status">
          De kolommen zijn opnieuw verwerkt. Controleer de geldige regels hieronder.
        </p>
      ) : null}
      <SummaryStrip
        items={[
          { label: "Regels", value: String(data.rowCount) },
          { label: "Meenemen", value: String(data.includedCount) },
          { label: "Geldig", value: String(data.validCount) }
        ]}
      />

      <section className="workspace-section" aria-labelledby="mapping-title">
        <div className="workspace-section__header">
          <div>
            <h2 className="workspace-section__title" id="mapping-title">Kolommen koppelen</h2>
            <p className="work-panel__meta">
              Kies een normale VeyoCast-naam, bewaar een kolom als extra veld of
              zet hem uit. Een standaardveld kan maar één keer worden gekozen.
            </p>
          </div>
        </div>
        <form action={remapProductImport}>
          <input name="importId" type="hidden" value={data.id} />
          <div className={styles.mappingGrid}>
            {data.headers.map((header, index) => {
              const current = String(data.columnMapping[header] ?? "");
              return (
                <label key={header}>
                  <span>{header}</span>
                  <select
                    defaultValue={current}
                    disabled={!isDraft}
                    name={`target-${index}`}
                  >
                    <option value="">Niet importeren</option>
                    {mappingOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                    <option value={`custom:${header}`}>Extra kolom: {header}</option>
                  </select>
                </label>
              );
            })}
          </div>
          {isDraft ? <Button type="submit" variant="secondary">Mapping opnieuw verwerken</Button> : null}
        </form>
      </section>

      <section className="workspace-section" aria-labelledby="preview-title">
        <div className="workspace-section__header">
          <div>
            <h2 className="workspace-section__title" id="preview-title">Voorbeeld</h2>
            <p className="work-panel__meta">
              De eerste 100 genormaliseerde regels. Na toepassen zijn alle
              productcellen afzonderlijk te wijzigen in de catalogus.
            </p>
          </div>
          <StatusPill
            label={data.validCount === data.includedCount ? "Klaar voor import" : "Controleer fouten"}
            tone={data.validCount === data.includedCount ? "success" : "critical"}
          />
        </div>
        <div className="table-scroll">
          <table>
            <thead><tr><th>Regel</th><th>Naam</th><th>Categorie</th><th>Prijs</th><th>Status</th></tr></thead>
            <tbody>
              {data.rows.slice(0, 100).map((row) => (
                <tr key={row.rowNumber}>
                  <td>{row.rowNumber}</td>
                  <td>{String(row.normalized.name ?? "—")}</td>
                  <td>{String(row.normalized.category ?? "—")}</td>
                  <td>{formatPrice(row.normalized.price_cents)}</td>
                  <td>
                    <StatusPill
                      label={!row.included ? "Uitgeschakeld" : row.errors.length ? row.errors.join(" ") : "Geldig"}
                      tone={!row.included ? "neutral" : row.errors.length ? "critical" : "success"}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {isDraft ? (
        <section className="workspace-section" aria-labelledby="apply-title">
          <div className="workspace-section__header">
            <div>
              <h2 className="workspace-section__title" id="apply-title">Import toepassen</h2>
              <p className="work-panel__meta">
                Samenvoegen werkt bestaande producten bij en behoudt overige
                regels. Vervangen deactiveert Twelve-producten die niet in deze export staan.
              </p>
            </div>
          </div>
          <form action={applyProductImport} className={styles.applyBar}>
            <input name="importId" type="hidden" value={data.id} />
            <label>
              <span>Importmethode</span>
              <select defaultValue="merge" name="mode">
                <option value="merge">Samenvoegen</option>
                <option value="replace">Twelve-catalogus vervangen</option>
              </select>
            </label>
            <Button
              disabled={data.validCount !== data.includedCount || data.includedCount === 0}
              type="submit"
            >
              {data.includedCount} producten toepassen
            </Button>
          </form>
        </section>
      ) : null}
    </>
  );
}

const mappingOptions = [
  { label: "Artikelnummer", value: "external_id" },
  { label: "Productnaam", value: "name" },
  { label: "Beschrijving", value: "description" },
  { label: "Categorie", value: "category" },
  { label: "Prijs", value: "price" },
  { label: "Btw-percentage", value: "vat_rate" },
  { label: "Eenheid", value: "unit" },
  { label: "Barcode", value: "barcode" },
  { label: "Actief", value: "active" }
] as const;

const importErrors: Record<string, string> = {
  mapping: "De gekozen kolommapping kon niet veilig worden verwerkt.",
  "niet-gereed": "Minimaal één ingeschakelde regel bevat nog een fout.",
  status: "Deze import is al toegepast of geannuleerd.",
  toepassen: "De catalogus is niet gewijzigd. Probeer opnieuw."
};

function formatPrice(value: unknown) {
  return typeof value === "number"
    ? new Intl.NumberFormat("nl-NL", { currency: "EUR", style: "currency" }).format(value / 100)
    : "—";
}
