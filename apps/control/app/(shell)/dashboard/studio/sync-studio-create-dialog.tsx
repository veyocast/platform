"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Plus, X } from "lucide-react";
import { Button, Dialog, DialogBody, DialogClose, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@veyocast/ui";
import { syncContentFamilies, type SyncContentFamily } from "@veyocast/contracts";
import { SyncSlideStaticView } from "@veyocast/content-templates/sync-slide-static-view";
import { syncSlideCss } from "@veyocast/content-templates/sync-slide-styles";
import { createSyncTemplatePreview } from "./sync-template-preview";
import { resolveSyncCreationReceiptAction } from "./sync-create-wizard-actions";
import styles from "./sync-studio-create-dialog.module.css";

const groups = ["Alles", "Sport", "Kantine", "Club", "Media", "Vrij"];
/** A choice only navigates. All new writes and their scoped journals belong to the wizard. */
export function SyncStudioCreateDialog({ tenantId, actorScope, canCreate, initialOpen = false, initialGroup = "Alles", preferredMode, children }: {
  tenantId: string | null; tenantName: string; actorScope: string; canCreate: boolean; initialOpen?: boolean;
  initialGroup?: string; preferredMode?: "manual" | "connected"; children?: ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(initialOpen), [group, setGroup] = useState(groups.includes(initialGroup) ? initialGroup : "Alles");
  const [hydrated, setHydrated] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null), [legacyNonce, setLegacyNonce] = useState<string | null>(null);
  const generation = useRef(0), inflight = useRef(false);
  useEffect(() => {
    generation.current++; setLegacyNonce(null); setError(null);
    try {
      const raw = sessionStorage.getItem(`veyocast-sync-create-v1:${tenantId}`);
      if (raw) {
        if (raw.length > 700000) throw Error("bounds");
        const stored = JSON.parse(raw);
        if (stored.tenantId !== tenantId || typeof stored.idempotencyKey !== "string" || !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(stored.idempotencyKey)) throw Error("scope");
        setLegacyNonce(stored.idempotencyKey);
        setError("Een eerdere keuze is nog niet bevestigd. De oorspronkelijke opdracht blijft bewaard; controleer het ontvangstbewijs binnen het oorspronkelijke account.");
      }
    } catch { setError("Een eerdere keuze kan niet veilig worden gelezen. De opgeslagen opdracht blijft behouden; controleer je bibliotheek voordat je een nieuw ontwerp maakt."); }
    setHydrated(true);
    return () => { generation.current++; };
  }, [tenantId, actorScope]);
  function choose(family: SyncContentFamily) {
    if (!canCreate || !tenantId || !hydrated || busy) return;
    const query = new URLSearchParams({ family });
    if (preferredMode) query.set("mode", preferredMode);
    router.push(`/dashboard/studio/new?${query}`);
  }
  async function readReceipt() {
    if (!legacyNonce || inflight.current) return;
    const sequence = generation.current; inflight.current = true; setBusy(true);
    try {
      const result = await resolveSyncCreationReceiptAction({ idempotencyKey: legacyNonce }, actorScope);
      if (sequence !== generation.current) return;
      if (!result.ok) setError(result.error);
      else if (result.href) router.push(result.href);
      else setError("Dit account heeft geen bevestigd ontvangstbewijs voor die eerdere keuze. Er is niets opnieuw uitgevoerd; de oorspronkelijke opdracht blijft bewaard. Controleer het oorspronkelijke account en de bibliotheek.");
    } catch { if (sequence === generation.current) setError("Het ontvangstbewijs kon niet worden gecontroleerd. De oorspronkelijke opdracht blijft bewaard; probeer opnieuw zodra je verbinding terug is."); }
    finally { inflight.current = false; if (sequence === generation.current) setBusy(false); }
  }
  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild>{children ?? <Button disabled={!canCreate || !hydrated}><Plus size={18} strokeWidth={1.7} />Nieuw ontwerp</Button>}</DialogTrigger>
    <DialogContent size="wide" showClose={false} className={styles.dialog}>
      <header className={styles.header}><DialogTitle className={styles.title}>Wat wil je maken?</DialogTitle><DialogClose className={`icon-button ${styles.close}`} aria-label="Sluiten"><X size={18} /></DialogClose></header>
      <DialogBody className={styles.body}>
        <DialogDescription className={styles.description}>Van wedstrijddag tot kantinemenu. Elke template werkt in liggend én staand formaat.</DialogDescription>
        <p className={styles.exampleHint}>Opmaakvoorbeelden. In de volgende stap kies je je eigen gegevens.</p>
        <style>{syncSlideCss}</style>
        {error && <p role="alert">{error}</p>}
        {legacyNonce && <Button variant="secondary" disabled={busy || !hydrated} onClick={() => void readReceipt()}>{busy ? "Ontvangstbewijs controleren…" : "Eerder ontvangstbewijs controleren"}</Button>}
        <div className="vc-modal-family-tabs">{groups.map(value => <button type="button" key={value} className={group === value ? "active" : ""} aria-pressed={group === value} onClick={() => setGroup(value)}>{value}</button>)}</div>
        <div className={`vc-template-grid ${styles.grid}`}>
          {syncContentFamilies.filter(family => group === "Alles" || family.group === group).map(family => <button type="button" className="vc-template-card" key={family.id} disabled={!canCreate || busy || !hydrated} onClick={() => choose(family.id)}>
            <SyncSlideStaticView presentation={createSyncTemplatePreview(family.id)} compact includeStyles={false} />
            <span><strong>{family.name}</strong><small>{family.description}</small><ArrowRight size={16} /></span>
          </button>)}
        </div>
      </DialogBody>
    </DialogContent>
  </Dialog>;
}
