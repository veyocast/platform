"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, Database, FilePenLine, RefreshCw } from "lucide-react";
import { Button } from "@veyocast/ui";
import { syncContentFamilies, syncSlidePageCount, type SyncDynamicConfiguration, type SyncSlidePresentation } from "@veyocast/contracts";
import { SyncSlideStaticView, resolveSyncSystemAsset } from "@veyocast/content-templates/sync-slide-static-view";
import { SyncSportlinkControls } from "../slides/sync-sportlink-controls";
import { isSyncSportlinkType, type SyncSportlinkOptions } from "../slides/sync-sportlink-binding";
import { SyncStudioField as Field, SyncStudioFieldGroup as FieldGroup } from "./sync-studio-field";
import { SyncEngageControls } from "./sync-engage-controls";
import { SyncYouTubeControls } from "./sync-youtube-controls";
import { syncRowsFromText, syncLineupFromText } from "./sync-studio-recovery";
import { createSyncDesignWizardAction, loadSyncWizardSportlinkOptionsAction, previewSyncWizardAction } from "./sync-create-wizard-actions";
import {
  buildSyncWizardRequest, chooseSyncWizardTheme, connectedSyncWizardSeed, initialSyncCreateWizardDraft, prepareSyncWizardCommand,
  readSyncWizardJournal, syncCreateWizardDraftError, syncCreateWizardKey, syncWizardHref, syncWizardRowFamilies,
  type SyncCreateWizardDraft, type SyncCreateWizardJournal,
} from "./sync-create-wizard-state";
import type { SyncCreateWizardCommand, SyncCreateWizardData } from "./sync-create-wizard-types";
import styles from "./sync-create-wizard.module.css";
import { SyncBackgroundPicker } from "./sync-background-picker";
import { orientSyncBackground } from "../../../../lib/sync-background-choice";

const steps = ["Bron", "Inhoud", "Vormgeving", "Controleren"];
const rowHints: Record<string, string> = {
  menu: "Product | omschrijving | prijs | categorie",
  sponsors: "Naam | omschrijving | website | categorie",
  birthdays: "Naam | team | datum | leeftijd",
  training: "Team | dag en tijd | veld | trainer",
  volunteers: "Naam | taak | tijd | locatie",
  agenda: "Datum | activiteit | tijd | locatie",
  "team-info": "Naam | rol | nummer | informatie",
  standings: "Positie | team | gespeeld | punten",
  "period-standings": "Positie | team | gespeeld | punten",
};

/** The scope key unmounts stale requests when account, tenant or family changes. */
export function SyncCreateWizard({ data }: { data: SyncCreateWizardData }) {
  return <ScopedWizard key={syncCreateWizardKey(data)} data={data} />;
}

function ScopedWizard({ data }: { data: SyncCreateWizardData }) {
  const router = useRouter(), key = syncCreateWizardKey(data);
  const [draft, setDraft] = useState(() => initialSyncCreateWizardDraft(data));
  const [step, setStep] = useState(0), [hydrated, setHydrated] = useState(false);
  const [pending, setPending] = useState<SyncCreateWizardCommand | null>(null), [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null), [storageError, setStorageError] = useState(false), [corrupt, setCorrupt] = useState(false);
  const [notice, setNotice] = useState<string | null>(null), [confirmedHref, setConfirmedHref] = useState<string | null>(null);
  const [options, setOptions] = useState<SyncSportlinkOptions | null>(null), [optionsLoading, setOptionsLoading] = useState(false);
  const [optionsError, setOptionsError] = useState<string | null>(null), [optionsAttempt, setOptionsAttempt] = useState(0);
  const [preview, setPreview] = useState<Awaited<ReturnType<typeof previewSyncWizardAction>> | null>(null);
  const [previewKey, setPreviewKey] = useState(""), [previewing, setPreviewing] = useState(false), [previewError, setPreviewError] = useState<string | null>(null);
  const alive = useRef(true), pendingRef = useRef<SyncCreateWizardCommand | null>(null), busyRef = useRef(false), generation = useRef(0);
  const titleRef = useRef<HTMLHeadingElement>(null), draftRef = useRef(draft), stepRef = useRef(step);
  draftRef.current = draft; stepRef.current = step;
  const family = syncContentFamilies.find(value => value.id === data.family)!;
  const sport = Boolean(data.slideType && isSyncSportlinkType(data.slideType));
  const locked = busy || Boolean(pending) || Boolean(confirmedHref) || corrupt || !hydrated;
  const available = data.canCreateManual || data.canCreateConnected;
  const invalid = syncCreateWizardDraftError(draft);
  const compiled = useMemo(() => {
    if (draft.mode !== "connected") return { request: null, error: null };
    try { return { request: buildSyncWizardRequest(data, draft, options), error: null }; }
    catch (cause) { return { request: null, error: cause instanceof Error ? cause.message : "Controleer je bron en selectie." }; }
  }, [data, draft, options]);
  const requestKey = compiled.request ? JSON.stringify(compiled.request) : "";
  const previewCurrent = Boolean(preview?.ok && previewKey && previewKey === requestKey);
  const selectedSource = data.sources.find(source => source.id === draft.sourceId);
  const checkedSource = preview?.ok ? preview.source : null;
  const reviewSource = previewCurrent ? checkedSource : selectedSource;
  // Team controls need the family/type policy while a name is being edited.
  // The complete canonical schema is enforced before preview or any command.
  const cfg: SyncDynamicConfiguration | null = data.slideType ? { schemaVersion: 1, kind: "dynamic", rendererVersion: "sync-v1", sourceRevision: draft.presentation.sourceRevision, slideType: data.slideType, secondsPerPage: 5, seed: connectedSyncWizardSeed(draft.presentation) } : null;
  const bindingConfiguration = { teamSelection: { mode: draft.selection.mode, teamContexts: draft.selection.contexts }, birthday: { period: { days: draft.selection.birthdayDays } } };

  useEffect(() => {
    alive.current = true;
    try {
      const saved = readSyncWizardJournal(sessionStorage.getItem(key), data);
      if (saved) {
        setDraft(saved.draft); setStep(saved.pending ? 3 : saved.step);
        pendingRef.current = saved.pending; setPending(saved.pending);
        setNotice(saved.pending ? "Je oorspronkelijke opdracht is teruggevonden. Bevestig dezelfde opdracht om het ontvangstbewijs te controleren." : "Je bewaarde invoer is hersteld. Je kunt verder waar je was gebleven.");
      }
    } catch { setCorrupt(true); setError("Je bewaarde invoer kan niet veilig worden gelezen. Er is niets verstuurd. Houd deze pagina open en vraag ondersteuning; de oorspronkelijke browsergegevens blijven behouden."); }
    setHydrated(true);
    return () => { alive.current = false; generation.current++; };
  }, [key]);
  useEffect(() => {
    if (!hydrated || !sport || draft.mode !== "connected" || !draft.sourceId || pending) return;
    let cancelled = false;
    setOptions(null); setOptionsLoading(true); setOptionsError(null);
    void loadSyncWizardSportlinkOptionsAction({ sourceId: draft.sourceId }, data.actorScope).then(result => {
      if (cancelled || !alive.current) return;
      if (result.ok) setOptions(result.options); else setOptionsError(result.error);
    }).catch(() => { if (!cancelled && alive.current) setOptionsError("De teams en bronrechten konden niet worden bevestigd. Je selectie blijft behouden; laad de bron opnieuw."); })
      .finally(() => { if (!cancelled && alive.current) setOptionsLoading(false); });
    return () => { cancelled = true; };
  }, [hydrated, sport, draft.mode, draft.sourceId, data.actorScope, optionsAttempt, pending]);
  useEffect(() => { generation.current++; setPreviewing(false); }, [requestKey]);
  useEffect(() => {
    if (!hydrated) return;
    const leave = (event: BeforeUnloadEvent) => { if (!confirmedHref) { event.preventDefault(); event.returnValue = ""; } };
    window.addEventListener("beforeunload", leave);
    return () => window.removeEventListener("beforeunload", leave);
  }, [hydrated, confirmedHref]);

  function store(nextDraft: SyncCreateWizardDraft, nextStep: number, nextPending: SyncCreateWizardCommand | null) {
    const journal: SyncCreateWizardJournal = { schemaVersion: 1, tenantId: data.tenantId, actorScope: data.actorScope, family: data.family, step: nextStep, draft: nextDraft, pending: nextPending };
    try {
      const raw = JSON.stringify(journal);
      if (new TextEncoder().encode(raw).byteLength > 700_000) throw Error("bounds");
      sessionStorage.setItem(key, raw); setStorageError(false); return true;
    } catch { setStorageError(true); return false; }
  }
  function edit(next: SyncCreateWizardDraft) {
    if (locked) return;
    store(next, step, null); setDraft(next); setError(null); setNotice(null); setPreviewError(null);
  }
  function patch(value: Partial<SyncSlidePresentation>) { edit({ ...draft, presentation: { ...draft.presentation, ...value } }); }
  function style(value: Partial<SyncSlidePresentation["style"]>) { patch({ style: { ...draft.presentation.style, ...value } }); }
  function move(next: number) {
    if (locked) return;
    if (next > step && step === 0 && draft.mode === "connected" && (!draft.sourceId || !data.canCreateConnected)) { setError("Kies een beschikbare bron om verder te gaan, of kies handmatige invoer."); return; }
    if (next > step && step === 1 && (invalid || draft.mode === "connected" && compiled.error)) { setError(invalid ?? compiled.error); return; }
    store(draft, next, null); setStep(next); setError(null);
    requestAnimationFrame(() => titleRef.current?.focus());
  }
  async function checkPreview() {
    if (locked || previewing || !compiled.request) return;
    const sequence = ++generation.current, checked = requestKey;
    setPreviewing(true); setPreviewError(null);
    try {
      const result = await previewSyncWizardAction(compiled.request, data.actorScope);
      if (!alive.current || sequence !== generation.current) return;
      if (result.ok) { setPreview(result); setPreviewKey(checked); } else setPreviewError(result.error);
    } catch { if (alive.current && sequence === generation.current) setPreviewError("De broncontrole is niet bevestigd. Je invoer en de laatste volledige preview blijven behouden; probeer opnieuw."); }
    finally { if (alive.current && sequence === generation.current) setPreviewing(false); }
  }
  async function create() {
    if (!hydrated || corrupt || busyRef.current || confirmedHref || !available) return;
    if (!pendingRef.current && (data.themeDefaultsError || step !== 3 || invalid || draft.mode === "connected" && !previewCurrent)) return;
    const replaying = Boolean(pendingRef.current);
    let original: SyncCreateWizardCommand;
    try { original = pendingRef.current ?? prepareSyncWizardCommand(data, draft, options, crypto.randomUUID()); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Controleer je invoer voor je het ontwerp maakt."); return; }
    if (!store(draftRef.current, 3, original)) return;
    pendingRef.current = original; setPending(original); busyRef.current = true; setBusy(true); setError(null);
    try {
      const result = await createSyncDesignWizardAction(original, data.actorScope);
      if (!alive.current) return;
      if (!result.ok) {
        setError(result.error);
        // A refusal of this replay cannot disprove an earlier commit whose
        // response was lost. Retain its original body/nonce until confirmed.
        if (result.rejected && !replaying && store(draftRef.current, 3, null)) { pendingRef.current = null; setPending(null); }
        return;
      }
      if (!syncWizardHref(result.href)) { setError("De server bevestigde geen geldig ontwerp. Bevestig dezelfde oorspronkelijke opdracht opnieuw; je invoer blijft behouden."); return; }
      setConfirmedHref(result.href);
      try { sessionStorage.removeItem(key); } catch { setNotice("Je ontwerp is bevestigd. Het lokale ontvangstbewijs kon niet worden opgeruimd; open je ontwerp via de knop hieronder."); }
      router.push(result.href);
    } catch { if (alive.current) setError("Het antwoord is verloren gegaan. Je invoer en oorspronkelijke opdracht blijven behouden; bevestig dezelfde opdracht opnieuw."); }
    finally { busyRef.current = false; if (alive.current) setBusy(false); }
  }
  const p = draft.presentation;
  const display = draft.mode === "connected" ? preview?.ok ? preview.presentation : { ...connectedSyncWizardSeed(p), state: "empty" as const } : p;
  const matchFamily = ["scoreboard", "goal", "matchday", "next-match"].includes(data.family);
  const image = (data.images ?? []).find(value => p.style.backgroundAsset?.kind === "tenant" && value.id === p.style.backgroundAsset.mediaAssetId && value.checksumSha256 === p.style.backgroundAsset.checksumSha256);

  return <div className={styles.wizard} data-sync-create-family={data.family}>
    <header className={styles.header}>
      <Link href="/dashboard/content" className={styles.back}><ArrowLeft size={18} aria-hidden="true" /> Content</Link>
      <div><span className={styles.eyebrow}>{family.group} · Nieuw ontwerp</span><h1>{family.name}</h1><p>{family.description}</p></div>
      <span className={styles.badge}>{draft.mode === "connected" ? "Automatische bron" : "Zelf samenstellen"}</span>
    </header>
    <nav aria-label="Ontwerpstappen" className={styles.steps}><ol>{steps.map((label, index) => <li key={label}><button type="button" aria-current={step === index ? "step" : undefined} disabled={locked || index > step} onClick={() => move(index)}><span aria-hidden="true">{index < step ? <Check size={16} /> : index + 1}</span><span>{label}</span></button></li>)}</ol></nav>
    {notice && <p role="status" className={styles.notice}>{notice}</p>}
    {data.loadError && <p role="status" className={styles.notice}>{data.loadError} <Link href="/dashboard/sources">Bronnen bekijken</Link></p>}
    {data.themeDefaultsError && <p role="alert" className={styles.error}>{data.themeDefaultsError} Een teruggevonden oorspronkelijke opdracht kun je wel opnieuw controleren.</p>}
    {data.themeDefaults?.defaultThemeId === null && <p role="status" className={styles.notice}>Je bestaande standaardthema is niet beschikbaar voor nieuwe ontwerpen. Dit nieuwe ontwerp begint met FieldFlow; je bestaande themakeuze is niet gewijzigd.</p>}
    {error && <p role="alert" className={styles.error}>{error}</p>}
    {storageError && <div role="alert" className={styles.error}><p>Je browser kan de invoer niet veilig bewaren. Er wordt geen opdracht verstuurd. Houd deze pagina open, maak browseropslag vrij en probeer opnieuw.</p><Button variant="secondary" onClick={() => store(draft, step, pendingRef.current)}>Browseropslag opnieuw controleren</Button></div>}
    {!available && <p role="alert" className={styles.error}>Je hebt geen rechten om dit ontwerp te maken. Vraag een beheerder om toegang; er wordt niets aangemaakt.</p>}
    <div className={styles.layout}>
      <section className={styles.panel} aria-labelledby="sync-wizard-step-title">
        <div className={styles.sectionTitle}><span>Stap {step + 1} van 4</span><h2 id="sync-wizard-step-title" ref={titleRef} tabIndex={-1}>{steps[step]}</h2><p>{["Kies waar je inhoud vandaan komt.", "Geef je ontwerp inhoud die bij je vereniging past.", "Maak er jouw clubscherm van.", "Controleer alles voordat je het ontwerp maakt."][step]}</p></div>
        <fieldset disabled={locked || !available} className={styles.fields}>
          <legend className={styles.srOnly}>{steps[step]}</legend>
          {step === 0 && <>
            <div className={styles.choices} role="group" aria-label="Herkomst van de inhoud">
              {data.canCreateConnected && <button type="button" className={styles.choice} aria-pressed={draft.mode === "connected"} onClick={() => edit({ ...draft, mode: "connected" })}><Database size={24} aria-hidden="true" /><strong>Automatisch uit een bron</strong><span>Opgeslagen gegevens uit je gekoppelde bron, in je eigen clubstijl.</span></button>}
              {data.canCreateManual && <button type="button" className={styles.choice} aria-pressed={draft.mode === "manual"} onClick={() => edit({ ...draft, mode: "manual" })}><FilePenLine size={24} aria-hidden="true" /><strong>Zelf samenstellen</strong><span>Jij bepaalt de tekst en inhoud. Je kunt het ontwerp later verder bewerken.</span></button>}
            </div>
            {draft.mode === "connected" ? <>
              <Field label="Gekoppelde bron" hint="Alleen actieve bronnen van je eigen vereniging zijn beschikbaar."><select value={draft.sourceId} onChange={event => { setOptions(null); edit({ ...draft, sourceId: event.target.value, selection: { ...draft.selection, contexts: [] } }); }}><option value="">Kies een bron</option>{data.sources.map(source => <option key={source.id} value={source.id}>{source.name}</option>)}</select></Field>
              <SourceStatusWarning source={selectedSource} label="Status van de bron" />
              {!data.sources.length && <div className={styles.notice}><strong>Er is nog geen geschikte bron beschikbaar</strong><p>Koppel eerst je bron bij Bronnen. Je keuze blijft behouden; je kunt waar toegestaan ook zelf inhoud invoeren.</p><Link href="/dashboard/sources">Bronnen beheren <ArrowRight size={16} aria-hidden="true" /></Link></div>}
              {draft.sourceId && <p className={styles.hint}>De volgende stap controleert teams, beschikbare datasets en toestemming. Er wordt pas na jouw bevestiging een ontwerp gemaakt.</p>}
            </> : <p className={styles.hint}>{data.family === "engage" ? "Kies bij Inhoud een echte Engage-campagne. De opgeslagen kaart blijft ook zonder verbinding bruikbaar." : data.family === "youtube" ? "Kies bij Inhoud een geverifieerde videobron. Je opgeslagen kaart is de fallback wanneer online afspelen niet beschikbaar is." : "Begin met je eigen tekst en beelden. Dit is een ontwerp; toevoegen aan een playlist en publiceren doe je daarna."}</p>}
            {data.family === "goal" && <div className={styles.notice}><strong>Goalkaart of automatisch doelpuntmoment?</strong><p>Hier maak je een gewone kaart voor je playlist. Een kort doelpuntmoment boven lopende scherminhoud stel je apart in bij LEDScores.</p><Link href="/dashboard/studio/led-scores">Doelpuntmomenten instellen</Link></div>}
          </>}
          {step === 1 && <>
            <Field label="Naam van je ontwerp" hint="Deze naam gebruik je straks in je bibliotheek."><input value={p.name} minLength={2} maxLength={120} onChange={event => patch({ name: event.target.value })} /></Field>
            {draft.mode === "connected" && sport && cfg && <>
              <SyncSportlinkControls cfg={cfg} configuration={bindingConfiguration} options={options?.sourceId === draft.sourceId ? options : null} loading={optionsLoading} error={optionsError} onChange={selection => edit({ ...draft, selection })} />
              {optionsError && <Button variant="secondary" onClick={() => setOptionsAttempt(value => value + 1)}><RefreshCw size={16} aria-hidden="true" /> Bron opnieuw laden</Button>}
            </>}
            <Field label="Titel op het scherm"><input value={p.title} maxLength={400} onChange={event => patch({ title: event.target.value })} /></Field>
            <Field label="Ondertitel"><input value={p.subtitle} maxLength={400} onChange={event => patch({ subtitle: event.target.value })} /></Field>
            {draft.mode === "connected" ? <p className={styles.hint}>Wedstrijden, personen, producten of nieuws worden uitsluitend uit de toegestane bron gelezen. Hieronder schrijf je alleen je eigen toelichting.</p> : <>
              {data.family === "engage" && <SyncEngageControls poll={p.poll} disabled={locked} onSelect={poll => patch({ poll })} />}
              {data.family === "youtube" && <SyncYouTubeControls url={p.youtubeUrl} disabled={locked} onSelect={youtubeUrl => patch({ youtubeUrl })} />}
              {syncWizardRowFamilies.has(data.family) && <Field label="Inhoudsregels" hint={`${rowHints[data.family] ?? "Tijd of nummer | naam of thuisteam | informatie of uitteam | locatie of resultaat"}. Eén regel per item; laat ontbrekende kolommen leeg.`}><textarea value={draft.rowsText} rows={6} maxLength={400_000} onChange={event => { const rowsText = event.target.value, rows = syncRowsFromText(rowsText); edit({ ...draft, rowsText, presentation: rows === null ? p : { ...p, rows, ownRowIndexes: [] } }); }} /></Field>}
              {data.family === "lineup" && <Field label="Opstelling" hint="Eén linie per regel; rugnummers van 1 tot 99 gescheiden door komma’s."><textarea rows={5} maxLength={4_000} value={draft.lineupText} onChange={event => { const lineupText = event.target.value, lineup = syncLineupFromText(lineupText); edit({ ...draft, lineupText, presentation: lineup === null ? p : { ...p, lineup } }); }} /></Field>}
              {matchFamily && <>
                <div className={styles.twoFields}><Field label="Thuisteam"><input maxLength={400} value={p.home?.name ?? ""} onChange={event => patch({ home: { team: "", ...p.home, name: event.target.value } })} /></Field><Field label="Uitteam"><input maxLength={400} value={p.away?.name ?? ""} onChange={event => patch({ away: { team: "", ...p.away, name: event.target.value } })} /></Field></div>
                <div className={styles.twoFields}>{([ ["Datum", "date"], ["Tijd", "time"], ["Score thuis", "homeScore"], ["Score uit", "awayScore"] ] as const).map(([label, field]) => <Field key={field} label={label}><input value={p.match?.[field] ?? ""} maxLength={field === "date" ? 400 : field === "time" ? 40 : 10} onChange={event => patch({ match: { homeScore: "", awayScore: "", date: "", time: "", clock: "", ...p.match, [field]: event.target.value } })} /></Field>)}</div>
              </>}
              {data.family === "rss" && <div className={styles.fields}><h3>Je eigen nieuwsberichten</h3>{p.news.map((news, index) => <div className={styles.news} key={index}><Field label={`Titel bericht ${index + 1}`}><input maxLength={400} value={news.title} onChange={event => patch({ news: p.news.map((item, i) => i === index ? { ...item, title: event.target.value } : item) })} /></Field><Field label={`Tekst bericht ${index + 1}`}><textarea maxLength={4_000} value={news.intro} onChange={event => patch({ news: p.news.map((item, i) => i === index ? { ...item, intro: event.target.value } : item) })} /></Field><Field label={`Bron bericht ${index + 1}`}><input maxLength={400} value={news.source} onChange={event => patch({ news: p.news.map((item, i) => i === index ? { ...item, source: event.target.value } : item) })} /></Field><Button variant="secondary" onClick={() => patch({ news: p.news.filter((_, i) => i !== index) })}>Bericht {index + 1} verwijderen</Button></div>)}<Button variant="secondary" disabled={p.news.length >= 50} onClick={() => patch({ news: [...p.news, { title: "", intro: "", source: "" }] })}>Nieuwsbericht toevoegen</Button></div>}
            </>}
            <Field label="Eigen toelichting"><textarea rows={4} maxLength={4_000} value={p.body} onChange={event => patch({ body: event.target.value })} /></Field>
            <div className={styles.twoFields}><Field label="Bovenlabel"><input value={p.topLabel} maxLength={400} onChange={event => patch({ topLabel: event.target.value })} /></Field><Field label="Voettekst"><input value={p.footer} maxLength={400} onChange={event => patch({ footer: event.target.value })} /></Field></div>
          </>}
          {step === 2 && <>
            <FieldGroup label="Schermformaat" className={`${styles.segmented}`}>{([ ["landscape", "Liggend · 16:9"], ["portrait", "Staand · 9:16"] ] as const).map(([orientation, label]) => <button type="button" key={orientation} aria-pressed={p.orientation === orientation} onClick={() => patch(orientSyncBackground(p, orientation))}>{label}</button>)}</FieldGroup>
            <FieldGroup label="Clubstijl" className={`${styles.segmented}`}>{([ ["onzetrots-tv", "OnzeTrots TV"], ["fieldflow", "FieldFlow"] ] as const).map(([theme, label]) => <button type="button" key={theme} disabled={Boolean(data.themeDefaultsError)} aria-pressed={p.theme === theme} onClick={() => { try { edit(chooseSyncWizardTheme(data, draft, theme)); } catch (cause) { setError(cause instanceof Error ? cause.message : "De themavoorkeuren konden niet worden bevestigd."); } }}>{label}</button>)}</FieldGroup>
            {data.themeDefaults?.profiles.find(profile => profile.themeId === p.theme)?.configured === false && <p className={styles.hint}>Dit thema is nog niet ingesteld voor je vereniging. Je begint met de standaardinstellingen; je eigen wijzigingen worden alleen in dit ontwerp bewaard.</p>}
            <SyncBackgroundPicker presentation={p} onChange={patch} disabled={locked} />
            {Boolean(data.images?.length) && <Button variant="secondary" onClick={() => { const first = data.images?.[0]; if (first) style({ background: "photo", backgroundAsset: { kind: "tenant", mediaAssetId: first.id, checksumSha256: first.checksumSha256 } }); }}>Eigen foto kiezen</Button>}
            {p.style.background === "photo" && <>{p.style.backgroundAsset?.kind === "tenant" && <Field label="Achtergrondfoto"><select value={image?.id ?? ""} onChange={event => { const selected = data.images?.find(value => value.id === event.target.value); if (selected) style({ backgroundAsset: { kind: "tenant", mediaAssetId: selected.id, checksumSha256: selected.checksumSha256 } }); }}><option value="" disabled>Kies een beschikbare foto</option>{data.images?.map(value => <option key={value.id} value={value.id}>{value.title}</option>)}</select></Field>}<Field label="Uitsnede"><select value={p.style.backgroundPosition} onChange={event => style({ backgroundPosition: event.target.value as SyncSlidePresentation["style"]["backgroundPosition"] })}>{([ ["center", "Midden"], ["top", "Boven"], ["bottom", "Onder"], ["left", "Links"], ["right", "Rechts"] ] as const).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field></>}
            {!data.images?.length && <p className={styles.hint}>Je kunt nu de vaste achtergronden gebruiken. Voeg een eigen foto toe bij <Link href="/dashboard/media">Media</Link> om die hier te kiezen.</p>}
            <div className={styles.twoFields}><Field label="Beweging"><select value={p.style.motion ?? "geen"} onChange={event => style({ motion: event.target.value as "rustig" | "dynamisch" | "geen" })}><option value="geen">Geen</option><option value="rustig">Rustig</option><option value="dynamisch">Dynamisch</option></select></Field><Field label="Seconden per pagina" hint="3 tot 120 seconden; handmatige ontwerpen maximaal 120 seconden totaal."><input type="number" inputMode="numeric" min={3} max={120} step={1} value={draft.seconds} onChange={event => edit({ ...draft, seconds: event.target.value })} /></Field></div>
            {syncWizardRowFamilies.has(data.family) && <Field label="Regels per pagina"><select value={p.rowsPerPage} onChange={event => patch({ rowsPerPage: Number(event.target.value) })}>{Array.from({ length: 8 }, (_, index) => <option key={index} value={index + 1}>{index + 1}</option>)}</select></Field>}
          </>}
          {step === 3 && <>
            <dl className={styles.summary}><div><dt>Ontwerp</dt><dd>{p.name}</dd></div><div><dt>Inhoud</dt><dd>{family.name} · {draft.mode === "connected" ? "Automatisch" : "Zelf samengesteld"}</dd></div>{draft.mode === "connected" && <div><dt>Bron</dt><dd>{data.sources.find(source => source.id === draft.sourceId)?.name ?? "Oorspronkelijke bron"}</dd></div>}<div><dt>Scherm</dt><dd>{p.orientation === "portrait" ? "Staand · 9:16" : "Liggend · 16:9"} · {p.theme === "onzetrots-tv" ? "OnzeTrots TV" : "FieldFlow"}</dd></div><div><dt>Duur</dt><dd>{draft.seconds} seconden per pagina{draft.mode === "manual" ? ` · ${syncSlidePageCount(p)} ${syncSlidePageCount(p) === 1 ? "pagina" : "pagina’s"}` : " · afgestemd op de broninhoud"}</dd></div></dl>
            {draft.mode === "connected" && <><SourceStatusWarning source={reviewSource} label="Status van de bron" /><div className={styles.notice}><strong>{previewCurrent ? sourceNeedsAttention(checkedSource) ? "Opgeslagen broninhoud gecontroleerd" : "Broninhoud gecontroleerd" : "Controleer de opgeslagen broninhoud"}</strong><p>{previewCurrent ? "Je ziet de laatst bevestigde volledige preview van de opgeslagen gegevens. Dit bevestigt niet dat de bron nu foutloos of live is; de schermversie wordt later apart voorbereid en gepubliceerd." : "We lezen alleen de toegestane opgeslagen brongegevens. Deze controle maakt geen ontwerp, publicatie of schermwijziging."}</p><Button variant="secondary" disabled={!compiled.request || previewing} onClick={() => void checkPreview()}><RefreshCw size={16} aria-hidden="true" />{previewing ? "Bron controleren…" : previewCurrent ? "Bron opnieuw controleren" : "Bron controleren"}</Button>{compiled.error && <p>{compiled.error} Ga terug naar Inhoud of Bron om dit te herstellen.</p>}</div></>}
            <p className={styles.hint}>Je maakt een bewerkbaar ontwerp. Er verandert pas iets op je schermen nadat je de uitvoer aan een playlist toevoegt en publiceert.</p>
          </>}
        </fieldset>
        {previewError && <p role="alert" className={styles.error}>{previewError}</p>}
        {pending && <p role="status" className={styles.notice}>Je invoer staat vast tot dezelfde oorspronkelijke opdracht is bevestigd. Hierdoor ontstaat geen tweede ontwerp als het vorige antwoord verloren ging.</p>}
        <footer className={styles.actions}>
          {step > 0 && <Button variant="secondary" disabled={locked} onClick={() => move(step - 1)}><ArrowLeft size={16} aria-hidden="true" /> Vorige</Button>}
          {confirmedHref ? <Button asChild variant="primary"><Link href={confirmedHref}>Ontwerp openen</Link></Button> : step < 3 ? <Button variant="primary" disabled={locked || !available} onClick={() => move(step + 1)}>Verder <ArrowRight size={16} aria-hidden="true" /></Button> : <Button variant="primary" disabled={!hydrated || corrupt || busy || !available || storageError || !pending && Boolean(data.themeDefaultsError || invalid || draft.mode === "connected" && !previewCurrent)} onClick={() => void create()}>{busy ? "Ontwerp bevestigen…" : pending ? "Dezelfde opdracht bevestigen" : "Ontwerp maken"}</Button>}
        </footer>
      </section>
      <aside className={styles.preview} aria-label="Voorbeeld van je ontwerp">
        <div className={styles.previewHeading}><span className={styles.eyebrow}>Zo ziet het eruit</span><strong>{draft.mode === "connected" ? previewCurrent ? sourceNeedsAttention(checkedSource) ? "Opgeslagen bronpreview" : "Gecontroleerde bronpreview" : preview?.ok ? "Laatste volledige bronpreview" : "Vormgeving zonder brongegevens" : "Jouw ontwerp"}</strong></div>
        <div className={`${styles.stage} ${display.orientation === "portrait" ? styles.portrait : ""}`}><SyncSlideStaticView presentation={display} compact resolveAsset={asset => asset.kind === "system" ? resolveSyncSystemAsset(asset) : (preview?.ok ? preview.assets[asset.mediaAssetId]?.url : undefined) ?? data.images?.find(value => value.id === asset.mediaAssetId && value.checksumSha256 === asset.checksumSha256)?.url} /></div>
        {draft.mode === "connected" && <SourceStatusWarning source={checkedSource} label="Status van de bronpreview" />}
        <p className={styles.hint}>{draft.mode === "connected" && !previewCurrent ? "Controleer bij de laatste stap de echte broninhoud. Voorbeeldgegevens worden nooit als clubgegevens opgeslagen." : "Dit is je ontwerpvoorbeeld. Publiceren doe je later via een playlist."}</p>
      </aside>
    </div>
  </div>;
}

type SourceHealth = { providerStatus: string; lastErrorCode: string | null };
function sourceNeedsAttention(source: SourceHealth | null | undefined) {
  return Boolean(source && (!["ready", "healthy"].includes(source.providerStatus) || source.lastErrorCode));
}
function SourceStatusWarning({ source, label }: { source: SourceHealth | null | undefined; label: string }) {
  if (!source || !sourceNeedsAttention(source)) return null;
  const reason = source.providerStatus === "error" ? "De laatste bronverwerking is mislukt."
    : source.providerStatus === "stale" ? "De bron meldt verouderde gegevens."
      : source.providerStatus === "not_connected" ? "De bron is niet verbonden."
        : "De bron is nog niet als gereed bevestigd.";
  return <div role="status" aria-label={label} className={styles.notice}>
    <strong>De bron vraagt aandacht</strong>
    <p>{reason} Een preview kan nog de opgeslagen, laatst goedgekeurde gegevens tonen. Nieuwe live gegevens zijn hiermee niet bevestigd.</p>
    <p>Controleer de verbinding en instellingen bij Bronnen en voer daarna opnieuw een broncontrole uit. De opgeslagen preview en je invoer blijven beschikbaar.</p>
    <Link href="/dashboard/sources">Bronnen bekijken <ArrowRight size={16} aria-hidden="true" /></Link>
  </div>;
}
