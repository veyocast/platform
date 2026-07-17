import Link from "next/link";

import {
  HealthList,
  MetricCard,
  PageHeader,
  StatusPill,
  Timeline
} from "../../_components/shell-primitives";

const playlistMetrics = [
  {
    detail: "Concepten met niet-gepubliceerde wijzigingen.",
    label: "Concepten",
    tone: "info",
    value: "4"
  },
  {
    detail: "Versies die op minstens één scherm actief zijn.",
    label: "Gepubliceerd",
    tone: "success",
    value: "8"
  },
  {
    detail: "Eén asset heeft nog geen player-variant.",
    label: "Reviewblokkades",
    tone: "warning",
    value: "1"
  }
] as const;

const playlists = [
  {
    assignment: "3 schermen",
    duration: "01:07",
    items: "8 items",
    lastPublished: "Vandaag 13:12",
    name: "Zomerroute",
    status: "Concept gewijzigd",
    tone: "info"
  },
  {
    assignment: "2 schermen",
    duration: "04:22",
    items: "12 items",
    lastPublished: "Gisteren 18:40",
    name: "Kantineprogramma",
    status: "Gepubliceerd",
    tone: "success"
  },
  {
    assignment: "1 scherm",
    duration: "00:40",
    items: "4 items",
    lastPublished: "Nog niet gepubliceerd",
    name: "Sponsorwand",
    status: "Review nodig",
    tone: "warning"
  }
] as const;

const reviewChecks = [
  {
    detail: "De playlist bevat voldoende afspeelbare items.",
    label: "Minimaal één item",
    status: "3 items",
    tone: "success"
  },
  {
    detail: "Sponsor slide wacht nog op een player-variant.",
    label: "Alle media gereed",
    status: "1 blokkade",
    tone: "warning"
  },
  {
    detail: "De video heeft een veilige 1080p-variant.",
    label: "Player-variant beschikbaar",
    status: "Gereed",
    tone: "success"
  },
  {
    detail: "Publiceren maakt een vaste snapshot met manifest-hash.",
    label: "Immutable release",
    status: "Bevestigd",
    tone: "success"
  }
] as const;

const publishTimeline = [
  {
    detail: "Je past de volgorde en duur van items aan in het concept.",
    label: "Concept bewerken",
    meta: "Open",
    tone: "info"
  },
  {
    detail: "Castivo controleert gereede media, varianten en rechten.",
    label: "Publicatiereview",
    meta: "Blokkeert",
    tone: "warning"
  },
  {
    detail: "Een nieuwe release krijgt vaste item-snapshots en een manifest-hash.",
    label: "Release maken",
    meta: "Wacht",
    tone: "neutral"
  },
  {
    detail: "De player downloadt en verifieert de release voor de wissel.",
    label: "Player bijwerken",
    meta: "Atomair",
    tone: "success"
  }
] as const;

const releases = [
  {
    by: "Daan Operator",
    items: "8 items · 112 MB",
    label: "Zomerroute v3",
    publishedAt: "Vandaag 13:12",
    status: "Actief",
    tone: "success"
  },
  {
    by: "Mira Vos",
    items: "7 items · 96 MB",
    label: "Zomerroute v2",
    publishedAt: "Gisteren 18:40",
    status: "Vervangen",
    tone: "neutral"
  }
] as const;

export default function PlaylistsPage() {
  return (
    <>
      <PageHeader
        actions={
          <>
            <Link className="button-link button-link--secondary" href="/dashboard/media">
              Media openen
            </Link>
            <button className="button-link button-link--primary" disabled type="button">
              Publiceren
            </button>
          </>
        }
        description="Werk in concepten en publiceer alleen een volledige, onveranderlijke release. Je ziet vooraf welk scherm geraakt wordt en wat er nog ontbreekt."
        eyebrow="Museumkwartier"
        status={{ label: "Publicatiereview actief", tone: "success" }}
        title="Playlists"
      />

      <section className="metric-grid" aria-label="Playlistoverzicht">
        {playlistMetrics.map((metric) => (
          <MetricCard
            detail={metric.detail}
            key={metric.label}
            label={metric.label}
            tone={metric.tone}
            value={metric.value}
          />
        ))}
      </section>

      <section className="resource-toolbar" aria-label="Playlists bedienen">
        <div className="resource-toolbar__group">
          <input
            aria-label="Zoeken in playlists"
            className="toolbar-search"
            name="playlist-search"
            placeholder="Zoeken op playlistnaam"
            type="search"
          />
          <select aria-label="Filter playlists op status" className="toolbar-select" defaultValue="all">
            <option value="all">Alle statussen</option>
            <option value="draft">Concept</option>
            <option value="published">Gepubliceerd</option>
            <option value="review">Review nodig</option>
          </select>
        </div>
        <p className="resource-toolbar__summary">12 playlists · sortering: laatst gewijzigd</p>
      </section>

      <section className="playlist-workspace">
        <section className="workspace-section" aria-labelledby="playlist-list-title">
          <div className="workspace-section__header">
            <div>
              <h2 className="workspace-section__title" id="playlist-list-title">
                Playlists
              </h2>
              <p className="work-panel__meta">Concepten en gepubliceerde releases blijven duidelijk gescheiden.</p>
            </div>
            <StatusPill label="12 totaal" tone="neutral" />
          </div>
          <div className="data-table-frame">
            <table className="data-table data-table--responsive">
              <caption>Playlists binnen de actieve vereniging.</caption>
              <thead>
                <tr>
                  <th scope="col">Playlist</th>
                  <th scope="col">Status</th>
                  <th scope="col">Inhoud</th>
                  <th scope="col">Schermen</th>
                  <th scope="col">Laatste publicatie</th>
                  <th scope="col">Actie</th>
                </tr>
              </thead>
              <tbody>
                {playlists.map((playlist) => (
                  <tr key={playlist.name}>
                    <td data-label="Playlist">
                      <span className="table-primary">{playlist.name}</span>
                      <span className="table-secondary">{playlist.duration}</span>
                    </td>
                    <td data-label="Status">
                      <StatusPill label={playlist.status} tone={playlist.tone} />
                    </td>
                    <td data-label="Inhoud">{playlist.items}</td>
                    <td data-label="Schermen">{playlist.assignment}</td>
                    <td data-label="Laatste publicatie">{playlist.lastPublished}</td>
                    <td data-label="Actie">
                      <button className="table-action" type="button">
                        Openen
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="workspace-aside" aria-label="Playlistinstellingen en publicatiereview">
          <section className="inspector-panel" aria-labelledby="playlist-inspector-title">
            <div className="work-panel__header">
              <div>
                <h2 className="work-panel__title" id="playlist-inspector-title">
                  Conceptdetails
                </h2>
                <p className="work-panel__meta">Zomerroute</p>
              </div>
              <StatusPill label="Opgeslagen" tone="success" />
            </div>
            <form className="playlist-form">
              <div className="field">
                <label htmlFor="playlist-name">Playlistnaam</label>
                <input id="playlist-name" name="playlist-name" readOnly type="text" value="Zomerroute" />
              </div>
              <dl className="meta-list">
                <div>
                  <dt>Items</dt>
                  <dd>3 in concept</dd>
                </div>
                <div>
                  <dt>Totale duur</dt>
                  <dd>01:07</dd>
                </div>
                <div>
                  <dt>Toegewezen schermen</dt>
                  <dd>Entree links, Kantine hoofdscherm</dd>
                </div>
              </dl>
            </form>
          </section>

          <section className="data-surface" aria-labelledby="publish-review-title">
            <div className="work-panel__header">
              <div>
                <h2 className="work-panel__title" id="publish-review-title">
                  Publicatiereview
                </h2>
                <p className="work-panel__meta">Versie 4 wordt pas gemaakt na een volledige controle.</p>
              </div>
              <StatusPill label="Niet klaar" tone="warning" />
            </div>
            <HealthList ariaLabel="Publicatiereview controles" items={reviewChecks} />
            <p className="notice notice--warning" role="status">
              Sponsor slide is nog niet gereed. De publicatie blijft geblokkeerd
              totdat de player-variant beschikbaar is of je het item verwijdert.
            </p>
          </section>
        </aside>
      </section>

      <section className="work-grid">
        <section className="data-surface" aria-labelledby="publish-timeline-title">
          <div className="work-panel__header">
            <div>
              <h2 className="work-panel__title" id="publish-timeline-title">
                Publicatietijdlijn
              </h2>
              <p className="work-panel__meta">Van concept naar een atomair bijgewerkte player.</p>
            </div>
            <StatusPill label="Immutable" tone="success" />
          </div>
          <Timeline ariaLabel="Playlist publicatietijdlijn" items={publishTimeline} />
        </section>

        <section className="data-surface" aria-labelledby="release-history-title">
          <div className="work-panel__header">
            <div>
              <h2 className="work-panel__title" id="release-history-title">
                Recente releases
              </h2>
              <p className="work-panel__meta">Historie blijft onveranderlijk.</p>
            </div>
            <StatusPill label="2 versies" tone="neutral" />
          </div>
          <ul className="settings-list">
            {releases.map((release) => (
              <li className="settings-item" key={release.label}>
                <span className="settings-item__copy">
                  <span className="settings-item__title">{release.label}</span>
                  <span className="work-panel__meta">
                    {release.publishedAt} · {release.by} · {release.items}
                  </span>
                </span>
                <StatusPill label={release.status} tone={release.tone} />
              </li>
            ))}
          </ul>
        </section>
      </section>
    </>
  );
}
