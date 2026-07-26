import { hasCapability } from "@veyocast/auth";
import { Button, DataTable, PageHeader, StatusPill } from "@veyocast/ui";

import { requireTenantControlSession } from "../../../../lib/control-session";
import { loadTenantSupport } from "./data";
import { NewTicketDialog } from "./new-ticket-dialog";

export default async function SupportPage() {
  const session = await requireTenantControlSession("tenant.ticket.read");
  const data = session.tenantId
    ? await loadTenantSupport(session.tenantId)
    : { departments: [], tickets: [] };
  const canWrite = session.isLive && hasCapability(session.capabilities, "tenant.ticket.write");
  const canExportSupport =
    session.isLive && hasCapability(session.capabilities, "tenant.support.export");
  return (
    <>
      <PageHeader
        actions={canWrite ? <NewTicketDialog departments={data.departments} /> : null}
        description="Stel een vraag en volg ieder antwoord onder één herkenbaar ticketnummer."
        eyebrow={session.tenant}
        title="Support"
      />
      <section className="workspace-section" aria-labelledby="tickets-title">
          <div className="workspace-section__header">
            <div>
              <h2 className="workspace-section__title" id="tickets-title">Mijn tickets</h2>
              <p className="work-panel__meta">Nieuwste reactie staat bovenaan.</p>
            </div>
            <StatusPill label={`${data.tickets.length} tickets`} tone="neutral" />
          </div>
          <DataTable caption="Supporttickets van de actieve vereniging.">
            <thead><tr><th>Ticket</th><th>Afdeling</th><th>Status</th><th>Bijgewerkt</th></tr></thead>
            <tbody>
              {data.tickets.map((ticket) => (
                <tr key={ticket.id}>
                  <td><a className="table-primary" href={`/dashboard/support/${ticket.id}`}>VYO-{new Date().getFullYear()}-{String(ticket.ticket_number).padStart(6, "0")} · {ticket.subject}</a></td>
                  <td>{relationName(ticket.support_departments)}</td>
                  <td><StatusPill label={statusLabel(ticket.status)} tone={ticket.status === "resolved" || ticket.status === "closed" ? "success" : "info"} /></td>
                  <td>{formatDate(ticket.last_message_at)}</td>
                </tr>
              ))}
            </tbody>
          </DataTable>
          {!data.tickets.length ? <p className="work-panel__meta">Nog geen tickets.</p> : null}
      </section>

      <section className="data-surface support-export" aria-labelledby="support-export-title">
        <div className="work-panel__header">
          <div>
            <h2 className="work-panel__title" id="support-export-title">Veilige supportbundel</h2>
            <p className="work-panel__meta">
              Exporteert een privacyveilige diagnose over de laatste 24 uur. Tokens, persoonsgegevens,
              credentialhashes, URL&apos;s en ruwe logs worden nooit opgenomen.
            </p>
          </div>
          <StatusPill label="Allowlist" tone="success" />
        </div>
        <div className="support-export__actions">
          {canExportSupport ? (
            <form action="/api/support-bundle" method="post">
              <Button type="submit" variant="secondary">Supportbundel downloaden</Button>
            </form>
          ) : <Button disabled type="button" variant="secondary">Geen exportrechten</Button>}
          <p className="work-panel__meta">Elke geslaagde export wordt append-only geaudit.</p>
        </div>
      </section>
    </>
  );
}

export function relationName(value: unknown) {
  const item = Array.isArray(value) ? value[0] : value;
  return item && typeof item === "object" && "name" in item
    ? String(item.name)
    : "—";
}
export function statusLabel(status: string) {
  return ({ open: "Open", in_progress: "In behandeling", waiting_for_customer: "Wacht op klant", resolved: "Opgelost", closed: "Gesloten" } as Record<string, string>)[status] ?? status;
}
export function formatDate(value: string) {
  return new Intl.DateTimeFormat("nl-NL", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}
