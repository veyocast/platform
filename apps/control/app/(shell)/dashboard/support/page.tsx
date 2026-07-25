import { Button, DataTable, PageHeader, StatusPill } from "@veyocast/ui";

import { requireTenantControlSession } from "../../../../lib/control-session";
import { createSupportTicket } from "./actions";
import { loadTenantSupport } from "./data";
import styles from "./support.module.css";

export default async function SupportPage() {
  const session = await requireTenantControlSession("tenant.ticket.read");
  const data = session.tenantId
    ? await loadTenantSupport(session.tenantId)
    : { departments: [], tickets: [] };
  return (
    <>
      <PageHeader
        description="Stel een vraag en volg ieder antwoord onder één herkenbaar ticketnummer."
        eyebrow={session.tenant}
        title="Support"
      />
      <div className={styles.layout}>
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
        <section className="workspace-section" aria-labelledby="new-ticket-title">
          <div className="workspace-section__header">
            <div>
              <h2 className="workspace-section__title" id="new-ticket-title">Nieuw ticket</h2>
              <p className="work-panel__meta">Kies de juiste afdeling voor een snellere behandeling.</p>
            </div>
          </div>
          <form action={createSupportTicket} className={styles.form}>
            <label><span>Afdeling</span><select name="departmentId" required>{data.departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select></label>
            <label><span>Prioriteit</span><select defaultValue="normal" name="priority"><option value="low">Laag</option><option value="normal">Normaal</option><option value="high">Hoog</option><option value="urgent">Urgent</option></select></label>
            <label className={styles.wide}><span>Onderwerp</span><input maxLength={160} name="subject" required /></label>
            <label className={styles.wide}><span>Bericht</span><textarea maxLength={10000} name="body" required rows={7} /></label>
            <label className={styles.checkbox}><input name="sensitive" type="checkbox" /> Bevat gevoelige inhoud; beperk inzage</label>
            <Button type="submit">Ticket versturen</Button>
          </form>
        </section>
      </div>
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

