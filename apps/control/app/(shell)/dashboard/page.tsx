import Link from "next/link";

import { requireTenantControlSession } from "../../../lib/control-session";
import {
  loadTenantOverview,
  type TenantOverview
} from "../../../lib/control-overview";
import {
  HealthList,
  MetricCard,
  PageHeader,
  StatusPill,
  Timeline
} from "../_components/shell-primitives";

const tenantMetrics = [
  {
    detail: "5 online, 1 synchroniseert.",
    label: "Actieve schermen",
    tone: "success",
    value: "6"
  },
  {
    detail: "Bestuurskamer is 18 minuten niet gezien.",
    label: "Schermen offline",
    tone: "warning",
    value: "1"
  },
  {
    detail: "2 concepten hebben wijzigingen.",
    label: "Playlists",
    tone: "neutral",
    value: "12"
  },
  {
    detail: "4 items wachten op verwerking.",
    label: "Media",
    tone: "info",
    value: "84"
  },
  {
    detail: "Huidige release blijft veilig actief.",
    label: "Publicaties",
    tone: "warning",
    value: "2"
  },
  {
    detail: "Van 50 GB beschikbaar voor de vereniging.",
    label: "Opslag gebruikt",
    tone: "neutral",
    value: "18,4 GB"
  }
] as const;

const screenRows = [
  {
    connection: "Stabiel",
    lastSeen: "Nu",
    playlist: "Zomerroute",
    release: "v3 actief",
    screen: "Entree links",
    status: "Online",
    storage: "11,2 GB / 32 GB",
    tone: "success"
  },
  {
    connection: "Downloadt",
    lastSeen: "2 min geleden",
    playlist: "Kantineprogramma",
    release: "v12 naar v13",
    screen: "Kantine hoofdscherm",
    status: "Synchroniseren",
    storage: "8,7 GB / 32 GB",
    tone: "info"
  },
  {
    connection: "Onbekend",
    lastSeen: "18 min geleden",
    playlist: "Geen",
    release: "v1 actief",
    screen: "Bestuurskamer",
    status: "Offline",
    storage: "2,1 GB / 32 GB",
    tone: "warning"
  }
] as const;

const operationTimeline = [
  {
    detail: "Nieuwe poster is gereed en kan aan een concept worden toegevoegd.",
    label: "Media verwerkt",
    meta: "Gereed",
    tone: "success"
  },
  {
    detail: "Een sponsorafbeelding wacht nog op verwerking voordat je kunt publiceren.",
    label: "Publicatiereview",
    meta: "1 blokkade",
    tone: "warning"
  },
  {
    detail: "Kantine hoofdscherm downloadt de gewenste release en houdt versie 12 actief.",
    label: "Player synchroniseert",
    meta: "Veilig",
    tone: "info"
  }
] as const;

const openSignals = [
  {
    detail: "Sponsor slide heeft nog geen player-variant. Wacht op verwerking of vervang het item.",
    label: "Publicatie geblokkeerd",
    status: "Actie nodig",
    tone: "warning"
  },
  {
    detail: "Bestuurskamer heeft geen recente heartbeat. Controleer de verbinding of markeer onderhoud.",
    label: "Scherm offline",
    status: "18 min",
    tone: "warning"
  },
  {
    detail: "Tenantviewer heeft alleen leesrechten op media en releases.",
    label: "Rechten gecontroleerd",
    status: "Op orde",
    tone: "success"
  }
] as const;

export default async function DashboardPage() {
  const session = await requireTenantControlSession();

  if (!session.isLive) {
    return <DemoDashboardPage />;
  }

  const data = await loadTenantOverview(session.tenantId!);
  return <LiveDashboard data={data} tenant={session.tenant} userName={session.userName} />;
}

function LiveDashboard({
  data,
  tenant,
  userName
}: {
  data: TenantOverview;
  tenant: string;
  userName: string;
}) {
  const devices = new Map(data.devices.map((device) => [device.screen_id, device]));
  const onlineScreens = data.screens.filter((screen) => isRecentlyOnline(devices.get(screen.id)?.last_seen_at)).length;
  const offlineScreens = data.screens.filter((screen) => {
    const device = devices.get(screen.id);
    return !device || !isRecentlyOnline(device.last_seen_at);
  }).length;
  const pendingMedia = data.media.filter((asset) => asset.status !== "ready").length;
  const mediaBytes = data.media.reduce((total, asset) => total + Number(asset.file_size_bytes), 0);

  return (
    <>
      <PageHeader
        actions={
          <>
            <Link className="button-link button-link--secondary" href="/dashboard/screens">
              Scherm koppelen
            </Link>
            <Link className="button-link button-link--primary" href="/dashboard/playlists">
              Nieuwe playlist
            </Link>
          </>
        }
        description="Dit overzicht wordt rechtstreeks uit de actieve, tenantgebonden sessie geladen."
        eyebrow={tenant}
        status={{ label: "Live tenantdata", tone: "success" }}
        title={`Welkom, ${userName}`}
      />

      {data.error ? (
        <p className="notice notice--critical" role="alert">
          <strong>Overzicht niet beschikbaar.</strong> De actuele gegevens konden niet veilig worden geladen. Vernieuw de pagina of log opnieuw in.
        </p>
      ) : null}

      <section className="metric-grid" aria-label="Operationeel overzicht">
        <MetricCard detail={`${onlineScreens} met een recente heartbeat.`} label="Actieve schermen" tone="success" value={String(data.screens.length)} />
        <MetricCard detail="Niet gekoppeld of zonder recente heartbeat." label="Schermen met aandacht" tone={offlineScreens ? "warning" : "success"} value={String(offlineScreens)} />
        <MetricCard detail="Bewerkbare playlists binnen deze vereniging." label="Playlists" value={String(data.playlistCount)} />
        <MetricCard detail={`${pendingMedia} nog niet gereed.`} label="Media" tone={pendingMedia ? "warning" : "info"} value={String(data.media.length)} />
        <MetricCard detail="Onveranderlijke gepubliceerde versies." label="Releases" value={String(data.releaseCount)} />
        <MetricCard detail="Som van de geregistreerde bronbestanden." label="Mediaopslag" value={formatBytes(mediaBytes)} />
      </section>

      <section className="workspace-section" aria-labelledby="live-screen-fleet-title">
        <div className="workspace-section__header">
          <div>
            <h2 className="workspace-section__title" id="live-screen-fleet-title">Schermen</h2>
            <p className="work-panel__meta">Actuele scherm- en verbindingstoestand.</p>
          </div>
          <Link className="table-action" href="/dashboard/screens">Alle schermen bekijken</Link>
        </div>
        {data.screens.length ? (
          <div className="data-table-frame">
            <table className="data-table data-table--responsive">
              <caption>Actuele schermstatus binnen de actieve vereniging.</caption>
              <thead><tr><th scope="col">Scherm</th><th scope="col">Status</th><th scope="col">Locatie</th><th scope="col">Release</th></tr></thead>
              <tbody>{data.screens.map((screen) => {
                const device = devices.get(screen.id);
                const online = isRecentlyOnline(device?.last_seen_at);
                return <tr key={screen.id}>
                  <td data-label="Scherm"><span className="table-primary">{screen.name}</span></td>
                  <td data-label="Status"><StatusPill label={online ? "Online" : device ? "Offline" : "Niet gekoppeld"} tone={online ? "success" : "warning"} /></td>
                  <td data-label="Locatie">{screen.location || "Niet ingesteld"}</td>
                  <td data-label="Release">{device?.active_release_id ? shortId(device.active_release_id) : "Geen actieve release"}</td>
                </tr>;
              })}</tbody>
            </table>
          </div>
        ) : (
          <p className="notice" role="status">Nog geen schermen. Maak een scherm aan en koppel daarna een Player.</p>
        )}
      </section>

      <section className="workspace-section" aria-labelledby="recent-events-title">
        <div className="workspace-section__header">
          <div><h2 className="workspace-section__title" id="recent-events-title">Recente gebeurtenissen</h2><p className="work-panel__meta">Server-side auditgebeurtenissen, nieuwste eerst.</p></div>
          <StatusPill label={`${data.auditEvents.length} getoond`} tone="neutral" />
        </div>
        {data.auditEvents.length ? <ul className="health-list" aria-label="Recente auditgebeurtenissen">{data.auditEvents.map((event) => <li className="health-item" key={event.id}><span className="health-item__copy"><span className="health-item__title">{humanize(event.action)}</span><span className="work-panel__meta">{event.target_type} · {formatDate(event.created_at)}</span></span><StatusPill label={event.result === "success" ? "Geslaagd" : "Mislukt"} tone={event.result === "success" ? "success" : "critical"} /></li>)}</ul> : <p className="notice" role="status">Nog geen auditgebeurtenissen voor deze vereniging.</p>}
      </section>
    </>
  );
}

function DemoDashboardPage() {
  return (
    <>
      <PageHeader
        actions={
          <>
            <Link className="button-link button-link--secondary" href="/dashboard/screens">
              Scherm koppelen
            </Link>
            <Link className="button-link button-link--primary" href="/dashboard/playlists">
              Nieuwe playlist
            </Link>
          </>
        }
        description="Dit is de actuele status van jouw VeyoCast-omgeving. Schermen en publicaties staan vooraan, zodat je direct ziet wat aandacht vraagt."
        eyebrow="Museumkwartier"
        status={{ label: "Tenantcontext actief", tone: "success" }}
        title="Goedemorgen, Daan"
      />

      <section className="metric-grid" aria-label="Operationeel overzicht">
        {tenantMetrics.map((metric) => (
          <MetricCard
            detail={metric.detail}
            key={metric.label}
            label={metric.label}
            tone={metric.tone}
            value={metric.value}
          />
        ))}
      </section>

      <section className="dashboard-layout">
        <section className="workspace-section" aria-labelledby="screen-fleet-title">
          <div className="workspace-section__header">
            <div>
              <h2 className="workspace-section__title" id="screen-fleet-title">
                Schermen
              </h2>
              <p className="work-panel__meta">
                De schermen die nu actief zijn of aandacht vragen.
              </p>
            </div>
            <Link className="table-action" href="/dashboard/screens">
              Alle schermen bekijken
            </Link>
          </div>
          <div className="data-table-frame">
            <table className="data-table data-table--responsive">
              <caption>Actuele status van de schermvloot.</caption>
              <thead>
                <tr>
                  <th scope="col">Scherm</th>
                  <th scope="col">Status</th>
                  <th scope="col">Playlist</th>
                  <th scope="col">Release</th>
                  <th scope="col">Laatst gezien</th>
                  <th scope="col">Opslag</th>
                  <th scope="col">Verbinding</th>
                  <th scope="col">Actie</th>
                </tr>
              </thead>
              <tbody>
                {screenRows.map((screen) => (
                  <tr key={screen.screen}>
                    <td data-label="Scherm">
                      <span className="table-primary">{screen.screen}</span>
                      <span className="table-secondary">Museumkwartier</span>
                    </td>
                    <td data-label="Status">
                      <StatusPill label={screen.status} tone={screen.tone} />
                    </td>
                    <td data-label="Playlist">{screen.playlist}</td>
                    <td data-label="Release">{screen.release}</td>
                    <td data-label="Laatst gezien">{screen.lastSeen}</td>
                    <td data-label="Opslag">{screen.storage}</td>
                    <td data-label="Verbinding">{screen.connection}</td>
                    <td data-label="Actie">
                      <Link className="table-action" href="/dashboard/screens">
                        Details
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="dashboard-aside" aria-label="Publicatie en aandachtspunten">
          <section className="status-panel" aria-labelledby="publication-title">
            <div className="work-panel__header">
              <div>
                <h2 className="work-panel__title" id="publication-title">
                  Actieve publicatie
                </h2>
                <p className="work-panel__meta">Kantineprogramma</p>
              </div>
              <StatusPill label="Synchroniseren" tone="info" />
            </div>
            <dl className="meta-list">
              <div>
                <dt>Actieve release</dt>
                <dd>Versie 12</dd>
              </div>
              <div>
                <dt>Gewenste release</dt>
                <dd>Versie 13</dd>
              </div>
              <div>
                <dt>Schermen gereed</dt>
                <dd>5 van 6</dd>
              </div>
            </dl>
            <div className="progress-bar" aria-label="83 procent gedownload">
              <span style={{ width: "83%" }} />
            </div>
            <p className="notice" role="status">
              Versie 12 blijft spelen tot versie 13 op ieder scherm volledig is
              gedownload en geverifieerd.
            </p>
          </section>

          <section className="status-panel" aria-labelledby="open-actions-title">
            <div className="work-panel__header">
              <div>
                <h2 className="work-panel__title" id="open-actions-title">
                  Aandachtspunten
                </h2>
                <p className="work-panel__meta">Drie zaken vragen opvolging.</p>
              </div>
              <StatusPill label="3 open" tone="warning" />
            </div>
            <HealthList ariaLabel="Open dashboardacties" items={openSignals} />
          </section>
        </aside>
      </section>

      <section className="work-panel" aria-labelledby="operation-timeline-title">
        <div className="work-panel__header">
          <div>
            <h2 className="work-panel__title" id="operation-timeline-title">
              Operationele lijn
            </h2>
            <p className="work-panel__meta">
              Media, publicatie en playerstatus in de volgorde waarin ze je werk raken.
            </p>
          </div>
          <StatusPill label="Vandaag" tone="neutral" />
        </div>
        <Timeline ariaLabel="Operationele tenantflow" items={operationTimeline} />
      </section>
    </>
  );
}

function isRecentlyOnline(value: string | null | undefined) {
  return Boolean(value && Date.now() - new Date(value).getTime() < 5 * 60_000);
}

function formatBytes(value: number) {
  if (value < 1_000_000) return `${Math.round(value / 1_000)} kB`;
  if (value < 1_000_000_000) return `${(value / 1_000_000).toFixed(1)} MB`;
  return `${(value / 1_000_000_000).toFixed(1)} GB`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("nl-NL", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function humanize(value: string) {
  return value.replaceAll(".", " ").replaceAll("_", " ");
}

function shortId(value: string) {
  return value.slice(0, 8);
}
