import { DataTable, PageHeader, StatusPill } from "@veyocast/ui";
import Link from "next/link";

import { requireControlCapability } from "../../../../lib/control-session";
import { loadPlatformSupport } from "../../dashboard/support/data";
import { formatDate, relationName, statusLabel } from "../../dashboard/support/support-format";

export default async function PlatformSupportPage() {
  await requireControlCapability("platform.ticket.read");
  const data = await loadPlatformSupport();
  const attention = data.tickets.filter((ticket) => ["open", "in_progress"].includes(ticket.status)).length;
  return (
    <>
      <PageHeader
        actions={<Link className="button-link button-link--secondary" href="/platform/support/settings">Afdelingen en rollen</Link>}
        description="Eén rustige inbox voor klantvragen, gevoelige inhoud en overdracht tussen afdelingen."
        eyebrow="Platform"
        status={attention ? { label: `${attention} actie nodig`, tone: "warning" } : { label: "Inbox bijgewerkt", tone: "success" }}
        title="Supportdesk"
      />
      <section className="workspace-section">
        <DataTable caption="Platformbrede supporttickets.">
          <thead><tr><th>Ticket</th><th>Tenant</th><th>Afdeling</th><th>Status</th><th>Behandelaar</th><th>Bijgewerkt</th></tr></thead>
          <tbody>{data.tickets.map((ticket) => (
            <tr key={ticket.id}>
              <td><a className="table-primary" href={`/platform/support/${ticket.id}`}>VYO-{new Date(ticket.last_message_at).getFullYear()}-{String(ticket.ticket_number).padStart(6, "0")} · {ticket.subject}</a>{ticket.sensitive ? <span className="table-secondary">Beperkte inzage</span> : null}</td>
              <td>{relationName(ticket.tenants)}</td>
              <td>{relationName(ticket.support_departments)}</td>
              <td><StatusPill label={statusLabel(ticket.status)} tone={ticket.status === "closed" ? "success" : "info"} /></td>
              <td>{relationName(ticket.profiles)}</td>
              <td>{formatDate(ticket.last_message_at)}</td>
            </tr>
          ))}</tbody>
        </DataTable>
      </section>
    </>
  );
}
