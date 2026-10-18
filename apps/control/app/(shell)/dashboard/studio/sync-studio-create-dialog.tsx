"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Plus } from "lucide-react";
import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@veyocast/ui";
import {
  syncContentFamilies,
  type SyncContentFamily,
} from "@veyocast/contracts";
import {
  createSyncStudioStarter,
  safeParseStudioDocument,
  type StudioDocument,
} from "@veyocast/studio";
import { SyncSlideStaticView } from "@veyocast/content-templates/sync-slide-static-view";
import { syncSlideCss } from "@veyocast/content-templates/sync-slide-styles";
import { createSyncStudioProjectAction } from "./sync-studio-actions";

type Command = { document: StudioDocument; idempotencyKey: string };
/** Source template picker. A lost response retains the original command, including across reloads. */
export function SyncStudioCreateDialog({
  tenantId,
  tenantName,
  canCreate,
  initialOpen = false,
  children,
}: {
  tenantId: string | null;
  tenantName: string;
  canCreate: boolean;
  initialOpen?: boolean;
  children?: ReactNode;
}) {
  const router = useRouter(),
    [open, setOpen] = useState(initialOpen),
    [group, setGroup] = useState("Alles"),
    [busy, setBusy] = useState(false),
    [pending, setPending] = useState<Command | null>(null),
    [error, setError] = useState<string | null>(null),
    [hydrated, setHydrated] = useState(false),
    [cacheBlocked, setCacheBlocked] = useState(false);
  const key = `veyocast-sync-create-v1:${tenantId}`,
    attempt = useRef<Command | null>(null),
    confirmed = useRef<string | null>(null);
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(key);
      if (raw) {
        if (raw.length > 700000) throw Error("Oversized command");
        const stored = JSON.parse(raw);
        const document = safeParseStudioDocument(stored.document);
        if (
          stored.tenantId !== tenantId ||
          !document.success ||
          !document.data.syncPresentation ||
          typeof stored.idempotencyKey !== "string" ||
          !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
            stored.idempotencyKey,
          )
        )
          throw Error("Invalid command");
        attempt.current = {
          document: document.data,
          idempotencyKey: stored.idempotencyKey,
        };
        setPending(attempt.current);
        setOpen(true);
        setError(
          "Een eerdere keuze is nog niet bevestigd. Bevestig dezelfde keuze opnieuw om een dubbel ontwerp te voorkomen.",
        );
      }
    } catch {
      setCacheBlocked(true);
      setError(
        "Je eerdere keuze kan niet veilig worden gelezen. Houd dit venster open en controleer je bibliotheek voordat je een nieuw ontwerp maakt.",
      );
    }
    setHydrated(true);
  }, [key, tenantId]);
  async function create(family?: SyncContentFamily) {
    if (!canCreate || !tenantId || busy || cacheBlocked || !hydrated) return;
    if (confirmed.current) {
      router.push(`/dashboard/studio/${confirmed.current}`);
      return;
    }
    const replaying = Boolean(attempt.current);
    const command =
      attempt.current ??
      (family
        ? {
            document: JSON.parse(
              JSON.stringify(createSyncStudioStarter({ family, tenantName })),
            ) as StudioDocument,
            idempotencyKey: crypto.randomUUID(),
          }
        : null);
    if (!command) return;
    try {
      sessionStorage.setItem(key, JSON.stringify({ tenantId, ...command }));
    } catch {
      setCacheBlocked(true);
      setError(
        "Je keuze kon niet lokaal worden bewaard. Er is nog geen opdracht verstuurd; maak ruimte vrij en open deze pagina opnieuw.",
      );
      return;
    }
    attempt.current = command;
    setPending(command);
    setBusy(true);
    setError(null);
    try {
      const result = await createSyncStudioProjectAction(command);
      if (!result.ok) {
        if (result.rejected && !replaying) {
          attempt.current = null;
          setPending(null);
          try {
            sessionStorage.removeItem(key);
          } catch {
            /* A rejected transaction creates no project. */
          }
        }
        setError(result.error);
        return;
      }
      confirmed.current = result.projectId;
      attempt.current = null;
      setPending(null);
      try {
        sessionStorage.removeItem(key);
      } catch {
        /* A cache failure does not undo the confirmed writer receipt. */
      }
      router.push(`/dashboard/studio/${result.projectId}`);
    } catch {
      setError(
        "Het ontwerp is nog niet bevestigd. Bevestig dezelfde keuze opnieuw zodra je verbinding terug is.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          {children ?? (
            <Button disabled={!canCreate || !hydrated}>
              <Plus size={18} strokeWidth={1.7}/>
              Nieuw ontwerp
            </Button>
          )}
        </DialogTrigger>
        <DialogContent size="wide">
          <DialogHeader>
            <DialogTitle>Wat wil je maken?</DialogTitle>
            <DialogDescription>
              Van wedstrijddag tot kantinemenu. Elke template werkt in liggend
              én staand formaat.
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <style>{syncSlideCss}</style>
            {error && <p role="alert">{error}</p>}
            {pending ? (
              <div className="vc-source-binding">
                <strong>{pending.document.syncPresentation!.name}</strong>
                <p>
                  De oorspronkelijke keuze blijft behouden totdat de server
                  bevestigt welk ontwerp is aangemaakt.
                </p>
                <Button
                  disabled={busy || !canCreate || cacheBlocked}
                  onClick={() => void create()}
                >
                  {busy ? "Bezig…" : "Dezelfde keuze bevestigen"}
                </Button>
              </div>
            ) : (
              <>
                <div className="vc-modal-family-tabs">
                  {["Alles", "Sport", "Kantine", "Club", "Media", "Vrij"].map(
                    (value) => (
                      <button
                        type="button"
                        key={value}
                        className={group === value ? "active" : ""}
                        aria-pressed={group === value}
                        onClick={() => setGroup(value)}
                      >
                        {value}
                      </button>
                    ),
                  )}
                </div>
                <div className="vc-template-grid">
                  {syncContentFamilies
                    .filter(
                      (family) => group === "Alles" || family.group === group,
                    )
                    .map((family) => (
                      <button
                        type="button"
                        className="vc-template-card"
                        key={family.id}
                        disabled={
                          !canCreate || busy || !hydrated || cacheBlocked
                        }
                        onClick={() => void create(family.id)}
                      >
                        <SyncSlideStaticView
                          presentation={
                            createSyncStudioStarter({
                              family: family.id,
                              tenantName,
                            }).syncPresentation!
                          }
                          compact
                          includeStyles={false}
                        />
                        <span>
                          <strong>{family.name}</strong>
                          <small>{family.description}</small>
                          <ArrowRight size={16} />
                        </span>
                      </button>
                    ))}
                </div>
              </>
            )}
          </DialogBody>
        </DialogContent>
      </Dialog>
    </>
  );
}
