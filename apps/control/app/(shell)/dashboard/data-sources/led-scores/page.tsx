import Link from "next/link";
import { Activity, PlugZap, RadioTower, ShieldCheck } from "lucide-react";

import { hasCapability } from "@veyocast/auth";
import { Button, SummaryStrip } from "@veyocast/ui";

import { requireTenantControlSession } from "../../../../../lib/control-session";
import { createControlSupabaseClient } from "../../../../../lib/supabase/server";
import { formatTenantDateTime } from "../../../../../lib/tenant-time";
import { PageHeader, StatusPill } from "../../../_components/shell-primitives";
import {
  saveLedScoresConnection,
  saveLedScoresMappings,
  testLedScoresSource
} from "./actions";
import styles from "./led-scores.module.css";

type Props = { searchParams: Promise<{ fout?: string; succes?: string }> };

export default async function LedScoresPage({ searchParams }: Props) {
  const session = await requireTenantControlSession("tenant.data_source.read");
  const params = await searchParams;
  const data = session.isLive ? await loadLedScores(session.tenantId!) : emptyData();
  const canManage = session.isLive
    && session.tenantStatus === "active"
    && hasCapability(session.capabilities, "tenant.data_source.manage");
  const formatDate = (value: string | null) =>
    formatTenantDateTime(value, session.timezoneName);

  return <>
    <PageHeader
      actions={<div className={styles.actions}>
        <Button asChild variant="ghost"><Link href="/dashboard/data-sources">Alle databronnen</Link></Button>
        {data.enabled ? <Button asChild variant="secondary"><Link href="/dashboard/studio/led-scores">Goal Alerts ontwerpen</Link></Button> : null}
      </div>}
      description="Read-only scorestatus wordt server-side gevalideerd. Players en browsers verbinden nooit rechtstreeks met LED Scores."
      eyebrow="Databronnen · Experimentele pilot"
      title="LED Scores realtime"
    />
    {params.fout ? <p className="notice notice--critical" role="alert"><strong>LED Scores-actie mislukt.</strong> {params.fout}</p> : null}
    {params.succes ? <p className="notice notice--success" role="status">{params.succes}</p> : null}
    {!data.enabled ? <section className="workspace-section">
      <div className="notice notice--warning" role="status">
        <strong>Niet vrijgegeven voor deze tenant.</strong> Een platformbeheerder moet de experimentele featureflag eerst met reden en AAL2 inschakelen. Bestaande playback blijft ongewijzigd.
      </div>
    </section> : <>
      <SummaryStrip items={[
        { label: "Verbindingen", value: data.connections.length },
        { label: "Realtime verbonden", value: data.connections.filter((item) => item.health_status === "connected").length, tone: data.connections.some((item) => item.health_status === "connected") ? "success" : "warning" },
        { label: "Goal-events (24 uur)", value: data.eventCount }
      ]} />

      <section className="workspace-section" aria-labelledby="ledscores-connections">
        <div className="workspace-section__header"><div>
          <h2 className="workspace-section__title" id="ledscores-connections">Verbindingen</h2>
          <p className="work-panel__meta">Meerdere club- of veldverbindingen kunnen tegelijk door één lease-gecontroleerde workerpool worden gevolgd.</p>
        </div><StatusPill label="Read-only provider" tone="info" /></div>
        {data.connections.length ? <div className={styles.grid}>
          {data.connections.map((connection) => {
            const baseline = readBaseline(connection.baseline_json);
            const mappings = data.mappings.filter((item) => item.connection_id === connection.id);
            const lastGoal = data.events.find((event) => event.connection_id === connection.id);
            return <article className={styles.card} key={connection.id}>
              <div className={styles.cardHeader}>
                <div><p className={styles.eyebrow}>{connection.club_slug}</p><h3>{connection.name}</h3></div>
                <StatusPill {...healthStatus(connection.status, connection.health_status, connection.last_source_message_at)} />
              </div>
              <dl className={styles.details}>
                <div><dt>Laatste geldig bericht</dt><dd>{formatDate(connection.last_source_message_at)}</dd></div>
                <div><dt>Laatste reconnect/statuswissel</dt><dd>{formatDate(connection.last_connected_at ?? connection.last_disconnected_at)}</dd></div>
                <div><dt>Laatste goal</dt><dd>{lastGoal ? `${formatDate(lastGoal.detected_at)} · ${lastGoal.home_score}–${lastGoal.away_score}` : "Nog niet gedetecteerd"}</dd></div>
                <div><dt>Laatste test</dt><dd>{formatDate(connection.last_test_at)} · {connection.last_test_status === "success" ? "Geslaagd" : connection.last_test_status === "failed" ? "Mislukt" : "Niet getest"}</dd></div>
                <div><dt>Reconnects</dt><dd>{connection.reconnect_count}</dd></div>
                <div><dt>Ongeldige berichten</dt><dd>{connection.invalid_message_count}</dd></div>
              </dl>
              {baseline ? <p className="notice" role="status"><strong>Laatste score.</strong> Team {baseline.homeTeamId} {baseline.homeScore}–{baseline.awayScore} Team {baseline.awayTeamId}. Dit is alleen status; hij wordt nooit als nieuw goal-event afgespeeld.</p> : <p className="notice notice--warning"><strong>Wacht op baseline.</strong> De eerste ontvangen score wordt veilig onderdrukt.</p>}
              {connection.health_detail ? <p className={styles.meta}>{connection.health_detail}</p> : null}
              {canManage ? <>
                <form action={saveLedScoresConnection} className={styles.form}>
                  <input name="connectionId" type="hidden" value={connection.id} />
                  <input name="expectedRevision" type="hidden" value={connection.revision} />
                  <label><span>Interne naam</span><input defaultValue={connection.name} maxLength={120} name="name" required /></label>
                  <label><span>Clubslug</span><input defaultValue={connection.club_slug} maxLength={80} name="clubSlug" pattern="[a-z0-9-]+" required /></label>
                  <label><span>Status</span><select defaultValue={connection.status} name="status"><option value="active">Actief</option><option value="paused">Gepauzeerd</option></select></label>
                  <Button size="sm" type="submit" variant="secondary">Verbinding opslaan</Button>
                </form>
                <form action={testLedScoresSource} className={styles.inlineForm}>
                  <input name="connectionId" type="hidden" value={connection.id} />
                  <input name="clubSlug" type="hidden" value={connection.club_slug} />
                  <Button size="sm" type="submit"><PlugZap aria-hidden="true" />Read-only testen</Button>
                </form>
                <form action={saveLedScoresMappings} className={styles.mappingForm}>
                  <input name="connectionId" type="hidden" value={connection.id} />
                  <h4>Team-ID’s classificeren</h4>
                  <p>Home/away is niet hetzelfde als eigen/tegenstander. Een onbekend scorend team wordt veilig onderdrukt.</p>
                  {[0, 1, 2, 3].map((index) => {
                    const mapping = mappings[index];
                    return <div className={styles.mappingRow} key={index}>
                      <label><span>LED team-ID</span><input defaultValue={mapping?.provider_team_key ?? (index === 0 ? baseline?.homeTeamId ?? "" : index === 1 ? baseline?.awayTeamId ?? "" : "")} maxLength={200} name="teamKey" /></label>
                      <label><span>Weergavenaam</span><input defaultValue={mapping?.provider_team_name ?? ""} maxLength={160} name="teamName" /></label>
                      <label><span>Sportlinkteam (optioneel)</span><select defaultValue={mapping?.sports_team_id ?? ""} name="sportsTeamId"><option value="">Handmatige fallbacknaam</option>{data.sportsTeams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select></label>
                      <label><span>Classificatie</span><select defaultValue={mapping?.scoring_side ?? "opponent"} name="side"><option value="own">Eigen team</option><option value="opponent">Tegenstander</option></select></label>
                    </div>;
                  })}
                  <Button size="sm" type="submit" variant="secondary">Teammapping opslaan</Button>
                </form>
              </> : null}
            </article>;
          })}
        </div> : <div className="empty-state"><RadioTower aria-hidden="true" /><h3>Nog geen LED Scores-verbinding</h3><p>Voeg hieronder de eerste strikt gevalideerde clubslug toe.</p></div>}
      </section>

      {canManage ? <section className="workspace-section" aria-labelledby="new-ledscores-connection">
        <div className="workspace-section__header"><div><h2 className="workspace-section__title" id="new-ledscores-connection">Verbinding toevoegen</h2><p className="work-panel__meta">De host staat vast op wss.ledscores.score.tel; alleen de clubslug is configureerbaar.</p></div><ShieldCheck aria-hidden="true" /></div>
        <form action={saveLedScoresConnection} className={styles.createForm}>
          <input name="expectedRevision" type="hidden" value="0" />
          <input name="status" type="hidden" value="active" />
          <label><span>Interne naam</span><input maxLength={120} name="name" placeholder="LED-scorebord hoofdveld" required /></label>
          <label><span>Clubslug</span><input maxLength={80} name="clubSlug" pattern="[a-z0-9-]+" placeholder="duindorp-sv" required /></label>
          <div><Button type="submit"><Activity aria-hidden="true" />Verbinding toevoegen</Button></div>
        </form>
      </section> : null}

      <section className="workspace-section" aria-labelledby="event-history">
        <div className="workspace-section__header"><div><h2 className="workspace-section__title" id="event-history">Beperkte eventhistorie</h2><p className="work-panel__meta">Geen onbeperkte providerpayloads; alleen status, dedupe-uitkomst en delivery-aantallen.</p></div></div>
        {data.events.length ? <div className={styles.eventList}>{data.events.map((event) => { const delivery = deliverySummary(data.deliveries.filter((item) => item.goal_event_id === event.id), event.source_observed_at); return <article key={event.id}><div><strong>{event.event_kind === "synthetic_test" ? "Synthetische test" : "Goal-event"}</strong><span>{formatDate(event.detected_at)}</span></div><p>{event.home_team} {event.home_score}–{event.away_score} {event.away_team} · {event.scoring_side === "own" ? "Eigen team" : event.scoring_side === "opponent" ? "Tegenstander" : "Onbekend team"}</p><p>{delivery.total} uniek{delivery.total === 1 ? " scherm" : "e schermen"} · {delivery.received} ontvangen · {delivery.rendered} getoond · {delivery.skipped} overgeslagen · {delivery.failed} mislukt{delivery.renderLatencyMs === null ? "" : ` · bron→render gemiddeld ${delivery.renderLatencyMs} ms`}</p><StatusPill {...dispatchStatus(event.dispatch_status)} /></article>; })}</div> : <p className="notice">Nog geen goal-events geregistreerd.</p>}
      </section>
    </>}
  </>;
}

async function loadLedScores(tenantId: string) {
  const supabase = await createControlSupabaseClient();
  if (!supabase) return emptyData();
  const flag = await supabase.from("tenant_feature_flags").select("enabled")
    .eq("tenant_id", tenantId).eq("flag_key", "ledscores_realtime").maybeSingle();
  if (flag.data?.enabled !== true) return emptyData();
  const since = new Date(Date.now() - 86_400_000).toISOString();
  const [connections, mappings, sportsTeams, events, eventCount, deliveries] = await Promise.all([
    supabase.from("ledscores_connections").select("id,name,club_slug,status,health_status,health_detail,revision,baseline_json,last_source_message_at,last_connected_at,last_disconnected_at,last_test_at,last_test_status,last_test_detail,reconnect_count,invalid_message_count").eq("tenant_id", tenantId).order("created_at"),
    supabase.from("ledscores_team_mappings").select("id,connection_id,provider_team_key,provider_team_name,sports_team_id,scoring_side").eq("tenant_id", tenantId).order("created_at"),
    supabase.from("sports_teams").select("id,name").eq("tenant_id", tenantId).eq("active", true).order("name").limit(250),
    supabase.from("ledscores_goal_events").select("id,connection_id,event_kind,source_observed_at,detected_at,home_team,away_team,home_score,away_score,scoring_side,dispatch_status").eq("tenant_id", tenantId).order("detected_at", { ascending: false }).limit(25),
    supabase.from("ledscores_goal_events").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).gte("detected_at", since),
    supabase.from("ledscores_player_deliveries").select("goal_event_id,status,received_at,rendered_at,skipped_at,failed_at").eq("tenant_id", tenantId).eq("message_kind", "goal").gte("created_at", since).order("created_at", { ascending: false }).limit(1000)
  ]);
  const error = [connections.error, mappings.error, sportsTeams.error, events.error, eventCount.error, deliveries.error].find(Boolean);
  if (error) {
    console.error("LED Scores-beheer laden mislukt", { code: error.code });
    return { ...emptyData(), enabled: true };
  }
  return {
    connections: connections.data ?? [], enabled: true,
    deliveries: deliveries.data ?? [], eventCount: eventCount.count ?? 0, events: events.data ?? [],
    mappings: mappings.data ?? [], sportsTeams: sportsTeams.data ?? []
  };
}

function emptyData() { return { connections: [], deliveries: [], enabled: false, eventCount: 0, events: [], mappings: [], sportsTeams: [] }; }
function readBaseline(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const item = value as Record<string, unknown>;
  if (typeof item.homeTeamId !== "string" || typeof item.awayTeamId !== "string" || typeof item.homeScore !== "number" || typeof item.awayScore !== "number") return null;
  return { awayScore: item.awayScore, awayTeamId: item.awayTeamId, homeScore: item.homeScore, homeTeamId: item.homeTeamId };
}
function healthStatus(status: string, value: string, lastSourceMessageAt: string | null) {
  if (status === "paused") return { label: "Uitgeschakeld", tone: "neutral" as const };
  if (value === "connected" && (!lastSourceMessageAt || Date.parse(lastSourceMessageAt) < Date.now() - 60_000)) return { label: "Verouderd", tone: "warning" as const };
  if (value === "connected") return { label: "Verbonden", tone: "success" as const };
  if (value === "pending") return { label: "Verbinden", tone: "info" as const };
  if (value === "reconnecting" || value === "disconnected") return { label: "Opnieuw verbinden", tone: "warning" as const };
  if (value === "error") return { label: "Verbindingsfout", tone: "critical" as const };
  return { label: "Niet verbonden", tone: "neutral" as const };
}
function dispatchStatus(value: string) {
  if (value === "dispatched") return { label: "Verzonden", tone: "success" as const };
  if (value === "suppressed_unknown_side") return { label: "Veilig onderdrukt", tone: "warning" as const };
  return { label: "Geen doelgroepen", tone: "neutral" as const };
}
function deliverySummary(
  deliveries: Array<{ failed_at: string | null; received_at: string | null; rendered_at: string | null; skipped_at: string | null; status: string }>,
  sourceObservedAt: string
) {
  const sourceTime = Date.parse(sourceObservedAt);
  const latencies = deliveries.flatMap((delivery) => delivery.rendered_at
    ? [Math.max(0, Date.parse(delivery.rendered_at) - sourceTime)]
    : []);
  return {
    failed: deliveries.filter((delivery) => delivery.status === "failed").length,
    received: deliveries.filter((delivery) => delivery.received_at).length,
    rendered: deliveries.filter((delivery) => delivery.rendered_at).length,
    renderLatencyMs: latencies.length
      ? Math.round(latencies.reduce((total, value) => total + value, 0) / latencies.length)
      : null,
    skipped: deliveries.filter((delivery) => delivery.skipped_at).length,
    total: deliveries.length
  };
}
