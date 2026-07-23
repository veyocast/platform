import Link from "next/link";
import { LayoutTemplate } from "lucide-react";

import { hasCapability } from "@veyocast/auth";
import { Button, PageHeader, StatusPill, SummaryStrip } from "@veyocast/ui";

import { requireTenantControlSession } from "../../../../lib/control-session";
import styles from "../publisher-resources.module.css";
import { loadTenantTemplates } from "./data";
import { TemplateCreateDialog, TemplateUseDialog } from "./template-dialogs";

type TemplatesPageProps = {
  searchParams: Promise<{ fout?: string; succes?: string }>;
};

export default async function TemplatesPage({ searchParams }: TemplatesPageProps) {
  const session = await requireTenantControlSession("tenant.playlist.read");
  const query = await searchParams;
  const data = session.isLive && session.tenantId
    ? await loadTenantTemplates(session.tenantId)
    : { error: null, playlists: [], templates: [] };
  const active = data.templates.filter((template) => template.status === "active");
  const canWrite = session.isLive && session.tenantStatus === "active" &&
    hasCapability(session.roles, "tenant.playlist.write");

  return (
    <>
      <PageHeader
        actions={<TemplateCreateDialog disabled={!canWrite} playlists={data.playlists} />}
        description="Herbruikbare, begrensde playlistconcepten voor snelle en consistente publicaties."
        eyebrow={session.tenant}
        status={!session.isLive ? { label: "Demomodus", tone: "warning" } : undefined}
        title="Templates"
      />
      {query.fout ? <p className="notice notice--critical" role="alert"><strong>Templateactie mislukt.</strong> {query.fout}</p> : null}
      {query.succes ? <p className="notice notice--success" role="status">{query.succes}</p> : null}
      {data.error ? <p className="notice notice--critical" role="alert"><strong>Templates niet geladen.</strong> {data.error}</p> : null}
      {!session.isLive ? <p className="notice notice--warning" role="status">Configureer Supabase en log in om echte tenanttemplates te beheren.</p> : null}

      <SummaryStrip
        aria-label="Templatesamenvatting"
        items={[
          { label: "Actieve templates", value: active.length },
          { label: "Gearchiveerd", value: data.templates.length - active.length },
          { detail: "Mogelijke bronnen voor een template", label: "Playlists", value: data.playlists.length }
        ]}
      />

      {data.templates.length ? (
        <section aria-label="Tenanttemplates" className={styles.resourceGrid}>
          {data.templates.map((template) => (
            <article className={styles.resourceCard} data-muted={template.status === "archived"} key={template.id}>
              <div className={styles.resourceHeader}>
                <div><h2>{template.name}</h2><p>{template.description || "Geen beschrijving toegevoegd."}</p></div>
                <StatusPill label={template.status === "active" ? "Actief" : "Gearchiveerd"} tone={template.status === "active" ? "success" : "neutral"} />
              </div>
              <dl className={styles.resourceMeta}>
                <div><dt>Inhoud</dt><dd>{template.itemCount} {template.itemCount === 1 ? "item" : "items"}</dd></div>
                <div><dt>Bron</dt><dd>{template.sourcePlaylistName || "Vastgelegde snapshot"}</dd></div>
              </dl>
              <div className={styles.resourceFooter}>
                <span>Bijgewerkt {formatDate(template.updatedAt)} · revisie {template.revision}</span>
                {template.status === "active" && canWrite
                  ? <TemplateUseDialog templateId={template.id} templateName={template.name} />
                  : null}
              </div>
            </article>
          ))}
        </section>
      ) : (
        <section className={styles.empty} role="status">
          <LayoutTemplate aria-hidden="true" />
          <h2>Nog geen templates</h2>
          <p>Een template ontstaat uit een gecontroleerde playlist en neemt geen releasehistorie of schermtoewijzingen over.</p>
          <Button asChild variant="secondary"><Link href="/dashboard/playlists">Bekijk playlists</Link></Button>
        </section>
      )}
    </>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("nl-NL", { dateStyle: "medium" }).format(new Date(value));
}
