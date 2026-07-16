import Link from "next/link";

import { MetricCard, PageHeader, StatusPill } from "../_components/shell-primitives";

const platformMetrics = [
  {
    detail: "Alle tenants reageren binnen de afgesproken health window.",
    label: "Tenantstatus",
    tone: "success",
    value: "12/12"
  },
  {
    detail: "Laatste foutloze publicatie: 11 minuten geleden.",
    label: "Release pipeline",
    tone: "success",
    value: "Groen"
  },
  {
    detail: "Twee tenants naderen hun opslaglimiet.",
    label: "Capaciteit",
    tone: "warning",
    value: "84%"
  }
] as const;

const serviceChecks = [
  ["Auth claims", "RLS-helperclaims worden server-side verwacht", "Voorbereid"],
  ["Media worker", "Queuecontract volgt in S05", "Placeholder"],
  ["Player sync", "Offline manifestcontract volgt in S06", "Placeholder"]
] as const;

export default function PlatformPage() {
  return (
    <>
      <PageHeader
        actions={
          <Link className="button-link button-link--primary" href="/platform/tenants">
            Tenants beheren
          </Link>
        }
        description="Platformrollen zien tenantstatus, servicechecks en foundation-waarschuwingen zonder tenantdata buiten RLS-context te mengen."
        eyebrow="Platform"
        status={{ label: "Platformadmin vereist", tone: "info" }}
        title="Platformoverzicht"
      />

      <section className="metric-grid" aria-label="Platformmetingen">
        {platformMetrics.map((metric) => (
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
              <h2 className="work-panel__title">Servicechecks</h2>
              <p className="work-panel__meta">Platformbrede afhankelijkheden</p>
            </div>
            <StatusPill label="S03 placeholder" tone="neutral" />
          </div>
          <div className="data-table-frame">
            <table className="data-table">
              <caption>Foundation checks voor de Control-shell.</caption>
              <thead>
                <tr>
                  <th scope="col">Check</th>
                  <th scope="col">Context</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {serviceChecks.map(([check, context, status]) => (
                  <tr key={check}>
                    <td>{check}</td>
                    <td>{context}</td>
                    <td>{status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <article className="work-panel">
          <div className="work-panel__header">
            <div>
              <h2 className="work-panel__title">Rolgrens</h2>
              <p className="work-panel__meta">Platform versus tenant</p>
            </div>
            <StatusPill label="RLS-first" tone="success" />
          </div>
          <p className="page-description">
            Platformnavigatie is gescheiden van tenantbeheer. De shell toont
            beide ontwikkelrollen, maar de echte sessieadapter moet per request
            server-side autorisatie bepalen.
          </p>
        </article>
      </section>
    </>
  );
}
