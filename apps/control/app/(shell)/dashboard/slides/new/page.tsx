import Link from "next/link";
import { Database, LayoutTemplate } from "lucide-react";

import { Button } from "@veyocast/ui";

import { requireTenantControlSession } from "../../../../../lib/control-session";
import { createControlSupabaseClient } from "../../../../../lib/supabase/server";
import { PageHeader } from "../../../_components/shell-primitives";
import styles from "../../dynamic-content.module.css";
import {
  SlideComposerForm,
  type SlideSourceOption
} from "./slide-composer-form";

type PageProps = {
  searchParams: Promise<{ fout?: string }>;
};

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

      {!data.sources.length ? (
        <div className={`empty-state ${styles.emptyState}`}>
          <Database aria-hidden="true" />
          <h2>Eerst een databron nodig</h2>
          <p>Maak een productbron, koppel een veilige RSS-feed of verbind Sportlink voordat je een slide samenstelt.</p>
          <div className={styles.heroActions}>
            <Button asChild><Link href="/dashboard/data-sources">Databron toevoegen</Link></Button>
            <Button asChild variant="secondary"><Link href="/dashboard/data-sources/sportlink">Sportlink koppelen</Link></Button>
          </div>
        </div>
      ) : !data.templates.length ? (
        <div className={`empty-state ${styles.emptyState}`}><LayoutTemplate aria-hidden="true" /><h2>Geen gepubliceerde templates</h2><p>Een platformbeheerder moet eerst een dynamisch template publiceren.</p></div>
      ) : (
        <SlideComposerForm sources={data.sources} templates={data.templates} />
      )}
    </>
  );
}

async function loadOptions(tenantId: string) {
  const supabase = await createControlSupabaseClient();
  if (!supabase) return { sources: [], templates: [] };
  const [sourcesResult, templatesResult] = await Promise.all([
    supabase.from("dynamic_data_sources").select("id, name, kind, provider_status, last_successful_sync_at, last_error_code").eq("tenant_id", tenantId).eq("status", "active").order("name"),
    supabase.from("dynamic_templates").select("id, name, slide_type, orientation, current_published_version_id").eq("status", "published").order("name")
  ]);
  const sportSources = (sourcesResult.data ?? []).filter(
    (source) => source.kind === "sportlink"
  );
  const successfulGroupsBySource = new Map<string, string[]>();
  if (sportSources.length) {
    const connectionsResult = await supabase
      .from("sportlink_connections")
      .select("id, data_source_id")
      .eq("tenant_id", tenantId)
      .in("data_source_id", sportSources.map((source) => source.id));
    const connections = connectionsResult.data ?? [];
    if (connections.length) {
      const policiesResult = await supabase
        .from("sportlink_sync_policies")
        .select("connection_id, dataset_group, last_success_at")
        .eq("tenant_id", tenantId)
        .in("connection_id", connections.map((connection) => connection.id))
        .not("last_success_at", "is", null);
      const sourceIdByConnection = new Map(
        connections.map((connection) => [connection.id, connection.data_source_id])
      );
      for (const policy of policiesResult.data ?? []) {
        const sourceId = sourceIdByConnection.get(policy.connection_id);
        if (!sourceId || !policy.last_success_at) continue;
        const groups = successfulGroupsBySource.get(sourceId) ?? [];
        groups.push(policy.dataset_group);
        successfulGroupsBySource.set(sourceId, groups);
      }
    }
  }
  const sources = await Promise.all((sourcesResult.data ?? []).map(
    async (source): Promise<SlideSourceOption> => ({
      id: source.id,
      itemCount: await loadSourceItemCount(
        supabase,
        tenantId,
        source.id,
        source.kind
      ),
      kind: source.kind,
      lastErrorCode: source.last_error_code,
      lastSuccessfulSyncAt: source.last_successful_sync_at,
      name: source.name,
      providerStatus: source.provider_status,
      successfulDatasetGroups: successfulGroupsBySource.get(source.id) ?? []
    })
  ));
  return {
    sources,
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

async function loadSourceItemCount(
  supabase: NonNullable<Awaited<ReturnType<typeof createControlSupabaseClient>>>,
  tenantId: string,
  sourceId: string,
  kind: string
) {
  if (kind === "sportlink") return 0;
  if (kind === "rss") {
    const result = await supabase
      .from("dynamic_news_articles")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("data_source_id", sourceId);
    return result.count ?? 0;
  }
  const result = await supabase
    .from("tenant_products")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("active", true)
    .eq("available", true)
    .or(`data_source_id.eq.${sourceId},data_source_id.is.null`);
  return result.count ?? 0;
}
