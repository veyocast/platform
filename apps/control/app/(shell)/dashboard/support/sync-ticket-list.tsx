"use client";
import Link from "next/link";
import { useState } from "react";
import { ChevronRight, MessageSquare } from "lucide-react";
import { StatusPill } from "@veyocast/ui";
import { relationName, statusLabel } from "./support-format";
import type { loadTenantSupport } from "./data";
export function SyncTicketList({ tickets, unavailable }: { tickets: Awaited<ReturnType<typeof loadTenantSupport>>["tickets"]; unavailable: boolean }) {
  const [filter, setFilter] = useState("Alle");
  const visible = tickets.filter(ticket => filter === "Alle" || filter === "Open" && ticket.status === "open" || filter === "In behandeling" && ["in_progress", "waiting_for_customer"].includes(ticket.status) || filter === "Opgelost" && ["resolved", "closed"].includes(ticket.status));
  return <><div className="ad-tabs" aria-label="Ticketstatus">{["Alle", "Open", "In behandeling", "Opgelost"].map(label => <button type="button" key={label} onClick={() => setFilter(label)} aria-pressed={filter === label}>{label}</button>)}</div><section className="card ad-ticket-list" aria-label="Supporttickets">{visible.map(ticket => <Link className="sync-ticket-row" key={ticket.id} href={`/dashboard/support/${ticket.id}`}><span className="ad-square"><MessageSquare size={18} /></span><div><h2 className="sync-ticket-title">{ticket.subject}</h2><p>{relationName(ticket.support_departments)} · VYO-{String(ticket.ticket_number).padStart(6, "0")}</p></div><StatusPill label={statusLabel(ticket.status)} tone={["resolved", "closed"].includes(ticket.status) ? "success" : "info"} /><ChevronRight size={18} /></Link>)}{!visible.length ? <div className="empty"><MessageSquare size={36} strokeWidth={1.7} aria-hidden="true" /><h2 className="sync-empty-title">{unavailable ? "Tickets niet beschikbaar" : "Nog geen tickets in deze selectie"}</h2><p>{unavailable ? "Vernieuw de pagina om je opgeslagen tickets opnieuw te lezen." : "Maak een ticket aan als je hulp nodig hebt."}</p></div> : null}</section></>;
}
