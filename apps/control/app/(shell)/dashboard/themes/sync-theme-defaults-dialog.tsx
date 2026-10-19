"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { Button, Dialog, DialogBody, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@veyocast/ui";
import { type SyncThemeCreationDefaults, type SyncThemeDefaultsProfile, syncThemeCreationDefaultsSchema, syncSlideTransition } from "@veyocast/contracts";
import { createSyncStudioStarter } from "@veyocast/studio/mobile-v3";
import { SyncSlideStaticView } from "@veyocast/content-templates/sync-slide-static-view";
import { applySyncThemeCreationDefaults } from "../../../../lib/sync-theme-creation-defaults";
import { readSyncThemeCreationDefaultsAction, saveSyncThemeCreationDefaultsAction } from "./sync-theme-defaults-actions";
import {
  acceptThemeDefaultsAck, newThemeDefaultsRecovery, parseThemeDefaultsRecovery, prepareThemeDefaultsSave,
  reconcileThemeDefaults, rejectThemeDefaultsSave, themeDefaultsDirty, themeDefaultsJournalKey,
  type ThemeDefaultsRecovery, type ThemeDefaultsScope,
} from "./sync-theme-defaults-state";
import styles from "./sync-theme-defaults-dialog.module.css";

type Props = ThemeDefaultsScope & { tenantName: string; themeName: string; profile: SyncThemeDefaultsProfile; canWrite: boolean };

/** A fresh controller for every authenticated actor/resource; old requests cannot cross it. */
export function SyncThemeDefaultsDialog(props: Props) {
  return <ThemeDefaultsController key={`${props.actorScope}:${props.tenantId}:${props.themeId}`} {...props} />;
}

function ThemeDefaultsController(props: Props) {
  const [open, setOpen] = useState(false), [closeChoice, setCloseChoice] = useState(false);
  const [state, setState] = useState(() => newThemeDefaultsRecovery(props, props.profile));
  const latest = useRef(state), alive = useRef(false), generation = useRef(0), inFlight = useRef(false);
  const [hydrated, setHydrated] = useState(false), [blocked, setBlocked] = useState(false), [busy, setBusy] = useState(false);
  const [unreadable, setUnreadable] = useState(false);
  const [message, setMessage] = useState<string | null>(null), [failure, setFailure] = useState<string | null>(null);
  const [currentProfile, setCurrentProfile] = useState<SyncThemeDefaultsProfile | null>(null);
  const key = themeDefaultsJournalKey(props), dirty = themeDefaultsDirty(state);
  const reducedMotion = useReducedMotion();
  const modeLabelId = useId(), modeHintId = useId();

  function publish(next: ThemeDefaultsRecovery) { latest.current = next; setState(next); }
  function persist(next: ThemeDefaultsRecovery) {
    const raw = JSON.stringify(next);
    parseThemeDefaultsRecovery(raw, props);
    sessionStorage.setItem(key, raw);
    publish(next);
  }

  useEffect(() => {
    alive.current = true; const sequence = ++generation.current;
    try {
      const raw = sessionStorage.getItem(key);
      if (raw) {
        let restored = parseThemeDefaultsRecovery(raw, props);
        if (!restored.pending && !themeDefaultsDirty(restored) && !restored.conflict && props.profile.revision >= restored.revision) restored = newThemeDefaultsRecovery(props, props.profile);
        else if (!restored.pending && restored.revision < props.profile.revision) restored = { ...restored, conflict: true };
        latest.current = restored; setState(restored);
        setMessage(restored.pending ? "De eerdere opdracht is nog niet bevestigd. Controleer hetzelfde ontvangstbewijs; je invoer blijft bewaard." : "Je lokale concept is hersteld.");
      }
    } catch {
      setUnreadable(true); setBlocked(true); setFailure("Je lokale herstelgegevens konden niet veilig worden gelezen. Er wordt niets opgeslagen of overschreven. Herstel browseropslag en probeer het lezen opnieuw.");
    }
    setHydrated(true);
    return () => { alive.current = false; if (generation.current === sequence) generation.current++; };
    // The actor/resource-keyed controller hydrates once; refreshed profiles are reconciled below.
  }, []);

  useEffect(() => {
    const current = latest.current;
    if (!hydrated || blocked || current.pending || busy || current.revision >= props.profile.revision) return;
    if (themeDefaultsDirty(current) || current.conflict) {
      publish({ ...current, conflict: true });
      setFailure("Een andere beheerder heeft dit thema gewijzigd. Je concept is behouden. Haal de actuele versie op en kies welke instellingen je gebruikt.");
    } else publish(newThemeDefaultsRecovery(props, props.profile));
    // A receipt or fresh read may already be newer than stale route props.
  }, [props.profile, hydrated, blocked, busy]);

  useEffect(() => {
    if (!dirty && !state.pending) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, state.pending]);

  const presentation = useMemo(() => {
    const starter = createSyncStudioStarter({ family: "free", tenantName: props.tenantName, theme: props.themeId }).syncPresentation!;
    return applySyncThemeCreationDefaults({ ...starter, title: "Onze club,\njouw verhaal.", subtitle: "Stijlvoorbeeld", body: "" }, props.themeId, state.draft);
  }, [props.tenantName, props.themeId, state.draft]);
  const transition = reducedMotion ? null : syncSlideTransition(presentation);

  function edit(patch: Partial<SyncThemeCreationDefaults>) {
    const current = latest.current;
    if (!props.canWrite || !hydrated || blocked || current.pending || current.conflict || inFlight.current) return;
    const next = { ...current, draft: syncThemeCreationDefaultsSchema.parse({ ...current.draft, ...patch }) };
    // Keep typed input visible even when storage fails, but block any POST.
    publish(next); setMessage(null); setFailure(null);
    try { persist(next); } catch { setBlocked(true); setFailure("Je concept kon niet lokaal worden bewaard. Er is niets verstuurd. Maak browseropslag beschikbaar en probeer het bewaren opnieuw."); }
  }

  async function save() {
    if (!props.canWrite || !hydrated || blocked || inFlight.current) return;
    const previous = latest.current, replaying = previous.pending !== null;
    let pending: ThemeDefaultsRecovery;
    try { pending = prepareThemeDefaultsSave(previous, crypto.randomUUID()); persist(pending); }
    catch { setBlocked(true); setFailure("De volledige opdracht kon niet veilig worden bewaard. Er is niets verstuurd. Herstel browseropslag en probeer opnieuw."); return; }
    const command = pending.pending!;
    const sequence = generation.current;
    inFlight.current = true; setBusy(true); setFailure(null); setMessage(null);
    try {
      const result = await saveSyncThemeCreationDefaultsAction(command, props.actorScope);
      if (!alive.current || sequence !== generation.current) return;
      if (result.ok) {
        const accepted = acceptThemeDefaultsAck(pending, result.value);
        // A durable confirmed state must replace the pending journal before success is shown.
        persist(accepted.state); setCurrentProfile(null);
        setMessage("Opgeslagen. Nieuwe ontwerpen gebruiken deze instellingen. Bestaande ontwerpen en publicaties blijven hun vastgezette opmaak gebruiken.");
      } else {
        const next = rejectThemeDefaultsSave(pending, result.code, result.uncertain, replaying);
        if (next !== pending) persist(next);
        setFailure(next.pending ? "Het resultaat van de eerdere opdracht is nog onzeker. Je volledige oorspronkelijke opdracht blijft bewaard. Controleer hetzelfde ontvangstbewijs zodra je toegang en verbinding terug zijn." : result.message);
      }
    } catch {
      setFailure("Opslaan is niet bevestigd. Je oorspronkelijke opdracht en invoer blijven bewaard. Controleer hetzelfde ontvangstbewijs; maak geen nieuwe opdracht.");
    } finally {
      if (alive.current && sequence === generation.current) { inFlight.current = false; setBusy(false); }
    }
  }

  async function readCurrent() {
    if (inFlight.current || latest.current.pending) return;
    const sequence = generation.current;
    inFlight.current = true; setBusy(true); setFailure(null);
    try {
      const result = await readSyncThemeCreationDefaultsAction(props.actorScope);
      if (!alive.current || sequence !== generation.current) return;
      if (!result.ok) { setFailure(result.message); return; }
      const profile = result.value.profiles.find(value => value.themeId === props.themeId);
      if (!profile) throw new Error("Missing theme profile");
      setCurrentProfile(profile);
    } catch { if (alive.current && sequence === generation.current) setFailure("De actuele instellingen konden niet worden opgehaald. Je concept blijft bewaard; probeer opnieuw zodra je verbinding terug is."); }
    finally { if (alive.current && sequence === generation.current) { inFlight.current = false; setBusy(false); } }
  }

  function chooseCurrent(keepDraft: boolean) {
    if (!currentProfile || inFlight.current) return;
    try { persist(reconcileThemeDefaults(latest.current, currentProfile, keepDraft)); setCurrentProfile(null); setFailure(null); setMessage(keepDraft ? "Je concept is behouden. Controleer de waarden en sla bewust op boven de actuele revisie." : "De actuele opgeslagen instellingen zijn geladen."); }
    catch { setBlocked(true); setFailure("Je herstelkeuze kon niet lokaal worden bewaard. Er is niets verstuurd. Herstel browseropslag en probeer opnieuw."); }
  }

  function requestClose(next: boolean) {
    if (next) { setCloseChoice(false); setOpen(true); return; }
    if (inFlight.current || latest.current.pending || themeDefaultsDirty(latest.current)) { setCloseChoice(true); return; }
    setOpen(false);
  }
  function keepAndClose() {
    try { persist(latest.current); setCloseChoice(false); setOpen(false); }
    catch { setFailure("Het concept kon niet veilig worden bewaard. Het venster blijft open. Herstel browseropslag en probeer opnieuw."); }
  }
  function discardAndClose() {
    if (latest.current.pending || inFlight.current) return;
    try { sessionStorage.removeItem(key); publish({ ...latest.current, draft: latest.current.baseline, conflict: false }); setMessage(null); setFailure(null); setCloseChoice(false); setOpen(false); }
    catch { setFailure("Het lokale concept kon niet worden verwijderd. Het venster blijft open; probeer opnieuw zodra browseropslag beschikbaar is."); }
  }
  function retryStorage() {
    try {
      if (unreadable) {
        const raw = sessionStorage.getItem(key);
        if (raw) publish(parseThemeDefaultsRecovery(raw, props));
        setUnreadable(false);
      } else persist(latest.current);
      setBlocked(false); setFailure(null);
    }
    catch { setFailure("Browseropslag is nog niet beschikbaar. Er is niets verstuurd; je invoer blijft in dit venster staan."); }
  }

  const disabled = !props.canWrite || !hydrated || blocked || !!state.pending || state.conflict || busy;
  return <Dialog open={open} onOpenChange={requestClose}>
    <DialogTrigger asChild><Button variant="secondary" size="md" disabled={!hydrated}>Instellen<span className={styles.srOnly}> · {props.themeName}</span></Button></DialogTrigger>
    <DialogContent className={styles.dialog} size="wide" showClose={false}>
      <header className={styles.header}>
        <DialogTitle className={styles.title}>{props.themeName} instellen</DialogTitle>
        <button type="button" className={`icon-button ${styles.close}`} onClick={() => requestClose(false)} aria-label="Sluiten"><X size={18} /></button>
      </header>
      <DialogBody className={styles.body}>
        <DialogDescription className={styles.description}>Standaardopmaak voor nieuwe ontwerpen. Bestaande ontwerpen en publicaties wijzigen niet.</DialogDescription>
        <div className={styles.grid}>
          <div className={styles.preview}>
            <span className={styles.previewLabel}>Voorbeeld · {props.tenantName}</span>
            <div className={styles.stage} data-testid="theme-preview"><motion.div key={state.draft.motion} data-motion={state.draft.motion} initial={transition ? { opacity: 0, y: transition.offsetPx } : false} animate={{ opacity: 1, y: 0 }} transition={{ duration: transition ? transition.durationMs / 1000 : 0, ease: "easeOut" }}><SyncSlideStaticView presentation={presentation} compact /></motion.div></div>
            <p className={styles.hint}>Deze preview gebruikt dezelfde renderer als een nieuw ontwerp. Er worden geen voorbeeldinhoud, ontwerpen of publicaties opgeslagen.</p>
          </div>
          <div className={styles.stack}>
            <p className={styles.hint}>{state.configured ? `Opgeslagen instellingen · revisie ${state.revision}` : "Nog niet ingesteld · deze beginwaarden zijn nog niet opgeslagen."}{!props.canWrite ? " Alleen bekijken: je rol kan deze instellingen niet wijzigen." : ""}</p>
            <fieldset className={styles.fields} disabled={disabled}>
              <legend className={styles.srOnly}>Nieuwe-ontwerpinstellingen</legend>
              <label className={styles.field}><span>Clubaccent</span><input type="color" value={state.draft.accent} onChange={event => edit({ accent: event.target.value })} /></label>
              <label className={styles.field}><span>Lettertype</span><select value={state.draft.font} onChange={event => edit({ font: event.target.value as SyncThemeCreationDefaults["font"] })}>{["Manrope", "Inter", "Georgia", "Arial"].map(font => <option key={font}>{font}</option>)}</select></label>
              <label className={styles.field}><span id={modeLabelId}>Weergave</span><select aria-labelledby={modeLabelId} aria-describedby={modeHintId} value={state.draft.mode} onChange={event => edit({ mode: event.target.value as SyncThemeCreationDefaults["mode"] })}><option value="light">Licht / wit</option><option value="dark">Donker / blauw</option><option value="auto">Automatisch</option></select><small id={modeHintId}>Automatisch gebruikt de gekozen pakketachtergrond bij het maken; het volgt geen klok of apparaatinstelling.</small></label>
              <label className={styles.field}><span>Typografie · {state.draft.scale}%</span><input type="range" min="90" max="120" step="1" value={state.draft.scale} onChange={event => edit({ scale: Number(event.target.value) })} /></label>
              <label className={styles.field}><span>Achtergrond</span><select value={state.draft.background} onChange={event => edit({ background: event.target.value as SyncThemeCreationDefaults["background"] })}><option value="clubkleur">Clubkleur</option><option value="gradient">Rustig kleurverloop</option><option value="stadium">Sportpark</option></select></label>
              <label className={styles.field}><span>Beweging</span><select value={state.draft.motion} onChange={event => edit({ motion: event.target.value as SyncThemeCreationDefaults["motion"] })}><option value="rustig">Rustig</option><option value="geen">Geen beweging</option><option value="dynamisch">Dynamisch</option></select></label>
              <label className={styles.toggle}><input type="checkbox" checked={state.draft.showLogo} onChange={event => edit({ showLogo: event.target.checked })} /><span>Clublogo tonen</span></label>
            </fieldset>
            {failure ? <div className={styles.error} role="alert">{failure}</div> : null}
            {message ? <p className={styles.notice} role="status">{message}</p> : null}
            {blocked ? <Button variant="secondary" size="md" onClick={retryStorage}>{unreadable ? "Herstelgegevens opnieuw lezen" : "Lokaal bewaren opnieuw proberen"}</Button> : null}
            {state.conflict && !state.pending ? <div className={styles.recovery}>
              <Button variant="secondary" size="md" disabled={busy} onClick={readCurrent}>Actuele instellingen ophalen</Button>
              {currentProfile ? <><p>Actueel: revisie {currentProfile.revision}. Kies bewust welke invoer je wilt bewaren.</p><Button variant="secondary" size="md" onClick={() => chooseCurrent(true)}>Mijn concept behouden op actuele revisie</Button><Button variant="secondary" size="md" onClick={() => chooseCurrent(false)}>Actuele instellingen gebruiken</Button></> : null}
            </div> : null}
            <Button variant="primary" size="md" disabled={!props.canWrite || !hydrated || blocked || busy || state.conflict} onClick={save}>{busy ? "Instellingen controleren…" : state.pending ? "Hetzelfde ontvangstbewijs controleren" : "Instellingen opslaan"}</Button>
            {closeChoice ? <div className={styles.recovery} role="status"><p>{state.pending ? "De opdracht is nog niet bevestigd. Bewaar haar om later exact hetzelfde ontvangstbewijs te controleren." : "Je hebt een lokaal concept. Bewaar het of verwerp je wijzigingen voordat je sluit."}</p><Button variant="secondary" size="md" disabled={busy} onClick={keepAndClose}>Bewaren en sluiten</Button>{!state.pending ? <Button variant="secondary" size="md" disabled={busy} onClick={discardAndClose}>Wijzigingen verwerpen en sluiten</Button> : null}<Button variant="ghost" size="md" onClick={() => setCloseChoice(false)}>Verder bewerken</Button></div> : null}
            <Link className={styles.advanced} href={`/dashboard/themes/fieldflow?theme=${props.themeId}`} onClick={event => { if (latest.current.pending || themeDefaultsDirty(latest.current)) { event.preventDefault(); setCloseChoice(true); } }}>Geavanceerde huisstijluitrol</Link>
            <p className={styles.hint}>De geavanceerde uitrol heeft een eigen concept- en publicatiestroom voor bestaande inhoud en schermen.</p>
          </div>
        </div>
      </DialogBody>
    </DialogContent>
  </Dialog>;
}
