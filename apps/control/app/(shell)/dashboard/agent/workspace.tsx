"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@veyocast/ui";
import type { AgentAttachment, AgentProposal, AgentStep } from "../../../../lib/agent/catalog";
import { decideAgentProposalAction, openAgentConversationAction, reviseAgentProposalAction, sendAgentMessageAction } from "./actions";
import { AgentAttachmentsPanel } from "./attachments-panel";
import { AgentStudioPreview } from "./studio-preview";
import { AgentPlaylistPreview } from "./playlist-preview";
import { AgentPlayerStatus } from "./player-status";
import styles from "./workspace.module.css";

type Message = { role: "user" | "assistant"; content: string; choices?: string[]; generationBrief?: string };
const statuses: Record<string, string> = { proposed: "Voorstel · nog niets uitgevoerd", approved: "Akkoord opgeslagen", running: "Gedeeltelijk uitgevoerd · hervatbaar", failed: "Stap mislukt · bevestigde stappen blijven behouden", review_required: "Gegevens gewijzigd · nieuw voorstel nodig", cancelled: "Geannuleerd", completed: "Alle stappen bevestigd uitgevoerd" };
const operations: Record<string, string> = { rename: "Naam wijzigen", groups: "Groepen toewijzen", publish: "Publiceren", add_item: "Media toevoegen", update_details: "Gegevens bewerken", move_item: "Item ordenen", remove_item: "Item verwijderen", replace_item: "Media vervangen", update_item: "Iteminstellingen wijzigen", create: "Aanmaken", update: "Bewerken", archive: "Archiveren", restore: "Herstellen", delete: "Verwijderen", disable: "Uitschakelen", enable: "Inschakelen", save: "Ontwerp opslaan" };
const fields: Record<string, string> = { id: "Object-ID", itemId: "Exacte playlistvermelding", mediaAssetId: "Media-ID", revision: "Verwachte versie", payload: "Exacte wijzigingen", screenIds: "Doelschermen", notes: "Publicatienotitie", name: "Naam", title: "Titel", groupIds: "Groepen", durationSeconds: "Speelduur in seconden", startsAt: "Begint op", endsAt: "Eindigt op", direction: "Verplaatsing", fitMode: "Beeld passen", description: "Omschrijving", newId: "Nieuw object-ID" };

function showValue(value: unknown, key: string, timezone: string): string {
  if (value === null || value === undefined) return "—";
  if (Array.isArray(value)) return value.map(entry => showValue(entry, key, timezone)).join(", ");
  if (typeof value === "object") return Object.entries(value).map(([field, entry]) => `${fields[field] ?? field}: ${showValue(entry, field, timezone)}`).join("\n");
  if (["startsAt", "endsAt", "visibleFrom", "visibleUntil"].includes(key) && typeof value === "string" && Number.isFinite(Date.parse(value))) return `${new Intl.DateTimeFormat("nl-NL", { dateStyle: "medium", timeStyle: "short", timeZone: timezone }).format(new Date(value))} (${timezone}) · ${value}`;
  if (key === "direction") return ({ up: "Eén positie omhoog", down: "Eén positie omlaag", start: "Naar het begin", end: "Naar het einde" })[String(value)] ?? String(value);
  return String(value);
}

export function AgentWorkspace({ tenantName, timezone, initialProposals, initialConversationId, videoConfig }: { tenantName: string; timezone: string; initialProposals: AgentProposal[]; initialConversationId?: string | null; videoConfig: { anonKey: string; supabaseUrl: string } | null }) {
  const [conversationId, setConversationId] = useState<string | null>(initialConversationId ?? initialProposals[0]?.conversation_id ?? null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [proposals, setProposals] = useState(initialProposals);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<AgentAttachment[]>([]);
  const [risks, setRisks] = useState<Record<string, { hash: string; messages: string[] }>>({});
  const pending = useRef(false);
  const generation = useRef(0);
  const conversation = useRef(conversationId);
  const opening = useRef<Promise<string> | null>(null);

  async function ensureConversation() {
    if (conversation.current) return conversation.current;
    if (!opening.current) opening.current = openAgentConversationAction().then(opened => {
      if (!opened.ok) throw Error(opened.error);
      conversation.current = opened.id; setConversationId(opened.id); return opened.id;
    }).finally(() => { opening.current = null; });
    return opening.current;
  }

  async function run(action: () => Promise<void>) {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError(null);
    try { await action(); } catch { setError("De verbinding is onderbroken. Je invoer en oorspronkelijke voorstellen blijven behouden; controleer hun status voordat je hervat."); }
    finally { pending.current = false; setBusy(false); }
  }

  function updateProposal(proposal: AgentProposal, supersedesId?: string) { setProposals(current => [proposal, ...current.filter(item => item.id !== proposal.id).map(item => item.id === supersedesId || proposal.status === "proposed" && item.status === "proposed" && item.conversation_id === proposal.conversation_id ? { ...item, status: "cancelled" } : item)]); }

  async function send(value = text) {
    const content = value.trim();
    if (!content || content.length > 8000) return;
    await run(async () => {
      const id = await ensureConversation();
      const next: Message[] = [...messages, { role: "user", content }];
      const requestGeneration = ++generation.current;
      const result = await sendAgentMessageAction(id, next.slice(-20).map(message => ({ role: message.role, content: message.content })));
      if (requestGeneration !== generation.current) return;
      if (!result.ok) { setError(result.error); return; }
      setMessages([...next, { role: "assistant", content: result.reply.text, choices: result.reply.choices, generationBrief: result.reply.generationBrief }]); setText("");
      if (result.reply.proposal) updateProposal(result.reply.proposal, result.reply.supersedesId);
    });
  }

  async function decide(proposal: AgentProposal, approve: boolean, riskHash: string | null) {
    await run(async () => {
      const result = await decideAgentProposalAction(proposal.id, proposal.plan_hash, approve, riskHash);
      if (!result.ok && result.risk) setRisks(current => ({ ...current, [proposal.id]: result.risk! }));
      if (!result.ok) { setError(result.error); if (result.proposal) updateProposal(result.proposal); } else updateProposal(result.proposal);
    });
  }

  return <div className={styles.workspace} aria-busy={busy}>
    <p className={styles.context}>{tenantName} · {timezone} · bestaande beheerrechten</p>
    {error && <p className="notice notice--critical" role="alert">{error}</p>}
    <section aria-label="Gesprek" className={styles.conversation}>
      {!messages.length && <p>Vraag bijvoorbeeld welke playlist vanavond op het barscherm staat. Noem bij een beheeropdracht wat je wilt wijzigen; ik zoek eerst de actuele bestemming en inhoud.</p>}
      <div aria-live="polite" aria-relevant="additions">{messages.map((message, index) => <article key={index} className={styles.message}><strong>{message.role === "user" ? "Jij" : "VeyoCast-agent"}</strong><p>{message.content}</p>{message.choices && <div className={styles.actions}>{message.choices.map(choice => <Button key={choice} variant="secondary" disabled={busy} onClick={() => void send(choice)}>{choice}</Button>)}</div>}{message.generationBrief && <p>Beeldconcept: {message.generationBrief}</p>}</article>)}</div>
      <form onSubmit={event => { event.preventDefault(); void send(); }} className={styles.composer}>
        <label>Vraag of opdracht<textarea value={text} onChange={event => setText(event.target.value)} maxLength={8000} rows={3} disabled={busy} /></label>
        <Button variant="primary" type="submit" disabled={busy || !text.trim()}>{busy ? "Controleren…" : "Versturen"}</Button>
      </form>
    </section>
    <AgentAttachmentsPanel conversationId={conversationId} ensureConversation={ensureConversation} videoConfig={videoConfig} onProposal={updateProposal} onError={setError} onAttachmentsChange={setAttachments} generationBrief={messages.filter(message => message.generationBrief).at(-1)?.generationBrief} />
    <section aria-label="Voorstellen" className={styles.proposals}>
      <h2>Voorstellen en bevestigde stappen</h2>
      {proposals.map(proposal => <ProposalCard key={proposal.id} proposal={proposal} attachments={attachments} risk={risks[proposal.id]} busy={busy} onDecide={(approve, risk) => void decide(proposal, approve, risk)} onRevise={steps => void run(async () => {
        const result = await reviseAgentProposalAction(proposal.conversation_id, steps, { id: proposal.id, hash: proposal.plan_hash });
        if (!result.ok) setError(result.error); else setProposals(current => [result.proposal, ...current.map(item => item.id === proposal.id ? { ...item, status: "cancelled" } : item)]);
      })} />)}
      {!proposals.length && <p>Er is nog geen beheeropdracht voorgesteld of uitgevoerd.</p>}
    </section>
  </div>;
}

function ProposalCard({ proposal, attachments, risk, busy, onDecide, onRevise }: { proposal: AgentProposal; attachments: AgentAttachment[]; risk?: { hash: string; messages: string[] }; busy: boolean; onDecide: (approve: boolean, riskHash: string | null) => void; onRevise: (steps: AgentStep[]) => void }) {
  const [acceptRisk, setAcceptRisk] = useState(false);
  const editableSteps = proposal.plan.steps.slice(proposal.next_step);
  const original = JSON.stringify(editableSteps, null, 2);
  const [edited, setEdited] = useState(original);
  const [invalid, setInvalid] = useState(false);
  useEffect(() => { setEdited(JSON.stringify(proposal.plan.steps.slice(proposal.next_step), null, 2)); }, [proposal.plan_hash, proposal.next_step, proposal.plan.steps]);
  useEffect(() => { setAcceptRisk(false); }, [risk?.hash, proposal.plan_hash]);
  const dirty = edited !== original;
  let formSteps: AgentStep[] = [];
  try { const parsed: unknown = JSON.parse(edited); if (Array.isArray(parsed) && parsed.every(step => step && typeof step.args === "object" && step.args)) formSteps = parsed; } catch { formSteps = []; }
  function changeField(index: number, container: "args" | "payload", field: string, value: string | number) {
    const changed = structuredClone(formSteps);
    const step = changed[index]; if (!step) return;
    if (container === "payload") step.args.payload = { ...(step.args.payload as Record<string, unknown>), [field]: value };
    else step.args[field] = value;
    setEdited(JSON.stringify(changed, null, 2)); setInvalid(false);
  }
  const editable = ["proposed", "approved", "running", "review_required", "failed"].includes(proposal.status);
  const actionable = ["proposed", "approved", "running", "failed"].includes(proposal.status);
  return <article className={styles.proposal}>
    <h3>{statuses[proposal.status] ?? "Status controleren"}</h3>
    <p>Tijdzone: {proposal.plan.timezone}. Akkoord geldt uitsluitend voor deze onveranderlijke voorstelversie.</p>
    {proposal.last_error_code && <p role="alert">{({ "42501": "Je actuele rechten of de privébijlage staan deze stap niet toe.", "23514": "De inhoud is niet gereed of voldoet niet aan de bestaande domeincontrole.", "40001": "Het object is intussen gewijzigd; controleer een nieuw voorstel.", "PT409": "De verwachte objectversie is veranderd; controleer een nieuw voorstel." })[proposal.last_error_code] ?? "De stap kon technisch niet bevestigd worden."} Eerdere bevestigde stappen blijven behouden. Controleer het gekoppelde object en hervat alleen de resterende stap of pas het voorstel aan.</p>}
    <ol>{proposal.plan.steps.map((step, index) => <li key={step.commandKey}><strong>{operations[step.operation] ?? step.operation}: <Link href={step.href}>{step.label}</Link></strong><p>{index < proposal.next_step ? "✓ Bevestigd uitgevoerd" : index === proposal.next_step && proposal.last_error_code ? "Niet uitgevoerd · herstel nodig" : "Nog niet uitgevoerd"}</p>{step.affectedScreens.length > 0 && <p>Betrokken schermen: {step.affectedScreens.map(screen => screen.name).join(", ")}. Een gedeelde playlistwijziging kan alle gekoppelde schermen raken.</p>}<dl>{Object.entries(step.args).filter(([key]) => !["document", "assetIds", "updatedAt"].includes(key)).map(([key, value]) => <div key={key}><dt>{fields[key] ?? key}</dt><dd>{showValue(value, key, proposal.plan.timezone)}</dd></div>)}</dl></li>)}</ol>
    {proposal.plan.steps.filter(step => step.domain === "studio" && step.args.document).map(step => <AgentStudioPreview key={step.commandKey} step={step} proposalId={proposal.id} stepIndex={proposal.plan.steps.indexOf(step)} attachments={attachments} />)}
    {proposal.plan.steps.filter(step => step.domain === "playlist" && step.operation === "publish").map(step => <AgentPlaylistPreview key={step.commandKey} proposalId={proposal.id} stepIndex={proposal.plan.steps.indexOf(step)} revision={proposal.next_step} />)}
    {proposal.receipts.map(receipt => { const step = proposal.plan.steps[receipt.step]; if (!step) return null; const id = receipt.result.projectId ?? receipt.result.playlistId ?? receipt.result.assetId; const href = step.domain === "studio" && id ? `/dashboard/studio/${String(id)}` : step.href; return <p key={receipt.step}><Link href={href}>Open bevestigd resultaat: {step.label}</Link></p>; })}
    {editable && formSteps.map((step, index) => <fieldset key={index} disabled={busy}><legend>Stap {proposal.next_step + index + 1} aanpassen</legend>{(["args", "payload"] as const).flatMap(container => Object.entries(container === "args" ? step.args : step.args.payload && typeof step.args.payload === "object" ? step.args.payload : {}).filter(([key, value]) => ["name", "title", "description", "notes", "durationSeconds"].includes(key) && ["string", "number"].includes(typeof value)).map(([field, value]) => <label key={`${container}:${field}`}>{fields[field] ?? field}<input type={typeof value === "number" ? "number" : "text"} value={String(value)} onChange={event => changeField(index, container, field, typeof value === "number" ? Number(event.target.value) : event.target.value)} /></label>))}</fieldset>)}
    {editable && <details><summary>Voorstel aanpassen</summary><label>Exacte voorstelstappen<textarea className={styles.json} rows={10} value={edited} disabled={busy} onChange={event => { setEdited(event.target.value); setInvalid(false); }} /></label><p>Een wijziging maakt een nieuwe voorstelversie die je opnieuw moet controleren en goedkeuren. Je kunt ook in het gesprek aangeven wat anders moet.</p>{invalid && <p role="alert">Het voorstel is geen geldige lijst van stappen. Herstel de invoer; er is niets uitgevoerd.</p>}<Button variant="secondary" disabled={busy} onClick={() => { try { const steps = JSON.parse(edited) as AgentStep[]; if (!Array.isArray(steps)) throw Error(); onRevise(steps); } catch { setInvalid(true); } }}>Aangepast voorstel controleren</Button></details>}
    {dirty && <p role="status">Je aanpassingen zijn nog niet gecontroleerd of opgeslagen. Controleer eerst het aangepaste voorstel; de oorspronkelijke opdracht kan hier niet worden uitgevoerd.</p>}
    {risk && <aside aria-label="Actuele risico’s"><ul>{risk.messages.map(message => <li key={message}>{message}</li>)}</ul><label className={styles.risk}><input type="checkbox" checked={acceptRisk} onChange={event => setAcceptRisk(event.target.checked)} disabled={busy} />Ik bevestig uitsluitend deze getoonde risico’s voor deze stap.</label></aside>}
    {actionable && <div className={styles.actions}><Button variant="primary" disabled={busy || dirty || Boolean(risk && !acceptRisk)} onClick={() => onDecide(true, acceptRisk ? risk?.hash ?? null : null)}>{proposal.status === "proposed" ? "Akkoord en uitvoeren" : "Bevestigde opdracht hervatten"}</Button><Button variant="secondary" disabled={busy} onClick={() => onDecide(false, null)}>Annuleren</Button></div>}
    {proposal.status === "completed" && <p role="status">De beheeracties zijn bevestigd. ‘Gepubliceerd’ is nog geen ontvangstbewijs: <Link href="/dashboard/screens">controleer de actuele status per scherm</Link>. Players nemen alleen volledig voorbereide wijzigingen over op hun normale veilige overgang.</p>}
    {proposal.receipts.filter(receipt => proposal.plan.steps[receipt.step]?.operation === "publish" && typeof receipt.result.releaseId === "string").map(receipt => <AgentPlayerStatus key={receipt.step} releaseId={String(receipt.result.releaseId)} screenIds={proposal.plan.steps[receipt.step]!.args.screenIds as string[]} />)}
  </article>;
}
