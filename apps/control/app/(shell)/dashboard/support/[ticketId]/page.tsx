import { notFound } from "next/navigation";
import Link from "next/link";
import { Button, PageHeader, StatusPill } from "@veyocast/ui";

import { requireTenantControlSession } from "../../../../../lib/control-session";
import { addTicketMessage, deleteSupportTicket, uploadTicketAttachment } from "../actions";
import { loadSupportTicket } from "../data";
import { formatDate, relationName, statusLabel } from "../page";
import styles from "../support.module.css";

export default async function TicketPage({ params }: { params: Promise<{ ticketId: string }> }) {
  await requireTenantControlSession("tenant.ticket.read");
  const { ticketId } = await params;
  const data = await loadSupportTicket(ticketId);
  if (!data) notFound();
  return (
    <>
      <PageHeader
        actions={<Link className="button-link button-link--secondary" href="/dashboard/support">Alle tickets</Link>}
        description={`${relationName(data.ticket.support_departments)} · aangemaakt ${formatDate(data.ticket.created_at)}`}
        eyebrow={`VYO-${new Date(data.ticket.created_at).getFullYear()}-${String(data.ticket.ticket_number).padStart(6, "0")}`}
        status={{ label: statusLabel(data.ticket.status), tone: data.ticket.status === "closed" ? "success" : "info" }}
        title={data.ticket.subject}
      />
      <section className="workspace-section">
        <div className={styles.thread}>
          {data.messages.map((message) => (
            <article className={`${styles.message} ${message.author_scope === "platform" ? styles.platformMessage : ""}`} key={message.id}>
              <header><strong>{relationName(message.profiles) || (message.author_scope === "platform" ? "VeyoCast Support" : "Klant")}</strong><span>{formatDate(message.created_at)}</span></header>
              {message.sensitive ? <StatusPill label="Gevoelig" tone="warning" /> : null}
              <p>{message.body}</p>
            </article>
          ))}
        </div>
        {data.ticket.status !== "closed" ? (
          <form action={addTicketMessage} className={styles.reply}>
            <input name="ticketId" type="hidden" value={ticketId} />
            <label><span>Antwoord</span><textarea maxLength={10000} name="body" required rows={5} /></label>
            <label className={styles.checkbox}><input name="sensitive" type="checkbox" /> Gevoelige inhoud</label>
            <Button type="submit">Antwoord versturen</Button>
          </form>
        ) : null}
      </section>
      <section className="workspace-section">
        <div className="workspace-section__header"><div><h2 className="workspace-section__title">Bijlagen</h2><p className="work-panel__meta">JPG, PNG, PDF of tekst; maximaal 10 MB. Downloadlinks verlopen na vijf minuten.</p></div><StatusPill label={`${data.attachments.length} bestanden`} tone="neutral" /></div>
        <div className={styles.attachments}>{data.attachments.map((attachment) => attachment.url ? <a href={attachment.url} key={attachment.id}>{attachment.file_name}<span>{Math.ceil(attachment.file_size_bytes / 1024)} KB{attachment.sensitive ? " · gevoelig" : ""}</span></a> : null)}</div>
        <form action={uploadTicketAttachment} className={styles.reply}>
          <input name="tenantId" type="hidden" value={data.ticket.tenant_id} />
          <input name="ticketId" type="hidden" value={ticketId} />
          <label><span>Bijlage toevoegen</span><input accept=".jpg,.jpeg,.png,.pdf,.txt" name="file" required type="file" /></label>
          <label className={styles.checkbox}><input name="sensitive" type="checkbox" /> Gevoelige bijlage</label>
          <Button type="submit" variant="secondary">Bijlage uploaden</Button>
        </form>
      </section>
      <section className="workspace-section">
        <h2 className="workspace-section__title">Ticket verwijderen</h2>
        <p className="work-panel__meta">Het ticket verdwijnt voor gebruikers; de verwijderactie blijft als auditbewijs bestaan.</p>
        <form action={deleteSupportTicket}>
          <input name="ticketId" type="hidden" value={ticketId} />
          <Button type="submit" variant="destructive">Ticket verwijderen</Button>
        </form>
      </section>
    </>
  );
}
