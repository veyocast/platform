import Link from "next/link";

import { MetricCard, PageHeader, StatusPill } from "../_components/shell-primitives";

const platformMetrics = [
  { detail: "Alle tenants reageren binnen de health window.", label: "Tenants op orde", tone: "success", value: "12/12" },
  { detail: "Laatste foutloze publicatie: 11 minuten geleden.", label: "Release pipeline", tone: "success", value: "Op orde" },
  { detail: "Twee tenants naderen hun opslaglimiet.", label: "Capaciteit", tone: "warning", value: "84%" }
] as const;

const serviceChecks = [
  ["Identiteit en rechten", "Server-side claims worden afgedwongen", "Op orde", "success"],
  ["Mediaverwerking", "Vier jobs wachten op verwerking", "Aandacht", "warning"],
  ["Players", "Alle actieve devices rapporteren een release", "Op orde", "success"]
] as const;

export default function PlatformPage() {
  return (
    <>
      <PageHeader
        actions={<Link className="button-link button-link--primary" href="/platform/tenants">Tenants beheren</Link>}
        description="Platformbeheer geeft een apart overzicht van tenantgezondheid, capaciteit en systeemafhankelijkheden zonder tenantinhoud te mengen."
        eyebrow="Platform"
        status={{ label: "Platformcontext actief", tone: "info" }}
        title="Platformoverzicht"
      />

      <section className="metric-grid" aria-label="Platformoverzicht">
        {platformMetrics.map((metric) => <MetricCard {...metric} key={metric.label} />)}
      </section>

      <section className="workspace-section" aria-labelledby="service-checks-title">
        <div className="workspace-section__header">
          <div>
            <h2 className="workspace-section__title" id="service-checks-title">Systeemstatus</h2>
            <p className="work-panel__meta">Operationele signalen over alle verenigingen.</p>
          </div>
          <StatusPill label="3 controles" tone="neutral" />
        </div>
        <div className="data-table-frame">
          <table className="data-table data-table--responsive">
            <caption>Platformbrede servicecontroles.</caption>
            <thead><tr><th scope="col">Controle</th><th scope="col">Context</th><th scope="col">Status</th></tr></thead>
            <tbody>
              {serviceChecks.map(([check, context, status, tone]) => (
                <tr key={check}>
                  <td data-label="Naam"><span className="table-primary">{check}</span></td>
                  <td data-label="Context">{context}</td>
                  <td data-label="Status"><StatusPill label={status} tone={tone} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
