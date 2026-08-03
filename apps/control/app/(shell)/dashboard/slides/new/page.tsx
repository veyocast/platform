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
import {
  buildSportlinkSlideOptions,
  type SportlinkSlideOptions
} from "./sportlink-slide-options";

type PageProps = {
  searchParams: Promise<{ fout?: string }>;
};

export default async function NewSlidePage({ searchParams }: PageProps) {
  const session = await requireTenantControlSession("tenant.dynamic_slide.write");
  const params = await searchParams;
  const data = session.isLive
    ? await loadOptions(session.tenantId!)
    : { primaryColor: "#FF5C20", sources: [], templates: [] };

  return (
    <>
      <PageHeader
        actions={<Button asChild variant="ghost"><Link href="/dashboard/slides">Annuleren</Link></Button>}
        description="Kies bron, inhoud en vormgeving. De Player toont de gecontroleerde snapshot direct als HTML/CSS; een immutable PNG blijft beschikbaar als veilige fallback."
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
        <SlideComposerForm
          primaryColor={data.primaryColor}
          sources={data.sources}
          templates={data.templates}
        />
      )}
    </>
  );
}

async function loadOptions(tenantId: string) {
  const supabase = await createControlSupabaseClient();
  if (!supabase) {
    return { primaryColor: "#FF5C20", sources: [], templates: [] };
  }
  const [sourcesResult, templatesResult, settingsResult] = await Promise.all([
    supabase.from("dynamic_data_sources").select("id, name, kind, provider_status, last_successful_sync_at, last_error_code").eq("tenant_id", tenantId).eq("status", "active").order("name"),
    supabase.from("dynamic_templates").select("id, slug, name, description, slide_type, orientation, current_published_version_id").eq("status", "published").order("name"),
    supabase.from("tenant_settings").select("primary_color").eq("tenant_id", tenantId).maybeSingle()
  ]);
  const sportSources = (sourcesResult.data ?? []).filter(
    (source) => source.kind === "sportlink"
  );
  const successfulGroupsBySource = new Map<string, string[]>();
  const sportOptionsBySource = new Map<string, SportlinkSlideOptions>();
  if (sportSources.length) {
    const connectionsResult = await supabase
      .from("sportlink_connections")
      .select("id, data_source_id")
      .eq("tenant_id", tenantId)
      .in("data_source_id", sportSources.map((source) => source.id));
    const connections = connectionsResult.data ?? [];
    if (connections.length) {
      const connectionIds = connections.map((connection) => connection.id);
      const [policiesResult, teamsResult, matchesResult] = await Promise.all([
        supabase
          .from("sportlink_sync_policies")
          .select("connection_id, dataset_group, last_success_at")
          .eq("tenant_id", tenantId)
          .in("connection_id", connectionIds)
          .not("last_success_at", "is", null),
        supabase
          .from("sports_teams")
          .select("source_connection_id, external_id, name, metadata")
          .eq("tenant_id", tenantId)
          .eq("active", true)
          .in("source_connection_id", connectionIds)
          .limit(1000),
        supabase
          .from("sports_matches")
          .select(
            "source_connection_id, home_team, away_team, competition, pool"
          )
          .eq("tenant_id", tenantId)
          .eq("active", true)
          .in("source_connection_id", connectionIds)
          .limit(1000)
      ]);
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
      for (const source of sportSources) {
        const sourceConnectionIds = new Set(
          connections
            .filter((connection) => connection.data_source_id === source.id)
            .map((connection) => connection.id)
        );
        sportOptionsBySource.set(
          source.id,
          buildSportlinkSlideOptions({
            matches: (matchesResult.data ?? []).filter((match) =>
              sourceConnectionIds.has(match.source_connection_id)
            ),
            teams: (teamsResult.data ?? []).filter((team) =>
              sourceConnectionIds.has(team.source_connection_id)
            )
          })
        );
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
      sportCompetitions:
        sportOptionsBySource.get(source.id)?.competitions ?? [],
      sportTeams: sportOptionsBySource.get(source.id)?.teams ?? [],
      successfulDatasetGroups: successfulGroupsBySource.get(source.id) ?? []
    })
  ));
  return {
    primaryColor: normalizePrimaryColor(settingsResult.data?.primary_color),
    sources,
    templates: (templatesResult.data ?? []).flatMap((template) =>
      template.current_published_version_id ? [{
        description: template.description,
        name: template.name,
        orientation: template.orientation,
        slideType: template.slide_type,
        slug: template.slug,
        versionId: template.current_published_version_id
      }] : []
    )
  };
}

function normalizePrimaryColor(value: unknown) {
  return typeof value === "string" && /^#[0-9A-Fa-f]{6}$/.test(value)
    ? value.toUpperCase()
    : "#FF5C20";
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
