import Link from "next/link";
import { Database, LayoutTemplate, Sparkles } from "lucide-react";

import { Button } from "@veyocast/ui";

import { requireTenantControlSession } from "../../../../../lib/control-session";
import { createControlSupabaseClient } from "../../../../../lib/supabase/server";
import { PageHeader, StatusPill } from "../../../_components/shell-primitives";
import styles from "../../dynamic-content.module.css";
import { createDynamicSlide } from "../actions";

type PageProps = {
  searchParams: Promise<{ fout?: string }>;
};

const steps = [
  "Dynamische slide",
  "Categorie",
  "Slidetype",
  "Template",
  "Databron",
  "Inhoud",
  "Voorbeeld",
  "Opslaan"
];

export default async function NewSlidePage({ searchParams }: PageProps) {
  const session = await requireTenantControlSession("tenant.dynamic_slide.write");
  const params = await searchParams;
  const data = session.isLive
    ? await loadOptions(session.tenantId!)
    : { sources: [], templates: [] };

  return (
    <>
      <PageHeader
        actions={<Button asChild variant="ghost"><Link href="/dashboard/slides">Annuleren</Link></Button>}
        description="Doorloop de vaste keuzes; VeyoCast maakt daarna een controleerbare datasnapshot en server-side PNG."
        eyebrow="Nieuwe slide"
        title="Dynamische slide maken"
      />
      {params.fout ? <p className="notice notice--critical" role="alert"><strong>Slide niet gemaakt.</strong> {params.fout}</p> : null}
      <div aria-label="Stappen voor dynamische slide" className={styles.steps}>
        {steps.map((step, index) => <div className={styles.step} key={step}><strong>{index + 1}</strong><span>{step}</span></div>)}
      </div>

      {!data.sources.length ? (
        <div className="empty-state">
          <Database aria-hidden="true" />
          <h2>Eerst een databron nodig</h2>
          <p>Maak een productbron of koppel een veilige RSS-feed voordat je een slide samenstelt.</p>
          <Button asChild><Link href="/dashboard/data-sources">Databron toevoegen</Link></Button>
        </div>
      ) : !data.templates.length ? (
        <div className="empty-state"><LayoutTemplate aria-hidden="true" /><h2>Geen gepubliceerde templates</h2><p>Een platformbeheerder moet eerst een dynamisch template publiceren.</p></div>
      ) : (
        <form action={createDynamicSlide} className={styles.form}>
          <section className={styles.formSection}>
            <h2>1–3. Basis</h2>
            <div className={styles.fieldGrid}>
              <label className={styles.field}><span>Naam van de slide</span><input name="name" required maxLength={120} placeholder="Kantinemenu vandaag" /></label>
              <label className={styles.field}><span>Slidetype</span><select name="slideType" defaultValue="menu"><option value="menu">Menubord</option><option value="news">Nieuws</option></select></label>
              <label className={`${styles.field} ${styles.fieldWide}`}><span>Titel op het scherm</span><input name="title" maxLength={160} placeholder="Menu vandaag" /></label>
            </div>
          </section>
          <section className={styles.formSection}>
            <h2>4. Kies template</h2>
            <div className={styles.grid}>
              {data.templates.map((template, index) => (
                <label className={styles.card} key={template.versionId}>
                  <div className={styles.cardBody}>
                    <input defaultChecked={index === 0} name="templateVersionId" type="radio" value={template.versionId} />
                    <div><strong>{template.name}</strong><p className={styles.muted}>{template.slideType === "menu" ? "Menubord" : "Nieuws"} · {template.orientation === "portrait" ? "Staand" : "Liggend"}</p></div>
                    <StatusPill label="Platformtemplate" tone="info" />
                  </div>
                </label>
              ))}
            </div>
          </section>
          <section className={styles.formSection}>
            <h2>5–6. Databron en inhoud</h2>
            <div className={styles.fieldGrid}>
              <label className={styles.field}><span>Databron</span><select name="dataSourceId" required>{data.sources.map((source) => <option key={source.id} value={source.id}>{source.name} · {source.kind === "rss" ? "Nieuws" : "Producten"}</option>)}</select></label>
              <label className={styles.field}><span>Selectiemodus</span><select name="selectionMode" defaultValue="latest"><option value="latest">Automatisch nieuwste snapshot</option><option value="pinned">Deze versie vastzetten</option></select></label>
              <label className={styles.field}><span>Categorie (optioneel)</span><input name="category" maxLength={160} placeholder="Dranken" /></label>
              <label className={styles.field}><span>Maximaal aantal items</span><input defaultValue="8" max="40" min="1" name="maxItems" type="number" /></label>
            </div>
          </section>
          <section className={styles.formSection}>
            <h2>7–8. Voorbeeld en opslaan</h2>
            <p className={styles.muted}>Na opslaan verschijnt de immutable workerpreview hier en in de slidebibliotheek. Pas wanneer die gereed is kan de snapshot naar een playlist.</p>
            <div className={styles.formActions}><span className={styles.muted}>Bestaande releases en schermcache blijven ongewijzigd.</span><Button type="submit"><Sparkles aria-hidden="true" />Opslaan als slide</Button></div>
          </section>
        </form>
      )}
    </>
  );
}

async function loadOptions(tenantId: string) {
  const supabase = await createControlSupabaseClient();
  if (!supabase) return { sources: [], templates: [] };
  const [sourcesResult, templatesResult] = await Promise.all([
    supabase.from("dynamic_data_sources").select("id, name, kind").eq("tenant_id", tenantId).eq("status", "active").order("name"),
    supabase.from("dynamic_templates").select("id, name, slide_type, orientation, current_published_version_id").eq("status", "published").order("name")
  ]);
  return {
    sources: sourcesResult.data ?? [],
    templates: (templatesResult.data ?? []).flatMap((template) =>
      template.current_published_version_id ? [{
        name: template.name,
        orientation: template.orientation,
        slideType: template.slide_type,
        versionId: template.current_published_version_id
      }] : []
    )
  };
}
