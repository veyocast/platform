"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, FolderOpen, Loader2, RotateCcw } from "lucide-react";
import { Button, Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@veyocast/ui";
import { ArchiveMediaDialog } from "../media/media-overlays";
import { restoreMediaAsset } from "../media/actions";
import { mutateStudioProjectAction } from "../studio/actions";
import { loadContentMediaArchivePreview, type ContentMediaArchivePreview } from "./content-resource-actions";

export function ContentMediaArchiveAction({ assetId, title }: { assetId: string; title: string }) {
  const [preview, setPreview] = useState<ContentMediaArchivePreview | null>(null);
  const [open, setOpen] = useState(false), [pending, setPending] = useState(false), [error, setError] = useState("");
  const trigger = useRef<HTMLButtonElement>(null), nonce = useRef<string | null>(null), mounted = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  async function prepare() {
    if (pending) return;
    setPending(true); setError("");
    try {
      const result = await loadContentMediaArchivePreview(assetId);
      if (!mounted.current) return;
      if (!result.ok) { setError(result.message); return; }
      nonce.current = crypto.randomUUID(); setPreview(result.preview); setOpen(true);
    } catch { if (mounted.current) setError("De controle van het mediagebruik is niet bevestigd. Er is niets gewijzigd; probeer opnieuw."); }
    finally { if (mounted.current) setPending(false); }
  }
  return <>
    <Button variant="ghost" size="sm" style={{ minWidth: 44, minHeight: 44, padding: 5 }} type="button" title="Archiveren" aria-label={`${title} archiveren`} aria-busy={pending} disabled={pending} onClick={event => { trigger.current = event.currentTarget; void prepare(); }}>
      {pending ? <Loader2 size={15} className="vc-spin" /> : <FolderOpen size={15} />}
    </Button>
    {error && <span role="alert">{error}</span>}
    {preview && nonce.current && <ArchiveMediaDialog {...preview} canArchive idempotencyKey={nonce.current} open={open} onOpenChange={setOpen} trigger={null} returnTo="/dashboard/content" onReturnFocus={() => trigger.current?.focus()} />}
  </>;
}

export function ContentMediaRestoreAction({ assetId, title, nonce }: { assetId: string; title: string; nonce: string }) {
  return <form action={restoreMediaAsset} className="vc-card-actions">
    <input type="hidden" name="assetId" value={assetId} /><input type="hidden" name="idempotencyKey" value={nonce} /><input type="hidden" name="returnTo" value="/dashboard/content" />
    <Button variant="ghost" size="sm" style={{ minWidth: 44, minHeight: 44, padding: 5 }} type="submit" title="Herstellen" aria-label={`${title} herstellen`}><RotateCcw size={15} /></Button>
  </form>;
}

type StudioCardCommand = { projectId: string; expectedRevision: number; idempotencyKey: string; operation: "archive" | "restore" | "duplicate" };
const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;

export function ContentStudioActions({ projectId, title, revision, archived, canArchive, canDuplicate, scope }: {
  projectId: string; title: string; revision: number; archived: boolean; canArchive: boolean; canDuplicate: boolean; scope: string;
}) {
  const router = useRouter(), key = `veyocast-content-studio-v1:${scope}:${projectId}`;
  const [ready, setReady] = useState(false), [running, setRunning] = useState(false), [open, setOpen] = useState(false), [message, setMessage] = useState("");
  const [pending, setPending] = useState<StudioCardCommand | null>(null), [unreadable, setUnreadable] = useState(false);
  const attempt = useRef<StudioCardCommand | null>(null), active = useRef(false), mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    attempt.current = null; setPending(null); setUnreadable(false); setReady(false);
    try {
      const raw = sessionStorage.getItem(key);
      if (raw) {
        if (raw.length > 2048) throw Error("bounds");
        const value = JSON.parse(raw) as StudioCardCommand;
        if (!value || Object.keys(value).sort().join() !== "expectedRevision,idempotencyKey,operation,projectId" || value.projectId !== projectId || !uuid.test(value.idempotencyKey) || !Number.isSafeInteger(value.expectedRevision) || value.expectedRevision < 0 || !["archive", "restore", "duplicate"].includes(value.operation)) throw Error("scope");
        attempt.current = value; setPending(value); setMessage("Een eerdere actie is nog niet bevestigd. Bevestig dezelfde actie opnieuw; je ontwerp blijft behouden.");
      }
    } catch { setUnreadable(true); setMessage("De lokaal bewaarde actie kan niet veilig worden gelezen. Er is niets opnieuw uitgevoerd; open het actuele ontwerp om verder te gaan."); }
    setReady(true);
    return () => { mounted.current = false; };
  }, [key, projectId]);
  async function run(operation: StudioCardCommand["operation"]) {
    if (!ready || active.current || unreadable || (operation === "duplicate" ? !canDuplicate : !canArchive)) return;
    if (attempt.current && attempt.current.operation !== operation) { setMessage("Bevestig eerst de oorspronkelijke actie opnieuw."); return; }
    active.current = true; setRunning(true); setMessage("");
    try {
      if (!attempt.current) {
        const command = { projectId, expectedRevision: revision, idempotencyKey: crypto.randomUUID(), operation };
        sessionStorage.setItem(key, JSON.stringify(command)); attempt.current = command; setPending(command);
      }
      const result = await mutateStudioProjectAction(attempt.current);
      if (!mounted.current) return;
      if (!result.ok) {
        setMessage(result.error ?? "De actie is niet bevestigd. Probeer dezelfde actie opnieuw.");
        if (result.outcome === "conflict") { sessionStorage.removeItem(key); attempt.current = null; setPending(null); router.refresh(); }
        return;
      }
      sessionStorage.removeItem(key); attempt.current = null; setPending(null); setOpen(false); router.refresh();
    } catch { if (mounted.current) setMessage("De serverbevestiging ontbreekt. Het resultaat is nog onbekend; bevestig dezelfde actie opnieuw."); }
    finally { active.current = false; if (mounted.current) setRunning(false); }
  }
  const blocked = !ready || running || unreadable;
  const iconStyle = { minWidth: 44, minHeight: 44, padding: 5 };
  return <>
    {canDuplicate && !archived && <Button variant="ghost" size="sm" style={iconStyle} title="Dupliceren" aria-label={`${title} dupliceren`} disabled={blocked || Boolean(pending && pending.operation !== "duplicate")} onClick={() => void run("duplicate")}><Copy size={15} /></Button>}
    {canArchive && <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" style={iconStyle}
          title={archived ? "Herstellen" : "Archiveren"}
          aria-label={`${title} ${archived ? "herstellen" : "archiveren"}`}
          disabled={blocked || Boolean(pending && pending.operation !== (archived ? "restore" : "archive"))}>
          {archived ? <RotateCcw size={15} /> : <FolderOpen size={15} />}
        </Button>
      </DialogTrigger>
      <DialogContent><DialogHeader><DialogTitle>{archived ? "Ontwerp herstellen" : "Ontwerp archiveren"}</DialogTitle><DialogDescription>{title}</DialogDescription></DialogHeader>
        <DialogBody><p>{archived ? "Het ontwerp komt terug in de actieve bibliotheek." : "Het ontwerp gaat naar het herstelbare archief. Een eventuele lopende render wordt gestopt."} Bestaande publicaties blijven ongewijzigd.</p>{message && <p role="alert">{message}</p>}</DialogBody>
        <DialogFooter><Button variant="secondary" onClick={() => setOpen(false)}>Annuleren</Button><Button variant="primary" disabled={blocked} onClick={() => void run(archived ? "restore" : "archive")}>{archived ? "Herstellen" : "Archiveren"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>}
    {message && !open && <span role="alert">{message}</span>}
    {pending && <Button variant="secondary" size="sm" disabled={blocked || (pending.operation === "duplicate" ? !canDuplicate : !canArchive)} onClick={() => void run(pending.operation)}>Dezelfde actie opnieuw bevestigen</Button>}
  </>;
}
