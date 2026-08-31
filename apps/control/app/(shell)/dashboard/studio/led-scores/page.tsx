import { randomUUID } from "node:crypto";

import Link from "next/link";
import {
  AlertTriangle,
  Layers3,
  MonitorPlay,
  Pause,
  Play,
  RadioTower,
  Send,
  Sparkles,
  TestTube2
} from "lucide-react";

import { hasCapability } from "@veyocast/auth";
import { Badge, Button, SummaryStrip } from "@veyocast/ui";

import { requireTenantControlSession } from "../../../../../lib/control-session";
import {
  deriveLedScoresFeatureAvailability,
  ledScoresFeatureAvailabilityMessages,
  parseLedScoresEffectiveState,
  type LedScoresFeatureAvailability
} from "../../../../../lib/ledscores-feature-state";
import { createControlSupabaseClient } from "../../../../../lib/supabase/server";
import { formatTenantDateTime } from "../../../../../lib/tenant-time";
import { PageHeader, StatusPill } from "../../../_components/shell-primitives";
import { LedScoresAlertEditor, type AlertEditorValue } from "./alert-editor";
import { LiveMatchSlideEditor } from "./live-match-slide-editor";
import {
  publishLedScoresGoalAlert,
  setLedScoresGoalAlertStatus,
  testLedScoresGoalAlert
} from "./actions";
import {
  activePublishedGroupIds,
  publishedGroupIds
} from "./published-targets";
import styles from "./led-scores-studio.module.css";

type Props = { searchParams: Promise<{ edit?: string; fout?: string; resultaat?: string; succes?: string }> };

export default async function LedScoresStudioPage({ searchParams }: Props) {
  const session = await requireTenantControlSession("tenant.dynamic_slide.read");
  const params = await searchParams;
  const data = session.isLive ? await loadStudioData(session.tenantId!) : emptyData();
  const canWrite = session.isLive
    && session.tenantStatus === "active"
    && hasCapability(session.capabilities, "tenant.dynamic_slide.write");
  const canPublish = canWrite && hasCapability(session.capabilities, "tenant.playlist.publish");
  const edited = data.alerts.find((alert) => alert.id === params.edit) ?? null;
  const initial = editorValue(edited, data.connections[0]?.id ?? "", data.draftGroups);
  const formatDate = (value: string) => formatTenantDateTime(value, session.timezoneName);
  const resultEventId = safeEventId(params.resultaat);
  const liveTargetGroups = activePublishedGroupIds(
    data.alerts.map((alert) => ({
      currentPublishedVersionId: alert.current_published_version_id,
      status: alert.status
    })),
    data.publishedGroups
  );

  return <>
    <PageHeader
      actions={<div className={styles.headerActions}><Button asChild variant="ghost"><Link href="/dashboard/studio">Terug naar Studio</Link></Button><Button asChild variant="secondary"><Link href="/dashboard/data-sources/led-scores">Databron beheren</Link></Button></div>}
      description="Breng live wedstrijdmomenten als tijdelijke overlays in beeld en maak een tussenstandslide die de laatst gevalideerde wedstrijdinformatie volgt."
      eyebrow="Studio · LED Scores"
      title="Live wedstrijdbeleving"
    />
    {params.fout ? <p className="notice notice--critical" role="alert"><strong>Wedstrijdbeleving-actie mislukt.</strong> {params.fout}</p> : null}
    {params.succes ? <p className="notice notice--success" role="status">{params.succes}{resultEventId ? <> <Link href={`/dashboard/data-sources/led-scores#event-${resultEventId}`}>Bekijk het afleverresultaat per scherm</Link>.</> : null}</p> : null}
    {!data.enabled ? <p className="notice notice--warning" role="status"><strong>{availabilityMessage(data.availability).title}</strong>{" "}{availabilityMessage(data.availability).detail}</p> : !data.connections.length ? <p className="notice notice--warning" role="status"><strong>Eerst een databron koppelen.</strong> Voeg een actieve LED Scores-verbinding toe voordat je een Goal Alert ontwerpt. <Link href="/dashboard/data-sources/led-scores">Open databronbeheer</Link>.</p> : <>
      <SummaryStrip items={[
        { label: "Overlay experiences", value: data.alerts.length },
        { label: "Gepubliceerd", value: data.alerts.filter((alert) => alert.status === "published").length, tone: "success" },
        { label: "Live tussenstandslides", value: data.liveSlides.length },
        { label: "Actieve live-doelschermen", value: screenUnion(data.targetGroups, liveTargetGroups).length }
      ]} />

      <section className={styles.systemOverview} aria-labelledby="live-match-system">
        <div className={styles.systemHeading}>
          <div><p className={styles.eyebrow}>Eén bron, twee afspeelvormen</p><h2 id="live-match-system">Zo werkt de wedstrijdbeleving</h2><p>Overlays onderbreken of bedekken kort. De live tussenstand is gewone playlistcontent en pakt telkens de laatst beschikbare informatie.</p></div>
          <StatusPill label="Server-side bronbinding" tone="info" />
        </div>
        <div className={styles.systemCards}>
          <article>
            <span className={styles.moduleIcon}><Sparkles aria-hidden="true" /></span>
            <div><Badge status="info">Tijdelijk boven playlist</Badge><h3>Wedstrijdmomenten</h3><p>Goal, opstelling, start, rust en einde verschijnen als ontworpen animaties. Goal onthult de speler zodra naam, rugnummer en foto beschikbaar zijn.</p></div>
            <ul><li>Momentgestuurd</li><li>Liggend en staand</li><li>Aflevering per scherm</li></ul>
            <Button asChild size="sm" variant="secondary"><Link href="#editor">Overlay experience maken</Link></Button>
          </article>
          <article>
            <span className={styles.moduleIcon}><MonitorPlay aria-hidden="true" /></span>
            <div><Badge status="success">Normale slide</Badge><h3>Live tussenstand</h3><p>Score, klok, status en wedstrijdverloop komen uit de nieuwste geldige state. Bij stale data bevriest de klok en blijft de laatste bevestigde score staan.</p></div>
            <ul><li>Playlistitem</li><li>Latest-bound</li><li>Veilige offlineposter</li></ul>
            <Button asChild size="sm" variant="secondary"><Link href="#live-score-slide">Tussenstandslide maken</Link></Button>
          </article>
        </div>
      </section>

      <section className="workspace-section" aria-labelledby="published-alerts">
        <div className="workspace-section__header"><div><h2 className="workspace-section__title" id="published-alerts">Overlay experiences</h2><p className="work-panel__meta">Iedere experience kan meerdere wedstrijdmomenten bevatten. Bij overlap wint per scherm eerst hoogste prioriteit en daarna nieuwste publicatie.</p></div><StatusPill label="Immutable versies" tone="info" /></div>
        {data.alerts.length ? <div className={styles.alertGrid}>{data.alerts.map((alert) => {
          const targets = publishedGroupIds(alert.current_published_version_id, data.publishedGroups);
          const screens = screenUnion(data.targetGroups, targets);
          const recentHeartbeatScreens = data.screens.filter((screen) => screens.includes(screen.id) && screen.status === "online").length;
          return <article className={styles.alertCard} key={alert.id}>
            <div className={styles.alertCardHeader}><div><span>Prioriteit {alert.priority}</span><h3>{alert.name}</h3></div><StatusPill {...alertStatus(alert.status)} /></div>
            <dl><div><dt>Live doelgroep</dt><dd>{targets.length} groep{targets.length === 1 ? "" : "en"} · {screens.length} actief {screens.length === 1 ? "doelscherm" : "doelschermen"}</dd></div><div><dt>Standaardduur</dt><dd>{alert.duration_ms / 1000} seconden</dd></div><div><dt>Playlist</dt><dd>{alert.underlay_policy === "pause" ? "Pauzeert en hervat" : "Speelt door"}</dd></div><div><dt>Bijgewerkt</dt><dd>{formatDate(alert.updated_at)}</dd></div></dl>
            <div className={styles.alertActions}><Button asChild size="sm" variant="secondary"><Link href={`/dashboard/studio/led-scores?edit=${alert.id}#editor`}>Bewerken</Link></Button>
              {canPublish && alert.status !== "archived" ? <form action={publishLedScoresGoalAlert}><input name="alertId" type="hidden" value={alert.id} /><input name="expectedRevision" type="hidden" value={alert.revision} /><Button size="sm" type="submit"><Send aria-hidden="true" />Nieuwe versie publiceren</Button></form> : null}
              {canWrite && alert.status === "published" ? <form action={setLedScoresGoalAlertStatus}><input name="alertId" type="hidden" value={alert.id} /><input name="expectedRevision" type="hidden" value={alert.revision} /><input name="status" type="hidden" value="paused" /><Button size="sm" type="submit" variant="secondary"><Pause aria-hidden="true" />Pauzeren</Button></form> : null}
              {canWrite && alert.status === "paused" ? <form action={setLedScoresGoalAlertStatus}><input name="alertId" type="hidden" value={alert.id} /><input name="expectedRevision" type="hidden" value={alert.revision} /><input name="status" type="hidden" value="published" /><Button size="sm" type="submit" variant="secondary"><Play aria-hidden="true" />Hervatten</Button></form> : null}
            </div>
            {canPublish && alert.status === "published" ? <form action={testLedScoresGoalAlert} className={styles.liveTestForm}><input name="alertId" type="hidden" value={alert.id} /><p><strong>Synthetische live-schermtest.</strong> De immutable versie heeft {screens.length} actief {screens.length === 1 ? "doelscherm" : "doelschermen"}; {recentHeartbeatScreens} met een recente heartbeat. Heartbeat bewijst Playercontact, niet dat de Goal Alert-stream verbonden is.</p><label><span>Variant</span><select defaultValue="own" name="scoringSide"><option value="own">Eigen goal</option><option value="opponent">Tegenstander</option></select></label><label><span>Thuis</span><input defaultValue="4" max="999" min="0" name="homeScore" type="number" /></label><label><span>Uit</span><input defaultValue="2" max="999" min="0" name="awayScore" type="number" /></label><label><span>Doelpuntenmaker (optioneel)</span><input maxLength={160} name="scorerName" placeholder="Testdoelpunt" /></label><Button size="sm" type="submit" variant="secondary"><TestTube2 aria-hidden="true" />Live-test klaarzetten</Button></form> : <p className={styles.muted}><AlertTriangle aria-hidden="true" />Publiceer en activeer eerst een versie voor een synthetische live-test.</p>}
          </article>;
        })}</div> : <div className="empty-state"><RadioTower aria-hidden="true" /><h3>Nog geen overlay experiences</h3><p>Maak hieronder de eerste set wedstrijdmomenten en publiceer daarna een immutable versie.</p></div>}
      </section>

      {canWrite ? <section className="workspace-section" id="live-score-slide" aria-labelledby="live-score-slide-title">
        <div className="workspace-section__header"><div><h2 className="workspace-section__title" id="live-score-slide-title">Live tussenstand als slide</h2><p className="work-panel__meta">Maak een echte dynamische slide voor een playlist. Het ontwerp blijft immutable; alleen de begrensde wedstrijdstate wordt bij weergave ververst.</p></div><Layers3 aria-hidden="true" /></div>
        <LiveMatchSlideEditor
          connections={data.connections.map((connection) => ({ id: connection.id, name: connection.name }))}
          idempotencyKey={randomUUID()}
          slides={data.liveSlides.map((slide) => ({
            id: slide.id,
            name: slide.name,
            orientation: slide.orientation,
            status: slide.status,
            updatedLabel: formatDate(slide.updated_at)
          }))}
        />
      </section> : null}

      {canWrite ? <section className="workspace-section" id="editor" aria-labelledby="alert-editor-title">
        <div className="workspace-section__header"><div><h2 className="workspace-section__title" id="alert-editor-title">{edited ? `Experience bewerken · ${edited.name}` : "Nieuwe overlay experience"}</h2><p className="work-panel__meta">De wizard koppelt meerdere live momenten aan één bron, vormtaal en doelschermset. Op mobiel blijft iedere taak één duidelijke stap.</p></div>{edited ? <Button asChild variant="ghost"><Link href="/dashboard/studio/led-scores#editor">Nieuwe experience</Link></Button> : null}</div>
        <LedScoresAlertEditor
          alerts={data.alerts.map((alert) => ({ groupIds: data.draftGroups.filter((target) => target.alert_id === alert.id).map((target) => target.screen_group_id), id: alert.id, name: alert.name, priority: alert.priority, status: alert.status }))}
          assets={data.assets}
          connections={data.connections.map((connection) => ({
            id: connection.id,
            mappings: data.mappings.filter((mapping) => mapping.connection_id === connection.id).map((mapping) => ({ side: mapping.scoring_side as "opponent" | "own", teamKey: mapping.provider_team_key, teamName: mapping.provider_team_name })),
            name: connection.name
          }))}
          groups={data.groups}
          initial={initial}
          screens={data.screens}
          sponsors={data.sponsors}
        />
      </section> : null}
    </>}
  </>;
}

async function loadStudioData(tenantId: string) {
  const supabase = await createControlSupabaseClient();
  if (!supabase) return emptyData();
  const featureStateResult = await supabase.rpc(
    "get_ledscores_feature_effective_state_v1",
    { p_tenant_id: tenantId }
  );
  const featureState = parseLedScoresEffectiveState(
    featureStateResult.data,
    tenantId
  );
  const availability = featureStateResult.error
    ? "unavailable" as const
    : deriveLedScoresFeatureAvailability(featureState);
  if (featureStateResult.error || availability === "unavailable") {
    console.error("LED Scores Studio-vrijgavestatus laden mislukt", {
      code: featureStateResult.error?.code ?? "invalid_response"
    });
  }
  if (availability !== "available") return { ...emptyData(), availability };
  const [connections, mappings, groups, memberships, screens, devices, assets, sponsors, alerts, draftGroups, publishedGroups, liveSlides] = await Promise.all([
    supabase.from("ledscores_connections").select("id,name").eq("tenant_id", tenantId).eq("status", "active").order("name"),
    supabase.from("ledscores_team_mappings").select("connection_id,provider_team_key,provider_team_name,scoring_side").eq("tenant_id", tenantId).order("created_at"),
    supabase.from("screen_groups").select("id,name,status").eq("tenant_id", tenantId).order("name"),
    supabase.from("screen_group_memberships").select("screen_group_id,screen_id").eq("tenant_id", tenantId),
    supabase.from("screens").select("id,name,status").eq("tenant_id", tenantId).is("deleted_at", null).order("name"),
    supabase.from("player_devices").select("screen_id,status,last_seen_at").eq("tenant_id", tenantId).eq("status", "paired"),
    supabase.from("media_assets").select("id,title,kind").eq("tenant_id", tenantId).eq("status", "ready").is("deleted_at", null).order("title").limit(250),
    supabase.from("sponsor_creatives").select("id,position_key,orientation").eq("tenant_id", tenantId).eq("status", "approved").order("created_at", { ascending: false }).limit(100),
    supabase.from("ledscores_goal_alerts").select("id,connection_id,name,status,priority,duration_ms,underlay_policy,draft_config,revision,current_published_version_id,updated_at").eq("tenant_id", tenantId).neq("status", "archived").order("updated_at", { ascending: false }),
    supabase.from("ledscores_goal_alert_draft_groups").select("alert_id,screen_group_id").eq("tenant_id", tenantId),
    supabase.from("ledscores_goal_alert_version_groups").select("alert_version_id,screen_group_id").eq("tenant_id", tenantId),
    supabase.from("dynamic_slides").select("id,name,orientation,status,updated_at").eq("tenant_id", tenantId).eq("slide_type", "ledscores_live_match").neq("status", "archived").order("updated_at", { ascending: false })
  ]);
  const error = [connections.error, mappings.error, groups.error, memberships.error, screens.error, devices.error, assets.error, sponsors.error, alerts.error, draftGroups.error, publishedGroups.error, liveSlides.error].find(Boolean);
  if (error) { console.error("LED Scores Studio laden mislukt", { code: error.code }); return { ...emptyData(), enabled: true }; }
  const activeScreenIds = new Set((screens.data ?? []).filter((screen) => screen.status === "active").map((screen) => screen.id));
  return {
    alerts: alerts.data ?? [], assets: (assets.data ?? []).map((asset) => ({ ...asset, kind: String(asset.kind) })),
    availability: "available" as const,
    connections: connections.data ?? [], draftGroups: draftGroups.data ?? [], enabled: true,
    groups: (groups.data ?? []).filter((group) => group.status === "active").map((group) => ({ id: group.id, name: group.name, screenIds: (memberships.data ?? []).filter((item) => item.screen_group_id === group.id && activeScreenIds.has(item.screen_id)).map((item) => item.screen_id) })),
    liveSlides: liveSlides.data ?? [],
    mappings: mappings.data ?? [],
    publishedGroups: publishedGroups.data ?? [],
    screens: (screens.data ?? []).filter((screen) => screen.status === "active").map((screen) => ({
      id: screen.id,
      name: screen.name,
      status: screenRealtimeStatus((devices.data ?? []).filter((device) => device.screen_id === screen.id).map((device) => device.last_seen_at))
    })),
    sponsors: (sponsors.data ?? []).map((sponsor) => ({ id: sponsor.id, label: `${sponsor.position_key} · ${sponsor.orientation}` })),
    targetGroups: (groups.data ?? []).map((group) => ({ id: group.id, screenIds: (memberships.data ?? []).filter((item) => item.screen_group_id === group.id && activeScreenIds.has(item.screen_id)).map((item) => item.screen_id) }))
  };
}

function editorValue(alert: Awaited<ReturnType<typeof loadStudioData>>["alerts"][number] | null, connectionId: string, groups: Array<{ alert_id: string; screen_group_id: string }>): AlertEditorValue { return alert ? { config: isRecord(alert.draft_config) ? alert.draft_config : {}, connectionId: alert.connection_id, durationMs: alert.duration_ms, groupIds: groups.filter((item) => item.alert_id === alert.id).map((item) => item.screen_group_id), id: alert.id, name: alert.name, priority: alert.priority, revision: alert.revision, underlayPolicy: alert.underlay_policy } : { config: {}, connectionId, durationMs: 8000, groupIds: [], id: null, name: "Wedstrijdexperience", priority: 100, revision: 0, underlayPolicy: "continue" }; }
function emptyData() { return { alerts: [] as Array<{ id: string; connection_id: string; name: string; status: string; priority: number; duration_ms: number; underlay_policy: string; draft_config: unknown; revision: number; current_published_version_id: string | null; updated_at: string }>, assets: [] as Array<{ id: string; kind: string; title: string }>, availability: "not_released" as LedScoresFeatureAvailability, connections: [] as Array<{ id: string; name: string }>, draftGroups: [] as Array<{ alert_id: string; screen_group_id: string }>, enabled: false, groups: [] as Array<{ id: string; name: string; screenIds: string[] }>, liveSlides: [] as Array<{ id: string; name: string; orientation: string; status: string; updated_at: string }>, mappings: [] as Array<{ connection_id: string; provider_team_key: string; provider_team_name: string; scoring_side: string }>, publishedGroups: [] as Array<{ alert_version_id: string; screen_group_id: string }>, screens: [] as Array<{ id: string; name: string; status: "offline" | "online" | "stale" }>, sponsors: [] as Array<{ id: string; label: string }>, targetGroups: [] as Array<{ id: string; screenIds: string[] }> }; }
function availabilityMessage(value: LedScoresFeatureAvailability) { return ledScoresFeatureAvailabilityMessages[value === "available" ? "unavailable" : value]; }
function screenUnion(groups: Array<{ id: string; screenIds: string[] }>, selected: string[]) { return [...new Set(groups.filter((group) => selected.includes(group.id)).flatMap((group) => group.screenIds))]; }
function alertStatus(status: string) { if (status === "published") return { label: "Actief gepubliceerd", tone: "success" as const }; if (status === "paused") return { label: "Gepauzeerd", tone: "warning" as const }; return { label: "Concept", tone: "neutral" as const }; }
function isRecord(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
function safeEventId(value: string | undefined) { return value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value) ? value : null; }
function screenRealtimeStatus(values: Array<string | null>): "offline" | "online" | "stale" {
  const latest = Math.max(...values.map((value) => value ? Date.parse(value) : 0), 0);
  if (latest >= Date.now() - 2 * 60_000) return "online";
  if (latest >= Date.now() - 15 * 60_000) return "stale";
  return "offline";
}
