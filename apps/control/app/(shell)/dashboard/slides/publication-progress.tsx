"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@veyocast/ui";
import { publishDynamicSlideVersion, readDynamicPublication } from "./version-actions";

export function PublicationProgress({ slideId, versionId, onPublished, refreshOnPublished = true }: { slideId: string; versionId?: string; onPublished?: () => void; refreshOnPublished?: boolean }) {
  const router = useRouter();
  const [state, setState] = useState<Awaited<ReturnType<typeof readDynamicPublication>> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stalled, setStalled] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [pending, startTransition] = useTransition();
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const deadline = Date.now() + 120_000;
    async function check() {
      try {
        const next = await readDynamicPublication(slideId, versionId);
        if (cancelled) return;
        setState(next); setError(null);
        if (next.status === "published") { onPublished?.(); if (refreshOnPublished) router.refresh(); return; }
        if (next.status !== "publishing") return;
        if (Date.now() >= deadline || (attempt === 0 && next.startedAt && Date.now() - Date.parse(next.startedAt) > 600_000)) { setStalled(true); return; }
      } catch {
        if (cancelled) return;
        setError("De publicatiestatus kan niet worden gecontroleerd. Je opgeslagen versie blijft behouden.");
        if (Date.now() >= deadline) { setStalled(true); return; }
      }
      timer = setTimeout(check, 2_000);
    }
    void check();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [slideId, versionId, attempt, onPublished, refreshOnPublished, router]);
  if (!error && (!state || state.status === "draft" || state.status === "published")) return null;
  const failed = stalled || state?.status === "failed" || Boolean(error);
  return <section className={`notice notice--${failed ? "critical" : "warning"}`} role={failed ? "alert" : "status"}>
    <p>{error ?? (state?.status === "failed" ? `Publicatie mislukt (${state.error}).` : stalled ? "De publicatie duurt te lang. Controleer de verwerking of probeer gecontroleerd opnieuw." : "Je opgeslagen versie wordt verwerkt. Publicatie is nog niet bevestigd.")} De vorige werkende versie blijft actief.</p>
    {failed && <Button type="button" disabled={pending} onClick={() => startTransition(async () => {
      try {
        const current = await readDynamicPublication(slideId, versionId);
        if (current.status !== "published") {
          const result = await publishDynamicSlideVersion({ slideId, versionId: current.versionId, expectedRevision: current.revision });
          if (!result.ok) { setError(result.message ?? "Publiceren is niet gelukt."); return; }
        }
        setError(null); setStalled(false); setAttempt(value => value + 1);
      } catch { setError("Opnieuw proberen is niet gelukt. Je opgeslagen versie blijft behouden."); }
    })}>{pending ? "Controleren…" : "Publicatie opnieuw proberen"}</Button>}
  </section>;
}

export function PublicationListRefresh({ active }: { active: boolean }) {
  const router = useRouter();
  const [stalled, setStalled] = useState(false);
  useEffect(() => {
    if (!active) { setStalled(false); return; }
    const startedAt = Date.now();
    const timer = setInterval(() => {
      if (Date.now() - startedAt >= 120_000) { clearInterval(timer); setStalled(true); return; }
      router.refresh();
    }, 3_000);
    return () => clearInterval(timer);
  }, [active, router]);
  return stalled ? <p role="alert" className="notice notice--warning">De verwerking duurt langer dan verwacht. Open de betreffende slide om de publicatie te controleren of opnieuw te proberen. De vorige werkende versie blijft actief.</p> : null;
}
