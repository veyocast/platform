import Link from "next/link";
import {
  Database,
  FileSpreadsheet,
  Rss,
  ShieldCheck,
  Trophy
} from "lucide-react";

import { hasCapability } from "@veyocast/auth";
import { Button, SummaryStrip } from "@veyocast/ui";

import { requireTenantControlSession } from "../../../../lib/control-session";
import { createControlSupabaseClient } from "../../../../lib/supabase/server";
import { PageHeader, StatusPill } from "../../_components/shell-primitives";
import styles from "../dynamic-content.module.css";
import {
  createProductSource,
  createManualProduct,
  createRssSource,
  syncRssSource
} from "./actions";

type PageProps = {
  searchParams: Promise<{ fout?: string; succes?: string }>;
};

export default async function DataSourcesPage({ searchParams }: PageProps) {
  const session = await requireTenantControlSession("tenant.data_source.read");
  const params = await searchParams;
  const canManage =
    session.isLive &&
    session.tenantStatus === "active" &&
    hasCapability(session.capabilities, "tenant.data_source.manage");
  const canWriteProducts =
    session.isLive &&
    hasCapability(session.capabilities, "tenant.product.write");
  const sources = session.isLive
    ? await loadSources(session.tenantId!)
    : [];

  return (
    <>
      <PageHeader
        actions={(
          <div className={styles.heroActions}>
            <Button asChild variant="secondary">
              <Link href="/dashboard/data-sources/sportlink">
                <Trophy aria-hidden="true" />
                Sportlink koppelen
              </Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/dashboard/integrations/twelve-products">
                <FileSpreadsheet aria-hidden="true" />
                Twelve-import
              </Link>
            </Button>
          </div>
        )}
        description="Beheer providerdata als gecontroleerde snapshots. Schermen benaderen deze bronnen nooit rechtstreeks."
        eyebrow={session.tenant}
        title="Databronnen"
      />
      {params.fout ? <p className="notice notice--critical" role="alert"><strong>Databron niet bijgewerkt.</strong> {params.fout}</p> : null}
      {params.succes ? <p className="notice notice--success" role="status">{params.succes}</p> : null}
      <SummaryStrip items={[
        { label: "Databronnen", value: sources.length },
        { label: "Gezond", value: sources.filter((source) => source.provider_status === "ready").length },
        { label: "Aandacht nodig", value: sources.filter((source) => source.provider_status === "error").length, tone: sources.some((source) => source.provider_status === "error") ? "warning" : "success" }
      ]} />

      <section className="workspace-section" aria-labelledby="source-list-title">
        <div className="workspace-section__header">
          <div>
            <h2 className="workspace-section__title" id="source-list-title">Gekoppelde bronnen</h2>
            <p className="work-panel__meta">Een mislukte synchronisatie laat de laatste goede content ongewijzigd.</p>
          </div>
        </div>
        {sources.length ? (
          <div className={styles.grid}>
            {sources.map((source) => (
              <article className={styles.card} key={source.id}>
                <div className={styles.cardBody}>
                  <div className={styles.cardTop}>
                    {source.kind === "rss"
                      ? <Rss aria-hidden="true" />
                      : source.kind === "sportlink"
                        ? <Trophy aria-hidden="true" />
                        : <Database aria-hidden="true" />}
                    <StatusPill {...sourceStatus(source.provider_status)} />
                  </div>
                  <div>
                    <h3 className={styles.cardTitle}>{source.name}</h3>
                    <p className={styles.muted}>{sourceKind(source.kind)}</p>
                  </div>
                  <dl className={styles.definitionList}>
                    <div><dt>Laatste goede sync</dt><dd>{formatDate(source.last_successful_sync_at)}</dd></div>
                    <div>
                      <dt>Laatste fout</dt>
                      <dd>{sourceErrorCopy(source.last_error_code)}</dd>
                    </div>
                  </dl>
                  {source.kind === "rss" && canManage ? (
                    <form action={syncRssSource}>
                      <input name="sourceId" type="hidden" value={source.id} />
                      <Button size="sm" type="submit" variant="secondary">Nu synchroniseren</Button>
                    </form>
                  ) : null}
                  {source.kind === "twelve_excel" ? (
                    <p className={styles.muted}><ShieldCheck aria-hidden="true" /> Officiële API niet gekoppeld; gecontroleerde Excel-import blijft actief.</p>
                  ) : null}
                  {source.kind === "sportlink" ? (
                    <Button asChild size="sm" variant="secondary">
                      <Link href="/dashboard/data-sources/sportlink">
                        Sportlink beheren
                      </Link>
                    </Button>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        ) : <div className={`empty-state ${styles.emptyState}`}><h3>Nog geen databronnen</h3><p>Maak hieronder een productbron, veilige RSS-feed of Sportlink-koppeling.</p></div>}
      </section>

      {canManage ? (
        <section className="workspace-section" aria-labelledby="source-create-title">
          <div className="workspace-section__header">
            <div><h2 className="workspace-section__title" id="source-create-title">Databron toevoegen</h2><p className="work-panel__meta">Secrets worden nooit in deze configuratie opgeslagen.</p></div>
          </div>
          <div className={styles.sourceForms}>
            <form action={createRssSource} className={styles.formSection}>
              <h2>RSS of Atom</h2>
              <label className={styles.field}><span>Naam</span><input name="name" required maxLength={120} placeholder="Clubnieuws" /></label>
              <label className={styles.field}><span>Publieke feed-URL</span><input name="url" required type="url" placeholder="https://example.nl/feed.xml" /></label>
              <Button type="submit"><Rss aria-hidden="true" />Feed controleren en koppelen</Button>
            </form>
            <form action={createProductSource} className={styles.formSection}>
              <h2>Productcatalogus</h2>
              <label className={styles.field}><span>Naam</span><input name="name" required maxLength={120} placeholder="Kantineproducten" /></label>
              <label className={styles.field}><span>Bronsoort</span><select name="kind"><option value="manual_products">Handmatige producten</option><option value="twelve_excel">Twelve Excel-export</option></select></label>
              <Button type="submit"><Database aria-hidden="true" />Productbron maken</Button>
            </form>
            <article className={styles.formSection}>
              <h2>Sportlink Club.Dataservice</h2>
              <p className={styles.muted}>
                Importeer club, teams, wedstrijden, uitslagen, standen en
                activiteiten via de officiële server-side koppeling.
              </p>
              <p className={styles.muted}>
                Je hebt hiervoor de Client ID uit Sportlink Club.Dataservice
                nodig. VeyoCast test en versleutelt deze voordat de eerste
                synchronisatie wordt ingepland.
              </p>
              <div>
                <Button asChild variant="secondary">
                  <Link href="/dashboard/data-sources/sportlink">
                    <Trophy aria-hidden="true" />
                    Sportlink instellen
                  </Link>
                </Button>
              </div>
            </article>
          </div>
        </section>
      ) : null}
      {canWriteProducts && sources.some((source) => source.kind === "manual_products") ? (
        <section className="workspace-section" aria-labelledby="manual-product-title">
          <div className="workspace-section__header">
            <div><h2 className="workspace-section__title" id="manual-product-title">Handmatig product toevoegen</h2><p className="work-panel__meta">Voor kleine catalogi zonder providerbestand. Prijzen worden als gehele eurocenten opgeslagen.</p></div>
          </div>
          <form action={createManualProduct} className={styles.formSection}>
            <div className={styles.fieldGrid}>
              <label className={styles.field}><span>Productbron</span><select name="sourceId">{sources.filter((source) => source.kind === "manual_products").map((source) => <option key={source.id} value={source.id}>{source.name}</option>)}</select></label>
              <label className={styles.field}><span>Productnaam</span><input name="name" required maxLength={160} placeholder="Clubburger" /></label>
              <label className={styles.field}><span>Categorie</span><input name="category" maxLength={160} placeholder="Warme snacks" /></label>
              <label className={styles.field}><span>Prijs in euro</span><input name="price" required min="0" step="0.01" type="number" placeholder="8,75" /></label>
              <label className={`${styles.field} ${styles.fieldWide}`}><span>Omschrijving</span><input name="description" maxLength={1000} placeholder="Optionele korte omschrijving" /></label>
            </div>
            <div><Button type="submit">Product opslaan</Button></div>
          </form>
        </section>
      ) : null}
    </>
  );
}

async function loadSources(tenantId: string) {
  const supabase = await createControlSupabaseClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("dynamic_data_sources")
    .select("id, name, kind, provider_status, last_successful_sync_at, last_error_code")
    .eq("tenant_id", tenantId)
    .neq("status", "archived")
    .order("updated_at", { ascending: false });
  if (error) {
    console.error("Dynamische databronnen laden mislukt", { code: error.code });
    return [];
  }
  return data ?? [];
}

function sourceKind(kind: string) {
  if (kind === "rss") return "RSS/Atom-nieuws";
  if (kind === "sportlink") return "Sportlink · wedstrijden en competitie";
  if (kind === "twelve_excel") return "Twelve · gecontroleerde Excel-snapshot";
  return "Handmatige productcatalogus";
}

function sourceStatus(status: string) {
  if (status === "ready") return { label: "Gereed", tone: "success" as const };
  if (status === "error") return { label: "Laatste sync mislukt", tone: "critical" as const };
  if (status === "not_connected") return { label: "API niet gekoppeld", tone: "warning" as const };
  return { label: "Synchroniseren", tone: "info" as const };
}

function formatDate(value: string | null) {
  return value
    ? new Intl.DateTimeFormat("nl-NL", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value))
    : "Nog niet";
}

function sourceErrorCopy(code: string | null) {
  if (!code) return "Geen";
  const messages: Record<string, string> = {
    rss_fetch_blocked: "Feed-URL is om veiligheidsredenen geblokkeerd",
    rss_fetch_http_error: "Feedserver gaf een foutantwoord",
    rss_fetch_invalid_content: "URL bevat geen geldige RSS- of Atom-feed",
    rss_fetch_too_large: "Feed is groter dan de veilige limiet",
    rss_fetch_unavailable: "Feed was tijdelijk niet bereikbaar",
    rss_sync_failed: "Feed kon niet worden verwerkt"
  };
  return `${messages[code] ?? "Synchronisatie mislukt"} (${code})`;
}
