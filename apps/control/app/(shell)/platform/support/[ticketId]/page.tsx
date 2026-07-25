import { notFound } from "next/navigation";
import Link from "next/link";
import { Button, PageHeader, StatusPill } from "@veyocast/ui";

import { requireControlCapability } from "../../../../../lib/control-session";
import { addTicketMessage, deleteSupportTicket, updateTicketStatus, uploadTicketAttachment } from "../../../dashboard/support/actions";
import { loadSupportTicket } from "../../../dashboard/support/data";
import { formatDate, relationName, statusLabel } from "../../../dashboard/support/page";
import styles from "../../../dashboard/support/support.module.css";

export default async function PlatformTicketPage({ params }: { params: Promise<{ ticketId: string }> }) {
  await requireControlCapability("platform.ticket.read");
  const { ticketId } = await params;
  const data = await loadSupportTicket(ticketId);
  if (!data) notFound();
  return (
    <>
      <PageHeader
        actions={<Link className="button-link button-link--secondary" href="/platform/support">Inbox</Link>}
        description={`${relationName(data.ticket.tenants)} · ${relationName(data.ticket.support_departments)}`}
        eyebrow={`VYO-${new Date(data.ticket.created_at).getFullYear()}-${String(data.ticket.ticket_number).padStart(6, "0")}`}
        status={{ label: statusLabel(data.ticket.status), tone: data.ticket.status === "closed" ? "success" : "info" }}
        title={data.ticket.subject}
      />
      <section className="workspace-section">
        <form action={updateTicketStatus} className={styles.form}>
          <input name="ticketId" type="hidden" value={ticketId} />
          <label><span>Status</span><select defaultValue={data.ticket.status} name="status"><option value="open">Open</option><option value="in_progress">In behandeling</option><option value="waiting_for_customer">Wacht op klant</option><option value="resolved">Opgelost</option><option value="closed">Gesloten</option></select></label>
          <label><span>Behandelaar</span><select defaultValue={data.ticket.assigned_to ?? ""} name="assignedTo"><option value="">Niet toegewezen</option>{data.platformUsers.map((membership) => <option key={membership.user_id} value={membership.user_id}>{relationName(membership.profiles)}</option>)}</select></label>
          <Button type="submit" variant="secondary">Toewijzing opslaan</Button>
        </form>
      </section>
      <section className="workspace-section">
        <div className="workspace-section__header"><div><h2 className="workspace-section__title">Bijlagen</h2><p className="work-panel__meta">Privé-opslag; downloadlinks verlopen na vijf minuten.</p></div><StatusPill label={`${data.attachments.length} bestanden`} tone="neutral" /></div>
        <div className={styles.attachments}>{data.attachments.map((attachment) => attachment.url ? <a href={attachment.url} key={attachment.id}>{attachment.file_name}<span>{Math.ceil(attachment.file_size_bytes / 1024)} KB{attachment.sensitive ? " · gevoelig" : ""}</span></a> : null)}</div>
        <form action={uploadTicketAttachment} className={styles.reply}>
          <input name="scope" type="hidden" value="platform" />
          <input name="tenantId" type="hidden" value={data.ticket.tenant_id} />
          <input name="ticketId" type="hidden" value={ticketId} />
          <label><span>Bijlage toevoegen</span><input accept=".jpg,.jpeg,.png,.pdf,.txt" name="file" required type="file" /></label>
          <label className={styles.checkbox}><input name="sensitive" type="checkbox" /> Gevoelige bijlage</label>
          <Button type="submit" variant="secondary">Bijlage uploaden</Button>
        </form>
      </section>
      <section className="workspace-section">
        <div className={styles.thread}>
          {data.messages.map((message) => <article className={`${styles.message} ${message.author_scope === "platform" ? styles.platformMessage : ""}`} key={message.id}>
            <header><strong>{relationName(message.profiles) || "VeyoCast gebruiker"}</strong><span>{formatDate(message.created_at)}</span></header>
            {message.sensitive ? <StatusPill label="Gevoelig" tone="warning" /> : null}
            <p>{message.body}</p>
          </article>)}
        </div>
        {data.ticket.status !== "closed" ? <form action={addTicketMessage} className={styles.reply}>
          <input name="scope" type="hidden" value="platform" />
          <input name="ticketId" type="hidden" value={ticketId} />
          <label><span>Antwoord als VeyoCast</span><textarea maxLength={10000} name="body" required rows={5} /></label>
          <label className={styles.checkbox}><input name="sensitive" type="checkbox" /> Alleen bevoegde behandelaars en tenantbeheerders</label>
          <Button type="submit">Antwoord versturen</Button>
        </form> : null}
      </section>
      <section className="workspace-section">
        <h2 className="workspace-section__title">Beheersactie</h2>
        <form action={deleteSupportTicket}>
          <input name="scope" type="hidden" value="platform" />
          <input name="ticketId" type="hidden" value={ticketId} />
          <Button type="submit" variant="destructive">Ticket verwijderen en notificeren</Button>
        </form>
      </section>
    </>
  );
}
