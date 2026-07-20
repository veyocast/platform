import { DataTable, PageHeader, ResourceState, StatusPill } from "@veyocast/ui";

import { requireTenantControlSession } from "../../../../lib/control-session";
import { loadTenantAuditEvents } from "../../../../lib/control-overview";

export default async function AuditLogPage() {
  const session = await requireTenantControlSession("tenant.audit.read");
  const data = session.isLive
    ? await loadTenantAuditEvents(session.tenantId!)
    : { error: false, events: demoEvents };

  return (
    <>
      <PageHeader
        description="Het append-only beveiligingsspoor binnen de actieve vereniging."
        eyebrow={session.tenant}
        status={{
          label: session.isLive ? "Live tenantdata" : "Demodata",
          tone: session.isLive ? "success" : "warning"
        }}
        title="Auditlog"
      />
      {!session.isLive ? (
        <p className="notice notice--warning" role="status">
          Deze gebeurtenissen zijn uitsluitend lokale fixtures.
        </p>
      ) : null}
      <section className="workspace-section" aria-labelledby="audit-table-title">
        <div className="workspace-section__header">
          <div>
            <h2 className="workspace-section__title" id="audit-table-title">
              Recente gebeurtenissen
            </h2>
            <p className="work-panel__meta">
              Acties kunnen hier niet worden gewijzigd of verwijderd.
            </p>
          </div>
          <StatusPill label={`${data.events.length} gebeurtenissen`} tone="neutral" />
        </div>
        {data.error ? (
          <ResourceState
            action={<a href="/dashboard/auditlog">Opnieuw proberen</a>}
            kind="error"
            title="Auditlog niet beschikbaar"
          >
            De gebeurtenissen konden niet veilig worden geladen. Probeer de auditlog opnieuw te
            openen.
          </ResourceState>
        ) : data.events.length ? (
          <DataTable caption="Gebeurtenissen binnen de actieve vereniging.">
            <thead>
              <tr>
                <th scope="col">Tijd</th>
                <th scope="col">Actie</th>
                <th scope="col">Doel</th>
                <th scope="col">Actor</th>
                <th scope="col">Resultaat</th>
              </tr>
            </thead>
            <tbody>
              {data.events.map((event) => (
                <tr key={event.id}>
                  <td data-label="Tijd">
                    <span className="table-primary">{formatDate(event.created_at)}</span>
                  </td>
                  <td data-label="Actie">{humanize(event.action)}</td>
                  <td data-label="Doel">
                    {event.target_type}
                    {event.target_id ? ` · ${event.target_id.slice(0, 8)}` : ""}
                  </td>
                  <td data-label="Actor">
                    {event.actor_user_id
                      ? `Gebruiker ${event.actor_user_id.slice(0, 8)}`
                      : "Systeem"}
                  </td>
                  <td data-label="Resultaat">
                    <StatusPill
                      label={event.result === "success" ? "Geslaagd" : "Mislukt"}
                      tone={event.result === "success" ? "success" : "critical"}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        ) : (
          <ResourceState kind="empty" title="Nog geen auditgebeurtenissen">
            Nieuwe beveiligingsgebeurtenissen verschijnen hier automatisch.
          </ResourceState>
        )}
      </section>
    </>
  );
}

const demoEvents = [
  {
    action: "demo.opened",
    actor_user_id: "demo-admin",
    created_at: "2026-07-19T08:24:00.000Z",
    id: "demo-event",
    result: "success",
    target_id: null,
    target_type: "development_fixture"
  }
];

function humanize(value: string) {
  return value.replaceAll(".", " ").replaceAll("_", " ");
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("nl-NL", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}
