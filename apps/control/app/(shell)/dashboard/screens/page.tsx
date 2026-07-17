import Link from "next/link";

import {
  HealthList,
  MetricCard,
  PageHeader,
  StatusPill,
  Timeline
} from "../../_components/shell-primitives";

const screenMetrics = [
  {
    detail: "Schermen met een actieve device-sessie.",
    label: "Online",
    tone: "success",
    value: "14"
  },
  {
    detail: "Nieuwe content wordt veilig voorbereid.",
    label: "Synchroniseren",
    tone: "info",
    value: "2"
  },
  {
    detail: "Koppeling of verbinding vraagt aandacht.",
    label: "Aandacht nodig",
    tone: "warning",
    value: "1"
  }
] as const;

const screenRows = [
  {
    connection: "Stabiel",
    lastSeen: "Nu",
    location: "Clubhuis entree",
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
    location: "Barwand",
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
    location: "Vergaderruimte",
    playlist: "Geen",
    release: "v1 actief",
    screen: "Bestuurskamer",
    status: "Offline",
    storage: "2,1 GB / 32 GB",
    tone: "warning"
  }
] as const;

const pairingChecks = [
  {
    detail: "De code verloopt na tien minuten en wordt alleen als hash bewaard.",
    label: "Pairingcode",
    status: "Actief",
    tone: "info"
  },
  {
    detail: "Alleen een beheerder van deze vereniging kan de player claimen.",
    label: "Bevestiging",
    status: "Vereist",
    tone: "success"
  },
  {
    detail: "Na koppeling downloadt de player eerst een volledige release.",
    label: "Eerste synchronisatie",
    status: "Veilig",
    tone: "success"
  }
] as const;

const syncDiagnostics = [
  {
    detail: "Entree links meldt een heartbeat en actieve release binnen de gezonde drempel.",
    label: "Heartbeat",
    status: "2 min",
    tone: "success"
  },
  {
    detail: "De laatst geverifieerde release is lokaal beschikbaar wanneer internet wegvalt.",
    label: "Lokale cache",
    status: "Warm",
    tone: "success"
  },
  {
    detail: "Kantine hoofdscherm downloadt release 13 en wisselt pas na verificatie.",
    label: "Gewenste release",
    status: "83%",
    tone: "info"
  }
] as const;

const deviceLifecycle = [
  {
    detail: "De player toont een leesbare code op het startscherm.",
    label: "Code tonen",
    meta: "10 min",
    tone: "info"
  },
  {
    detail: "Een beheerder kiest het scherm en bevestigt het juiste apparaat.",
    label: "Scherm koppelen",
    meta: "Bewust",
    tone: "success"
  },
  {
    detail: "De player bewaart een geverifieerde release voordat hij content toont.",
    label: "Release voorbereiden",
    meta: "Atomair",
    tone: "success"
  }
] as const;

export default function ScreensPage() {
  return (
    <>
      <PageHeader
        actions={
          <>
            <Link className="button-link button-link--secondary" href="/dashboard/playlists">
              Releases bekijken
            </Link>
            <button className="button-link button-link--primary" disabled type="button">
              Scherm koppelen
            </button>
          </>
        }
        description="Beheer de schermvloot, bekijk de actieve en gewenste release en koppel nieuwe players met een tijdelijke code."
        eyebrow="Museumkwartier"
        status={{ label: "Player is een apart apparaat", tone: "success" }}
        title="Schermen"
      />

      <section className="metric-grid" aria-label="Schermoverzicht">
        {screenMetrics.map((metric) => (
          <MetricCard
            detail={metric.detail}
            key={metric.label}
            label={metric.label}
            tone={metric.tone}
            value={metric.value}
          />
        ))}
      </section>

      <section className="screens-workspace">
        <section className="workspace-section" aria-labelledby="screen-fleet-title">
          <div className="workspace-section__header">
            <div>
              <h2 className="workspace-section__title" id="screen-fleet-title">
                Schermvloot
              </h2>
              <p className="work-panel__meta">Status, release en verbinding per scherm.</p>
            </div>
            <StatusPill label="17 totaal" tone="neutral" />
          </div>
          <div className="data-table-frame">
            <table className="data-table data-table--responsive">
              <caption>Operationele schermstatus binnen de actieve vereniging.</caption>
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
                {screenRows.map((row) => (
                  <tr key={row.screen}>
                    <td data-label="Scherm">
                      <span className="table-primary">{row.screen}</span>
                      <span className="table-secondary">{row.location}</span>
                    </td>
                    <td data-label="Status">
                      <StatusPill label={row.status} tone={row.tone} />
                    </td>
                    <td data-label="Playlist">{row.playlist}</td>
                    <td data-label="Release">{row.release}</td>
                    <td data-label="Laatst gezien">{row.lastSeen}</td>
                    <td data-label="Opslag">{row.storage}</td>
                    <td data-label="Verbinding">{row.connection}</td>
                    <td data-label="Actie">
                      <button className="table-action" type="button">
                        Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="workspace-aside" aria-label="Scherm koppelen">
          <section className="inspector-panel" aria-labelledby="pairing-title">
            <div className="work-panel__header">
              <div>
                <h2 className="work-panel__title" id="pairing-title">
                  Scherm koppelen
                </h2>
                <p className="work-panel__meta">Voer de code van het player-startscherm in.</p>
              </div>
              <StatusPill label="10 min" tone="info" />
            </div>
            <form className="playlist-form">
              <div className="field">
                <label htmlFor="screen-name">Schermnaam</label>
                <input
                  id="screen-name"
                  name="screen-name"
                  placeholder="Bijvoorbeeld entree links"
                  readOnly
                  type="text"
                />
              </div>
              <div className="pairing-code" aria-label="Pairingcode">
                CTV 482
              </div>
            </form>
            <HealthList ariaLabel="Pairingcontroles" items={pairingChecks} />
            <p className="notice" role="status">
              Pairing is in deze demo read-only. In productie bevestig je eerst het
              scherm en apparaat voordat de eerste release wordt voorbereid.
            </p>
          </section>
        </aside>
      </section>

      <section className="work-grid">
        <section className="data-surface" aria-labelledby="sync-diagnostics-title">
          <div className="work-panel__header">
            <div>
              <h2 className="work-panel__title" id="sync-diagnostics-title">
                Playerdiagnostiek
              </h2>
              <p className="work-panel__meta">Heartbeats, cache en release-status zonder gevoelige gegevens.</p>
            </div>
            <StatusPill label="Op orde" tone="success" />
          </div>
          <HealthList ariaLabel="Player sync diagnostics" items={syncDiagnostics} />
        </section>

        <section className="data-surface" aria-labelledby="device-lifecycle-title">
          <div className="work-panel__header">
            <div>
              <h2 className="work-panel__title" id="device-lifecycle-title">
                Koppelproces
              </h2>
              <p className="work-panel__meta">Van pairingcode naar een veilige eerste synchronisatie.</p>
            </div>
            <StatusPill label="Controleerbaar" tone="info" />
          </div>
          <Timeline ariaLabel="Device lifecycle stappen" items={deviceLifecycle} />
        </section>
      </section>
    </>
  );
}
