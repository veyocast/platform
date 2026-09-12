import Link from "next/link";
import { hasCapability } from "@veyocast/auth";
import { defaultGoalOverlayConfiguration, goalOverlayConfigurationSchema } from "@veyocast/contracts";
import { Button } from "@veyocast/ui";
import { requireTenantControlSession } from "../../../../../../lib/control-session";
import { createControlSupabaseClient } from "../../../../../../lib/supabase/server";
import { getSupabasePublicConfig } from "../../../../../../lib/supabase/config";
import { loadTenantStyleData } from "../../../../../../lib/tenant-style-data";
import { PageHeader } from "../../../../_components/shell-primitives";
import { emptyData, loadStudioData } from "../studio-data";
import { GoalOverlayEditor } from "./editor";

export default async function GoalOverlayPage({ searchParams }: { searchParams: Promise<{ fout?: string; succes?: string }> }) {
  const session = await requireTenantControlSession("tenant.dynamic_slide.read");
  const [params, data, style, db] = await Promise.all([searchParams, session.isLive ? loadStudioData(session.tenantId!) : emptyData(), loadTenantStyleData(session.tenantId, session.isLive), createControlSupabaseClient()]);
  const alert = data.alerts.find((item) => item.is_central_goal_overlay);
  const [draft, published, players, logos] = db && session.isLive ? await Promise.all([
    db.from("ledscores_goal_overlay_draft_teams").select("connection_id,provider_club_id,provider_team_key").eq("tenant_id", session.tenantId!).eq("alert_id", alert?.id ?? "00000000-0000-4000-8000-000000000000"),
    db.from("ledscores_goal_overlay_version_teams").select("connection_id,provider_club_id,provider_team_key,team_name").eq("tenant_id", session.tenantId!).eq("alert_version_id", alert?.current_published_version_id ?? "00000000-0000-4000-8000-000000000000").eq("selected", true),
    db.from("ledscores_player_identities").select("id,connection_id,provider_team_key,display_name,shirt_number,manual_photo_media_asset_id").eq("tenant_id", session.tenantId!).eq("active", true).order("display_name").limit(1000),
    db.rpc("get_ledscores_team_logos_v2", { p_tenant_id: session.tenantId })
  ]) : [{ data: [], error: null }, { data: [], error: null }, { data: [], error: null }, { data: [], error: null }];
  const logoRows = (logos.data ?? []) as { connection_id: string; team_key: string; storage_path: string }[];
  const signedLogos = db && logoRows.length ? await db.storage.from("provider-assets").createSignedUrls([...new Set(logoRows.map((l) => l.storage_path))], 600) : { data: [] };
  const logoUrls = new Map((signedLogos.data ?? []).map((l) => [l.path, l.signedUrl]));
  const loaded = !draft.error && !published.error && !players.error;
  const raw = alert?.draft_config as { goalOverlay?: unknown } | undefined;
  const config = goalOverlayConfigurationSchema.safeParse(raw?.goalOverlay);
  const initial = { ...(config.success ? config.data : defaultGoalOverlayConfiguration), defaults: { primary: style.appearance.schemaVersion === 2 ? style.appearance.palette.primary : style.selection.accent ?? style.light.accent, darkSurface: style.dark.surface, modePolicy: style.selection.modePolicy, timezone: session.timezoneName } };
  const canWrite = session.isLive && session.tenantStatus === "active" && hasCapability(session.capabilities, "tenant.dynamic_slide.write") && loaded;
  const upload = getSupabasePublicConfig();
  return <>
    <PageHeader title="Goal Overlay" eyebrow="Studio · Live & interactief · LED Scores" description="Eén doelpuntenviering voor je club. Van introfilm tot tussenstand, op ieder geselecteerd scherm." actions={<Button asChild variant="ghost"><Link href="/dashboard/studio/led-scores">Terug naar LED Scores</Link></Button>} />
    {params.fout ? <p className="notice notice--critical" role="alert">{params.fout}</p> : null}
    {params.succes ? <p className="notice notice--success" role="status">{params.succes}</p> : null}
    {style.error || !loaded ? <p className="notice notice--warning" role="status">De instellingen konden niet volledig worden geladen. Vernieuw de pagina voordat je verdergaat.</p> : null}
    {!data.enabled ? <p className="notice notice--warning">LED Scores is nog niet beschikbaar voor deze tenant. Controleer de featurevrijgave in het databronbeheer.</p> : <GoalOverlayEditor
      key={`${alert?.id ?? "new"}-${alert?.revision ?? 0}`}
      initial={initial} alert={alert ? { id: alert.id, revision: alert.revision, status: alert.status } : null}
      canWrite={canWrite && !style.error} canPublish={canWrite && hasCapability(session.capabilities, "tenant.playlist.publish")}
      teams={data.mappings.filter((m) => m.scoring_side === "own").flatMap((m) => {
        const c = data.connections.find((c) => c.id === m.connection_id);
        return c?.provider_club_id ? [{ connectionId: c.id, clubId: c.provider_club_id, teamKey: m.provider_team_key, name: m.provider_team_name, clubName: c.provider_club_name ?? c.name, category: m.category, active: m.active, logoUrl: logoUrls.get(logoRows.find((l) => l.connection_id === c.id && l.team_key === m.provider_team_key)?.storage_path ?? "") ?? null }] : [];
      })}
      selectedTeams={(draft.data ?? []).map((t) => ({ connectionId: t.connection_id, clubId: t.provider_club_id, teamKey: t.provider_team_key }))}
      publishedTeams={(published.data ?? []).map((t) => ({ connectionId: t.connection_id, clubId: t.provider_club_id, teamKey: t.provider_team_key, name: t.team_name }))}
      groups={data.groups} selectedGroups={data.draftGroups.filter((g) => g.alert_id === alert?.id).map((g) => g.screen_group_id)}
      publishedGroupIds={data.publishedGroups.filter((g) => g.alert_version_id === alert?.current_published_version_id).map((g) => g.screen_group_id)}
      photos={data.assets.filter((a) => a.kind === "image" && a.librarySelectable)}
      assets={data.assets.filter((a) => a.kind === "video" && a.canvasCompatible && a.librarySelectable)}
      players={(players.data ?? []).map((p) => ({ id: p.id, connectionId: p.connection_id, teamKey: p.provider_team_key, name: p.display_name, photoMediaId: p.manual_photo_media_asset_id }))}
      uploadConfig={upload && hasCapability(session.capabilities, "tenant.media.write") ? { anonKey: upload.anonKey, supabaseUrl: upload.url, canUpload: canWrite } : null}
    />}
  </>;
}
