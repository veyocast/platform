import Link from "next/link";
import { Activity, PlugZap, RadioTower, ShieldCheck } from "lucide-react";

import { hasCapability } from "@veyocast/auth";
import { Button, SummaryStrip } from "@veyocast/ui";

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
import {
  linkLedScoresClub,
  saveLedScoresConnection,
  saveLedScoresMappings,
  testLedScoresSource
} from "./actions";
import {
  isLedScoresProviderConnected,
  ledScoresConnectionHealth
} from "./connection-health";
import {
  deliveryDisplayState,
  deliveryLatencyMs,
  formatDeliveryLatency,
  heartbeatDisplayState,
  safeDeliveryDetail,
  type GoalDeliveryRow
} from "./delivery-visibility";
import styles from "./led-scores.module.css";

type Props = { searchParams: Promise<{ fout?: string; succes?: string }> };

type LedScoresDelivery = GoalDeliveryRow & {
  created_at: string;
  goal_event_id: string;
  id: string;
  screen_id: string;
};

type LedScoresScreen = {
  deleted_at: string | null;
  id: string;
  name: string;
  status: string;
};

type LedScoresDevice = {
  app_version: string | null;
  last_seen_at: string | null;
  platform: string | null;
  screen_id: string;
  status: string;
};

export default async function LedScoresPage({ searchParams }: Props) {
  const session = await requireTenantControlSession("tenant.data_source.read");
  const params = await searchParams;
  const data = session.isLive ? await loadLedScores(session.tenantId!) : emptyData();
  const canManage = session.isLive
    && session.tenantStatus === "active"
    && hasCapability(session.capabilities, "tenant.data_source.manage");
  const formatDate = (value: string | null) =>
    formatTenantDateTime(value, session.timezoneName);
  const screensById = new Map(data.screens.map((screen) => [screen.id, screen]));
  const devicesByScreen = latestDevicesByScreen(data.devices);
  const connectedProviderCount = data.connections.filter((connection) =>
    isLedScoresProviderConnected(
      connection.health_status,
      connection.lease_expires_at
    )
  ).length;

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
    {data.loadError ? <p className="notice notice--critical" role="alert"><strong>Afleverdetails konden niet volledig worden geladen.</strong> Goal Alerts en bestaande Playerweergave blijven ongewijzigd. Vernieuw deze pagina; blijft dit terugkomen, controleer dan de databronstatus.</p> : null}
    {data.deliveriesTruncated ? <p className="notice notice--warning" role="status"><strong>Niet alle afleverregels passen in dit overzicht.</strong> De nieuwste {data.deliveries.length} afleverregels van de getoonde events zijn geladen; totalen bij oudere events kunnen daardoor onvolledig zijn.</p> : null}
    {!data.enabled ? <section className="workspace-section">
      <div className="notice notice--warning" role="status">
        <strong>{availabilityMessage(data.availability).title}</strong>{" "}
        {availabilityMessage(data.availability).detail}
      </div>
    </section> : <>
      <SummaryStrip items={[
        { label: "Verbindingen", value: data.connections.length },
        { label: "Provider verbonden", value: connectedProviderCount, tone: connectedProviderCount > 0 ? "success" : "warning" },
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
                <StatusPill {...ledScoresConnectionHealth({
                  connectionStatus: connection.status,
                  healthStatus: connection.health_status,
                  lastConnectedAt: connection.last_connected_at,
                  lastSourceMessageAt: connection.last_source_message_at,
                  leaseExpiresAt: connection.lease_expires_at
                })} />
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
              <p className="notice"><strong>Clubidentiteit.</strong> {connection.provider_club_id ? `${connection.provider_club_name} · LED Scores club-ID ${connection.provider_club_id}` : "De connector haalt de club-ID en teamcatalogus op bij verbinden."} {connection.catalog_synced_at ? `Catalogus bijgewerkt: ${formatDate(connection.catalog_synced_at)}.` : ""}</p>
              {canManage ? <>
                <form action={linkLedScoresClub} className={styles.form}>
                  <input name="connectionId" type="hidden" value={connection.id} /><input name="expectedRevision" type="hidden" value={connection.revision} />
                  <label><span>VeyoCast-vereniging koppelen</span><select name="sportsClubId" defaultValue={connection.sports_club_id ?? ""}><option value="">Geen Sportlink-vereniging gekoppeld</option>{data.sportsClubs.map((club) => <option key={club.id} value={club.id}>{club.name}</option>)}</select></label>
                  <p>Deze expliciete koppeling verbindt de clubidentiteiten. Teams worden alleen automatisch aan Sportlink gekoppeld wanneer de bron exact dezelfde teamcode levert.</p>
                  <Button size="sm" type="submit" variant="secondary">Club koppelen</Button>
                </form>
                <form action={saveLedScoresConnection} className={styles.form}>
                  <input name="connectionId" type="hidden" value={connection.id} />
                  <input name="expectedRevision" type="hidden" value={connection.revision} />
                  <label><span>Interne naam</span><input defaultValue={connection.name} maxLength={120} name="name" required /></label>
                  <label><span>Clubslug</span><input readOnly={Boolean(connection.provider_club_id)} defaultValue={connection.club_slug} maxLength={80} name="clubSlug" pattern="[a-z0-9-]+" required /></label>
                  <label><span>Status</span><select defaultValue={connection.status} name="status"><option value="active">Actief</option><option value="paused">Gepauzeerd</option></select></label>
                  <Button size="sm" type="submit" variant="secondary">Verbinding opslaan</Button>
                </form>
                <form action={testLedScoresSource} className={styles.inlineForm}>
                  <input name="connectionId" type="hidden" value={connection.id} />
                  <input name="clubSlug" type="hidden" value={connection.club_slug} />
                  <Button size="sm" type="submit"><PlugZap aria-hidden="true" />Read-only testen</Button>
                </form>
                {!connection.provider_club_id ? <form action={saveLedScoresMappings} className={styles.mappingForm}>
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
                </form> : <p>{mappings.length} teams uit de broncatalogus. <Link href="/dashboard/studio/led-scores/goal-overlay">Teams selecteren in Goal Overlay</Link>.</p>}
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
        <div className="workspace-section__header"><div><h2 className="workspace-section__title" id="event-history">Beperkte eventhistorie</h2><p className="work-panel__meta">Per test of goal zie je welke Player hem ontving en werkelijk toonde. Een recente heartbeat bewijst alleen Playercontact, niet dat de Goal Alert-stream verbonden is.</p></div></div>
        {data.events.length ? <div className={styles.eventList}>{data.events.map((event, index) => {
          const eventDeliveries = data.deliveries.filter((item) => item.goal_event_id === event.id);
          const delivery = deliverySummary(eventDeliveries, event.source_observed_at);
          return <article id={`event-${event.id}`} key={event.id}>
            <div className={styles.eventHeading}>
              <div><strong>{event.event_kind === "synthetic_test" ? "Synthetische test" : "Goal-event"}</strong><span>{formatDate(event.detected_at)}</span></div>
              <StatusPill {...dispatchStatus(event.dispatch_status)} />
            </div>
            <p>{event.home_team} {event.home_score}–{event.away_score} {event.away_team} · {event.scoring_side === "own" ? "Eigen team" : event.scoring_side === "opponent" ? "Tegenstander" : "Onbekend team"}</p>
            <p>{delivery.total} uniek{delivery.total === 1 ? " scherm" : "e schermen"} · {delivery.received} ontvangen · {delivery.rendered} getoond · {delivery.skipped} overgeslagen · {delivery.failed} mislukt · {delivery.expired} verlopen zonder weergave{delivery.renderLatencyMs === null ? "" : ` · bron→render gemiddeld ${formatDeliveryLatency(delivery.renderLatencyMs)}`}</p>
            {eventDeliveries.length ? <details className={styles.deliveryDisclosure} open={index === 0 ? true : undefined}>
              <summary>Aflevering per scherm <span>{eventDeliveries.length}</span></summary>
              <DeliveryTable
                deliveries={eventDeliveries}
                devicesByScreen={devicesByScreen}
                formatDate={formatDate}
                screensById={screensById}
                sourceObservedAt={event.source_observed_at}
              />
            </details> : <p className={styles.noDeliveries}>Voor dit event zijn geen schermleveringen klaargezet.</p>}
          </article>;
        })}</div> : <p className="notice">Nog geen goal-events geregistreerd.</p>}
      </section>
    </>}
  </>;
}

async function loadLedScores(tenantId: string) {
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
    console.error("LED Scores-vrijgavestatus laden mislukt", {
      code: featureStateResult.error?.code ?? "invalid_response"
    });
  }
  if (availability !== "available") return { ...emptyData(), availability };
  const since = new Date(Date.now() - 86_400_000).toISOString();
  const [connections, mappings, sportsTeams, events, eventCount, screens, devices, sportsClubs] = await Promise.all([
    supabase.from("ledscores_connections").select("id,name,club_slug,provider_club_id,provider_club_name,sports_club_id,catalog_synced_at,status,health_status,health_detail,revision,baseline_json,last_source_message_at,last_connected_at,last_disconnected_at,lease_expires_at,last_test_at,last_test_status,last_test_detail,reconnect_count,invalid_message_count").eq("tenant_id", tenantId).order("created_at"),
    supabase.from("ledscores_team_mappings").select("id,connection_id,provider_team_key,provider_team_name,sports_team_id,scoring_side").eq("tenant_id", tenantId).order("created_at"),
    supabase.from("sports_teams").select("id,name").eq("tenant_id", tenantId).eq("active", true).order("name").limit(250),
    supabase.from("ledscores_goal_events").select("id,connection_id,event_kind,source_observed_at,detected_at,home_team,away_team,home_score,away_score,scoring_side,dispatch_status").eq("tenant_id", tenantId).order("detected_at", { ascending: false }).limit(25),
    supabase.from("ledscores_goal_events").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).gte("detected_at", since),
    supabase.from("screens").select("id,name,status,deleted_at").eq("tenant_id", tenantId).order("name").limit(500),
    supabase.from("player_devices").select("screen_id,status,platform,app_version,last_seen_at").eq("tenant_id", tenantId).order("last_seen_at", { ascending: false }).limit(500),
    supabase.from("sports_clubs").select("id,name").eq("tenant_id", tenantId).eq("active", true).order("name")
  ]);
  const coreError = [connections.error, mappings.error, sportsTeams.error, sportsClubs.error, events.error, eventCount.error].find(Boolean);
  if (coreError) {
    console.error("LED Scores-beheer laden mislukt", { code: coreError.code });
    return { ...emptyData(), enabled: true, loadError: true };
  }
  const diagnosticsError = [screens.error, devices.error].find(Boolean);
  if (diagnosticsError) {
    console.error("LED Scores-schermdiagnostiek laden mislukt", { code: diagnosticsError.code });
  }

  const eventIds = (events.data ?? []).map((event) => event.id);
  const deliveryLimit = 2_500;
  const deliveries = eventIds.length
    ? await supabase
      .from("ledscores_player_deliveries")
      .select("id,goal_event_id,screen_id,status,execute_at,expires_at,dispatched_at,received_at,rendered_at,skipped_at,failed_at,outcome_detail,created_at", { count: "exact" })
      .eq("tenant_id", tenantId)
      .eq("message_kind", "goal")
      .in("goal_event_id", eventIds)
      .order("created_at", { ascending: false })
      .limit(deliveryLimit)
    : { count: 0, data: [] as LedScoresDelivery[], error: null };
  if (deliveries.error) {
    console.error("LED Scores-afleverdetails laden mislukt", { code: deliveries.error.code });
  }
  const deliveryRows = deliveries.error
    ? []
    : (deliveries.data ?? []) as LedScoresDelivery[];
  return {
    availability: "available" as const,
    sportsClubs: sportsClubs.data ?? [], connections: connections.data ?? [], deliveries: deliveryRows,
    deliveriesTruncated: (deliveries.count ?? 0) > deliveryRows.length,
    devices: (devices.error ? [] : devices.data ?? []) as LedScoresDevice[],
    enabled: true, eventCount: eventCount.count ?? 0, events: events.data ?? [],
    loadError: Boolean(diagnosticsError || deliveries.error),
    mappings: mappings.data ?? [],
    screens: (screens.error ? [] : screens.data ?? []) as LedScoresScreen[],
    sportsTeams: sportsTeams.data ?? []
  };
}

function emptyData() { return { availability: "not_released" as LedScoresFeatureAvailability, connections: [], deliveries: [] as LedScoresDelivery[], deliveriesTruncated: false, devices: [] as LedScoresDevice[], enabled: false, eventCount: 0, events: [], loadError: false, mappings: [], screens: [] as LedScoresScreen[], sportsTeams: [], sportsClubs: [] as { id: string; name: string }[] }; }
function availabilityMessage(value: LedScoresFeatureAvailability) {
  return ledScoresFeatureAvailabilityMessages[
    value === "available" ? "unavailable" : value
  ];
}
function readBaseline(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const item = value as Record<string, unknown>;
  if (typeof item.homeTeamId !== "string" || typeof item.awayTeamId !== "string" || typeof item.homeScore !== "number" || typeof item.awayScore !== "number") return null;
  return { awayScore: item.awayScore, awayTeamId: item.awayTeamId, homeScore: item.homeScore, homeTeamId: item.homeTeamId };
}
function dispatchStatus(value: string) {
  if (value === "dispatched") return { label: "Klaargezet", tone: "info" as const };
  if (value === "suppressed_unknown_side") return { label: "Veilig onderdrukt", tone: "warning" as const };
  return { label: "Geen doelgroepen", tone: "neutral" as const };
}

function DeliveryTable({
  deliveries,
  devicesByScreen,
  formatDate,
  screensById,
  sourceObservedAt
}: {
  deliveries: LedScoresDelivery[];
  devicesByScreen: Map<string, LedScoresDevice>;
  formatDate: (value: string | null) => string;
  screensById: Map<string, LedScoresScreen>;
  sourceObservedAt: string;
}) {
  return <div className={styles.deliveryTableWrapper}>
    <table className={styles.deliveryTable}>
      <caption className="vc-visually-hidden">Afleverresultaat per doelscherm</caption>
      <thead><tr><th scope="col">Scherm</th><th scope="col">Player en heartbeat</th><th scope="col">Afleverstatus</th><th scope="col">Tijd en latency</th><th scope="col">Detail</th></tr></thead>
      <tbody>{deliveries.map((delivery) => {
        const screen = screensById.get(delivery.screen_id);
        const device = devicesByScreen.get(delivery.screen_id);
        const heartbeat = heartbeatDisplayState(device?.last_seen_at ?? null);
        const outcome = deliveryDisplayState(delivery);
        const latency = formatDeliveryLatency(deliveryLatencyMs(delivery, sourceObservedAt));
        const detail = safeDeliveryDetail(delivery.outcome_detail);
        return <tr key={delivery.id}>
          <td data-label="Scherm"><strong>{screen?.name ?? "Onbekend scherm"}</strong>{screen && (screen.status !== "active" || screen.deleted_at) ? <small>{screen.deleted_at ? "Scherm verwijderd" : `Scherm ${screen.status}`}</small> : null}</td>
          <td data-label="Player en heartbeat"><span>{device ? playerLabel(device) : "Geen gekoppelde Player"}</span><StatusPill label={heartbeat.label} tone={heartbeat.tone} />{device?.last_seen_at ? <small>Laatst gezien {formatDate(device.last_seen_at)}</small> : null}</td>
          <td data-label="Afleverstatus"><StatusPill label={outcome.label} tone={outcome.tone} /></td>
          <td data-label="Tijd en latency"><span>{formatDate(outcome.occurredAt)}</span>{latency ? <small>Bron → {outcome.label.toLowerCase()}: {latency}</small> : outcome.key === "pending" ? <small>Uitvoering gepland {formatDate(delivery.execute_at)}</small> : null}</td>
          <td data-label="Detail">{detail ?? "—"}</td>
        </tr>;
      })}</tbody>
    </table>
  </div>;
}

function latestDevicesByScreen(devices: LedScoresDevice[]) {
  const result = new Map<string, LedScoresDevice>();
  for (const device of devices) {
    const current = result.get(device.screen_id);
    if (!current || timestamp(device.last_seen_at) > timestamp(current.last_seen_at)) {
      result.set(device.screen_id, device);
    }
  }
  return result;
}

function timestamp(value: string | null) {
  const parsed = value ? Date.parse(value) : 0;
  return Number.isFinite(parsed) ? parsed : 0;
}

function playerLabel(device: LedScoresDevice) {
  const platform = device.platform
    ? device.platform.toLowerCase().includes("android")
      ? "Android"
      : device.platform.toLowerCase().includes("webos")
        ? "LG webOS"
        : device.platform.toLowerCase().includes("browser")
          ? "Browser"
          : device.platform
    : "Platform onbekend";
  const lifecycle = device.status === "paired" ? "" : ` · ${device.status}`;
  return `${platform}${device.app_version ? ` · ${device.app_version}` : ""}${lifecycle}`;
}

function deliverySummary(
  deliveries: LedScoresDelivery[],
  sourceObservedAt: string
) {
  const sourceTime = Date.parse(sourceObservedAt);
  const states = deliveries.map((delivery) => deliveryDisplayState(delivery));
  const latencies = deliveries.flatMap((delivery) => delivery.rendered_at
    ? [Math.max(0, Date.parse(delivery.rendered_at) - sourceTime)]
    : []);
  return {
    expired: states.filter((state) => state.key === "expired").length,
    failed: states.filter((state) => state.key === "failed").length,
    received: deliveries.filter((delivery) => delivery.received_at).length,
    rendered: states.filter((state) => state.key === "rendered").length,
    renderLatencyMs: latencies.length
      ? Math.round(latencies.reduce((total, value) => total + value, 0) / latencies.length)
      : null,
    skipped: states.filter((state) => state.key === "skipped").length,
    total: deliveries.length
  };
}
