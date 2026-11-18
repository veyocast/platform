"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { safeParseStudioDocument } from "@veyocast/studio";
import type { AgentAttachment, AgentStep } from "../../../../lib/agent/catalog";
import styles from "./workspace.module.css";
import { readAgentStudioPreviewAssetsAction } from "./actions";

const StudioCanvas = dynamic(() => import("../studio/[designId]/studio-konva-canvas").then(module => module.StudioKonvaCanvas), { ssr: false, loading: () => <p role="status">Studio-voorbeeld voorbereiden…</p> });

export function AgentStudioPreview({ step, proposalId, stepIndex, attachments }: { step: AgentStep; proposalId: string; stepIndex: number; attachments: AgentAttachment[] }) {
  const [confirmed, setConfirmed] = useState<AgentAttachment[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    setConfirmed(null); setError(null);
    void readAgentStudioPreviewAssetsAction(proposalId, stepIndex).then(result => { if (!active) return; if (result.ok) setConfirmed(result.assets); else setError(result.error); }).catch(() => { if (active) setError("De originele ontwerpbeelden konden niet bevestigd geladen worden. Controleer het voorstel opnieuw voordat je akkoord geeft."); });
    return () => { active = false; };
  }, [proposalId, stepIndex]);
  const parsed = safeParseStudioDocument(step.args.document);
  if (!parsed.success) return null;
  if (error) return <p role="alert">{error}</p>;
  if (!confirmed) return <p role="status">Originele ontwerpbeelden controleren…</p>;
  const assets = (confirmed ?? attachments).map(attachment => ({ id: attachment.id, kind: attachment.kind, title: attachment.title, width: attachment.width, height: attachment.height, previewUrl: attachment.previewUrl, sourceUrl: attachment.sourceUrl }));
  return <figure aria-label="Voorbeeld van het voorgestelde Studio-ontwerp"><figcaption>{parsed.data.artboard.orientation === "portrait" ? "Staand · 9:16" : "Liggend · 16:9"} · hetzelfde Studio-canvas en dezelfde bewerkbare tekst als de gewone editor</figcaption><div className={styles.studioPreview}><StudioCanvas document={parsed.data} assets={assets} canEdit={false} dispatch={() => undefined} playheadMs={0} reducedMotion selectedIds={[]} showGrid={false} zoom={1} /></div></figure>;
}
