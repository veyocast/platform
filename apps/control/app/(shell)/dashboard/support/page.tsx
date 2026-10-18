import sites from "../settings/sites-settings.module.css";

import { hasCapability } from "@veyocast/auth";
import { Button, StatusPill } from "@veyocast/ui";

import { requireTenantControlSession } from "../../../../lib/control-session";
import { loadTenantSupport } from "./data";
import { NewTicketDialog } from "./new-ticket-dialog";
import { SyncTicketList } from "./sync-ticket-list";
import { CheckCircle, LifeBuoy, MessagesSquare } from "lucide-react";

export default async function SupportPage() {
  const session = await requireTenantControlSession("tenant.ticket.read");
  const data = session.tenantId
    ? await loadTenantSupport(session.tenantId)
    : { departments: [], tickets: [], error: false };
  const canWrite = session.isLive && hasCapability(session.capabilities, "tenant.ticket.write");
  const canExportSupport =
    session.isLive && hasCapability(session.capabilities, "tenant.support.export");
  return (
    <div className="admin-page">
      <header className="section-header"><div><div className="eyebrow">HELP / SUPPORT</div><h1>We helpen je verder.</h1><p>Eén gesprek, alle informatie en een duidelijke verantwoordelijke.</p></div><div className="header-actions">{canWrite ? <NewTicketDialog departments={data.departments} /> : <button className="btn btn-secondary" disabled type="button">Nieuw ticket</button>}</div></header>
      {data.error ? <p className="notice notice--critical" role="alert">De supportgegevens konden niet veilig worden gelezen. Er is niets gewijzigd. Vernieuw de pagina of probeer later opnieuw.</p> : null}
      <div className="grid-3">{[{ label: "Open tickets", count: data.tickets.filter(ticket => ticket.status === "open").length, Icon: LifeBuoy }, { label: "In behandeling", count: data.tickets.filter(ticket => ["in_progress", "waiting_for_customer"].includes(ticket.status)).length, Icon: MessagesSquare }, { label: "Opgelost", count: data.tickets.filter(ticket => ["resolved", "closed"].includes(ticket.status)).length, Icon: CheckCircle }].map(({ label, count, Icon }) => <div className="card ad-metric" key={label}><span className="ad-square"><Icon size={18} /></span><span className="muted">{label}</span><strong>{data.error ? "—" : count}</strong></div>)}</div>
      <SyncTicketList tickets={data.tickets} unavailable={data.error} />

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
