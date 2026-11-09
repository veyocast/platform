"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@veyocast/ui";
import type { SportlinkSeasonInventory, SportlinkSeasonInventoryRow, SportlinkSeasonPreview } from "@veyocast/contracts";
import { formatTenantDateTime } from "../../../../../../lib/tenant-time";
import type { DynamicSlidePreviewResult } from "../../../slides/actions";
import { DynamicSlideLivePreview } from "../../../slides/new/dynamic-slide-live-preview";
import { applySeasonSwitchAction, previewSeasonSwitchAction } from "./season-switch-actions";
import {
  readSeasonJournal, seasonCommands, seasonPreviewRequest, seasonResourceKey, seasonSwitchBatchLimit,
  type SeasonJournal
} from "./season-switch-state";
import styles from "./season-switch.module.css";

const stateLabels = {
  current: "Actueel", available: "Voorstel beschikbaar", choice_required: "Keuze nodig",
  source_unavailable: "Brondata nog niet beschikbaar", no_successor: "Geen opvolger gevonden",
  locked: "Historisch of actief vastgezet", conflict: "Conflict sinds controle", malformed: "Handmatige controle nodig",
  broad_unchanged: "Brede selectie blijft behouden"
} as const;

const impactStateLabels: Record<string, string> = {
  draft_playlist: "Conceptplaylist", immutable_release: "Vastgelegde publicatie",
  removed_schedule: "Verwijderde planning", disabled_schedule: "Uitgeschakelde planning",
  historical_schedule: "Eerdere planning", recurring_schedule: "Terugkerende planning",
  future_schedule: "Toekomstige planning", configured_schedule: "Ingestelde planning",
  desired_publication: "Doelpublicatie", default_publication: "Standaardpublicatie",
  configured_zone: "Ingestelde compositiezone", historical_zone: "Eerdere compositiezone",
  confirmed_publication: "Historisch Playerframe"
};

type Review = { review: SportlinkSeasonPreview; screenPreview: DynamicSlidePreviewResult | null };
type Props = { inventory: SportlinkSeasonInventory; actorScope: string; canWriteDesigns: boolean; canWriteRunbooks: boolean };

function contextText(context: SportlinkSeasonInventoryRow["bindings"][number]["currentContext"]) {
  if (!context) return "De bestaande context is niet volledig bevestigd.";
  return `Team ${context.providerTeamId} · seizoen ${context.seasonId ?? "actueel"} · competitie ${context.competitionId ?? "actuele selectie"} · poule ${context.poolId ?? "geen vaste poule"} · fase ${context.phaseId ?? "geen vaste fase"}`;
}

const restoreLinkLabel = (href: string) => href.startsWith("/dashboard/publications/") ? "Eerdere publicatie en herstel bekijken" : href.includes("#version-history-title") ? "Ontwerpversies en nieuwe basis bekijken" : "Publicatiegebruik bekijken";
const publishLinkLabel = (href: string) => /\/playlists\/[^/]+\/publish(?:\?|$)/u.test(href) ? "Via bestaande preflight voorbereiden" : "Playlists en planning bekijken";

function Impact({ impact }: { impact: SportlinkSeasonInventoryRow["impact"] }) {
  return <details className={styles.impact}>
    <summary>Gebruik en publicaties {impact.knownCount === null ? "· totaal onbekend" : `· ${impact.knownCount} bekend`}</summary>
    {impact.unknown ? <p>Een deel van het gebruik is niet bevestigd. Dit overzicht bewijst geen zichtbaar Player-frame.</p> : null}
    {impact.references.length ? <ul>{impact.references.map((reference, index) => <li key={`${reference.kind}:${reference.id}:${index}`}>
      {reference.href ? <Link href={reference.href}>{reference.name}</Link> : reference.name} · {impactStateLabels[reference.state] ?? "Gebruik nog niet geclassificeerd"}
      {reference.state === "confirmed_publication" ? <span> · eerder gemeld; huidige weergave niet bevestigd</span> : null}
      {reference.confirmedVersionId ? <span className={styles.code}> · versie bij gemeld Playerframe {reference.confirmedVersionId}</span> : null}
    </li>)}</ul> : <p>Geen bevestigde verwijzingen in deze inventaris.</p>}
    {impact.truncated ? <p>Niet alle verwijzingen passen op deze pagina. Open het oorspronkelijke object voor het volledige beheer.</p> : null}
  </details>;
}

export function SeasonSwitchWorkspace({ inventory, actorScope, canWriteDesigns, canWriteRunbooks }: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [choices, setChoices] = useState<Record<string, Record<string, string>>>(() => Object.fromEntries(inventory.rows.map(row => [seasonResourceKey(row), Object.fromEntries(row.bindings.map(binding => [binding.fromProviderTeamId, row.state === "available" && !binding.candidatesTruncated && binding.candidates.length === 1 ? binding.candidates[0]!.candidateId : ""]))])));
  const [clearMatches, setClearMatches] = useState<Record<string, boolean>>({});
  const [reviews, setReviews] = useState<Record<string, Review>>({});
  const [journal, setJournal] = useState<SeasonJournal | null>(null);
  const journalRef = useRef<SeasonJournal | null>(null), runningRef = useRef(false);
  const [hydrated, setHydrated] = useState(false), [busy, setBusy] = useState(false), [confirmed, setConfirmed] = useState(false), [recoveryBlocked, setRecoveryBlocked] = useState(false);
  const [notice, setNotice] = useState<string | null>(null), [error, setError] = useState<string | null>(null);
  const storageKey = `veyocast.season-switch.v1:${actorScope}`;
  const locked = busy || Boolean(journal) || recoveryBlocked;
  const selectedRows = inventory.rows.filter(row => selected.includes(seasonResourceKey(row)));
  const reviewed = selectedRows.length > 0 && selectedRows.every(row => reviews[seasonResourceKey(row)]?.review.canApply);

  useEffect(() => {
    try { journalRef.current = readSeasonJournal(sessionStorage.getItem(storageKey), actorScope); setJournal(journalRef.current); }
    catch { setRecoveryBlocked(true); setError("Het lokale opdrachtbewijs kon niet worden gecontroleerd. Er wordt geen nieuwe opdracht verstuurd. De serverversies blijven behouden. Open deze pagina in de oorspronkelijke sessie of vraag je beheerder het ontvangstbewijs te controleren."); }
    setHydrated(true);
  }, [actorScope, storageKey]);

  function choose(row: SportlinkSeasonInventoryRow, teamId: string, candidateId: string) {
    if (locked) return;
    const key = seasonResourceKey(row);
    setChoices(current => ({ ...current, [key]: { ...current[key], [teamId]: candidateId } }));
    setReviews(current => { const next = { ...current }; delete next[key]; return next; });
    setConfirmed(false); setError(null);
  }

  function toggle(row: SportlinkSeasonInventoryRow, checked: boolean) {
    if (locked) return;
    const key = seasonResourceKey(row);
    if (checked && selected.length >= seasonSwitchBatchLimit) { setError("Werk maximaal 25 expliciet gekozen concepten per bevestiging bij."); return; }
    setSelected(current => checked ? [...current, key] : current.filter(value => value !== key));
    setConfirmed(false); setError(null);
  }

  async function reviewSelected() {
    if (locked || !hydrated || !selectedRows.length) return;
    setBusy(true); setError(null); setNotice(null); setConfirmed(false);
    const next: Record<string, Review> = {};
    try {
      for (const row of selectedRows) {
        const key = seasonResourceKey(row);
        const input = seasonPreviewRequest(row, choices[key] ?? {}, clearMatches[key] ?? false);
        const result = await previewSeasonSwitchAction(input, actorScope);
        if (result.ok) next[key] = { review: result.review, screenPreview: result.screenPreview };
        else setError(result.error);
      }
      setReviews(next);
      setNotice("De controle heeft niets opgeslagen of gepubliceerd. Beoordeel de oude en nieuwe koppelingen en de inhoud voordat je bevestigt.");
    } catch { setError("Kies voor ieder team een volledige, gecontroleerde context. Je ontwerpen zijn niet gewijzigd."); }
    finally { setBusy(false); }
  }

  function persist(value: SeasonJournal) {
    sessionStorage.setItem(storageKey, JSON.stringify(value));
    journalRef.current = value;
    setJournal(value);
  }

  async function runCommands(value: SeasonJournal) {
    if (runningRef.current) return;
    runningRef.current = true;
    setBusy(true); setError(null);
    let next = value;
    try {
      for (let index = 0; index < next.commands.length; index++) {
        const command = next.commands[index]!;
        if (command.result) continue;
        const response = await applySeasonSwitchAction(command.request, actorScope);
        if (!response.ok) { setError(response.error); continue; }
        next = { ...next, commands: next.commands.map((item, position) => position === index ? { ...item, result: response.receipt } : item) };
        journalRef.current = next;
        setJournal(next);
        try { persist(next); }
        catch { setError("Het antwoord is bevestigd, maar het lokale bewijs kon niet worden vernieuwd. Houd deze pagina open. Een herhaling gebruikt dezelfde opdracht en maakt geen tweede wijziging."); break; }
      }
      setNotice("Alleen bevestigde conceptopslag telt als bijgewerkt. Inhoud voorbereiden, preflight, publiceren en een zichtbaar scherm zijn afzonderlijke stappen.");
    } catch { setError("Een antwoord ontbreekt. Controleer dezelfde oorspronkelijke opdrachten opnieuw; de overige uitkomsten blijven zichtbaar."); }
    finally { runningRef.current = false; setBusy(false); }
  }

  function applySelected() {
    if (!reviewed || !confirmed || locked || !hydrated || journalRef.current) return;
    try {
      const commands = seasonCommands(selectedRows.map(row => reviews[seasonResourceKey(row)]!.review), selectedRows.map(() => crypto.randomUUID()), crypto.randomUUID());
      const value: SeasonJournal = { schemaVersion: 1, actorScope, commands };
      persist(value); void runCommands(value);
    } catch { setError("Het oorspronkelijke opdrachtbewijs kon niet veilig worden bewaard. Er is niets verstuurd. Maak browseropslag vrij en probeer opnieuw."); }
  }

  function finish() {
    if (!journal || journal.commands.some(command => !command.result) || busy) return;
    try { sessionStorage.removeItem(storageKey); journalRef.current = null; setJournal(null); setSelected([]); setReviews({}); setConfirmed(false); router.refresh(); }
    catch { setError("De uitkomsten blijven bewaard. Het lokale bewijs kon niet worden opgeruimd; probeer opnieuw."); }
  }

  const health = inventory.sourceHealth;
  return <div className={styles.workspace}>
    <section aria-labelledby="season-source-health" className={styles.panel}>
      <h2 id="season-source-health">Broncontrole</h2>
      <p><strong>{({ ready: "Bronselectie bevestigd", stale: "Bron is verouderd", incomplete: "Bronselectie onvolledig", unavailable: "Bron niet bevestigd" })[health.state]}</strong></p>
      <dl className={styles.facts}>
        <div><dt>Wedstrijden geslaagd</dt><dd>{formatTenantDateTime(health.matchesLastSuccessAt, inventory.connection.timeZone)}</dd></div>
        <div><dt>Competities geslaagd</dt><dd>{formatTenantDateTime(health.competitionsLastSuccessAt, inventory.connection.timeZone)}</dd></div>
        <div><dt>Werkelijk waargenomen dekking</dt><dd>{health.coverageKnown && health.observedThrough ? health.observedThrough : "Niet bevestigd"}</dd></div>
      </dl>
      {health.reasons.length ? <ul>{health.reasons.map(reason => <li key={reason}>{reason}</li>)}</ul> : null}
      <Link href="/dashboard/sources/sportlink#datasetstatus">Bronstatus controleren</Link>
      {inventory.integration.matchdayRunbooks === "unavailable" ? <p role="status">Wedstrijddag-draaiboeken zijn nog niet volledig geïnventariseerd. Hun gebruik en wijzigingen zijn onbekend; dit is geen lege selectie.</p> : null}
    </section>
    {error ? <p className="notice notice--critical" role="alert">{error}</p> : null}
    {notice ? <p className="notice notice--success" role="status">{notice}</p> : null}
    {journal ? <section className={styles.panel} aria-labelledby="season-receipts">
      <h2 id="season-receipts">Ontvangstrapport</h2>
      <p>Elke rij wordt afzonderlijk atomisch opgeslagen. Een ontbrekend antwoord blijft in afwachting; andere bevestigde rijen blijven bewaard.</p>
      <p>Dit rapport bevestigt de oorspronkelijke opdrachten. Open het actuele concept voor latere wijzigingen.</p>
      <ul className={styles.results}>{journal.commands.map(command => <li key={command.request.requestId}>
        <strong>{inventory.rows.find(row => seasonResourceKey(row) === seasonResourceKey(command.request))?.name ?? command.request.resourceId}</strong>
        <span>{command.result ? ({ applied: "Concept bijgewerkt", conflict: "Conflict — opnieuw controleren", blocked: "Geblokkeerd — selectie behouden" })[command.result.status] : "Antwoord in afwachting"}</span>
        {command.result?.reason ? <p>{command.result.reason}</p> : null}
        {command.result?.status === "applied" ? <p>Revisie {command.result.previousRevision} → {command.result.newRevision}. Nog niet gepubliceerd.</p> : null}
        <span className={styles.code}>Opdracht {command.request.requestId}</span>
        {command.result?.links.edit ? <Link href={command.result.links.edit}>Concept openen</Link> : null}
        {command.result?.status === "applied" ? <p>Open het concept om de inhoud voor te bereiden. Gebruik daarna de juiste versie in de bestaande playlist- en publicatiestroom.</p> : null}
        {command.result?.links.publish ? <Link href={command.result.links.publish}>{publishLinkLabel(command.result.links.publish)}</Link> : null}
        {command.result?.links.restore ? <Link href={command.result.links.restore}>{restoreLinkLabel(command.result.links.restore)}</Link> : null}
      </li>)}</ul>
      <div className={styles.actions}>
        {journal.commands.some(command => !command.result) ? <Button disabled={busy || !hydrated} onClick={() => void runCommands(journal)} variant="primary">Dezelfde opdrachten controleren</Button> : <Button disabled={busy} onClick={finish} variant="secondary">Rapport afronden en inventaris vernieuwen</Button>}
      </div>
    </section> : null}
    <section aria-labelledby="season-inventory-title">
      <div className={styles.sectionHeader}><h2 id="season-inventory-title">Koppelingen en impact</h2><span>{inventory.totalCount === null ? `${inventory.rows.length} op deze pagina · totaal onbekend` : `${inventory.totalCount} in deze selectie`}</span></div>
      <p>Standaard is niets geselecteerd. Brede selecties, historische publicaties en actieve draaiboeken blijven behouden.</p>
      {!inventory.targetSeasonId ? <p role="status">Kies eerst een doelseizoen uit de ingelezen Sportlink-contexten.</p> : null}
      {inventory.rows.length === 0 ? <p>Geen bevestigde ontwerpen in deze filterselectie. Een ontbrekende bron of integratie wordt hierboven afzonderlijk vermeld.</p> : null}
      <div className={styles.rows}>{inventory.rows.map(row => {
        const key = seasonResourceKey(row), review = reviews[key];
        const canWrite = row.resourceKind === "dynamic_slide" ? canWriteDesigns : canWriteRunbooks;
        return <article className={styles.panel} key={key} aria-labelledby={`season-row-${row.resourceId}`}>
          <div className={styles.rowHeader}>
            <label className={styles.check}><input type="checkbox" aria-label={`${row.name} selecteren`} checked={selected.includes(key)} disabled={!hydrated || locked || !row.canUpdate || !canWrite || !inventory.targetSeasonId} onChange={event => toggle(row, event.target.checked)} /><span><strong id={`season-row-${row.resourceId}`}>{row.name}</strong><small>{row.resourceKind === "dynamic_slide" ? "Sportlink-ontwerp" : "Wedstrijddag-draaiboek"}</small></span></label>
            <span className={styles.status}>{stateLabels[row.state]}</span>
          </div>
          <p>{row.reason}</p>
          {!canWrite ? <p>Je kunt deze koppeling lezen. Voor conceptwijzigingen is het bestaande bewerkrecht nodig.</p> : null}
          {row.bindings.map(binding => {
            const chosen = binding.candidates.find(candidate => candidate.candidateId === choices[key]?.[binding.fromProviderTeamId]);
            return <div className={styles.binding} key={binding.fromProviderTeamId}>
            <div><strong>Oorspronkelijke selectie</strong><p className={styles.code}>{contextText(binding.currentContext)}</p></div>
            {row.canUpdate && canWrite ? <label className={styles.field}><span>Nieuwe context voor team {binding.fromProviderTeamId}</span><select disabled={locked} value={choices[key]?.[binding.fromProviderTeamId] ?? ""} onChange={event => choose(row, binding.fromProviderTeamId, event.target.value)}>
              <option value="">Kies expliciet een broncontext</option>
              {binding.candidates.map(candidate => <option key={candidate.candidateId} value={candidate.candidateId}>{candidate.label} · team {candidate.context.providerTeamId} · seizoen {candidate.context.seasonId} · competitie {candidate.context.competitionId ?? "n.v.t."} · poule {candidate.context.poolId ?? "n.v.t."} · fase {candidate.context.phaseId ?? "n.v.t."}</option>)}
            </select></label> : null}
            {chosen && row.canUpdate && canWrite ? <p className={styles.code}>{chosen.reason === "same_team_identity" ? "Dezelfde canonieke teamcode." : "Een expliciet gekozen teamkoppeling; de naam bepaalt de identiteit niet."} Wedstrijdsoort: {chosen.qualifications.competitionType ?? "niet bevestigd"} · discipline: {chosen.qualifications.discipline ?? "niet bevestigd"} · klasse: {chosen.qualifications.level ?? "niet bevestigd"}. {contextText(chosen.context)}</p> : null}
            {binding.candidatesTruncated ? <p role="status">{binding.candidateCount} geldige kandidaten; een begrensd deel staat hier. Er is geen automatisch voorstel. Kies bewust of open het oorspronkelijke concept voor een uitgebreidere selectie.</p> : null}
          </div>; })}
          {row.resourceKind === "matchday_runbook" && row.canUpdate && canWrite ? <label className={styles.check}><input type="checkbox" disabled={locked} checked={clearMatches[key] ?? false} onChange={event => { setClearMatches(current => ({ ...current, [key]: event.target.checked })); setReviews(current => { const next = { ...current }; delete next[key]; return next; }); setConfirmed(false); }} /><span>Ik bevestig dat alle geselecteerde wedstrijden en de hoofdwedstrijd worden gewist als ze niet volledig bij de nieuwe context passen. Daarna kies ik opnieuw exacte wedstrijden.</span></label> : null}
          <Impact impact={row.impact} />
          <div className={styles.actions}>{row.links.edit ? <Link href={row.links.edit}>Oorspronkelijk ontwerp openen</Link> : null}{row.links.restore ? <Link href={row.links.restore}>{restoreLinkLabel(row.links.restore)}</Link> : null}</div>
          {review ? <section className={styles.review} aria-label={`Controle ${row.name}`}>
            <h3>Oude context → nieuwe context</h3>
            {review.review.newSelection.mappings.map(mapping => <p className={styles.code} key={mapping.fromProviderTeamId}>Team {mapping.fromProviderTeamId} → {contextText(mapping.context)}</p>)}
            {review.review.reasons.map(reason => <p key={reason}>{reason}</p>)}
            <p>{review.review.canApply ? "De gecontroleerde binding kan als concept worden opgeslagen." : "Deze rij kan nog niet worden opgeslagen; controleer de melding en bron."}</p>
            {review.screenPreview ? <DynamicSlideLivePreview loading={false} result={review.screenPreview} /> : <p>Schermvoorbeeld {({ ready: "beschikbaar via de oorspronkelijke editor", empty: "geldig leeg", unavailable: "niet beschikbaar; broncontrole ontbreekt", blocked: "geblokkeerd" })[review.review.preview.state]}. {review.review.preview.message}</p>}
          </section> : null}
        </article>;
      })}</div>
    </section>
    {!journal ? <section className={styles.panel} aria-labelledby="season-confirm-title">
      <h2 id="season-confirm-title">Geselecteerde concepten controleren</h2>
      <p>{selected.length} geselecteerd op deze pagina, maximaal 25 per bevestiging. Je bestaande publicaties blijven actief.</p>
      <div className={styles.actions}><Button disabled={!hydrated || locked || selectedRows.length === 0} onClick={() => void reviewSelected()} variant="secondary">Wijzigingen controleren</Button></div>
      {reviewed ? <><label className={styles.check}><input type="checkbox" checked={confirmed} disabled={busy} onChange={event => setConfirmed(event.target.checked)} /><span>Ik bevestig alleen deze {selectedRows.length} gecontroleerde conceptwijzigingen. Namen, opmaak, duur en thuis/uit blijven behouden. Ik publiceer hiermee niets.</span></label><Button disabled={!confirmed || busy || !hydrated} onClick={applySelected} variant="primary">Concepten bijwerken</Button></> : null}
    </section> : null}
  </div>;
}
