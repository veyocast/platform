"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@veyocast/ui";
import { AssetImage } from "@veyocast/content-templates/sites-media";
import type { AgentAttachment, AgentProposal } from "../../../../lib/agent/catalog";
import { watchVisibleRouteRefresh } from "../../../../lib/visible-route-refresh";
import { maxImageUploadBatchSize } from "../../../../lib/media/image-upload-policy";
import { VideoUploadForm } from "../media/video-upload-form";
import { generateAgentImageAction, prepareImageSlideAction, readAgentAttachmentsAction, reviseAgentProposalAction } from "./actions";
import styles from "./workspace.module.css";

type Transfer = { id: string; file: File; progress: number; status: "uploading" | "failed" | "received"; message?: string };

function uploadImage(conversationId: string, transfer: Transfer, onProgress: (progress: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", "/api/agent/images");
    request.timeout = 180000;
    request.upload.onprogress = event => { if (event.lengthComputable) onProgress(Math.round(event.loaded / event.total * 95)); };
    request.onerror = request.ontimeout = () => reject(Error("De overdracht is onderbroken. Je bestand blijft beschikbaar; controleer de status en probeer dezelfde bijlage opnieuw."));
    request.onload = () => {
      try {
        const result = JSON.parse(request.responseText) as { ok: boolean; error?: string };
        if (request.status < 200 || request.status >= 300 || !result.ok) throw Error(result.error ?? "De bijlage is niet bevestigd ontvangen.");
        resolve();
      } catch { reject(Error("De privébijlage is niet bevestigd ontvangen. Controleer het formaat, je verbinding en de agentvrijgave voordat je dezelfde bijlage opnieuw verstuurt.")); }
    };
    const form = new FormData(); form.set("conversationId", conversationId); form.set("attachmentId", transfer.id); form.set("media", transfer.file); form.set("title", transfer.file.name.slice(0, 120));
    request.send(form);
  });
}

export function AgentAttachmentsPanel({ conversationId, ensureConversation, videoConfig, onProposal, onError, generationBrief, onAttachmentsChange }: {
  conversationId: string | null;
  ensureConversation: () => Promise<string>;
  videoConfig: { anonKey: string; supabaseUrl: string } | null;
  onProposal: (proposal: AgentProposal) => void;
  onError: (message: string) => void;
  generationBrief?: string;
  onAttachmentsChange: (attachments: AgentAttachment[]) => void;
}) {
  const [attachments, setAttachments] = useState<AgentAttachment[]>([]);
  const [readError, setReadError] = useState<string | null>(null);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [videos, setVideos] = useState<Array<{ id: string; file: File }>>([]);
  const [prompt, setPrompt] = useState("");
  const [title, setTitle] = useState("Nieuw beeldconcept");
  const [orientation, setOrientation] = useState<"landscape" | "portrait">("landscape");
  const [fit, setFit] = useState<"contain" | "cover">("contain");
  const [referenceId, setReferenceId] = useState("");
  const [slideTitle, setSlideTitle] = useState("");
  const [slideBody, setSlideBody] = useState("");
  const [logoId, setLogoId] = useState("");
  const [generating, setGenerating] = useState(false);
  const [proposing, setProposing] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const requestSequence = useRef(0);
  const generationPending = useRef(false);
  const proposalPending = useRef(false);
  const scope = useRef(conversationId);
  scope.current = conversationId;

  useEffect(() => { if (generationBrief) setPrompt(generationBrief); }, [generationBrief]);

  async function load(id: string) {
    const sequence = ++requestSequence.current;
    try {
      const result = await readAgentAttachmentsAction(id);
      if (sequence !== requestSequence.current || scope.current !== id) return;
      if (result.ok) { setAttachments(result.attachments); onAttachmentsChange(result.attachments); setReadError(null); } else setReadError(result.error);
    } catch {
      if (sequence === requestSequence.current && scope.current === id) setReadError("De actuele bijlagestatus kon niet worden geladen. Eerder ontvangen bestanden blijven behouden; controleer de verbinding en probeer opnieuw.");
    }
  }

  useEffect(() => {
    if (!conversationId) return;
    void load(conversationId);
    return () => { requestSequence.current++; };
  }, [conversationId]);

  useEffect(() => {
    if (!conversationId || !attachments.some(attachment => ["uploading", "processing"].includes(attachment.status))) return;
    return watchVisibleRouteRefresh({ document, window, intervalMs: 5000, refresh: () => {
      void load(conversationId).finally(() => setRefresh(value => value + 1));
    } });
  }, [conversationId, attachments, refresh]);

  async function transmit(transfer: Transfer, id: string) {
    setTransfers(current => current.map(item => item.id === transfer.id ? { ...item, status: "uploading", message: undefined } : item));
    try {
      await uploadImage(id, transfer, progress => setTransfers(current => current.map(item => item.id === transfer.id ? { ...item, progress } : item)));
      setTransfers(current => current.map(item => item.id === transfer.id ? { ...item, status: "received", progress: 100 } : item));
      await load(id);
    } catch (cause) {
      setTransfers(current => current.map(item => item.id === transfer.id ? { ...item, status: "failed", message: cause instanceof Error ? cause.message : "De overdracht is niet bevestigd." } : item));
    }
  }

  async function selectFiles(files: File[]) {
    if (files.filter(file => !file.type.startsWith("video/")).length > maxImageUploadBatchSize) { onError(`Kies maximaal ${maxImageUploadBatchSize} afbeeldingen per uploadbatch. Er is niets verstuurd; selecteer de bestanden in afzonderlijke batches.`); return; }
    try {
      const id = await ensureConversation();
      const images = files.filter(file => !file.type.startsWith("video/")).map(file => ({ id: crypto.randomUUID(), file, progress: 0, status: "uploading" as const }));
      setTransfers(current => [...current, ...images]);
      setVideos(current => [...current, ...files.filter(file => file.type.startsWith("video/")).map(file => ({ id: crypto.randomUUID(), file }))]);
      for (const image of images) await transmit(image, id);
    } catch { onError("Het privégesprek kon niet worden geopend. Je bestanden zijn niet gepubliceerd; selecteer ze opnieuw zodra je verbonden bent."); }
  }

  async function generate() {
    if (generationPending.current) return;
    generationPending.current = true; setGenerating(true);
    try {
      const id = await ensureConversation();
      const result = await generateAgentImageAction({ conversationId: id, title, prompt, orientation, referenceId: referenceId || undefined });
      if (!result.ok) onError(result.error); else await load(id);
    } catch { onError("Het beeldconcept is niet bevestigd. Er wordt niets uitgezonden; een verstuurd providerverzoek kan wel kosten veroorzaken."); }
    finally { generationPending.current = false; setGenerating(false); }
  }

  async function retain(attachment: AgentAttachment) {
    if (!conversationId) return;
    await propose(async () => reviseAgentProposalAction(conversationId, [{ domain: "attachment", operation: "retain", args: { id: attachment.id } }]));
  }

  async function propose(operation: () => Promise<{ ok: true; proposal: AgentProposal } | { ok: false; error: string }>) {
    if (proposalPending.current) return;
    proposalPending.current = true; setProposing(true);
    try { const result = await operation(); if (result.ok) onProposal(result.proposal); else onError(result.error); }
    catch { onError("Het bijlagevoorstel is niet bevestigd opgeslagen. Er is niets gepubliceerd; je bestanden en invoer blijven behouden. Controleer de voorstellen voordat je opnieuw probeert."); }
    finally { proposalPending.current = false; setProposing(false); }
  }

  async function makeSlide(attachment: AgentAttachment) {
    if (!conversationId) return;
    await propose(async () => prepareImageSlideAction({ conversationId, assetId: attachment.id, name: attachment.title, title: slideTitle, body: slideBody, orientation, fit, logoId: logoId || undefined }));
  }

  return <section className={styles.attachments} aria-label="Privébijlagen en beeldgeneratie">
    <h2>Bijlagen en afbeeldingen</h2>
    {readError && <p role="alert">{readError}</p>}
    <p>Bijlagen blijven privé bij dit gesprek. Alleen een apart goedgekeurd voorstel bewaart ze in Media of gebruikt ze in een slide/playlist. Ongebruikte privébestanden worden na zeven dagen gecontroleerd opgeruimd.</p>
    <label>Bijlagen kiezen<input type="file" multiple accept="image/jpeg,image/png,image/webp,image/avif,image/gif,image/svg+xml,video/mp4,video/webm,.mp4,.webm" onChange={event => { const files = Array.from(event.target.files ?? []); event.target.value = ""; if (files.length) void selectFiles(files); }} /></label>
    <label>Doelformaat<select value={orientation} onChange={event => setOrientation(event.target.value as "landscape" | "portrait")} disabled={generating}><option value="landscape">Liggend · 16:9</option><option value="portrait">Staand · 9:16</option></select></label>
    {transfers.map(transfer => <div key={transfer.id} className={styles.transfer}><strong>{transfer.file.name}</strong><progress aria-label={`Overdracht ${transfer.file.name}`} max={100} value={transfer.progress} /><p role={transfer.status === "failed" ? "alert" : "status"}>{transfer.message ?? (transfer.status === "received" ? "Ontvangen · verwerkingsstatus hieronder" : `${transfer.progress}% verstuurd`)}</p>{transfer.status === "failed" && conversationId && <Button variant="secondary" onClick={() => void transmit(transfer, conversationId)}>Dezelfde bijlage opnieuw proberen</Button>}</div>)}
    {conversationId && videoConfig && videos.map(video => <VideoUploadForm key={video.id} {...videoConfig} canUpload agentConversationId={conversationId} initialFile={video.file} onComplete={() => void load(conversationId)} />)}
    {videos.length > 0 && !videoConfig && <p role="alert">Video-upload is niet geconfigureerd. Er is geen video opgeslagen; laat de bestaande Supabase-uploadconfiguratie controleren.</p>}
    <details><summary>Afbeelding maken of bewerken</summary>
      <p>‘Genereer voorbeeld’ is een betaalde OpenAI-aanvraag, geen publicatie. De voorbeeldkwaliteit is begrensd. Video-upload en afspelen zijn beschikbaar; videosynthese niet.</p>
      <label>Naam van het beeldconcept<input value={title} onChange={event => setTitle(event.target.value)} minLength={2} maxLength={120} disabled={generating} /></label>
      <label>Beeldopdracht<textarea value={prompt} onChange={event => setPrompt(event.target.value)} maxLength={4000} rows={3} disabled={generating} /></label>
      <label>Formaat<select value={orientation} onChange={event => setOrientation(event.target.value as "landscape" | "portrait")} disabled={generating}><option value="landscape">Liggend · 16:9</option><option value="portrait">Staand · 9:16</option></select></label>
      <label>Bronafbeelding bewerken (optioneel)<select value={referenceId} onChange={event => setReferenceId(event.target.value)} disabled={generating}><option value="">Nieuwe afbeelding maken</option>{attachments.filter(attachment => attachment.kind === "image" && attachment.status === "ready").map(attachment => <option key={attachment.id} value={attachment.id}>{attachment.title}</option>)}</select></label>
      <Button variant="primary" disabled={generating || !prompt.trim() || title.trim().length < 2} onClick={() => void generate()}>{generating ? "Beeldconcept maken…" : "Genereer voorbeeld (betaald)"}</Button>
      <p>AI kan tekst of logo’s veranderen. Bewaar originele logo’s als afzonderlijke inhoud en zet exacte data, tijden en sponsorvermeldingen in de bewerkbare slide.</p>
    </details>
    <label>Voorbeeld passen<select value={fit} onChange={event => setFit(event.target.value as "contain" | "cover")}><option value="contain">Volledig beeld · passen</option><option value="cover">Doelformaat vullen · bijsnijden</option></select></label>
    <details><summary>Exacte tekst en origineel logo in een slide</summary><p>Deze tekst blijft bewerkbaar en wordt niet door de beeldgenerator getekend. Met tekst reserveert het ontwerp een afzonderlijk leesvlak; controleer het echte Studio-voorbeeld vóór akkoord.</p><label>Titel op de slide<input value={slideTitle} onChange={event => setSlideTitle(event.target.value)} maxLength={240} /></label><label>Exacte datum, tijd en sponsorvermeldingen<textarea value={slideBody} onChange={event => setSlideBody(event.target.value)} maxLength={4000} rows={3} /></label><label>Origineel logo (optioneel)<select value={logoId} onChange={event => setLogoId(event.target.value)}><option value="">Geen afzonderlijk logo</option>{attachments.filter(attachment => attachment.kind === "image" && attachment.status === "ready").map(attachment => <option key={attachment.id} value={attachment.id}>{attachment.title}</option>)}</select></label></details>
    <div className={styles.attachmentGrid}>{attachments.map(attachment => <article key={attachment.id}>
      <h3>{attachment.title}</h3><p>{({ uploading: "Uploaden", processing: "Verwerken", ready: "Gereed", validation_failed: "Validatie mislukt", quarantined: "In quarantaine", discarded: "Opgeruimd" })[attachment.status] ?? "Status controleren"} · {attachment.retained ? "Bevestigd bewaard" : "Privéconcept"}</p>
      <div className={styles.attachmentPreview} style={{ aspectRatio: orientation === "portrait" ? "9 / 16" : "16 / 9" }}>{attachment.kind === "video" && attachment.sourceUrl ? <video controls muted playsInline preload="metadata" src={attachment.sourceUrl} style={{ objectFit: fit }}><track kind="captions" /></video> : attachment.previewUrl ? <AssetImage src={attachment.sourceUrl ?? attachment.previewUrl} alt={`Voorbeeld ${attachment.title}`} style={{ objectFit: fit }} /> : <p>Een veilig voorbeeld volgt na verwerking.</p>}</div>
      <p>Bijlage-ID: {attachment.id}</p>
      {!attachment.retained && <Button variant="secondary" disabled={proposing || attachment.status !== "ready"} onClick={() => void retain(attachment)}>Bewaarvoorstel maken</Button>}
      {attachment.kind === "image" && <Button variant="secondary" disabled={proposing || attachment.status !== "ready"} onClick={() => void makeSlide(attachment)}>Voorstel voor slide maken</Button>}
    </article>)}</div>
  </section>;
}
