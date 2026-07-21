import Link from "next/link";
import { notFound } from "next/navigation";

import { hasCapability } from "@veyocast/auth";

import { requireTenantControlSession } from "../../../../../lib/control-session";
import { PageHeader, StatusPill } from "../../../_components/shell-primitives";
import {
  renamePlayerDevice,
  requestScreenSyncRetry,
  revokePlayerDevice,
  updateScreen
} from "../actions";
import { loadScreenDetail, type FleetDevice, type FleetRelease } from "../data";
import { ScreenLifecycleActions } from "./screen-lifecycle-actions";

type ScreenDetailPageProps = {
  params: Promise<{ screenId: string }>;
  searchParams: Promise<{ fout?: string; succes?: string; tab?: string }>;
};

const tabs = [
  ["overview", "Overzicht"],
  ["content", "Content"],
  ["player", "Player"],
  ["sync", "Synchronisatie"],
  ["events", "Gebeurtenissen"]
] as const;

export default async function ScreenDetailPage({ params, searchParams }: ScreenDetailPageProps) {
  const session = await requireTenantControlSession("tenant.screen.read");
  const { screenId } = await params;
  const query = await searchParams;
  const activeTab = tabs.some(([value]) => value === query.tab) ? query.tab! : "overview";
  const data = session.isLive && session.tenantId
    ? await loadScreenDetail(session.tenantId, screenId)
    : null;
  if (session.isLive && !data?.screen && !data?.error) notFound();
  const screen = data?.screen ?? null;
  const pairedDevice = data?.devices.find((device) => device.status === "paired") ?? null;
  const latestHeartbeat = data?.heartbeats[0] ?? null;
  const canManage = Boolean(
    session.isLive &&
    session.tenantStatus === "active" &&
    hasCapability(session.roles, "tenant.screen.manage")
  );
  const status = screenStatus(screen?.status, pairedDevice, pairedDevice?.lastSeenAt ?? null);

  return <>
    <Link className="breadcrumb-link" href="/dashboard/screens">← Terug naar schermvloot</Link>
    <PageHeader
      actions={screen ? <div className="page-action-group">
        <Link className="button-link button-link--secondary" href={`/dashboard/screens/new?screen=${screen.id}`}>Onboarding openen</Link>
        <Link className="button-link button-link--primary" href={`/dashboard/screens/${screen.id}?tab=sync`}>Synchronisatie bekijken</Link>
      </div> : null}
      description={screen ? `${screen.location || "Geen locatie"} · ${orientationLabel(screen.orientation)} · ${resolutionLabel(screen)}` : "Het scherm kon niet worden geladen."}
      eyebrow={`${session.tenant} · Schermdetail`}
      status={status}
      title={screen?.name ?? "Schermdetail"}
    />
    {query.fout ? <p className="notice notice--critical" role="alert"><strong>Actie niet uitgevoerd.</strong> {query.fout}</p> : null}
    {query.succes ? <p className="notice notice--success" role="status">{query.succes}</p> : null}
    {data?.error ? <p className="notice notice--critical" role="alert"><strong>Schermdetails onvolledig.</strong> {data.error}</p> : null}

    {screen && data ? <>
      <nav className="detail-tabs" aria-label="Schermdetails">
        {tabs.map(([value, label]) => <Link aria-current={activeTab === value ? "page" : undefined} href={`/dashboard/screens/${screen.id}?tab=${value}`} key={value}>{label}</Link>)}
      </nav>

      {activeTab === "overview" ? <OverviewTab
        canManage={canManage}
        device={pairedDevice}
        latestHeartbeat={latestHeartbeat}
        screen={screen}
      /> : null}
      {activeTab === "content" ? <ContentTab releases={data.releases} screen={screen} /> : null}
      {activeTab === "player" ? <PlayerTab canManage={canManage} devices={data.devices} screenId={screen.id} /> : null}
      {activeTab === "sync" ? <SyncTab
        canManage={canManage}
        device={pairedDevice}
        heartbeats={data.heartbeats}
        releases={data.releases}
        screenId={screen.id}
        syncEvents={data.syncEvents}
      /> : null}
      {activeTab === "events" ? <EventsTab events={data.auditEvents} /> : null}
    </> : null}
  </>;
}

function OverviewTab({
  canManage,
  device,
  latestHeartbeat,
  screen
}: {
  canManage: boolean;
  device: FleetDevice | null;
  latestHeartbeat: { createdAt: string; runtimeState: string } | null;
  screen: NonNullable<Awaited<ReturnType<typeof loadScreenDetail>>["screen"]>;
}) {
  return <>
    <section className="metric-grid" aria-label="Schermstatus">
      <Metric label="Lifecycle" value={screenStatusLabel(screen.status)} detail={lifecycleExplanation(screen.status)} />
      <Metric label="Player" value={device?.deviceName || "Niet gekoppeld"} detail={device?.platform || "Start onboarding om een Player te koppelen."} />
      <Metric label="Laatste heartbeat" value={latestHeartbeat ? relativeDate(latestHeartbeat.createdAt) : "Nog nooit"} detail={latestHeartbeat?.runtimeState || "Runtime nog onbekend."} />
      <Metric label="Laatste veilige fout" value={device?.lastErrorCode || "Geen"} detail={device?.lastErrorAt ? formatDate(device.lastErrorAt) : "Er is geen actuele Playerfout gerapporteerd."} />
    </section>
    <section className="data-surface" aria-labelledby="screen-settings-title">
      <div className="workspace-section__header">
        <div><h2 className="workspace-section__title" id="screen-settings-title">Scherminstellingen en lifecycle</h2><p className="work-panel__meta">Onderhoud bewaart de lokale release. Uitschakelen trekt de Player in zodra die weer online komt.</p></div>
        <StatusPill label={canManage ? "Beheerbaar" : "Alleen lezen"} tone={canManage ? "success" : "warning"} />
      </div>
      <form action={updateScreen} className="playlist-form onboarding-form">
        <input name="screenId" type="hidden" value={screen.id} />
        <div className="form-grid">
          <div className="field"><label htmlFor="detail-screen-name">Schermnaam</label><input defaultValue={screen.name} disabled={!canManage} id="detail-screen-name" maxLength={120} name="name" required type="text" /></div>
          <div className="field"><label htmlFor="detail-screen-location">Locatie</label><input defaultValue={screen.location ?? ""} disabled={!canManage} id="detail-screen-location" maxLength={160} name="location" type="text" /></div>
        </div>
        <div className="form-grid">
          <div className="field"><label htmlFor="detail-screen-orientation">Oriëntatie</label><select defaultValue={screen.orientation} disabled={!canManage} id="detail-screen-orientation" name="orientation"><option value="landscape">Liggend</option><option value="portrait">Staand</option></select></div>
          <div className="field"><label htmlFor="detail-screen-status">Lifecycle</label><select defaultValue={screen.status} disabled={!canManage} id="detail-screen-status" name="status"><option value="active">Actief</option><option value="maintenance">Onderhoud</option>{screen.status === "disabled" ? <option value="disabled">Uitgeschakeld</option> : null}</select></div>
        </div>
        <div className="form-grid">
          <div className="field"><label htmlFor="detail-screen-width">Breedte</label><input defaultValue={screen.resolutionWidth ?? 1920} disabled={!canManage} id="detail-screen-width" max={7680} min={320} name="resolutionWidth" required type="number" /></div>
          <div className="field"><label htmlFor="detail-screen-height">Hoogte</label><input defaultValue={screen.resolutionHeight ?? 1080} disabled={!canManage} id="detail-screen-height" max={4320} min={240} name="resolutionHeight" required type="number" /></div>
        </div>
        {screen.status === "disabled"
          ? <p className="notice"><strong>Heractiveren.</strong> Sla lifecycle ‘Actief’ op en koppel daarna bewust een nieuwe Player; een ingetrokken device-identiteit wordt nooit hergebruikt.</p>
          : <p className="notice notice--warning"><strong>Deactiveren is een aparte beheeractie.</strong> Gebruik de beveiligde actie onderaan; daar wordt het offline gevolg expliciet bevestigd.</p>}
        <button className="button-link button-link--primary" disabled={!canManage} type="submit">Scherminstellingen opslaan</button>
      </form>
    </section>
    <ScreenLifecycleActions
      canManage={canManage}
      screenId={screen.id}
      screenName={screen.name}
      status={screen.status}
    />
  </>;
}

function ContentTab({ releases, screen }: { releases: FleetRelease[]; screen: NonNullable<Awaited<ReturnType<typeof loadScreenDetail>>["screen"]> }) {
  const assignedRelease = releases.find((release) => release.id === screen.assignedReleaseId) ?? null;
  return <section className="data-surface" aria-labelledby="screen-content-title">
    <div className="workspace-section__header"><div><h2 className="workspace-section__title" id="screen-content-title">Toegewezen content</h2><p className="work-panel__meta">Toewijzing verwijst altijd naar een immutable release. Wijzig de release via de begeleide publicatieflow.</p></div><StatusPill label={assignedRelease ? "Release toegewezen" : "Geen content"} tone={assignedRelease ? "success" : "warning"} /></div>
    <dl className="onboarding-summary">
      <SummaryItem label="Playlist" value={assignedRelease?.playlistName || "Nog niet gekozen"} />
      <SummaryItem label="Gewenste release" value={assignedRelease ? `Versie ${assignedRelease.version}` : "Geen"} />
      <SummaryItem label="Release-ID" value={screen.assignedReleaseId ? `${screen.assignedReleaseId.slice(0, 12)}…` : "Geen"} />
    </dl>
    <div className="page-action-group"><Link className="button-link button-link--primary" href="/dashboard/publish">Content publiceren</Link>{assignedRelease ? <Link className="button-link button-link--secondary" href={`/dashboard/releases/${assignedRelease.id}`}>Release bekijken</Link> : <Link className="button-link button-link--secondary" href="/dashboard/releases">Release Center openen</Link>}</div>
  </section>;
}

function PlayerTab({ canManage, devices, screenId }: { canManage: boolean; devices: FleetDevice[]; screenId: string }) {
  const pairedDevice = devices.find((device) => device.status === "paired") ?? null;
  return <>
    {!pairedDevice ? <section className="data-surface" aria-labelledby="pair-player-title"><div className="workspace-section__header"><div><h2 className="workspace-section__title" id="pair-player-title">Nog geen actieve Player</h2><p className="work-panel__meta">Start of hervat onboarding met een nieuwe tijdelijke code.</p></div><StatusPill label="Niet gekoppeld" tone="warning" /></div><Link className="button-link button-link--primary" href={`/dashboard/screens/new?screen=${screenId}`}>Player koppelen</Link></section> : <section className="data-surface" aria-labelledby="player-device-title">
      <div className="workspace-section__header"><div><h2 className="workspace-section__title" id="player-device-title">Actieve Player</h2><p className="work-panel__meta">Geen pairingtoken, device secret of volledige fingerprint wordt in Control getoond.</p></div><StatusPill label="Gekoppeld" tone="success" /></div>
      <dl className="onboarding-summary">
        <SummaryItem label="Naam" value={pairedDevice.deviceName || "VeyoCast Player"} />
        <SummaryItem label="Platform" value={pairedDevice.platform || "Onbekend"} />
        <SummaryItem label="Appversie" value={pairedDevice.appVersion || "Onbekend"} />
        <SummaryItem label="Gekoppeld op" value={formatDate(pairedDevice.pairedAt)} />
        <SummaryItem label="Laatst gezien" value={pairedDevice.lastSeenAt ? formatDate(pairedDevice.lastSeenAt) : "Nog nooit"} />
        <SummaryItem label="Status" value={pairedDevice.status === "paired" ? "Gekoppeld" : pairedDevice.status} />
      </dl>
      <form action={renamePlayerDevice} className="inline-form"><input name="deviceId" type="hidden" value={pairedDevice.id} /><input name="screenId" type="hidden" value={screenId} /><div className="field"><label htmlFor="device-rename">Playernaam</label><input defaultValue={pairedDevice.deviceName || "VeyoCast Player"} disabled={!canManage} id="device-rename" maxLength={120} name="deviceName" required type="text" /></div><button className="button-link button-link--secondary" disabled={!canManage} type="submit">Player hernoemen</button></form>
      <div className="danger-zone"><div><h3>Device intrekken of opnieuw koppelen</h3><p>Intrekking wordt bij de eerstvolgende verbinding afgedwongen. Zolang het apparaat offline is, kan de lokaal gevalideerde release zichtbaar blijven.</p></div><form action={revokePlayerDevice} className="playlist-form"><input name="deviceId" type="hidden" value={pairedDevice.id} /><input name="screenId" type="hidden" value={screenId} /><label className="check-row"><input disabled={!canManage} name="confirmOffline" required type="checkbox" value="yes" /><span><strong>Ik begrijp het offline gevolg</strong><span className="work-panel__meta">De server kan een volledig offline apparaat niet onmiddellijk bereiken.</span></span></label><div className="page-action-group"><button className="button-link button-link--destructive" disabled={!canManage} name="rePair" type="submit" value="false">Player intrekken</button><button className="button-link button-link--secondary" disabled={!canManage} name="rePair" type="submit" value="true">Intrekken en opnieuw koppelen</button></div></form></div>
    </section>}
    {devices.some((device) => device.status !== "paired") ? <section className="workspace-section" aria-labelledby="device-history-title"><div className="workspace-section__header"><div><h2 className="workspace-section__title" id="device-history-title">Devicehistorie</h2><p className="work-panel__meta">Ingetrokken identiteiten blijven traceerbaar en worden nooit opnieuw actief gemaakt.</p></div></div><div className="data-table-frame"><table className="data-table data-table--responsive"><caption>Historische Players voor dit scherm.</caption><thead><tr><th scope="col">Player</th><th scope="col">Status</th><th scope="col">Gekoppeld</th><th scope="col">Ingetrokken</th></tr></thead><tbody>{devices.filter((device) => device.status !== "paired").map((device) => <tr key={device.id}><td data-label="Player"><span className="table-primary">{device.deviceName || "VeyoCast Player"}</span><span className="table-secondary">{device.platform || "Platform onbekend"}</span></td><td data-label="Status"><StatusPill label="Ingetrokken" tone="critical" /></td><td data-label="Gekoppeld">{formatDate(device.pairedAt)}</td><td data-label="Ingetrokken">{device.revokedAt ? formatDate(device.revokedAt) : "Onbekend"}</td></tr>)}</tbody></table></div></section> : null}
  </>;
}

function SyncTab({ canManage, device, heartbeats, releases, screenId, syncEvents }: { canManage: boolean; device: FleetDevice | null; heartbeats: Array<{ createdAt: string; runtimeState: string }>; releases: FleetRelease[]; screenId: string; syncEvents: Array<{ createdAt: string; id: string; phase: string; releaseId: string | null }> }) {
  return <>
    <section className="metric-grid" aria-label="Synchronisatiestatus">
      <Metric label="Actieve release" value={releaseLabel(device?.activeReleaseId ?? null, releases)} detail="Deze release is door de Player als actief gerapporteerd." />
      <Metric label="Gewenste release" value={releaseLabel(device?.desiredReleaseId ?? null, releases)} detail="Download en verificatie blokkeren de huidige playback niet." />
      <Metric label="Opslag" value={formatStorage(device)} detail="Verouderde of ontbrekende telemetry blijft onbekend." />
      <Metric label="Runtime" value={heartbeats[0]?.runtimeState || "Onbekend"} detail={device?.lastSeenAt ? `Laatst gezien ${relativeDate(device.lastSeenAt)}.` : "Nog geen heartbeat ontvangen."} />
    </section>
    <section className="data-surface" aria-labelledby="sync-actions-title">
      <div className="workspace-section__header"><div><h2 className="workspace-section__title" id="sync-actions-title">Gecontroleerd opnieuw proberen</h2><p className="work-panel__meta">Het verzoek wordt traceerbaar vastgelegd en bij de eerstvolgende Playerverbinding bevestigd. De actieve release blijft spelen.</p></div><StatusPill label={device?.syncRetryRequestedAt ? "Retry aangevraagd" : "Geen open retry"} tone={device?.syncRetryRequestedAt ? "info" : "neutral"} /></div>
      <form action={requestScreenSyncRetry}><input name="screenId" type="hidden" value={screenId} /><button className="button-link button-link--primary" disabled={!canManage || !device} type="submit">Synchronisatie opnieuw proberen</button></form>
    </section>
    <section className="workspace-section" aria-labelledby="sync-timeline-title"><div className="workspace-section__header"><div><h2 className="workspace-section__title" id="sync-timeline-title">Synchronisatietijdlijn</h2><p className="work-panel__meta">Downloaden, verifiëren, wissel gereed, actief en fout blijven afzonderlijk zichtbaar.</p></div><StatusPill label={`${syncEvents.length} gebeurtenissen`} tone="neutral" /></div>{syncEvents.length ? <ol className="screen-event-list">{syncEvents.map((event) => <li key={event.id}><span className="screen-event-list__marker" aria-hidden="true">{syncPhaseIcon(event.phase)}</span><div><strong>{syncPhaseLabel(event.phase)}</strong><p>{event.releaseId ? releaseLabel(event.releaseId, releases) : "Geen release-ID"} · {formatDate(event.createdAt)}</p></div></li>)}</ol> : <p className="notice" role="status">Nog geen synchronisatiegebeurtenissen. De eerste heartbeat en releasevoorbereiding verschijnen hier automatisch.</p>}</section>
  </>;
}

function EventsTab({ events }: { events: Array<{ action: string; createdAt: string; id: string; result: string; targetType: string }> }) {
  return <section className="workspace-section" aria-labelledby="screen-events-title"><div className="workspace-section__header"><div><h2 className="workspace-section__title" id="screen-events-title">Gebeurtenissen</h2><p className="work-panel__meta">Lifecycle-, pairing-, device- en retrycommands zijn append-only herleidbaar.</p></div><StatusPill label={`${events.length} gebeurtenissen`} tone="neutral" /></div>{events.length ? <div className="data-table-frame"><table className="data-table data-table--responsive"><caption>Auditgebeurtenissen voor dit scherm en zijn Players.</caption><thead><tr><th scope="col">Gebeurtenis</th><th scope="col">Resultaat</th><th scope="col">Resource</th><th scope="col">Tijd</th></tr></thead><tbody>{events.map((event) => <tr key={event.id}><td data-label="Gebeurtenis"><span className="table-primary">{eventLabel(event.action)}</span><span className="table-secondary">{event.action}</span></td><td data-label="Resultaat"><StatusPill label={event.result === "success" ? "Geslaagd" : "Mislukt"} tone={event.result === "success" ? "success" : "critical"} /></td><td data-label="Resource">{event.targetType}</td><td data-label="Tijd">{formatDate(event.createdAt)}</td></tr>)}</tbody></table></div> : <p className="notice" role="status">Nog geen beheeracties voor dit scherm.</p>}</section>;
}

function Metric({ detail, label, value }: { detail: string; label: string; value: string }) {
  return <article className="metric-card"><p className="metric-card__label">{label}</p><p className="metric-card__value metric-card__value--text">{value}</p><p className="metric-card__detail">{detail}</p></article>;
}

function SummaryItem({ label, value }: { label: string; value: string }) { return <div><dt>{label}</dt><dd>{value}</dd></div>; }
function screenStatus(status: string | undefined, device: FleetDevice | null, lastSeenAt: string | null) { if (status === "disabled") return { label: "Uitgeschakeld", tone: "critical" as const }; if (status === "maintenance") return { label: "Onderhoud", tone: "warning" as const }; if (!device) return { label: "Niet gekoppeld", tone: "warning" as const }; if (lastSeenAt && Date.now() - Date.parse(lastSeenAt) <= 5 * 60_000) return { label: "Online", tone: "success" as const }; return { label: "Offline", tone: "warning" as const }; }
function screenStatusLabel(status: string) { return status === "maintenance" ? "Onderhoud" : status === "disabled" ? "Uitgeschakeld" : "Actief"; }
function lifecycleExplanation(status: string) { return status === "maintenance" ? "Lokale playback blijft behouden; nieuwe sync en pairing wachten." : status === "disabled" ? "Device toegang is ingetrokken zodra de serverstatus bekend is." : "Pairing, heartbeat en synchronisatie zijn toegestaan."; }
function orientationLabel(value: string) { return value === "portrait" ? "Staand" : "Liggend"; }
function resolutionLabel(screen: { resolutionHeight: number | null; resolutionWidth: number | null }) { return screen.resolutionWidth && screen.resolutionHeight ? `${screen.resolutionWidth} × ${screen.resolutionHeight}` : "Resolutie onbekend"; }
function formatDate(value: string) { return new Intl.DateTimeFormat("nl-NL", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }
function relativeDate(value: string) { const elapsed = Math.max(0, Date.now() - Date.parse(value)); if (elapsed < 60_000) return "zojuist"; if (elapsed < 3_600_000) return `${Math.floor(elapsed / 60_000)} min geleden`; if (elapsed < 86_400_000) return `${Math.floor(elapsed / 3_600_000)} uur geleden`; return formatDate(value); }
function releaseLabel(id: string | null, releases: FleetRelease[]) { if (!id) return "Geen"; return releases.find((release) => release.id === id)?.label ?? `Release ${id.slice(0, 8)}`; }
function formatStorage(device: FleetDevice | null) { if (!device || device.storageUsedBytes === null || device.storageQuotaBytes === null) return "Onbekend"; return `${formatBytes(device.storageUsedBytes)} / ${formatBytes(device.storageQuotaBytes)}`; }
function formatBytes(value: number) { if (value < 1024 ** 2) return `${Math.round(value / 1024)} kB`; if (value < 1024 ** 3) return `${(value / 1024 ** 2).toFixed(1)} MB`; return `${(value / 1024 ** 3).toFixed(1)} GB`; }
function syncPhaseLabel(value: string) { return ({ manifest_received: "Manifest ontvangen", downloading: "Downloaden", verifying: "Verifiëren", switch_pending: "Wissel gereed", active: "Actief", failed: "Mislukt" } as Record<string, string>)[value] ?? "Onbekende fase"; }
function syncPhaseIcon(value: string) { return value === "active" ? "✓" : value === "failed" ? "!" : "→"; }
function eventLabel(value: string) { return ({ "screen.created": "Scherm aangemaakt", "screen.updated": "Scherm bijgewerkt", "screen.deactivated": "Scherm gedeactiveerd", "screen.removed": "Scherm verwijderd", "player_device.paired": "Player gekoppeld", "player_device.renamed": "Player hernoemd", "player_device.revoked": "Player ingetrokken", "player_device.sync_retry_requested": "Synchronisatie opnieuw aangevraagd" } as Record<string, string>)[value] ?? "Beheeractie"; }
