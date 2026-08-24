import { themeSelectionSchema } from "@veyocast/contracts";
import { platformDefaultThemeSelection } from "@veyocast/content-templates/theme-catalog";

import { requireTenantControlSession } from "../../../../../../lib/control-session";
import { createControlSupabaseClient } from "../../../../../../lib/supabase/server";
import { createSportlinkSlideBatch } from "./actions";
import { SportlinkBulkWizard } from "./sportlink-bulk-wizard";

type PageProps = { searchParams: Promise<{ fout?: string }> };

export default async function SportlinkNewPage({ searchParams }: PageProps) {
  const session = await requireTenantControlSession("tenant.dynamic_slide.write");
  const params = await searchParams;
  const data = session.isLive && session.tenantId
    ? await loadSportlinkWizardData(session.tenantId)
    : { defaultThemeSelection: platformDefaultThemeSelection, media: [], sources: [], teams: [], templates: [] };
  return (
    <>
      {params.fout ? <p className="notice notice--critical" role="alert"><strong>Slides niet gemaakt.</strong> {params.fout}</p> : null}
      <SportlinkBulkWizard action={createSportlinkSlideBatch} {...data} />
    </>
  );
}

async function loadSportlinkWizardData(tenantId: string) {
  const supabase = await createControlSupabaseClient();
  if (!supabase) return { defaultThemeSelection: platformDefaultThemeSelection, media: [], sources: [], teams: [], templates: [] };
  const [sourcesResult, connectionsResult, templatesResult, settingsResult, mediaResult] = await Promise.all([
    supabase.from("dynamic_data_sources").select("id,name").eq("tenant_id", tenantId).eq("kind", "sportlink").eq("status", "active").order("name"),
    supabase.from("sportlink_connections").select("id,data_source_id").eq("tenant_id", tenantId).eq("status", "active"),
    supabase.from("dynamic_templates").select("slide_type,orientation,current_published_version_id").eq("status", "published").like("slug", "editorial-arena-%"),
    supabase.from("tenant_settings").select("default_theme_id,default_theme_version,theme_mode_policy,theme_accent,theme_support").eq("tenant_id", tenantId).maybeSingle(),
    supabase.from("media_assets").select("id,title").eq("tenant_id", tenantId).eq("status", "ready").eq("source_kind", "user").eq("kind", "image").is("deleted_at", null).order("title").limit(100)
  ]);
  const connections = connectionsResult.data ?? [];
  const teamResult = connections.length
    ? await supabase.from("sports_teams").select("external_id,name,metadata,source_connection_id").eq("tenant_id", tenantId).eq("active", true).in("source_connection_id", connections.map((item) => item.id)).order("name")
    : { data: [] };
  return {
    defaultThemeSelection: tenantThemeSelection(settingsResult.data),
    media: (mediaResult.data ?? []).map((asset) => ({ id: asset.id, name: asset.title })),
    sources: sourcesResult.data ?? [],
    teams: (teamResult.data ?? []).map((team) => ({
      dataSourceId: connections.find((connection) => connection.id === team.source_connection_id)?.data_source_id ?? "",
      externalId: team.external_id,
      name: team.name,
      contexts: competitionContexts(team.metadata)
    })),
    templates: (templatesResult.data ?? []).flatMap((template) => template.current_published_version_id ? [{ orientation: template.orientation, slideType: template.slide_type, versionId: template.current_published_version_id }] : [])
  };
}

function tenantThemeSelection(settings: Record<string, unknown> | null) {
  const parsed = themeSelectionSchema.safeParse({
    accent: text(settings?.theme_accent),
    categoryOverrides: [],
    modePolicy: settings?.theme_mode_policy,
    ref: {
      catalog: "v2",
      id: settings?.default_theme_id,
      version: settings?.default_theme_version
    },
    support: text(settings?.theme_support)
  });
  return parsed.success ? parsed.data : platformDefaultThemeSelection;
}

function competitionContexts(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const options = (value as Record<string, unknown>).competitionOptions;
  if (!Array.isArray(options)) return [];
  return options.flatMap((option) => {
    if (!option || typeof option !== "object" || Array.isArray(option)) return [];
    const record = option as Record<string, unknown>;
    const competitionId = text(record.externalId);
    if (!competitionId) return [];
    return [{
      competitionId,
      label: [text(record.name), text(record.poolName), text(record.season)].filter(Boolean).join(" · "),
      phaseId: text(record.period),
      poolId: text(record.poolExternalId),
      seasonId: text(record.season)
    }];
  });
}

function text(value: unknown) { return typeof value === "string" && value.trim() ? value.trim() : null; }
