import { alertDefinitions, sloDefinitions } from "@veyocast/observability";
import { DataTable, PageHeader, StatusPill } from "@veyocast/ui";

import { requireControlCapability } from "../../../../lib/control-session";

export default async function PlatformSystemPage() {
  const session = await requireControlCapability("platform.system.read");

  return (
    <>
      <PageHeader
        description="Canonieke doelwaarden, kritieke alertdrempels en directe herstelroutes voor staging en productie. Deze pagina toont configuratie, geen gesimuleerde live metingen."
        eyebrow="Platform"
        status={!session.isLive
          ? { label: "Lokale contractpreview", tone: "warning" }
          : undefined}
        title="Systeem en herstel"
      />

      <section className="workspace-section" aria-labelledby="slo-title">
        <div className="workspace-section__header">
          <div>
            <h2 className="workspace-section__title" id="slo-title">Service level objectives</h2>
            <p className="work-panel__meta">Meetbare doelen; live burn-rate visualisatie wordt uitsluitend gevuld door echte telemetry.</p>
          </div>
          <StatusPill label={`${sloDefinitions.length} doelen`} tone="info" />
        </div>
        <DataTable caption="Canonieke SLO-doelwaarden.">
          <thead><tr><th scope="col">Journey</th><th scope="col">Doelwaarde</th><th scope="col">Objectief</th><th scope="col">Venster</th></tr></thead>
          <tbody>{sloDefinitions.map((slo) => <tr key={slo.id}>
            <td data-label="Journey"><span className="table-primary">{slo.description}</span><span className="table-secondary">{slo.id}</span></td>
            <td data-label="Doelwaarde">Binnen {formatDuration(slo.targetMs)}</td>
            <td data-label="Objectief">{Math.round(slo.objective * 100)}%</td>
            <td data-label="Venster">{slo.window}</td>
          </tr>)}</tbody>
        </DataTable>
      </section>

      <section className="workspace-section" aria-labelledby="alerts-title">
        <div className="workspace-section__header">
          <div>
            <h2 className="workspace-section__title" id="alerts-title">Kritieke alertcontracten</h2>
            <p className="work-panel__meta">Iedere drempel heeft een eigenaar, runbook en Control-deeplink.</p>
          </div>
          <StatusPill label={`${alertDefinitions.length} alerts`} tone="success" />
        </div>
        <DataTable caption="Alertdrempels en herstelroutes.">
          <thead><tr><th scope="col">Alert</th><th scope="col">Drempel</th><th scope="col">Eigenaar</th><th scope="col">Herstelcontext</th></tr></thead>
          <tbody>{alertDefinitions.map((alert) => <tr key={alert.id}>
            <td data-label="Alert"><span className="table-primary">{humanize(alert.id)}</span><span className="table-secondary">{alert.id}</span></td>
            <td data-label="Drempel">{alert.threshold.operator} {alert.threshold.value} {alert.threshold.unit} gedurende {alert.threshold.durationMinutes} min</td>
            <td data-label="Eigenaar">{alert.owner === "platform" ? "Platform operations" : "Product support"}</td>
            <td data-label="Herstelcontext"><a className="table-action" href={alert.controlPath}>Open Control</a><span className="table-secondary">{alert.runbook}</span></td>
          </tr>)}</tbody>
        </DataTable>
      </section>
    </>
  );
}

function formatDuration(milliseconds: number) {
  if (milliseconds < 60_000) return `${milliseconds / 1_000} sec`;
  return `${milliseconds / 60_000} min`;
}

function humanize(value: string) {
  return value.replaceAll("_", " ");
}
