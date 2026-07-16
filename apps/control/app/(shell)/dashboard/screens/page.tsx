import Link from "next/link";

import { MetricCard, PageHeader, StatusPill } from "../../_components/shell-primitives";

const screenMetrics = [
  {
    detail: "Actieve schermen met een toegewezen player device.",
    label: "Gekoppeld",
    tone: "success",
    value: "14"
  },
  {
    detail: "Pairingcode is aangemaakt maar nog niet geclaimd.",
    label: "Wacht op pairing",
    tone: "warning",
    value: "2"
  },
  {
    detail: "Device is uitgeschakeld of sessie is ingetrokken.",
    label: "Aandacht",
    tone: "critical",
    value: "1"
  }
] as const;

const screenRows = [
  ["Entree links", "Clubhuis entree", "landscape", "Zomerroute v3", "paired", "success"],
  ["Kantine portrait", "Barwand", "portrait", "Entree v2", "pending", "warning"],
  ["Bestuurskamer", "Vergaderruimte", "landscape", "Geen release", "disabled", "critical"]
] as const;

const pairingChecks = [
  ["Code-hash", "SHA-256 opgeslagen", "success"],
  ["TTL", "10 minuten geldig", "info"],
  ["Claimrecht", "Tenantadmin vereist", "success"],
  ["Device token", "Alleen hash in database", "success"]
] as const;

const deviceCards = [
  {
    app: "Player PWA 0.1.0",
    lastSeen: "2 minuten geleden",
    name: "Entree player",
    screen: "Entree links",
    status: "paired",
    tone: "success"
  },
  {
    app: "Wacht op eerste boot",
    lastSeen: "Nog niet gezien",
    name: "Kantine player",
    screen: "Kantine portrait",
    status: "pending",
    tone: "warning"
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
              Pairing starten
            </button>
          </>
        }
        description="Schermen bepalen welke immutable release een player mag ophalen. Pairing maakt een revocable device session, zonder Supabase Auth-user voor de player."
        eyebrow="Tenantdevices"
        status={{ label: "Player is device", tone: "success" }}
        title="Schermen"
      />

      <section className="metric-grid" aria-label="Schermmetingen">
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

      <section className="work-grid">
        <article className="work-panel">
          <div className="work-panel__header">
            <div>
              <h2 className="work-panel__title">Schermbeheer</h2>
              <p className="work-panel__meta">Tenant-scoped screens</p>
            </div>
            <StatusPill label="RLS actief" tone="success" />
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
              <p>Tenantadmins maken schermen aan; viewers blijven read-only.</p>
            </div>
            <div className="data-table-frame">
              <table className="data-table">
                <caption>Schermen en device status.</caption>
                <thead>
                  <tr>
                    <th scope="col">Scherm</th>
                    <th scope="col">Locatie</th>
                    <th scope="col">Orientatie</th>
                    <th scope="col">Release</th>
                    <th scope="col">Device</th>
                  </tr>
                </thead>
                <tbody>
                  {screenRows.map(([screen, location, orientation, release, status, tone]) => (
                    <tr key={screen}>
                      <td>{screen}</td>
                      <td>{location}</td>
                      <td>{orientation}</td>
                      <td>{release}</td>
                      <td>
                        <StatusPill label={status} tone={tone} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </form>
        </article>

        <article className="work-panel" aria-labelledby="pairing-title">
          <div className="work-panel__header">
            <div>
              <h2 className="work-panel__title" id="pairing-title">
                Pairing
              </h2>
              <p className="work-panel__meta">Code vanaf player startscherm</p>
            </div>
            <StatusPill label="10 min" tone="info" />
          </div>
          <div className="pairing-code" aria-label="Pairingcode">
            CTV 482
          </div>
          <ul className="settings-list">
            {pairingChecks.map(([label, value, tone]) => (
              <li className="settings-item" key={label}>
                <span className="settings-item__copy">
                  <span className="settings-item__title">{label}</span>
                  <span className="work-panel__meta">{value}</span>
                </span>
                <StatusPill label={value} tone={tone} />
              </li>
            ))}
          </ul>
          <div className="notice" role="status">
            Oorzaak: echte player-tokenuitgifte volgt in de serverintegratie.
            Effect: pairingknop blijft read-only. Herstel: koppel deze UI aan
            `claim_pairing_session` zodra server actions landen.
          </div>
        </article>
      </section>

      <section className="work-panel" aria-labelledby="devices-title">
        <div className="work-panel__header">
          <div>
            <h2 className="work-panel__title" id="devices-title">
              Player devices
            </h2>
            <p className="work-panel__meta">Revocable sessions per scherm</p>
          </div>
          <StatusPill label="Geen Auth-users" tone="success" />
        </div>
        <div className="release-card-grid">
          {deviceCards.map((device) => (
            <article className="release-card" key={device.name}>
              <div className="work-panel__header">
                <div>
                  <h3 className="release-card__title">{device.name}</h3>
                  <p className="work-panel__meta">{device.screen}</p>
                </div>
                <StatusPill label={device.status} tone={device.tone} />
              </div>
              <dl className="release-card__meta">
                <div>
                  <dt>App</dt>
                  <dd>{device.app}</dd>
                </div>
                <div>
                  <dt>Laatste heartbeat</dt>
                  <dd>{device.lastSeen}</dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
