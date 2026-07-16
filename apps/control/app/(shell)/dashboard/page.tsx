import Link from "next/link";

import { MetricCard, PageHeader, StatusPill } from "../_components/shell-primitives";

const tenantMetrics = [
  {
    detail: "Drie schermen missen een recente heartbeat.",
    label: "Actieve schermen",
    tone: "warning",
    value: "128"
  },
  {
    detail: "Volgende publicatie wacht op eindcontrole.",
    label: "Playlists live",
    tone: "success",
    value: "18"
  },
  {
    detail: "Nieuwe media klaar voor playlistdrafts.",
    label: "Media-items",
    tone: "info",
    value: "642"
  }
] as const;

const releaseTasks = [
  ["Zomerroute playlist", "Wacht op goedkeuring", "Vandaag 16:00"],
  ["Entree schermen", "Planning compleet", "Morgen 09:00"],
  ["Noodbericht template", "Controleer fallbackcopy", "Open"]
] as const;

export default function DashboardPage() {
  return (
    <>
      <PageHeader
        actions={
          <>
            <Link className="button-link button-link--secondary" href="/dashboard/media">
              Media beheren
            </Link>
            <Link className="button-link button-link--primary" href="/dashboard/playlists">
              Playlist review
            </Link>
          </>
        }
        description="Tenantoperators krijgen een compact overzicht van schermstatus, releasewerk en open acties. De cijfers zijn foundationfixtures totdat de domeindata landt."
        eyebrow="Tenant"
        status={{ label: "Tenantcontext actief", tone: "success" }}
        title="Dashboard"
      />

      <section className="metric-grid" aria-label="Tenantmetingen">
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

      <section className="work-grid">
        <article className="work-panel">
          <div className="work-panel__header">
            <div>
              <h2 className="work-panel__title">Releasewerk</h2>
              <p className="work-panel__meta">
                Vooruitblik op contentpublicaties
              </p>
            </div>
            <StatusPill label="S05 domein" tone="neutral" />
          </div>
          <ul className="task-list">
            {releaseTasks.map(([title, description, due]) => (
              <li className="task-item" key={title}>
                <span className="task-item__copy">
                  <span className="task-item__title">{title}</span>
                  <span className="work-panel__meta">{description}</span>
                </span>
                <StatusPill label={due} tone={due === "Open" ? "warning" : "info"} />
              </li>
            ))}
          </ul>
        </article>

        <article className="work-panel">
          <div className="work-panel__header">
            <div>
              <h2 className="work-panel__title">Open acties</h2>
              <p className="work-panel__meta">Snel scannen, niet decoratief</p>
            </div>
            <StatusPill label="3 acties" tone="warning" />
          </div>
          <p className="page-description">
            Media-import is nu voorbereid met upload- en verwerkingstatussen.
            Playlistdrafts hebben nu een publish-review en immutable releases.
            Pairing krijgt een eigen workflow in de volgende sprint.
          </p>
        </article>
      </section>
    </>
  );
}
