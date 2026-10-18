"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, FolderOpen, RotateCcw } from "lucide-react";
import { mediaFrameCommandSchema, type MediaFrameCommand } from "@veyocast/contracts";
import { Button, Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@veyocast/ui";
import { mutateMediaFrameAction, prepareMediaFrameCopyAction, readMediaFrameUsageAction } from "./media-frame-actions";
import styles from "./media-frame-archive-actions.module.css";

type Props = { scope: string; identity: string; assetId: string; frameId?: string; revision?: number | null; title: string; archived: boolean; canWrite: boolean; canDuplicate: boolean };
export function MediaFrameCardActions({ scope, identity, assetId, frameId, revision, title, archived, canWrite, canDuplicate }: Props) {
  const router = useRouter(), tenantId = scope.split(":")[0]!, key = `veyocast-content-media-frame-v1:${scope}:${identity}`;
  const [ready, setReady] = useState(false), [running, setRunning] = useState(false), [unreadable, setUnreadable] = useState(false), [message, setMessage] = useState(""), [open, setOpen] = useState(false);
  const [pending, setPending] = useState<MediaFrameCommand | null>(null), [usage, setUsage] = useState<{ draftCount: number; releaseCount: number; screenCount: number } | null>(null);
  const mounted = useRef(false), busy = useRef(false), attempt = useRef<MediaFrameCommand | null>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    mounted.current = true; attempt.current = null;
    try {
      const raw = sessionStorage.getItem(key);
      if (raw) {
        if (raw.length > 32768) throw Error("bounds");
        const command = mediaFrameCommandSchema.parse(JSON.parse(raw));
        if (command.tenantId !== tenantId || (command.operation === "create" ? command.isPrimary !== false || command.sourceAssetId !== assetId : !frameId || command.frameId !== frameId || !["archive", "restore", "duplicate"].includes(command.operation))) throw Error("scope");
        attempt.current = command; setPending(command); setMessage("Een eerdere actie is nog niet bevestigd. Bevestig dezelfde actie opnieuw.");
      }
    } catch { setUnreadable(true); setMessage("De lokaal bewaarde actie kan niet veilig worden gelezen. Er is niets opnieuw uitgevoerd; open het actuele ontwerp om verder te gaan."); }
    setReady(true); return () => { mounted.current = false; };
  }, [assetId, frameId, key, tenantId]);
  async function send(command: MediaFrameCommand) {
    const result = await mutateMediaFrameAction(command, scope);
    if (!mounted.current) return;
    if (!result.ok) {
      setMessage(result.message);
      if (result.code === "conflict") { sessionStorage.removeItem(key); attempt.current = null; setPending(null); setOpen(false); router.refresh(); }
      return;
    }
    try { sessionStorage.removeItem(key); }
    catch { setMessage("De server bevestigde de actie, maar de lokale hervatstatus kan nog niet worden gewist. Bevestig dezelfde actie opnieuw."); return; }
    attempt.current = null; setPending(null); setOpen(false); router.refresh();
  }
  async function execute(operation?: "archive" | "restore" | "duplicate") {
    if (!ready || busy.current || unreadable || !canWrite) return;
    busy.current = true; setRunning(true); setMessage("");
    try {
      let command = attempt.current;
      if (!command) {
        if (!operation) return;
        if (!frameId) {
          if (operation !== "duplicate") return;
          const prepared = await prepareMediaFrameCopyAction({ tenantId, mediaAssetId: assetId }, scope);
          if (!mounted.current) return;
          if (!prepared.ok) { setMessage(prepared.message); return; }
          command = prepared.command;
        } else {
          if (!Number.isSafeInteger(revision) || Number(revision) < 1) return;
          const identity = { tenantId, frameId, expectedRevision: Number(revision), idempotencyKey: crypto.randomUUID() };
          command = operation === "duplicate" ? { ...identity, operation, newFrameId: crypto.randomUUID() } : { ...identity, operation };
        }
        sessionStorage.setItem(key, JSON.stringify(command)); attempt.current = command; setPending(command);
      }
      if (command) await send(command);
    } catch { if (mounted.current) setMessage(attempt.current ? "De serverbevestiging ontbreekt. Het resultaat is nog onbekend; bevestig dezelfde actie opnieuw." : "De actie kon niet veilig worden voorbereid of bewaard. Er is niets verstuurd; probeer opnieuw."); }
    finally { busy.current = false; if (mounted.current) setRunning(false); }
  }
  async function prepareArchive() {
    if (!ready || busy.current || unreadable || !canWrite || !frameId || attempt.current) return;
    busy.current = true; setRunning(true); setMessage("");
    try {
      const result = await readMediaFrameUsageAction({ tenantId, frameId }, scope);
      if (!mounted.current) return;
      if (!result.ok) { setMessage(result.message); return; }
      setUsage(result); setOpen(true);
    } catch { if (mounted.current) setMessage("De gebruikscontrole is niet bevestigd. Er is niets gewijzigd; probeer opnieuw."); }
    finally { busy.current = false; if (mounted.current) setRunning(false); }
  }
  const blocked = !ready || running || unreadable || !canWrite || Boolean(pending), style = { minWidth: 44, minHeight: 44, padding: 5 };
  return <>
    {!archived && canDuplicate && <Button variant="ghost" size="sm" style={style} disabled={blocked} title="Dupliceren" aria-label={`${title} dupliceren`} onClick={() => void execute("duplicate")}><Copy size={15} /></Button>}
    {frameId && <Button variant="ghost" size="sm" style={style} disabled={blocked} title={archived ? "Herstellen" : "Archiveren"} aria-label={`${title} ${archived ? "herstellen" : "archiveren"}`} onClick={event => { trigger.current = event.currentTarget; void prepareArchive(); }}>{archived ? <RotateCcw size={15} /> : <FolderOpen size={15} />}</Button>}
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className={styles.dialog} onCloseAutoFocus={event => { event.preventDefault(); trigger.current?.focus(); }}><DialogHeader><DialogTitle>{archived ? "Media-ontwerp herstellen" : "Media-ontwerp archiveren"}</DialogTitle><DialogDescription className={styles.description}>{title}</DialogDescription></DialogHeader><DialogBody><p>{archived ? "Dit ontwerp komt terug in de Contentbibliotheek." : "Dit ontwerp gaat naar het herstelbare archief."} Het bestand en bestaande publicaties blijven behouden.</p>{usage && <p>{usage.draftCount} conceptplaylists · {usage.releaseCount} publicaties · {usage.screenCount} schermen</p>}{message && <p role="alert">{message}</p>}</DialogBody><DialogFooter><Button variant="secondary" onClick={() => setOpen(false)}>Annuleren</Button><Button variant="primary" className={styles.confirm} disabled={running || !canWrite} onClick={() => void execute(archived ? "restore" : "archive")}>{archived ? "Herstellen" : "Archiveren"}</Button></DialogFooter></DialogContent></Dialog>
    {message && !open && <span role="alert">{message}</span>}
    {pending && <Button variant="secondary" size="sm" disabled={!ready || running || unreadable || !canWrite} onClick={() => void execute()}>Dezelfde actie opnieuw bevestigen</Button>}
  </>;
}
