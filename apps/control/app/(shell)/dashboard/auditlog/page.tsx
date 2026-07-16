import { PageHeader, StatusPill } from "../../_components/shell-primitives";

const auditEvents = [
  ["Vandaag 10:24", "Playlist bijgewerkt", "Omar Smits", "Concept"],
  ["Vandaag 09:12", "Invite aangemaakt", "Mira Vos", "Team"],
  ["Gisteren 17:48", "Tenantinstelling gewijzigd", "Mira Vos", "Settings"]
] as const;

export default function AuditLogPage() {
  return (
    <>
      <PageHeader
        description="Het auditlog toont straks tenant- en platformacties met actor, object en resultaat. De route staat klaar voor read-only, RLS-gefilterde events."
        eyebrow="Beveiliging"
        status={{ label: "Read-only patroon", tone: "success" }}
        title="Auditlog"
      />

      <section className="work-panel" aria-labelledby="audit-table-title">
        <div className="work-panel__header">
          <div>
            <h2 className="work-panel__title" id="audit-table-title">
              Recente events
            </h2>
            <p className="work-panel__meta">
              Filterchips zijn voorbereid voor latere queryparameters.
            </p>
          </div>
          <div className="filter-row" aria-label="Auditfilters">
            <StatusPill label="Alle" tone="info" />
            <StatusPill label="Team" tone="neutral" />
            <StatusPill label="Content" tone="neutral" />
          </div>
        </div>
        <div className="data-table-frame">
          <table className="data-table">
            <caption>Auditgebeurtenissen binnen de actieve tenant.</caption>
            <thead>
              <tr>
                <th scope="col">Tijd</th>
                <th scope="col">Actie</th>
                <th scope="col">Actor</th>
                <th scope="col">Domein</th>
              </tr>
            </thead>
            <tbody>
              {auditEvents.map(([time, action, actor, domain]) => (
                <tr key={`${time}-${action}`}>
                  <td>{time}</td>
                  <td>{action}</td>
                  <td>{actor}</td>
                  <td>{domain}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
