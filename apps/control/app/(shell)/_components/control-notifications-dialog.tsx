"use client";

import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@veyocast/ui";
import { ArrowRight, Bell, LoaderCircle, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { parseControlNotifications, type ControlNotification } from "../_lib/control-notifications-contract";

type Props = { canRead: boolean; tenantId: string | null; tenantName: string; timezoneName: string };
type LoadState = "idle" | "loading" | "ready" | "error";

export function ControlNotificationsDialog({ canRead, tenantId, tenantName, timezoneName }: Props) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<LoadState>("idle");
  const [notifications, setNotifications] = useState<ControlNotification[]>([]);
  const [attempt, setAttempt] = useState(0);
  const returnFocus = useRef<HTMLElement | null>(null);
  useEffect(() => {
    function shortcut(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === "n") {
        event.preventDefault();
        returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        setOpen(true);
      }
    }
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, []);
  useEffect(() => {
    setNotifications([]);
    if (!open || !canRead || !tenantId) { setState("idle"); return; }
    const controller = new AbortController();
    setState("loading");
    void fetch("/api/control/notifications", { cache: "no-store", credentials: "same-origin", signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error("unavailable");
        const parsed = parseControlNotifications(await response.json(), tenantId);
        if (!parsed) throw new Error("invalid-context");
        if (!controller.signal.aborted) { setNotifications(parsed.notifications); setState("ready"); }
      })
      .catch(() => { if (!controller.signal.aborted) setState("error"); });
    return () => controller.abort();
  }, [open, canRead, tenantId, attempt]);
  const time = (value: string) => new Intl.DateTimeFormat("nl-NL", { timeZone: timezoneName, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild><button aria-label="Meldingen openen" aria-keyshortcuts="Control+Shift+N Meta+Shift+N" className="demo-icon" type="button" onClick={() => { returnFocus.current = null; }}><Bell size={22} aria-hidden="true" /></button></DialogTrigger>
    <DialogContent className="sites-control demo-modal control-notifications-dialog" showClose={false} onCloseAutoFocus={event => { if (returnFocus.current?.isConnected) { event.preventDefault(); returnFocus.current.focus(); returnFocus.current = null; } }}>
      <div className="demo-modal-heading"><DialogTitle>Meldingen</DialogTitle><DialogClose asChild><button className="demo-icon" aria-label="Meldingen sluiten" type="button"><X size={20} aria-hidden="true" /></button></DialogClose></div>
      <DialogDescription className="vc-visually-hidden">Recente activiteit van {tenantName}. Alleen geregistreerde acties worden getoond.</DialogDescription>
      {!canRead || !tenantId ? <div className="demo-help" role="status"><strong>Meldingen niet beschikbaar</strong><p>Voor deze context ontbreekt een actieve vereniging of leesrecht voor activiteit. Er worden geen gegevens opgehaald. Kies een actieve vereniging of vraag je beheerder om toegang.</p></div>
        : state === "loading" ? <div className="demo-help" role="status"><LoaderCircle size={18} aria-hidden="true" /> Meldingen worden geladen.</div>
        : state === "error" ? <div className="demo-help" role="alert"><strong>Meldingen konden niet worden geladen.</strong><p>De verbinding of sessie is niet beschikbaar. De activiteit blijft opgeslagen. Probeer opnieuw of open Activiteit.</p><button className="demo-button" type="button" onClick={() => setAttempt(value => value + 1)}>Opnieuw proberen</button></div>
        : state === "ready" && notifications.length === 0 ? <div className="demo-empty" role="status"><Bell size={28} aria-hidden="true" /><h3>Geen meldingen</h3><p>Er is nog geen activiteit geregistreerd voor {tenantName}.</p></div>
        : <div className="demo-results">{notifications.map(notification => <button key={notification.id} type="button" onClick={() => { window.location.assign(notification.href); }}><Bell size={18} aria-hidden="true" /><span>{notification.title}<small><time dateTime={notification.createdAt}>{time(notification.createdAt)}</time> · {notification.result === "success" ? "Vastgelegd" : notification.result === "denied" ? "Geweigerd" : "Mislukt"}</small></span><ArrowRight size={16} aria-hidden="true" /></button>)}</div>}
      <p className="demo-modal-footer-note">{canRead && tenantId ? <>De laatste 20 geregistreerde acties van {tenantName}. <a href="/dashboard/activity">Alle activiteit bekijken</a>.</> : "Alleen lezen. Meldingen veranderen geen content of schermstatus."}</p>
    </DialogContent>
  </Dialog>;
}
