import Link from "next/link";
import { notFound } from "next/navigation";

import { hasCapability } from "@veyocast/auth";
import { SummaryStrip } from "@veyocast/ui";

import { requireTenantControlSession } from "../../../../../lib/control-session";
import { formatTenantDateTime } from "../../../../../lib/tenant-time";
import { deriveScreenHealth } from "../../../../../lib/screen-health";
import { PageHeader, StatusPill } from "../../../_components/shell-primitives";
import {
  renamePlayerDevice,
  requestScreenSyncRetry,
  revokePlayerDevice,
  updateScreen,
  updateScreenGroupMemberships
} from "../actions";
import {
  loadScreenDetail,
  type FleetDevice,
  type FleetRelease,
  type ScreenPlayerCommand,
  type ScreenSchedule
} from "../data";
import {
  automationCapabilityView,
  loadScreenAutomation
} from "./automation-data";
import { ScreenLifecycleActions } from "./screen-lifecycle-actions";
import { ScreenPlayerRecoveryActions } from "./screen-player-recovery-actions";
import { ScreenAutomation } from "./screen-automation";

type ScreenDetailPageProps = {
  params: Promise<{ screenId: string }>;
  searchParams: Promise<{ fout?: string; succes?: string; tab?: string }>;
};

const tabs = [
  ["overview", "Overzicht"],
  ["content", "Content"],
  ["planning", "Planning"],
  ["automation", "Automatisering"],
  ["health", "Gezondheid"],
  ["settings", "Instellingen"],
  ["activity", "Activiteit"]
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
  const automation = activeTab === "automation" && session.isLive && session.tenantId
    ? await loadScreenAutomation(session.tenantId, screenId)
    : null;
  const latestHeartbeat = data?.heartbeats[0] ?? null;
  const canManage = Boolean(
    session.isLive &&
    session.tenantStatus === "active" &&
    hasCapability(session.capabilities, "tenant.screen.manage")
  );
  const status = screenStatus(screen?.status, pairedDevice, pairedDevice?.lastSeenAt ?? null);

  return <>
    <Link className="breadcrumb-link" href="/dashboard/screens">← Terug naar schermvloot</Link>
    <PageHeader
      actions={screen ? <div className="page-action-group">
        <Link className="button-link button-link--secondary" href={`/dashboard/screens/new?screen=${screen.id}`}>Onboarding openen</Link>
        <Link className="button-link button-link--primary" href={`/dashboard/screens/${screen.id}?tab=health`}>Gezondheid bekijken</Link>
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
        device={pairedDevice}
        latestHeartbeat={latestHeartbeat}
        releases={data.releases}
        schedules={data.schedules}
        screen={screen}
        venueContext={data.venueContext}
      /> : null}
      {activeTab === "content" ? <ContentTab releases={data.releases} screen={screen} /> : null}
      {activeTab === "planning" ? (
        <PlanningTab
          automationEnabled={data.automation.enabled}
          schedules={data.schedules}
          screen={screen}
        />
      ) : null}
      {activeTab === "automation" && automation ? (
        <ScreenAutomation
          automation={automation}
          canManage={canManage}
          capabilities={automationCapabilityView(
            pairedDevice?.platform ?? null,
            pairedDevice?.appVersion ?? null,
            pairedDevice?.capabilities ?? {}
          )}
          device={pairedDevice}
          screenId={screen.id}
        />
      ) : null}
      {activeTab === "health" ? <>
        <PlayerTab
          canManage={canManage}
          commands={data.playerCommands}
          devices={data.devices}
          screenId={screen.id}
          screenName={screen.name}
        />
        <SyncTab
        canManage={canManage}
        device={pairedDevice}
        heartbeats={data.heartbeats}
        releases={data.releases}
        screenId={screen.id}
        syncEvents={data.syncEvents}
        />
      </> : null}
      {activeTab === "settings" ? <SettingsTab canManage={canManage} groups={data.groups} screen={screen} /> : null}
      {activeTab === "activity" ? <EventsTab events={data.auditEvents} /> : null}
    </> : null}
  </>;
}

function OverviewTab({
  device,
  latestHeartbeat,
  releases,
  schedules,
  screen,
  venueContext
}: {
  device: FleetDevice | null;
  latestHeartbeat: { createdAt: string; runtimeState: string } | null;
  releases: FleetRelease[];
  schedules: ScreenSchedule[];
  screen: NonNullable<Awaited<ReturnType<typeof loadScreenDetail>>["screen"]>;
  venueContext: Awaited<ReturnType<typeof loadScreenDetail>>["venueContext"];
}) {
  const activeRelease = releases.find((release) => release.id === screen.assignedReleaseId) ?? null;
  const nextSchedule = schedules
    .filter((schedule) => schedule.enabled && Date.parse(schedule.startsAt) > Date.now())
    .sort((left, right) => Date.parse(left.startsAt) - Date.parse(right.startsAt))[0] ?? null;
  return <>
    <SummaryStrip
      aria-label="Schermstatus"
      items={[
        { detail: lifecycleExplanation(screen.status), label: "Lifecycle", value: screenStatusLabel(screen.status) },
        { detail: device?.platform || "Nog niet gekoppeld", label: "Player", value: device?.deviceName || "Niet gekoppeld" },
        { detail: latestHeartbeat?.runtimeState || "Runtime onbekend", label: "Heartbeat", value: latestHeartbeat ? relativeDate(latestHeartbeat.createdAt) : "Nog nooit" },
        {
          detail: assignmentExplanation(screen, schedules),
          label: "Actieve content",
          tone: activeRelease ? "success" : "warning",
          value: activeRelease?.label || "Niet toegewezen"
        }
      ]}
    />
    <section className="data-surface" aria-labelledby="screen-overview-title">
      <div className="workspace-section__header">
        <div><h2 className="workspace-section__title" id="screen-overview-title">In één oogopslag</h2><p className="work-panel__meta">Actuele status, verklaarbare toewijzing en eerstvolgende wijziging zonder technische ruis.</p></div>
        <StatusPill label={screen.activeAssignmentSource === "schedule" ? "Planning actief" : screen.activeAssignmentSource === "override" ? "Override actief" : "Standaardcontent"} tone={screen.activeAssignmentSource === "override" ? "warning" : "info"} />
      </div>
      <dl className="onboarding-summary">
        <SummaryItem label="Actieve bron" value={assignmentExplanation(screen, schedules)} />
        <SummaryItem label="Eerstvolgende planning" value={nextSchedule ? `${nextSchedule.name} · ${formatDate(nextSchedule.startsAt)}` : "Geen aankomende planning"} />
        <SummaryItem label="Player" value={device?.deviceName || "Niet gekoppeld"} />
        <SummaryItem label="Laatste contact" value={latestHeartbeat ? relativeDate(latestHeartbeat.createdAt) : "Nog nooit"} />
        <SummaryItem
          label="Venue Twin"
          value={venueContext
            ? `${venueContext.venue.name} · ${venueContext.zone?.name ?? "Geen zone"} · positie ${Math.round(venueContext.placement.xNormalized * 100)}% × ${Math.round(venueContext.placement.yNormalized * 100)}%`
            : "Nog niet ruimtelijk geplaatst"}
        />
      </dl>
      <div className="page-action-group">
        <Link className="button-link button-link--secondary" href="/dashboard/screens?view=venue">
          Venue Twin openen
        </Link>
      </div>
    </section>
  </>;
}

function SettingsTab({
  canManage,
  groups,
  screen
}: {
  canManage: boolean;
  groups: Awaited<ReturnType<typeof loadScreenDetail>>["groups"];
  screen: NonNullable<Awaited<ReturnType<typeof loadScreenDetail>>["screen"]>;
}) {
  return <>
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
    <section className="data-surface" aria-labelledby="screen-groups-title">
      <div className="workspace-section__header">
        <div>
          <h2 className="workspace-section__title" id="screen-groups-title">Schermgroepen</h2>
          <p className="work-panel__meta">Een scherm mag tegelijk in meerdere groepen staan. Goal Alerts gebruiken de unie van alle gekozen groepen en leveren per gebeurtenis maximaal één overlay aan dit scherm.</p>
        </div>
        <StatusPill label={`${groups.filter((group) => group.selected).length} gekozen`} tone="info" />
      </div>
      <form action={updateScreenGroupMemberships} className="playlist-form onboarding-form">
        <input name="screenId" type="hidden" value={screen.id} />
        {groups.length ? <fieldset className="check-list" disabled={!canManage}>
          <legend>Groepen voor {screen.name}</legend>
          {groups.map((group) => <label className="check-row" key={group.id}>
            <input defaultChecked={group.selected} name="groupIds" type="checkbox" value={group.id} />
            <span><strong>{group.name}</strong><span className="work-panel__meta">Meervoudige selectie is toegestaan.</span></span>
          </label>)}
        </fieldset> : <p className="notice">Er zijn nog geen actieve schermgroepen. Maak eerst een schermgroep aan.</p>}
        <div className="page-action-group">
          <button className="button-link button-link--primary" disabled={!canManage} type="submit">Schermgroepen opslaan</button>
          <Link className="button-link button-link--secondary" href="/dashboard/screens/groups">Schermgroepen beheren</Link>
        </div>
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
    <div className="workspace-section__header"><div><h2 className="workspace-section__title" id="screen-content-title">Toegewezen content</h2><p className="work-panel__meta">Toewijzing verwijst altijd naar een immutable release. De actieve bron blijft afzonderlijk verklaarbaar.</p></div><StatusPill label={assignedRelease ? "Release toegewezen" : "Geen content"} tone={assignedRelease ? "success" : "warning"} /></div>
    <dl className="onboarding-summary">
      <SummaryItem label="Playlist" value={assignedRelease?.playlistName || "Nog niet gekozen"} />
      <SummaryItem label="Gewenste release" value={assignedRelease ? `Versie ${assignedRelease.version}` : "Geen"} />
      <SummaryItem label="Toewijzingsbron" value={assignmentSourceLabel(screen.activeAssignmentSource)} />
      <SummaryItem label="Release-ID" value={screen.assignedReleaseId ? `${screen.assignedReleaseId.slice(0, 12)}…` : "Geen"} />
    </dl>
    <div className="page-action-group">
      <Link
        className="button-link button-link--primary"
        href={assignedRelease ? `/dashboard/playlists/${assignedRelease.playlistId}` : "/dashboard/playlists"}
      >
        {assignedRelease ? "Nieuwe versie maken" : "Playlist kiezen"}
      </Link>
      {assignedRelease
        ? <Link className="button-link button-link--secondary" href={`/dashboard/publications/${assignedRelease.id}`}>Publicatie bekijken</Link>
        : <Link className="button-link button-link--secondary" href="/dashboard/publications">Publicaties openen</Link>}
    </div>
  </section>;
}

function PlanningTab({
  automationEnabled,
  schedules,
  screen
}: {
  automationEnabled: boolean;
  schedules: ScreenSchedule[];
  screen: NonNullable<Awaited<ReturnType<typeof loadScreenDetail>>["screen"]>;
}) {
  return <>
    <section className="data-surface" aria-labelledby="screen-planning-title">
      <div className="workspace-section__header">
        <div><h2 className="workspace-section__title" id="screen-planning-title">Planning en prioriteit</h2><p className="work-panel__meta">Individuele planning gaat vóór schermgroepsplanning. Iedere actieve keuze verwijst naar een immutable release.</p></div>
        <StatusPill label={assignmentSourceLabel(screen.activeAssignmentSource)} tone={screen.activeAssignmentSource === "override" ? "warning" : "info"} />
      </div>
      <p className="notice"><strong>Nu zichtbaar:</strong> {assignmentExplanation(screen, schedules)}</p>
      {!automationEnabled && schedules.some((schedule) => schedule.enabled) ? (
        <p className="notice notice--warning">
          <strong>Automatische start staat uit.</strong> Deze contentplanning kan
          beginnen terwijl de Player niet automatisch actief wordt.{" "}
          <Link href={`/dashboard/screens/${screen.id}?tab=automation`}>
            Automatisering instellen
          </Link>
        </p>
      ) : null}
      <div className="page-action-group">
        <Link className="button-link button-link--primary" href={`/dashboard/planning?target=screen:${screen.id}`}>Planning beheren</Link>
        <Link className="button-link button-link--secondary" href="/dashboard/screens/groups">Schermgroepen bekijken</Link>
      </div>
    </section>
    <section className="workspace-section" aria-labelledby="screen-schedule-list-title">
      <div className="workspace-section__header"><div><h2 className="workspace-section__title" id="screen-schedule-list-title">Relevante planningen</h2><p className="work-panel__meta">Alle planningen die dit scherm rechtstreeks of via een groep kunnen raken.</p></div><StatusPill label={`${schedules.length} regels`} tone="neutral" /></div>
      {schedules.length ? <ol className="screen-event-list">
        {schedules.map((schedule) => <li key={schedule.id}>
          <span className="screen-event-list__marker" aria-hidden="true">{schedule.isActive ? "✓" : "→"}</span>
          <div>
            <strong>{schedule.name} · {schedule.releaseLabel}</strong>
            <p>{schedule.targetKind === "screen" ? "Individueel scherm" : `Schermgroep ${schedule.targetName}`} · prioriteit {schedule.priority} · {formatDate(schedule.startsAt)}{schedule.endsAt ? ` tot ${formatDate(schedule.endsAt)}` : ""}</p>
          </div>
          <StatusPill label={schedule.isActive ? "Nu actief" : schedule.enabled ? "Ingeschakeld" : "Uitgeschakeld"} tone={schedule.isActive ? "success" : schedule.enabled ? "info" : "neutral"} />
        </li>)}
      </ol> : <p className="notice" role="status">Er zijn geen individuele of groepsplanningen voor dit scherm.</p>}
    </section>
  </>;
}

function PlayerTab({
  canManage,
  commands,
  devices,
  screenId,
  screenName
}: {
  canManage: boolean;
  commands: ScreenPlayerCommand[];
  devices: FleetDevice[];
  screenId: string;
  screenName: string;
}) {
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
      <div className="danger-zone"><div><h3>Device permanent intrekken</h3><p>Gebruik deze beheeractie alleen wanneer de installatie niet meer gebruikt mag worden. Kies bij <strong>Meer acties</strong> voor <strong>Ontkoppelen en nieuwe code</strong> wanneer dezelfde fysieke Player opnieuw gekoppeld moet worden.</p></div><form action={revokePlayerDevice} className="playlist-form"><input name="deviceId" type="hidden" value={pairedDevice.id} /><input name="screenId" type="hidden" value={screenId} /><label className="check-row"><input disabled={!canManage} name="confirmOffline" required type="checkbox" value="yes" /><span><strong>Ik begrijp het offline gevolg</strong><span className="work-panel__meta">De server kan een volledig offline apparaat niet onmiddellijk bereiken.</span></span></label><div className="page-action-group"><button className="button-link button-link--destructive" disabled={!canManage} name="rePair" type="submit" value="false">Player intrekken</button></div></form></div>
    </section>}
    {pairedDevice ? (
      <>
        <ScreenPlayerRecoveryActions
          canManage={canManage}
          screenId={screenId}
          screenName={screenName}
        />
        <PlayerCommandStatus commands={commands} />
      </>
    ) : null}
    {devices.some((device) => device.status !== "paired") ? <section className="workspace-section" aria-labelledby="device-history-title"><div className="workspace-section__header"><div><h2 className="workspace-section__title" id="device-history-title">Devicehistorie</h2><p className="work-panel__meta">Ingetrokken identiteiten blijven traceerbaar en worden nooit opnieuw actief gemaakt.</p></div></div><div className="data-table-frame"><table className="data-table data-table--responsive"><caption>Historische Players voor dit scherm.</caption><thead><tr><th scope="col">Player</th><th scope="col">Status</th><th scope="col">Gekoppeld</th><th scope="col">Ingetrokken</th></tr></thead><tbody>{devices.filter((device) => device.status !== "paired").map((device) => <tr key={device.id}><td data-label="Player"><span className="table-primary">{device.deviceName || "VeyoCast Player"}</span><span className="table-secondary">{device.platform || "Platform onbekend"}</span></td><td data-label="Status"><StatusPill label="Ingetrokken" tone="critical" /></td><td data-label="Gekoppeld">{formatDate(device.pairedAt)}</td><td data-label="Ingetrokken">{device.revokedAt ? formatDate(device.revokedAt) : "Onbekend"}</td></tr>)}</tbody></table></div></section> : null}
  </>;
}

function PlayerCommandStatus({ commands }: { commands: ScreenPlayerCommand[] }) {
  return (
    <section className="workspace-section" aria-labelledby="player-command-status-title">
      <div className="workspace-section__header">
        <div>
          <h2 className="workspace-section__title" id="player-command-status-title">
            Opdrachtstatus
          </h2>
          <p className="work-panel__meta">
            Aflevering en uitvoering worden rechtstreeks door de Player bevestigd.
          </p>
        </div>
        <StatusPill label={`${commands.length} opdrachten`} tone="neutral" />
      </div>
      {commands.length ? (
        <div className="data-table-frame">
          <table className="data-table data-table--responsive">
            <caption>Recente eenmalige Playeropdrachten.</caption>
            <thead>
              <tr>
                <th scope="col">Opdracht</th>
                <th scope="col">Status</th>
                <th scope="col">Aangemaakt</th>
                <th scope="col">Details</th>
              </tr>
            </thead>
            <tbody>
              {commands.map((command) => {
                const status = playerCommandStatus(command);
                return (
                  <tr key={command.id}>
                    <td data-label="Opdracht">
                      <span className="table-primary">
                        {playerCommandLabel(command.commandType)}
                      </span>
                    </td>
                    <td data-label="Status">
                      <StatusPill label={status.label} tone={status.tone} />
                    </td>
                    <td data-label="Aangemaakt">{formatDate(command.createdAt)}</td>
                    <td data-label="Details">
                      {command.failureCode ?? `Verloopt ${formatDate(command.expiresAt)}`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="notice" role="status">Nog geen remote Playeropdrachten.</p>
      )}
    </section>
  );
}

function SyncTab({ canManage, device, heartbeats, releases, screenId, syncEvents }: { canManage: boolean; device: FleetDevice | null; heartbeats: Array<{ createdAt: string; runtimeState: string }>; releases: FleetRelease[]; screenId: string; syncEvents: Array<{ createdAt: string; id: string; phase: string; releaseId: string | null }> }) {
  return <>
    <SummaryStrip
      aria-label="Synchronisatiestatus"
      items={[
        { detail: "Door de Player actief gemeld", label: "Actieve release", value: releaseLabel(device?.activeReleaseId ?? null, releases) },
        { detail: "Volgende volledig te verifiëren release", label: "Gewenste release", value: releaseLabel(device?.desiredReleaseId ?? null, releases) },
        { detail: "Onbekende telemetry blijft onbekend", label: "Opslag", value: formatStorage(device) },
        {
          detail: device?.lastSeenAt ? `Laatst gezien ${relativeDate(device.lastSeenAt)}` : "Nog geen heartbeat",
          label: "Runtime",
          value: heartbeats[0]?.runtimeState || "Onbekend"
        }
      ]}
    />
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

function SummaryItem({ label, value }: { label: string; value: string }) { return <div><dt>{label}</dt><dd>{value}</dd></div>; }
function assignmentSourceLabel(source: string) { return source === "override" ? "Directe override" : source === "schedule" ? "Planning" : "Standaardplaylist"; }
function assignmentExplanation(screen: NonNullable<Awaited<ReturnType<typeof loadScreenDetail>>["screen"]>, schedules: ScreenSchedule[]) {
  if (screen.activeAssignmentSource === "override") return "Actief via directe override";
  if (screen.activeAssignmentSource === "schedule") {
    const active = schedules.find((schedule) => schedule.id === screen.activeScheduleId);
    if (!active) return "Actief via planning";
    return active.targetKind === "screen"
      ? `Actief via individuele planning “${active.name}”`
      : `Actief via schermgroep “${active.targetName}”`;
  }
  return "Actief via standaardplaylist van het scherm";
}
function screenStatus(status: string | undefined, device: FleetDevice | null, lastSeenAt: string | null) {
  return deriveScreenHealth({
    activeReleaseId: device?.activeReleaseId,
    desiredReleaseId: device?.desiredReleaseId,
    deviceStatus: device?.status,
    lastSeenAt,
    screenStatus: status ?? "active"
  });
}
function screenStatusLabel(status: string) { return status === "maintenance" ? "Onderhoud" : status === "disabled" ? "Uitgeschakeld" : "Actief"; }
function lifecycleExplanation(status: string) { return status === "maintenance" ? "Lokale playback blijft behouden; nieuwe sync en pairing wachten." : status === "disabled" ? "Device toegang is ingetrokken zodra de serverstatus bekend is." : "Pairing, heartbeat en synchronisatie zijn toegestaan."; }
function orientationLabel(value: string) { return value === "portrait" ? "Staand" : "Liggend"; }
function resolutionLabel(screen: { resolutionHeight: number | null; resolutionWidth: number | null }) { return screen.resolutionWidth && screen.resolutionHeight ? `${screen.resolutionWidth} × ${screen.resolutionHeight}` : "Resolutie onbekend"; }
function formatDate(value: string) { return formatTenantDateTime(value, null); }
function relativeDate(value: string) { const elapsed = Math.max(0, Date.now() - Date.parse(value)); if (elapsed < 60_000) return "zojuist"; if (elapsed < 3_600_000) return `${Math.floor(elapsed / 60_000)} min geleden`; if (elapsed < 86_400_000) return `${Math.floor(elapsed / 3_600_000)} uur geleden`; return formatDate(value); }
function releaseLabel(id: string | null, releases: FleetRelease[]) { if (!id) return "Geen"; return releases.find((release) => release.id === id)?.label ?? `Release ${id.slice(0, 8)}`; }
function formatStorage(device: FleetDevice | null) { if (!device || device.storageUsedBytes === null || device.storageQuotaBytes === null) return "Onbekend"; return `${formatBytes(device.storageUsedBytes)} / ${formatBytes(device.storageQuotaBytes)}`; }
function formatBytes(value: number) { if (value < 1024 ** 2) return `${Math.round(value / 1024)} kB`; if (value < 1024 ** 3) return `${(value / 1024 ** 2).toFixed(1)} MB`; return `${(value / 1024 ** 3).toFixed(1)} GB`; }
function playerCommandLabel(value: string) { return ({ RELOAD_PLAYER: "Player opnieuw laden", RECOVER_PAIRING: "Koppeling herstellen", FORCE_UNPAIR: "Ontkoppelen en nieuwe code", CLEAR_PLAYER_CACHE: "Lokale cache herstellen" } as Record<string, string>)[value] ?? "Playeropdracht"; }
function playerCommandStatus(command: ScreenPlayerCommand) {
  if (command.completedAt) return { label: "Geslaagd", tone: "success" as const };
  if (command.failedAt || Date.parse(command.expiresAt) <= Date.now()) {
    return command.failureCode === "COMMAND_EXPIRED" || !command.failedAt
      ? { label: "Verlopen", tone: "warning" as const }
      : { label: "Mislukt", tone: "critical" as const };
  }
  if (command.acknowledgedAt) return { label: "Player herstelt", tone: "info" as const };
  if (command.deliveredAt) return { label: "Afgeleverd", tone: "info" as const };
  return { label: "Wacht op player", tone: "neutral" as const };
}
function syncPhaseLabel(value: string) { return ({ manifest_received: "Manifest ontvangen", downloading: "Downloaden", verifying: "Verifiëren", switch_pending: "Wissel gereed", active: "Actief", failed: "Mislukt" } as Record<string, string>)[value] ?? "Onbekende fase"; }
function syncPhaseIcon(value: string) { return value === "active" ? "✓" : value === "failed" ? "!" : "→"; }
function eventLabel(value: string) { return ({ "screen.created": "Scherm aangemaakt", "screen.updated": "Scherm bijgewerkt", "screen.deactivated": "Scherm gedeactiveerd", "screen.removed": "Scherm verwijderd", "player_device.paired": "Player gekoppeld", "player_device.renamed": "Player hernoemd", "player_device.revoked": "Player ingetrokken", "player_device.sync_retry_requested": "Synchronisatie opnieuw aangevraagd", "player_command.queued": "Playeropdracht klaargezet", "player_command.delivered": "Playeropdracht afgeleverd", "player_command.completed": "Playeropdracht geslaagd", "player_command.failed": "Playeropdracht mislukt", "player_command.expired": "Playeropdracht verlopen" } as Record<string, string>)[value] ?? "Beheeractie"; }
