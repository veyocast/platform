"use client";
import { mediaFrameSourceDurationLimit } from "@veyocast/contracts";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ImagePlus, Monitor, Pause, Play, Plus, Smartphone } from "lucide-react";
import { Button } from "@veyocast/ui";
import { mediaFrameBackgroundStyle } from "../../../../../../../packages/content-templates/src/media-frame-background";
import { syncSystemAssets, type MediaFramePlaybackBackground, type MediaFrameSettings } from "@veyocast/contracts";
import { SyncStudioFrame } from "../../studio/sync-studio-frame";
import { SyncStudioCheck as Check, SyncStudioField as Field, SyncStudioFieldGroup as FieldGroup } from "../../studio/sync-studio-field";
import { uploadBackground } from "../../playlists/_components/sites/upload-media";
import { mutateMediaFrameAction, readMediaFrameSourceAction } from "./media-frame-actions";
import type { MediaFrameEditorProps, MediaFrameSource } from "./media-frame-types";
import {
  mediaFrameChrome, mediaFrameJournalKey, mediaFrameSourcesAvailable,
  sameMediaFrameSource,
  sourcesForMediaFrame, validatedMediaFrameDraft,
  type MediaFrameDraft, type MediaFrameJournal,
} from "./media-frame-presentation";
import { MediaFrameFilmstrip } from "./media-frame-filmstrip";
import { mutateMediaFrameSeriesAction, readContentFilmstripAction } from "./media-frame-series-actions";
import { mediaSeriesDraft, parseMediaFrameSeriesJournal, prepareMediaFrameSeriesSave, reconcileMediaFrameSeriesJournal, upgradeMediaFrameJournal, validMediaSeriesTitle, type MediaFrameSeriesJournal } from "./media-frame-series-state";
import type { MediaSeriesDraftV2 } from "./media-frame-series-types";
import styles from "./media-frame-editor.module.css";

const focusOptions = [["center", "Midden"], ["top", "Boven"], ["bottom", "Onder"], ["left", "Links"], ["right", "Rechts"]] as const;
const copy = <T,>(value: T): T => structuredClone(value);
type Edit = { draft: MediaFrameDraft; sources: MediaFrameJournal["sources"]; seriesDraft: MediaSeriesDraftV2 };

/** Changing account/resource remounts the controller and fences previous async results. */
export function MediaFrameEditor(props: MediaFrameEditorProps) {
  return <MediaFrameEditorSession key={`${props.actorScope}:${props.isPrimary ? `source:${props.mainSource.mediaAssetId}` : props.frameId}`} {...props} />;
}

function MediaFrameEditorSession(props: MediaFrameEditorProps) {
  const router = useRouter();
  const scope = useMemo(() => ({ actorScope: props.actorScope, tenantId: props.tenantId, identity: props.isPrimary ? `source:${props.mainSource.mediaAssetId}` : `frame:${props.frameId}`, assetId: props.mainSource.mediaAssetId }), [props.actorScope, props.tenantId, props.isPrimary, props.mainSource.mediaAssetId, props.frameId]);
  const legacyInitial = (): MediaFrameJournal => ({ ...scope, schemaVersion: 1, frameId: props.frameId, revision: props.frameRevision, draft: { settings: copy(props.settings), seconds: String(props.settings.durationSeconds) }, sources: sourcesForMediaFrame(props.settings, props.mainSource, [...(props.versions.find(version => version.id === props.versionId)?.sources ?? []), ...props.imageSources]) ?? [props.mainSource.expectedSource], dirty: false, pending: null });
  const initial = () => upgradeMediaFrameJournal(legacyInitial(), props.mediaSeries?.membership ?? null);
  const [journal, setJournal] = useState(initial);
  const [confirmedVersion, setConfirmedVersion] = useState(props.versionNumber);
  const current = useRef(journal), alive = useRef(true), busyRef = useRef(false), uploadInput = useRef<HTMLInputElement>(null);
  const [recoveryBlocked, setRecoveryBlocked] = useState(false);
  const [ready, setReady] = useState(false), [busy, setBusy] = useState(false), [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null), [message, setMessage] = useState<string | null>(null), [conflict, setConflict] = useState(false);
  const [history, setHistory] = useState<Edit[]>([]), [future, setFuture] = useState<Edit[]>([]), [playing, setPlaying] = useState(false);
  const [extraSources, setExtraSources] = useState<MediaFrameSource[]>([]);
  const available = useMemo(() => [props.mainSource, ...props.imageSources, ...props.versions.flatMap(version => version.sources), ...extraSources], [props.mainSource, props.imageSources, props.versions, extraSources]);
  const sourcesRef = useRef(available); sourcesRef.current = available;
  const write = (next: MediaFrameSeriesJournal) => {
    try { sessionStorage.setItem(mediaFrameJournalKey(scope), JSON.stringify(next)); }
    catch { setError("De browser kan je herstelgegevens niet bewaren. Je invoer en een eventuele oorspronkelijke opdracht blijven hier; maak ruimte vrij en bevestig dezelfde actie opnieuw."); return false; }
    return true;
  };
  const apply = (next: MediaFrameSeriesJournal) => { current.current = next; setJournal(next); };
  useEffect(() => {
    alive.current = true;
    try {
      const raw = sessionStorage.getItem(mediaFrameJournalKey(scope));
      const recovered = raw ? parseMediaFrameSeriesJournal(raw, scope, props.mediaSeries?.membership ?? null) : null;
      if (recovered && (recovered.dirty || recovered.pending || recovered.seriesDraft.dirty || recovered.confirmedAppend)) {
        current.current = recovered; setJournal(recovered);
        setConflict(!recovered.pending && (recovered.dirty || recovered.seriesDraft.dirty) && (recovered.revision !== props.frameRevision || recovered.seriesDraft.seriesId !== (props.mediaSeries?.membership?.seriesId ?? null) || recovered.seriesDraft.baseRevision !== (props.mediaSeries?.membership?.seriesRevision ?? null)));
        setMessage(recovered.pending ? "Een eerdere opdracht mist een bevestiging. Herhaal eerst precies die opdracht; je invoer blijft bewaard." : "Je lokale invoer is hersteld. Er is nog niets opnieuw opgeslagen.");
      }
    } catch { setRecoveryBlocked(true); setError("De lokale herstelgegevens konden niet veilig worden gelezen. Ze zijn behouden; gebruik dezelfde sessie en controleer de browseropslag voordat je verdergaat."); }
    setReady(true);
    return () => { alive.current = false; };
    // A mounted controller retains its exact actor/resource scope.
  }, []);
  useEffect(() => {
    if (!ready) return;
    const reconciled = reconcileMediaFrameSeriesJournal(current.current, initial());
    if (reconciled.conflict) setConflict(true);
    else if (reconciled.journal !== current.current) { apply(reconciled.journal); setConfirmedVersion(props.versionNumber); }
    // Refresh clean reads only; dirty frame/reeks CAS and original commands remain fixed.
  }, [props.frameRevision, props.versionId, props.mediaSeries?.membership?.seriesId, props.mediaSeries?.membership?.seriesRevision, ready, journal.pending, journal.dirty]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (current.current.dirty || current.current.pending) { event.preventDefault(); event.returnValue = ""; } };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);
  function beforeNavigate() {
    if (!ready || recoveryBlocked || busyRef.current || uploading) { setError("Wacht tot de lopende actie is bevestigd en je herstelgegevens zijn bewaard voordat je een ander ontwerp opent."); return false; }
    return write(current.current);
  }
  const canReplayPending = props.canReplayPending ?? props.canWrite;
  const mayReplay = Boolean(journal.pending) && canReplayPending;
  const blocked = !ready || recoveryBlocked || !props.canWrite || busy || uploading || Boolean(journal.pending);
  const maximumSeconds = mediaFrameSourceDurationLimit(props.mainSource);
  const validation = validatedMediaFrameDraft(journal.draft, maximumSeconds);
  const sourcesReady = mediaFrameSourcesAvailable(journal.sources, available);
  const edit = (draft: MediaFrameDraft, nextSources = current.current.sources, seriesDraft = current.current.seriesDraft) => {
    if (busyRef.current || current.current.pending || !ready || recoveryBlocked || !props.canWrite) return;
    const previousEdit = copy({ draft: current.current.draft, sources: current.current.sources, seriesDraft: current.current.seriesDraft });
    setHistory(previous => [...previous.slice(-49), previousEdit]); setFuture([]);
    const next = { ...current.current, draft, sources: nextSources, seriesDraft, dirty: true };
    apply(next); write(next); setMessage(null);
  };
  const patch = (change: Partial<MediaFrameSettings>) => edit({ ...current.current.draft, settings: { ...current.current.draft.settings, ...change } });
  const appearance = (change: Partial<MediaFrameSettings["appearance"]>) => patch({ appearance: { ...current.current.draft.settings.appearance, ...change } });
  const metadata = (change: Partial<MediaFrameSettings["sourceMetadata"]>) => patch({ sourceMetadata: { ...current.current.draft.settings.sourceMetadata, ...change } });
  const travel = (undo: boolean) => {
    const stack = undo ? history : future, target = stack.at(-1);
    if (!target || blocked) return;
    const previous = copy({ draft: current.current.draft, sources: current.current.sources, seriesDraft: current.current.seriesDraft });
    if (undo) { setHistory(stack.slice(0, -1)); setFuture(value => [...value, previous]); }
    else { setFuture(stack.slice(0, -1)); setHistory(value => [...value, previous]); }
    const next = { ...current.current, ...copy(target), dirty: true }; apply(next); write(next);
  };
  async function save(append = false) {
    if (!ready || recoveryBlocked || busyRef.current || uploading || (append && current.current.pending) || (current.current.pending ? !canReplayPending : !props.canWrite || conflict)) return;
    let pending;
    try { pending = prepareMediaFrameSeriesSave(current.current, crypto.randomUUID(), maximumSeconds, append ? crypto.randomUUID() : undefined); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "Controleer de invoer. Je ontwerp blijft bewaard."); return; }
    if (!current.current.pending && !mediaFrameSourcesAvailable(current.current.sources, sourcesRef.current)) { setError("Een gekozen bron is niet meer geverifieerd beschikbaar. Je ontwerp blijft behouden; controleer de bron voordat je opslaat."); return; }
    const sending = { ...current.current, pending, confirmedAppend: append ? null : current.current.confirmedAppend };
    if (!write(sending)) return;
    apply(sending); busyRef.current = true; setBusy(true); setError(null); setMessage(null);
    try {
      const result = pending.kind === "series" ? await mutateMediaFrameSeriesAction(pending.command, props.actorScope) : await mutateMediaFrameAction(pending.command, props.actorScope);
      if (!alive.current) return;
      if (!result.ok) {
        if (!result.uncertain) {
          const rejected = { ...current.current, pending: null }; if (write(rejected)) apply(rejected);
          if (result.code === "conflict") setConflict(true);
        }
        setError(result.message); return;
      }
      const receipt = "current" in result ? result.current : result;
      const appended = "appended" in result ? result.appended : null;
      if (receipt.frameId !== pending.command.frameId || (pending.kind === "series" && pending.command.operation === "append" && appended?.frameId !== pending.command.newFrameId)) throw Error("Invalid command receipt");
      const command = pending.command;
      const confirmed: MediaFrameSeriesJournal = {
        ...current.current,
        ...("settings" in command ? { draft: { settings: command.settings, seconds: String(command.settings.durationSeconds) }, sources: command.expectedSources } : {}),
        frameId: receipt.frameId, revision: receipt.frameRevision, pending: null, dirty: false,
        seriesDraft: "membership" in result ? mediaSeriesDraft(result.membership) : { ...current.current.seriesDraft, dirty: false },
        confirmedAppend: appended ? { frameId: appended.frameId, contentKey: appended.contentKey, href: appended.href, name: appended.name } : current.current.confirmedAppend,
      };
      // Replace the original command only after the complete receipt/destination is durable.
      if (!write(confirmed)) return;
      apply(confirmed); setConfirmedVersion(receipt.versionNumber); setConflict(false); setHistory([]); setFuture([]);
      setMessage(appended ? "Je ontwerp is opgeslagen. Een nieuwe slide is aan dezelfde reeks toegevoegd." : `Versie ${receipt.versionNumber} is opgeslagen. Bestaande playlistplaatsingen blijven bij hun gekozen versie.`);
      try {
        if (appended) router.push(appended.href);
        else if (props.isNew) router.replace(`/dashboard/content/media/${receipt.frameId}`);
        router.refresh();
      } catch { setError("De opslag is bevestigd, maar het volgende ontwerp kon niet worden geopend. Gebruik de bewaarde link hieronder; maak geen nieuwe kopie."); }
    } catch { if (alive.current) setError("De serverbevestiging ontbreekt. De opdracht blijft bewaard; probeer dezelfde actie opnieuw zodra je verbinding hebt."); }
    finally { if (alive.current) { busyRef.current = false; setBusy(false); } }
  }
  async function upload(file: File) {
    if (blocked || busyRef.current) return;
    busyRef.current = true; setUploading(true); setError(null);
    try {
      const result = await uploadBackground(file, props.actorScope);
      if (!alive.current) return;
      const verified = await readMediaFrameSourceAction({ tenantId: props.tenantId, mediaAssetId: result.assetId, role: "background" }, props.actorScope);
      if (!alive.current) return;
      if (!verified.ok) { setError(verified.message); return; }
      const source = verified.source;
      setExtraSources(previous => [...previous, source]); sourcesRef.current = [...sourcesRef.current, source];
      busyRef.current = false;
      const settings = { ...current.current.draft.settings, appearance: { ...current.current.draft.settings.appearance, background: { kind: "image" as const, mediaAssetId: source.mediaAssetId, position: "center" as const } } };
      const sources = [{ ...current.current.sources.find(value => value.role === "media")!, role: "media" as const }, { ...source.expectedSource, role: "background" as const }];
      edit({ ...current.current.draft, settings }, sources);
      setMessage("Je achtergrond is privé opgeslagen en gecontroleerd. Sla het ontwerp op om deze keuze vast te leggen.");
    } catch (failure) { if (alive.current) setError(failure instanceof Error && !(failure instanceof TypeError) ? failure.message : "De upload is niet bevestigd. Je bestaande achtergrond blijft behouden; controleer de beeldbank voordat je opnieuw uploadt."); }
    finally { if (alive.current) { busyRef.current = false; setUploading(false); } }
  }
  function selectBackground(id: string) {
    const settings = current.current.draft.settings;
    const next = { ...settings, appearance: { ...settings.appearance, background: id ? { kind: "image" as const, mediaAssetId: id, position: "center" as const } : { kind: "preset" as const, preset: "stadium" as const } } };
    const mainFingerprint = current.current.sources.find(source => source.role === "media")!;
    const source = available.find(value => value.mediaAssetId === id && value.kind === "image");
    if (id && !source) return;
    edit({ ...current.current.draft, settings: next }, source ? [mainFingerprint, { ...source.expectedSource, role: "background" }] : [mainFingerprint]);
  }
  const settings = journal.draft.settings;
  const presentation = mediaFrameChrome(settings);
  const primaryFingerprint = journal.sources.find(source => source.role === "media");
  const mainSource = available.find(source => primaryFingerprint && sameMediaFrameSource(primaryFingerprint, { ...source.expectedSource, role: "media" }));
  const backgroundFingerprint = journal.sources.find(source => source.role === "background");
  const backgroundSource = available.find(source => backgroundFingerprint && sameMediaFrameSource(backgroundFingerprint, { ...source.expectedSource, role: "background" }));
  const images = [...new Map(available.filter(source => source.kind === "image").map(source => [source.mediaAssetId, source])).values()];
  const preview = <MediaFramePreview settings={settings} main={mainSource} background={backgroundSource} playing={playing} />;
  const focusControl = (value: MediaFrameSettings["focus"], onChange: (focus: MediaFrameSettings["focus"]) => void, label: string) => <Field label={label}><select value={value} onChange={event => onChange(event.target.value as MediaFrameSettings["focus"])}>{focusOptions.map(([key, title]) => <option value={key} key={key}>{title}</option>)}</select></Field>;
  const content = <><div className="vc-properties-heading"><span>MAAK HET VAN JOU</span><h2>Je beeld op het scherm</h2><p>Uitsnede en achtergrond zie je meteen in het voorbeeld.</p></div><button type="button" className="vc-template-switch" disabled><Monitor size={20} /><span><small>INHOUD</small><strong>{props.mainSource.kind === "video" ? "Video" : "Afbeelding"}</strong></span></button><Field label="Beeld passend maken"><select value={settings.fitMode} onChange={event => patch({ fitMode: event.target.value as MediaFrameSettings["fitMode"] })}><option value="cover">Vullend · uitsnijden</option><option value="contain">Passend · hele beeld</option></select></Field>{focusControl(settings.focus, focus => patch({ focus }), "Focus van het beeld")}<p className="vc-property-hint">De originele bestandsinhoud blijft behouden. Trim en geluid stel je per playlistplaatsing in.</p><details><summary>Opgeslagen tekstmetadata</summary><p className="vc-property-hint">Dit mediabeeld toont geen tekst, clublogo of voettekst boven het bestand. Deze bestaande metadata blijft bij het ontwerp bewaard.</p>{([['title','Titel'],['headline','Boventitel'],['subtitle','Ondertitel'],['body','Tekst'],['footer','Voettekst']] as const).map(([key,label])=><Field key={key} label={label}><textarea rows={key==='body'?4:2} maxLength={key==='body'?4000:key==='headline'?200:400} value={settings.sourceMetadata[key]} onChange={event=>patch({sourceMetadata:{...settings.sourceMetadata,[key]:event.target.value}})}/></Field>)}</details></>;
  const style = <><div className="vc-properties-heading"><span>ÉÉN HERKENBARE CLUB</span><h2>Vormgeving</h2><p>De achtergrond is zichtbaar bij passend beeld en transparante bestanden.</p></div><FieldGroup label="Schermthema" className="vc-theme-options" separate>{(["fieldflow", "onzetrots-tv"] as const).map(theme => <button type="button" key={theme} className={settings.appearance.themeId === theme ? "active" : ""} aria-pressed={settings.appearance.themeId === theme} onClick={() => appearance({ themeId: theme })}><div className={`vc-theme-swatch ${theme === "onzetrots-tv" ? "onzetrots" : "fieldflow"}`} style={{ backgroundColor: settings.appearance.accentColor }}><span>Aa</span><i /></div><strong>{theme === "fieldflow" ? "FieldFlow" : "OnzeTrots TV"}</strong><small>{theme === "fieldflow" ? "Helder & modern" : "Karakter & clubgevoel"}</small></button>)}</FieldGroup><Field label="Accentkleur" controlWrapperClassName="vc-color-input" adornment={<span>{settings.appearance.accentColor}</span>}><input type="color" value={settings.appearance.accentColor} onChange={event => appearance({ accentColor: event.target.value })} /></Field><FieldGroup label="Achtergrond" className="vc-background-choices">{([['stadium','Stadion'],['dark','Donker'],['light','Licht'],['gradient','Verloop'],['stripes','Strepen'],['clubmuur','Clubmuur']] as const).map(([preset,label])=><button type="button" key={preset} className={`${preset} ${settings.appearance.background.kind==='preset'&&settings.appearance.background.preset===preset?'active':''}`} aria-label={label} aria-pressed={settings.appearance.background.kind==='preset'&&settings.appearance.background.preset===preset} onClick={()=>{const next={...settings,appearance:{...settings.appearance,background:{kind:'preset' as const,preset}}};edit({...journal.draft,settings:next},journal.sources.filter(source=>source.role==='media'));}}><span>{label}</span></button>)}</FieldGroup><Button variant="secondary" disabled={uploading} onClick={() => uploadInput.current?.click()}><ImagePlus size={16} />{uploading ? "Achtergrond controleren…" : "Eigen achtergrond uploaden"}</Button><input ref={uploadInput} type="file" hidden accept="image/jpeg,image/png,image/webp,image/avif" aria-label="Achtergrond uploaden" onChange={event => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void upload(file); }} /><Field label="Achtergrondfoto"><select value={settings.appearance.background.kind === "image" ? settings.appearance.background.mediaAssetId : ""} onChange={event => selectBackground(event.target.value)}><option value="">Geen afbeelding</option>{images.map(source => <option key={source.mediaAssetId} value={source.mediaAssetId}>{source.title}</option>)}</select></Field>{settings.appearance.background.kind === "image" && focusControl(settings.appearance.background.position, position => { const background=settings.appearance.background;if(background.kind==='image')appearance({background:{...background,position}}); }, "Uitsnede achtergrondfoto")}<details><summary>Opgeslagen tekstvormgeving</summary><p className="vc-property-hint">Lettertype, tekstgrootte, uitlijning, veilige marge, logo en voettekst blijven als metadata bewaard. Ze veranderen het mediabeeld niet.</p><div className={styles.metadataControls}>
    <Field label="Lettertype"><select value={settings.sourceMetadata.font} onChange={event => metadata({ font: event.target.value as MediaFrameSettings["sourceMetadata"]["font"] })}>{(["Inter", "Manrope", "Arial", "Brush", "Condensed", "Serif"] as const).map(font => <option key={font}>{font}</option>)}</select></Field>
    <Field label={`Tekstgrootte · ${settings.sourceMetadata.scale}%`}><input type="range" min={50} max={150} step={1} value={settings.sourceMetadata.scale} onChange={event => metadata({ scale: Number(event.target.value) })} /></Field>
    <FieldGroup label="Uitlijning" className="vc-segmented">{([["left", "Links"], ["center", "Midden"], ["right", "Rechts"]] as const).map(([alignment, label]) => <button key={alignment} type="button" className={settings.sourceMetadata.alignment === alignment ? "active" : ""} aria-pressed={settings.sourceMetadata.alignment === alignment} onClick={() => metadata({ alignment })}>{label}</button>)}</FieldGroup>
    <Field label={`Veilige marge · ${settings.sourceMetadata.safeMargin}%`}><input type="range" min={2} max={12} step="any" value={settings.sourceMetadata.safeMargin} onChange={event => metadata({ safeMargin: Number(event.target.value) })} /></Field>
    <Check label="Clublogo tonen" checked={settings.sourceMetadata.showLogo} onChange={showLogo => metadata({ showLogo })} />
    <Check label="Clubvoettekst tonen" checked={settings.sourceMetadata.showFooter} onChange={showFooter => metadata({ showFooter })} />
  </div></details></>;
  const historicalSources = (version: MediaFrameEditorProps["versions"][number]) => {
    const main = version.sources.find(source => source.expectedSource.role === "media");
    if (!main) return null;
    const sources = sourcesForMediaFrame(version.settings, main, version.sources);
    return sources && mediaFrameSourcesAvailable(sources, version.sources) ? sources : null;
  };
  const versions = <section className={styles.versions} aria-label="Versiehistorie"><h3>Versies</h3><p className="vc-property-hint">Een oudere versie openen verandert alleen je invoer. Opslaan maakt een nieuwe versie; bestaande plaatsingen blijven vastgezet.</p>{props.versions.length===0?<p>Nog geen opgeslagen versie.</p>:props.versions.map(version=><div key={version.id}><span>Versie {version.number} · {new Date(version.createdAt).toLocaleString('nl-NL')}</span><Button variant="secondary" disabled={blocked||!historicalSources(version)} onClick={()=>{const sources=historicalSources(version);if(sources)edit({settings:copy(version.settings),seconds:String(version.settings.durationSeconds)},sources);}}>Als invoer openen</Button></div>)}</section>;
  const seriesControls = props.mediaSeries ? <><Field label="Onderdeel van een reeks"><input value={journal.seriesDraft.seriesTitle} maxLength={120} placeholder="Bijvoorbeeld: Zondag · wedstrijddag" onChange={event => edit(current.current.draft, current.current.sources, { ...current.current.seriesDraft, seriesTitle: event.target.value, dirty: true })} /></Field><Button variant="secondary" disabled={blocked || conflict || !validation.success || !sourcesReady || !validMediaSeriesTitle(journal.seriesDraft.seriesTitle)} onClick={() => void save(true)}><Plus size={16} />Slide aan deze reeks toevoegen</Button></> : null;
  const settingsControls = <><div className="vc-properties-heading"><span>DE LAATSTE DETAILS</span><h2>Instellingen &amp; versies</h2><p>Bewaar hoe dit ontwerp gebruikt mag worden.</p></div><FieldGroup label="Schermstand" className="vc-orientation-options">{([['landscape','Liggend',Monitor,'16:9'],['portrait','Staand',Smartphone,'9:16']] as const).map(([orientation,label,Icon,ratio])=><button key={orientation} type="button" className={settings.orientation===orientation?'active':''} aria-pressed={settings.orientation===orientation} onClick={()=>patch({orientation})}><Icon size={24}/><strong>{label}</strong><span>{ratio}</span></button>)}</FieldGroup><Field label="Duur (seconden)" hint={`Van 3 tot ${maximumSeconds} seconden${props.mainSource.kind==='video'?' volgens de geverifieerde videobron':''}. Het fysieke scherm of de zone bepaalt de uiteindelijke schermstand.`}><input type="number" min={3} max={maximumSeconds} step={1} value={journal.draft.seconds} onChange={event=>edit({...journal.draft,seconds:event.target.value.slice(0,12)})}/></Field><Field label="Motion" hint="Deze keuze bewaart de intro-overgang van het voorbeeld. Het oorspronkelijke mediabestand blijft behouden."><select value={settings.sourceMetadata.motion} onChange={event => metadata({ motion: event.target.value as MediaFrameSettings["sourceMetadata"]["motion"] })}><option value="rustig">Rustige overgangen</option><option value="dynamisch">Dynamisch</option><option value="geen">Geen animatie</option></select></Field>{seriesControls}{versions}</>;
  return <SyncStudioFrame presentation={presentation} assets={[]} resolveAsset={()=>undefined} secondsPerPage={journal.draft.seconds} onSecondsChange={seconds=>edit({...journal.draft,seconds})} onChange={change=>{if(change.name!==undefined)patch({name:change.name});else if(change.orientation)patch({orientation:change.orientation});}} scratch={{rowsText:"",lineupText:""}} onScratchChange={()=>undefined} onSave={()=>void save()} onUndo={()=>travel(true)} onRedo={()=>travel(false)} canUndo={history.length>0&&!journal.pending} canRedo={future.length>0&&!journal.pending} canSave={ready&&!recoveryBlocked&&(journal.pending?canReplayPending:props.canWrite&&!conflict&&validation.success&&validMediaSeriesTitle(journal.seriesDraft.seriesTitle)&&sourcesReady&&(journal.dirty||journal.revision===0))} readOnly={(!props.canWrite&&!mayReplay)||recoveryBlocked} busy={busy||uploading||!ready} dirty={journal.dirty} revision={journal.revision} saveLabel={journal.pending?'Bevestiging ontbreekt':journal.dirty?'Niet opgeslagen':journal.revision===0?'Nog niet opgeslagen':`Versie ${confirmedVersion||1} opgeslagen`} inputsDisabled={!props.canWrite||Boolean(journal.pending)} primarySaveLabel={journal.pending?'Dezelfde actie opnieuw bevestigen':'Opslaan'} sectionLabel="MEDIA" templateReadOnly templateLabel={props.mainSource.kind==='video'?'Video':'Afbeelding'} maxSeconds={maximumSeconds} previewContent={preview} compactPreviewContent={<MediaFramePreview settings={settings} main={mainSource} background={backgroundSource} playing={false} compact />} mediaControls={{content:<div className={styles.controls}>{content}</div>,style:<div className={styles.controls}>{style}</div>,settings:<div className={styles.controls}>{settingsControls}</div>,playback:<div className="vc-page-controls"><button type="button" disabled={!mainSource||mainSource.kind!=='video'} onClick={()=>setPlaying(value=>!value)}>{playing?<Pause size={13}/>:<Play size={13}/>} {playing?'Pauzeren':'Afspelen'}</button><span>1 / 1</span></div>}} onBeforeLibraryNavigate={beforeNavigate} filmstripContent={props.mediaSeries ? <MediaFrameFilmstrip currentKey={props.mediaSeries.contentKey} currentName={settings.name} currentOrientation={settings.orientation} currentPreview={<MediaFramePreview settings={settings} main={mainSource} background={backgroundSource} playing={false} compact />} initialPage={props.mediaSeries.filmstrip} busy={busy||uploading||!ready} beforeNavigate={beforeNavigate} loadMore={offset=>readContentFilmstripAction({tenantId:props.tenantId,offset},props.actorScope)} /> : undefined} sourceControls={<><h3>Geverifieerde mediabron</h3><p>{props.mainSource.title}</p><p className="vc-property-hint">Dit ontwerp verwijst naar het oorspronkelijke bestand. Een kopie dupliceert het ontwerp, niet de bestandsbytes.</p></>} feedback={<div className={styles.feedback}>{!validation.success&&!journal.pending&&<p role="alert">Controleer de ontwerpnaam en een gehele duur van 3 tot {maximumSeconds} seconden. Je invoer blijft behouden.</p>}{error&&<p role="alert">{error}</p>}{message&&<p role="status">{message}</p>}{journal.pending&&<Button variant="secondary" disabled={busy||uploading||!canReplayPending||recoveryBlocked} onClick={()=>void save()}>Oorspronkelijke opdracht opnieuw bevestigen</Button>}{journal.confirmedAppend&&!journal.pending&&<a className={styles.confirmedDestination} href={journal.confirmedAppend.href} onClick={event=>{if(!beforeNavigate())event.preventDefault();}}>Toegevoegde slide openen: {journal.confirmedAppend.name}</a>}{!sourcesReady&&<p role="status">Een geverifieerde bron ontbreekt in deze weergave. De oorspronkelijke bronidentiteit en je invoer blijven behouden; vernieuw de pagina om de beschikbaarheid te controleren.</p>}{conflict&&<><p role="alert">Het ontwerp is intussen gewijzigd. Je lokale invoer blijft bewaard; bekijk de actuele versie voordat je opnieuw opslaat.</p><Button variant="secondary" onClick={()=>router.refresh()}>Actuele versie ophalen</Button><Button variant="secondary" disabled={busy||!props.canWrite||Boolean(journal.pending)||(props.frameRevision===journal.revision&&(props.mediaSeries?.membership?.seriesRevision??null)===journal.seriesDraft.baseRevision)} onClick={()=>{const next={...current.current,revision:props.frameRevision,frameId:props.frameId,seriesDraft:{...current.current.seriesDraft,seriesId:props.mediaSeries?.membership?.seriesId??null,baseRevision:props.mediaSeries?.membership?.seriesRevision??null}};if(write(next)){apply(next);setConflict(false);setMessage('De actuele revisie is als basis gekozen. Je lokale invoer is behouden; controleer deze en sla bewust opnieuw op.');}}}>Mijn invoer op actuele revisie gebruiken</Button></>}</div>} />;
}

function MediaFramePreview({settings,main,background,playing,compact=false}:{settings:MediaFrameSettings;main?:MediaFrameSource;background?:MediaFrameSource;playing:boolean;compact?:boolean}) {
  const video = useRef<HTMLVideoElement>(null);
  useEffect(()=>{const element=video.current;if(!element)return;if(playing)void element.play().catch(()=>undefined);else element.pause();},[playing,main?.sourceUrl]);
  const choice = settings.appearance.background;
  const value:MediaFramePlaybackBackground|null=choice.kind==='image'&&!background?null:{schemaVersion:1,themeId:settings.appearance.themeId,accentColor:settings.appearance.accentColor,background:choice.kind==='preset'?choice:{...choice,checksumSha256:background!.expectedSource.checksumSha256}};
  const clubmuur=syncSystemAssets.find(asset=>asset.path==='/assets/clubmuur-wall.webp');
  const style=value?mediaFrameBackgroundStyle(value,{image:background?.sourceUrl,clubmuur:clubmuur?.path}):null;
  return <div className={`${styles.preview} ${compact?styles.compact:''} ${settings.orientation==='portrait'?styles.portrait:''}`} style={(style??{}) as CSSProperties} aria-label={compact?undefined:'Mediavoorbeeld'}>{!main||!style?<p className={styles.unavailable}>Het geverifieerde voorbeeld is niet beschikbaar. Het bestand en je ontwerp zijn niet gewijzigd.</p>:main.kind==='image'?<Image src={main.sourceUrl} alt={compact?'':main.title} fill unoptimized sizes={compact?"62px":"100vw"} style={{objectFit:settings.fitMode,objectPosition:settings.focus}}/>:<video ref={video} src={main.sourceUrl} poster={main.posterUrl??undefined} muted loop playsInline preload={compact?'none':'metadata'} style={{objectFit:settings.fitMode,objectPosition:settings.focus}} aria-label={compact?undefined:main.title}/> }</div>;
}
