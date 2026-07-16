import Link from "next/link";

import { MetricCard, PageHeader, StatusPill } from "../../_components/shell-primitives";

const playlistMetrics = [
  {
    detail: "Bewerkbare playlists met nog ongepubliceerde wijzigingen.",
    label: "Concepten",
    tone: "info",
    value: "4"
  },
  {
    detail: "Laatste publicatie heeft een vaste manifest-hash.",
    label: "Releases",
    tone: "success",
    value: "12"
  },
  {
    detail: "Mist ready media of een player-variant.",
    label: "Review blokkade",
    tone: "warning",
    value: "1"
  }
] as const;

const draftItems = [
  ["Zomerroute poster", "Afbeelding", "12s", "contain", "Gereed", "success"],
  ["Welkom loop", "Video", "45s", "cover", "1080p variant", "success"],
  ["Sponsor slide", "Afbeelding", "10s", "contain", "Nog verwerken", "warning"]
] as const;

const reviewChecks = [
  ["Minimaal 1 item", "3 items", "success"],
  ["Alle media gereed", "1 blokkade", "warning"],
  ["Player-variant beschikbaar", "Video gereed", "success"],
  ["Immutable release", "Snapshot bij publish", "success"]
] as const;

const releases = [
  {
    hash: "7f9a...c21b",
    items: "8 items",
    label: "Zomerroute v3",
    publishedAt: "Vandaag 13:12",
    status: "Actief",
    tone: "success"
  },
  {
    hash: "31bd...9a04",
    items: "7 items",
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
        description="Playlistdrafts blijven bewerkbaar. Publiceren maakt een vaste release met manifest-hash en item-snapshots voor de player."
        eyebrow="Tenantcontent"
        status={{ label: "Publish review actief", tone: "success" }}
        title="Playlists"
      />

      <section className="metric-grid" aria-label="Playlistmetingen">
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

      <section className="work-grid">
        <article className="work-panel">
          <div className="work-panel__header">
            <div>
              <h2 className="work-panel__title">Draft editor</h2>
              <p className="work-panel__meta">Zomerroute playlist</p>
            </div>
            <StatusPill label="Bewerkbaar" tone="info" />
          </div>
          <form className="playlist-form">
            <div className="field">
              <label htmlFor="playlist-name">Playlistnaam</label>
              <input
                id="playlist-name"
                name="playlist-name"
                readOnly
                type="text"
                value="Zomerroute"
              />
            </div>
            <div className="data-table-frame">
              <table className="data-table">
                <caption>Draftvolgorde voor publish review.</caption>
                <thead>
                  <tr>
                    <th scope="col">Item</th>
                    <th scope="col">Type</th>
                    <th scope="col">Duur</th>
                    <th scope="col">Fit</th>
                    <th scope="col">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {draftItems.map(([title, type, duration, fit, status, tone]) => (
                    <tr key={title}>
                      <td>{title}</td>
                      <td>{type}</td>
                      <td>{duration}</td>
                      <td>{fit}</td>
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

        <article className="work-panel" aria-labelledby="publish-review-title">
          <div className="work-panel__header">
            <div>
              <h2 className="work-panel__title" id="publish-review-title">
                Publish review
              </h2>
              <p className="work-panel__meta">public.review_playlist_publish</p>
            </div>
            <StatusPill label="Niet klaar" tone="warning" />
          </div>
          <ul className="settings-list">
            {reviewChecks.map(([label, value, tone]) => (
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
            Oorzaak: Sponsor slide is nog niet ready. Effect: publish blijft
            geblokkeerd. Herstel: wacht op media processing of verwijder het
            item uit de draft.
          </div>
        </article>
      </section>

      <section className="work-panel" aria-labelledby="release-history-title">
        <div className="work-panel__header">
          <div>
            <h2 className="work-panel__title" id="release-history-title">
              Releasehistorie
            </h2>
            <p className="work-panel__meta">Immutable manifesten per versie</p>
          </div>
          <StatusPill label="2 releases" tone="neutral" />
        </div>
        <div className="release-card-grid">
          {releases.map((release) => (
            <article className="release-card" key={release.label}>
              <div className="work-panel__header">
                <div>
                  <h3 className="release-card__title">{release.label}</h3>
                  <p className="work-panel__meta">{release.publishedAt}</p>
                </div>
                <StatusPill label={release.status} tone={release.tone} />
              </div>
              <dl className="release-card__meta">
                <div>
                  <dt>Manifest</dt>
                  <dd>{release.hash}</dd>
                </div>
                <div>
                  <dt>Snapshot</dt>
                  <dd>{release.items}</dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
