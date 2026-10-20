import Link from "next/link";
import { FileCode2, Search } from "lucide-react";

import { hasCapability } from "@veyocast/auth";
import { Button, DataTable, SummaryStrip } from "@veyocast/ui";

import { requireControlCapability } from "../../../../lib/control-session";
import { createControlSupabaseClient } from "../../../../lib/supabase/server";
import { PageHeader, StatusPill } from "../../_components/shell-primitives";
import styles from "./template-catalog.module.css";

const pageSize = 20;
type PageProps = {
  searchParams: Promise<{ fout?: string; succes?: string; q?: string; status?: string; page?: string }>;
};

export default async function PlatformTemplatesPage({ searchParams }: PageProps) {
  const session = await requireControlCapability("platform.dynamic_template.read");
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q.trim().slice(0, 120) : "";
  const status = ["draft", "published", "withdrawn"].includes(params.status ?? "") ? params.status! : "";
  const requestedPage = typeof params.page === "string" && /^[1-9]\d{0,4}$/.test(params.page) ? Number(params.page) : 1;
  const result = session.isLive ? await loadTemplates(query, status, requestedPage) : { templates: [], total: 0, page: 1, error: false };
  const canWrite = hasCapability(session.capabilities, "platform.dynamic_template.write");
  const pageCount = Math.max(1, Math.ceil(result.total / pageSize));
  const pageHref = (page: number) => {
    const values = new URLSearchParams();
    if (query) values.set("q", query);
    if (status) values.set("status", status);
    values.set("page", String(page));
    return `/platform/templates?${values}`;
  };

  return (
    <div className={styles.catalog}>
      <PageHeader
        actions={canWrite ? <Button asChild><Link href="/platform/templates/new"><FileCode2 aria-hidden="true" />Nieuw template</Link></Button> : null}
        description="Vind een template en beheer de bijbehorende versies."
        eyebrow="Platform"
        title="Dynamische templates"
      />
      {params.fout ? <p className="notice notice--critical" role="alert">Actie mislukt. {params.fout}</p> : null}
      {params.succes ? <p className="notice notice--success" role="status">{params.succes}</p> : null}
      {result.error ? <p className="notice notice--critical" role="alert">De templates konden niet worden geladen. Het overzicht is daarom niet beschikbaar. Vernieuw de pagina om het opnieuw te proberen.</p> : null}
      <SummaryStrip items={[
        { label: query || status ? "Gevonden templates" : "Templates", value: result.error ? "Onbekend" : result.total },
        { label: "Op deze pagina", value: result.templates.length },
        { label: "Pagina", value: `${result.page} van ${pageCount}` }
      ]} />
      <form action="/platform/templates" className={styles.filters} method="get" role="search">
        <label><span>Zoeken op naam</span><input defaultValue={query} maxLength={120} name="q" placeholder="Naam van een template" type="search" /></label>
        <label><span>Status</span><select aria-label="Status" defaultValue={status} name="status"><option value="">Alle statussen</option><option value="published">Gepubliceerd</option><option value="draft">Concept</option><option value="withdrawn">Ingetrokken</option></select></label>
        <Button type="submit" variant="secondary"><Search aria-hidden="true" />Zoeken</Button>
      </form>
      {!result.error && result.templates.length > 0 ? (
        <section aria-labelledby="platform-template-list">
          <h2 className="sr-only" id="platform-template-list">Platformtemplates</h2>
          <DataTable caption="Dynamische templates en hun publicatieversies" className={styles.table}>
            <thead><tr><th scope="col">Template</th><th scope="col">Vorm</th><th scope="col">Status en versie</th></tr></thead>
            <tbody>{result.templates.map(template => (
              <tr key={template.id}>
                <td data-label="Template"><div><Link aria-label={`Template en versies openen: ${template.name}`} className={styles.name} href={`/platform/templates/${template.id}`}>{template.name}</Link>{template.description ? <p className={styles.description}>{template.description}</p> : null}</div></td>
                <td data-label="Vorm"><div>{template.slide_type === "menu" ? "Menubord" : "Nieuws"}<small className={styles.meta}>{template.orientation === "portrait" ? "Staand" : "Liggend"}</small></div></td>
                <td data-label="Status en versie"><div><StatusPill {...templateStatus(template.status)} /><small className={styles.meta}>{template.currentVersion !== null ? `Versie ${template.currentVersion}` : template.current_published_version_id ? "Versie niet beschikbaar" : "Nog geen publicatie"}</small></div></td>
              </tr>
            ))}</tbody>
          </DataTable>
          <nav aria-label="Paginering templates" className={styles.pagination}>
            {result.page > 1 ? <Button asChild variant="secondary"><Link href={pageHref(result.page - 1)}>Vorige</Link></Button> : <Button disabled variant="secondary">Vorige</Button>}
            <span>Pagina {result.page} van {pageCount}</span>
            {result.page < pageCount ? <Button asChild variant="secondary"><Link href={pageHref(result.page + 1)}>Volgende</Link></Button> : <Button disabled variant="secondary">Volgende</Button>}
          </nav>
        </section>
      ) : !result.error ? <p className={styles.empty}>{query || status ? "Geen templates gevonden. Pas je zoekopdracht of statusfilter aan." : "Er zijn nog geen platformtemplates."}</p> : null}
    </div>
  );
}

async function loadTemplates(query: string, status: string, requestedPage: number) {
  const supabase = await createControlSupabaseClient();
  if (!supabase) return { templates: [], total: 0, page: 1, error: true };
  const literal = query.replace(/[\\%_]/g, "\\$&");
  let countQuery = supabase.from("dynamic_templates").select("id", { count: "exact", head: true });
  if (query) countQuery = countQuery.ilike("name", `%${literal}%`);
  if (status) countQuery = countQuery.eq("status", status);
  const counted = await countQuery;
  if (counted.error || counted.count === null) return { templates: [], total: 0, page: 1, error: true };
  const total = counted.count;
  const page = Math.min(requestedPage, Math.max(1, Math.ceil(total / pageSize)));
  if (!total) return { templates: [], total, page, error: false };
  let listQuery = supabase.from("dynamic_templates").select("*");
  if (query) listQuery = listQuery.ilike("name", `%${literal}%`);
  if (status) listQuery = listQuery.eq("status", status);
  const { data, error } = await listQuery.order("updated_at", { ascending: false }).order("id", { ascending: true }).range((page - 1) * pageSize, page * pageSize - 1);
  if (error) return { templates: [], total, page, error: true };
  const versionIds = (data ?? []).flatMap(template => template.current_published_version_id ? [template.current_published_version_id] : []);
  const versions = versionIds.length ? await supabase.from("dynamic_template_versions").select("id, version").in("id", versionIds) : { data: [], error: null };
  if (versions.error) return { templates: [], total, page, error: true };
  const versionMap = new Map((versions.data ?? []).map(version => [version.id, version.version]));
  return { templates: (data ?? []).map(template => ({ ...template, currentVersion: template.current_published_version_id ? versionMap.get(template.current_published_version_id) ?? null : null })), total, page, error: false };
}

function templateStatus(status: string) {
  if (status === "published") return { label: "Gepubliceerd", tone: "success" as const };
  if (status === "withdrawn") return { label: "Ingetrokken", tone: "warning" as const };
  return { label: "Concept", tone: "neutral" as const };
}
