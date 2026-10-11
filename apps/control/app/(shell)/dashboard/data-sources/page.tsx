import Link from "next/link";
import { FileSpreadsheet, Rss, Sparkles } from "lucide-react";
import { hasCapability } from "@veyocast/auth";
import { Button, StatusPill } from "@veyocast/ui";
import { requireTenantControlSession } from "../../../../lib/control-session";
import { formatTenantDateTime } from "../../../../lib/tenant-time";
import { loadSourcesOverview } from "../sources/sites-sources-data";
import { sourceOverviewErrorCopy, sourceOverviewHealth, type SourceOverviewData } from "../sources/sites-sources-model";
import { SourcesOverview } from "../sources/sites-sources-overview";
import styles from "../sources/sites-sources-support.module.css";
import { createProductSource, createRssSource, syncRssSource } from "./actions";

type PageProps = { searchParams: Promise<{ fout?: string; succes?: string }> };
export default async function DataSourcesPage({ searchParams }: PageProps) {
  const session = await requireTenantControlSession("tenant.data_source.read");
  const params = await searchParams;
  const live = session.isLive && session.tenantStatus === "active";
  const canManage = live && hasCapability(session.capabilities, "tenant.data_source.manage");
  const canDesign = live && hasCapability(session.capabilities, "tenant.dynamic_slide.write");
  const canReadProducts = hasCapability(session.capabilities, "tenant.product.read");
  const data: SourceOverviewData = session.isLive && session.tenantId ? await loadSourcesOverview(session.tenantId) : {
    failed: false, sources: [], cards: (["sportlink", "youtube", "twelve", "led"] as const).map(id => ({ id, health: { label: "Nog niet ingesteld", tone: "neutral" }, connectionCount: 0, detail: "Er is nog geen bron gekoppeld." }))
  };
  const rssSources = data.sources.filter(source => source.kind === "rss");
  return <>
    {params.fout && <p className="notice notice--critical" role="alert"><strong>Databron niet bijgewerkt.</strong> {params.fout}</p>}
    {params.succes && <p className="notice notice--success" role="status">{params.succes}</p>}
    <SourcesOverview data={data} canManage={canManage} canDesign={canDesign} canReadProducts={canReadProducts}>
      <section className={styles.support} aria-labelledby="rss-source-title"><h2 id="rss-source-title">RSS en nieuws</h2><p>Nieuws wordt eerst gecontroleerd en opgeslagen. Bij een mislukte synchronisatie blijft de laatste goede inhoud beschikbaar.</p>
        {rssSources.length ? <div className={styles.rows}>{rssSources.map(source => <article className={styles.row} key={source.id}><header><h3>{source.name}</h3><StatusPill {...sourceOverviewHealth(source)} /></header><dl><div><dt>Laatste goede synchronisatie</dt><dd>{formatTenantDateTime(source.last_successful_sync_at, session.timezoneName)}</dd></div></dl>{source.last_error_code && <p role="status">{sourceOverviewErrorCopy(source.last_error_code)}</p>}{canManage && source.status !== "paused" && <form action={syncRssSource}><input name="sourceId" type="hidden" value={source.id} /><Button type="submit" variant="secondary">Nu synchroniseren</Button></form>}</article>)}</div> : <p>{data.failed ? "De nieuwsbronnen konden niet worden gelezen. Vernieuw de pagina." : "Er is nog geen nieuwsfeed gekoppeld."}</p>}
      </section>
      {canManage && <section className={styles.support} aria-labelledby="source-create-title"><details><summary id="source-create-title">Databron toevoegen</summary><div className={styles.forms}>
        <form action={createRssSource} className={styles.form}><h2>RSS of Atom</h2><label className={styles.field}><span>Naam</span><input name="name" required maxLength={120} /></label><label className={styles.field}><span>Publieke feed-URL</span><input name="url" required type="url" placeholder="https://example.nl/feed.xml" /></label><Button type="submit"><Rss aria-hidden="true" />Feed controleren en koppelen</Button></form>
        <form action={createProductSource} className={styles.form}><h2>Productcatalogus</h2><label className={styles.field}><span>Naam</span><input name="name" required maxLength={120} /></label><label className={styles.field}><span>Bronsoort</span><select name="kind"><option value="manual_products">Handmatige producten</option><option value="twelve_excel">Twelve Excel-export</option></select></label><Button type="submit"><FileSpreadsheet aria-hidden="true" />Productbron maken</Button></form>
      </div></details></section>}
      <section className={styles.support} aria-labelledby="other-integration-title"><h2 id="other-integration-title">Ook beheren</h2><div className={styles.links}>{hasCapability(session.capabilities, "tenant.sponsor.read") && <Button asChild variant="secondary"><Link href="/dashboard/sponsors">Sponsor Hub</Link></Button>}{canReadProducts && <Button asChild variant="secondary"><Link href="/dashboard/engage"><Sparkles aria-hidden="true" />Engage</Link></Button>}<Button asChild variant="secondary"><Link href="/dashboard/slides">Opgeslagen ontwerpen</Link></Button></div></section>
    </SourcesOverview>
  </>;
}
