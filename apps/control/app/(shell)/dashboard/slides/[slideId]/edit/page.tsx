import Link from "next/link";
import { notFound } from "next/navigation";

import { selectableThemeIdSchema, sportlinkSlideDraftSchema, themeSelectionSchema } from "@veyocast/contracts";
import { platformDefaultThemeSelection } from "@veyocast/content-templates/theme-catalog";
import { Button } from "@veyocast/ui";

import { requireTenantControlSession } from "../../../../../../lib/control-session";
import { createControlSupabaseClient } from "../../../../../../lib/supabase/server";
import { PageHeader } from "../../../../_components/shell-primitives";
import { SportlinkVersionEditor } from "./sportlink-version-editor";

type PageProps = { params: Promise<{ slideId: string }>; searchParams: Promise<{ succes?: string }> };

export default async function EditSportlinkSlidePage({ params, searchParams }: PageProps) {
  const session = await requireTenantControlSession("tenant.dynamic_slide.write");
  const [{ slideId }, query] = await Promise.all([params, searchParams]);
  const data = await loadEditorData(session.tenantId!, slideId);
  if (!data) notFound();
  return <><PageHeader actions={<Button asChild variant="ghost"><Link href={`/dashboard/slides/${slideId}`}>Annuleren</Link></Button>} description="Bewerk een gekloonde conceptversie. De huidige gepubliceerde versie blijft actief tot de nieuwe render volledig gereed is." eyebrow={session.tenant} status={{ label: `Concept v${data.versionNumber}`, tone: "warning" }} title={data.initialDraft.name} />{query.succes ? <p className="notice notice--success" role="status">{query.succes}</p> : null}<SportlinkVersionEditor {...data} slideId={slideId} /></>;
}

async function loadEditorData(tenantId: string, slideId: string) {
  const supabase = await createControlSupabaseClient();
  if (!supabase) return null;
  const [slideResult, teamsResult, templatesResult, settingsResult, mediaResult] = await Promise.all([
    supabase.from("dynamic_slides").select("active_draft_version_id,data_source_id").eq("tenant_id", tenantId).eq("id", slideId).neq("status", "archived").maybeSingle(),
    supabase.from("sports_teams").select("external_id,name,metadata,source_connection_id").eq("tenant_id", tenantId).eq("active", true).order("name"),
    supabase.from("dynamic_templates").select("slide_type,orientation,current_published_version_id").eq("status", "published").like("slug", "editorial-arena-%"),
    supabase.from("tenant_settings").select("default_theme_id").eq("tenant_id", tenantId).maybeSingle(),
    supabase.from("media_assets").select("id,title").eq("tenant_id", tenantId).eq("status", "ready").eq("source_kind", "user").eq("kind", "image").is("deleted_at", null).order("title").limit(100)
  ]);
  if (!slideResult.data?.active_draft_version_id) return null;
  const [versionResult, connectionsResult] = await Promise.all([
    supabase.from("dynamic_slide_versions").select("id,version_number,edit_revision,name,orientation,template_version_id,configuration_json,theme_selection_json").eq("tenant_id", tenantId).eq("id", slideResult.data.active_draft_version_id).eq("status", "draft").maybeSingle(),
    supabase.from("sportlink_connections").select("id,data_source_id").eq("tenant_id", tenantId).eq("data_source_id", slideResult.data.data_source_id)
  ]);
  const version = versionResult.data;
  if (!version) return null;
  const configuration = record(version.configuration_json);
  const selection = themeSelectionSchema.safeParse(version.theme_selection_json);
  const blueprintKey = configuration?.blueprintKey;
  const context = configuration?.context;
  const draft = sportlinkSlideDraftSchema.safeParse({
    arrival: configuration?.arrival,
    blueprintKey,
    context,
    display: configuration?.display,
    name: version.name,
    orientation: version.orientation,
    templateVersionId: version.template_version_id,
    themeSelection: selection.success ? selection.data : platformDefaultThemeSelection,
    title: configuration?.title
  });
  if (!draft.success) return null;
  const connectionIds = new Set((connectionsResult.data ?? []).map((connection) => connection.id));
  const teams = (teamsResult.data ?? []).filter((team) => connectionIds.has(team.source_connection_id)).map((team) => ({ contexts: competitionContexts(team.metadata), externalId: team.external_id, name: team.name }));
  const defaultTheme = selectableThemeIdSchema.safeParse(settingsResult.data?.default_theme_id);
  return {
    dataSourceId: slideResult.data.data_source_id,
    defaultThemeId: defaultTheme.success ? defaultTheme.data : "fieldflow" as const,
    initialDraft: draft.data,
    initialRevision: Number(version.edit_revision),
    media: (mediaResult.data ?? []).map((asset) => ({ id: asset.id, name: asset.title })),
    teams,
    templates: (templatesResult.data ?? []).flatMap((template) => template.current_published_version_id && (template.orientation === "landscape" || template.orientation === "portrait") ? [{ orientation: template.orientation, slideType: template.slide_type, versionId: template.current_published_version_id }] : []),
    versionId: version.id,
    versionNumber: version.version_number
  };
}

function competitionContexts(value: unknown) { const recordValue = record(value); const options = recordValue?.competitionOptions; if (!Array.isArray(options)) return []; return options.flatMap((value) => { const option = record(value); const competitionId = text(option?.externalId); if (!competitionId) return []; return [{ competitionId, label: [text(option?.name), text(option?.period), text(option?.poolName), text(option?.season)].filter(Boolean).join(" · "), phaseId: text(option?.period), poolId: text(option?.poolExternalId), seasonId: text(option?.season) }]; }); }
function record(value: unknown) { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null; }
function text(value: unknown) { return typeof value === "string" && value.trim() ? value.trim() : null; }
