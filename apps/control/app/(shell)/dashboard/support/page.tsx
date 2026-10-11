import Link from "next/link";
import { ArrowRight, Clock3, Monitor, Palette } from "lucide-react";
import sites from "../settings/sites-settings.module.css";

import { hasCapability } from "@veyocast/auth";
import { Button, DataTable, StatusPill } from "@veyocast/ui";

import { requireTenantControlSession } from "../../../../lib/control-session";
import { loadTenantSupport } from "./data";
import { NewTicketDialog } from "./new-ticket-dialog";
import { formatDate, relationName, statusLabel } from "./support-format";

export default async function SupportPage() {
  const session = await requireTenantControlSession("tenant.ticket.read");
  const data = session.tenantId
    ? await loadTenantSupport(session.tenantId)
    : { departments: [], tickets: [] };
  const canWrite = session.isLive && hasCapability(session.capabilities, "tenant.ticket.write");
  const canExportSupport =
    session.isLive && hasCapability(session.capabilities, "tenant.support.export");
  return (
    <div className={`${sites.page} ${sites.supportPage}`}>
      <h1 className="sr-only">Support</h1>
      {canWrite ? <header className={sites.actionHeading}><NewTicketDialog departments={data.departments} /></header> : null}
      <div className={sites.helpCards}>{[{title:"Content maken",description:"Van een idee naar een slide.",path:"/dashboard/studio",Icon:Palette},{title:"Schermen koppelen",description:"Geef ieder scherm zijn plek.",path:"/dashboard/screens",Icon:Monitor},{title:"Planning beheren",description:"Op het juiste moment in beeld.",path:"/dashboard/planning",Icon:Clock3}].map(({title,description,path,Icon})=><Link href={path} key={path}><Icon aria-hidden="true" size={23}/><strong>{title}</strong><span>{description}</span><ArrowRight aria-hidden="true" size={17}/></Link>)}</div>
      <section className={`${sites.surface} workspace-section`} aria-labelledby="tickets-title">
          <div className={sites.surfaceHeading}>
            <h2 id="tickets-title">Mijn tickets</h2>
            <p>De tickets hieronder zijn van jouw vereniging. Nieuwe tickets worden veilig opgeslagen.</p>
          </div>
          <DataTable caption="Supporttickets van de actieve vereniging.">
            <thead><tr><th scope="col">Ticket</th><th scope="col">Afdeling</th><th scope="col">Status</th><th scope="col"><span className="sr-only">Acties</span></th></tr></thead>
            <tbody>
              {data.tickets.map((ticket) => (
                <tr key={ticket.id}>
                  <td><a className={sites.textButton} href={`/dashboard/support/${ticket.id}`}><small>VYO-{new Date().getFullYear()}-{String(ticket.ticket_number).padStart(6, "0")}</small><strong>{ticket.subject}</strong></a></td>
                  <td>{relationName(ticket.support_departments)}</td>
                  <td><StatusPill label={statusLabel(ticket.status)} tone={ticket.status === "resolved" || ticket.status === "closed" ? "success" : "info"} /></td>
                  <td><Link aria-label={`Open ${ticket.subject}`} className={sites.iconButton} href={`/dashboard/support/${ticket.id}`} title={`Bijgewerkt ${formatDate(ticket.last_message_at)}`}><ArrowRight aria-hidden="true" size={17} /></Link></td>
                </tr>
              ))}
            </tbody>
          </DataTable>
          {!data.tickets.length ? <p className="work-panel__meta">Nog geen tickets.</p> : null}
      </section>

      <details className={sites.supportDetails}><summary>Veilige supportbundel</summary><section className={`${sites.surface} support-export`} aria-labelledby="support-export-title">
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
      </section></details>
    </div>
  );
}
