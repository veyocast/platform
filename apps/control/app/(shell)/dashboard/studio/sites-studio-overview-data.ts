import "server-only";
import {safeParseStudioDocument} from "@veyocast/studio";
import type {StudioProjectSummary} from "./types";
import { createControlSupabaseClient } from "../../../../lib/supabase/server";

/** Count stored, non-archived designs under the existing authenticated RLS session. */
export async function loadStudioDynamicDesignCount(
  tenantId: string | null,
  isLive: boolean,
  canReadDynamic: boolean
): Promise<number | null> {
  if (!canReadDynamic) return null;
  if (!isLive) return 0;
  if (!tenantId) return null;
  const client = await createControlSupabaseClient();
  if (!client) return null;
  const result = await client.from("dynamic_slides")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .neq("status", "archived");
  return result.error || result.count === null ? null : result.count;
}


export type StudioOverviewCard = StudioProjectSummary & { seriesId?: string; slideCount?: number };
type SeriesMetadata = { id: string; name: string; updated_at: string };
type SeriesMember = { series_id: string; project_id: string; sort_order: number };
const seriesOverviewError = "De Studio-reeksen konden niet volledig worden geladen. Vernieuw de pagina om alle slides veilig te bekijken.";
/** Group stored series under authenticated RLS; never infer relations from names. */
export async function loadStudioSeriesOverview(tenantId: string | null, isLive: boolean, projects: StudioProjectSummary[]): Promise<{ projects: StudioOverviewCard[]; error: string | null }> {
  if (!isLive || !projects.length) return { projects, error: null };
  if (!tenantId || projects.length > 100) return { projects: [], error: seriesOverviewError };
  const client = await createControlSupabaseClient();
  if (!client) return { projects: [], error: seriesOverviewError };
  const ids = projects.map(project => project.id);
  const related = await client.from("studio_series_items").select("series_id,project_id,sort_order").eq("tenant_id", tenantId).in("project_id", ids).limit(101);
  if (related.error || (related.data?.length ?? 0) > 100) return { projects: [], error: seriesOverviewError };
  const seriesIds = [...new Set((related.data ?? []).map(row => String(row.series_id)))];
  if (!seriesIds.length) return { projects, error: null };
  const [seriesResult, memberResult] = await Promise.all([
    client.from("studio_series").select("id,name,updated_at").eq("tenant_id", tenantId).in("id", seriesIds).eq("status", "active").limit(101),
    client.from("studio_series_items").select("series_id,project_id,sort_order").eq("tenant_id", tenantId).in("series_id", seriesIds).order("sort_order").limit(2001)
  ]);
  if (seriesResult.error || memberResult.error || (memberResult.data?.length ?? 0) > 2000) return { projects: [], error: seriesOverviewError };
  const series = (seriesResult.data ?? []) as SeriesMetadata[];
  const members = (memberResult.data ?? []) as SeriesMember[];
  const memberIds = [...new Set(members.filter(member => series.some(row => row.id === member.series_id)).map(member => member.project_id))];
  if (!memberIds.length) return { projects, error: null };
  const memberProjects = await client.from("studio_projects").select("*").eq("tenant_id", tenantId).in("id", memberIds).eq("status", "active").limit(2001);
  if (memberProjects.error || (memberProjects.data?.length ?? 0) > 2000) return { projects: [], error: seriesOverviewError };
  const firstIds = series.flatMap(row => {
    const first = members.filter(member => member.series_id === row.id).sort((a,b) => a.sort_order-b.sort_order)[0];
    return first && !projects.some(project => project.id === first.project_id) ? [first.project_id] : [];
  });
  const drafts = firstIds.length ? await client.from("studio_project_drafts").select("project_id,draft_revision,document_json").eq("tenant_id", tenantId).in("project_id", firstIds).limit(101) : { data: [], error: null };
  if (drafts.error) return { projects: [], error: seriesOverviewError };
  // A normal draft save changes the project revision in the same transaction.
  // Close the metadata/draft interval for first members outside the overview page.
  if (firstIds.length) {
    const current = await client.from("studio_projects").select("id,revision").eq("tenant_id", tenantId).in("id", firstIds).eq("status", "active").limit(101);
    if (current.error || firstIds.some(id => {
      const before = memberProjects.data?.find(project => project.id === id);
      const after = current.data?.find(project => project.id === id);
      return !before || !after || Number(before.revision) !== Number(after.revision);
    })) return { projects: [], error: seriesOverviewError };
  }
  const cards: StudioOverviewCard[] = [];
  const grouped = new Set<string>();
  for (const row of series) {
    const ordered = members.filter(member => member.series_id === row.id).sort((a,b) => a.sort_order-b.sort_order);
    if (!ordered.length || ordered.length > 20 || new Set(ordered.map(member => member.project_id)).size !== ordered.length) return { projects: [], error: seriesOverviewError };
    const stored = ordered.map(member => memberProjects.data?.find(project => project.id === member.project_id));
    if (stored.some(project => !project || !Number.isFinite(Number(project.duration_ms)) || Number(project.duration_ms) < 0)) return { projects: [], error: seriesOverviewError };
    // The original overview and this relation read are separate DB snapshots.
    // Refuse a mixed revision instead of combining stale content with a new duration.
    if (stored.some(metadata => {
      const visible = projects.find(project => project.id === metadata!.id);
      return visible && visible.projectRevision !== Number(metadata!.revision);
    })) return { projects: [], error: seriesOverviewError };
    const firstId = ordered[0]!.project_id;
    let first = projects.find(project => project.id === firstId);
    if (!first) {
      const metadata = stored[0]!;
      const draft = drafts.data?.find(value => value.project_id === firstId);
      const document = safeParseStudioDocument(draft?.document_json);
      if (!draft || !document.success || !["landscape","portrait"].includes(metadata.orientation)) return { projects: [], error: seriesOverviewError };
      first = { id: firstId, createdAt: metadata.created_at, updatedAt: metadata.updated_at, document: document.data, draftRevision: Number(draft.draft_revision), durationMs: Number(metadata.duration_ms), kind: metadata.project_kind, lastExportMediaId: null, lastRenderStatus: null, motionEnabled: Boolean(metadata.motion_enabled), name: metadata.name, orientation: metadata.orientation, ownerUserId: metadata.owner_user_id, projectRevision: Number(metadata.revision), status: metadata.status };
    }
    const ready = ordered.every(member => projects.find(project => project.id === member.project_id)?.lastRenderStatus === "completed");
    cards.push({ ...first, seriesId: row.id, slideCount: ordered.length, name: row.name, durationMs: stored.reduce((total,project) => total+Number(project!.duration_ms),0), updatedAt: [...stored.map(project => String(project!.updated_at)),row.updated_at].sort().at(-1)!, lastRenderStatus: ready ? "completed" : null });
    ordered.forEach(member => grouped.add(member.project_id));
  }
  // Preserve the existing ordered overview, placing a series at its first visible member.
  const result: StudioOverviewCard[] = [];
  const emitted = new Set<string>();
  for (const project of projects) {
    if (!grouped.has(project.id)) { result.push(project); continue; }
    const card = cards.find(candidate => members.some(member => member.series_id === candidate.seriesId && member.project_id === project.id));
    if (card && !emitted.has(card.seriesId!)) { result.push(card); emitted.add(card.seriesId!); }
  }
  return { projects: result, error: null };
}
