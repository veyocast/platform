"use client";

import { useEffect, useRef, useState, type ReactNode, type SetStateAction } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Check, CheckCheck, ChevronDown, Clock3, Copy, ImagePlus, ListChecks, ListOrdered, Monitor, Pause, Play, Plus, RotateCcw, Save, Search, Settings2, ShieldCheck, Trash2, Undo2, X } from 'lucide-react';
import type { Media, Playlist, Slide,SyncDynamicLibraryDesign } from './model';
import { AssetImage, type DynamicDesign } from './presentation-adapter';
import type { Group, Screen } from './model';
import { type StudioProject } from './presentation-adapter';
import { maximumPlaylistPlacementSeconds, playlistPlacementPages, refreshMediaFramePlacement } from './playlist-command-plan';
import { PHOTOS } from './model';
import { PlaylistMediaPicker } from './playlist-media-picker';
import { ScreenThemePicker } from './screen-theme-picker';
import { SyncSlidePreview } from './sync-studio-preview';
import type { ScreenThemeId } from './model';
import s from './playlist-editor.module.css';

type Props = {
  playlist: Playlist;
  confirmedPlaylist?: Playlist;
  onChange: (playlist: Playlist) => void;
  onClose: () => void;
  onSave: (playlist: Playlist) => Promise<Playlist | null>;
  onPublish: (playlist: Playlist, screenIds: string[]) => void;
  inventory: Screen[];
  groups: Group[];
  initialScreenIds: string[];
  media: Media[];
  onMediaChange: (action: SetStateAction<Media[]>) => void;
  designs: DynamicDesign[];
  syncDesigns?:SyncDynamicLibraryDesign[];
  projects: StudioProject[];
  onGoStudio: () => void;
  renderPreview: (slide: Slide, active: boolean) => ReactNode;
  startAdding?: boolean;
  notice?: string;
  onReplay?: () => void;
  canWrite?: boolean;
  canPublish?: boolean;
  busy?: boolean;
  onAdvanced: () => void;
  videoUploadConfig?:{anonKey:string;supabaseUrl:string};
};

const uid = () => crypto.randomUUID();
const pages = playlistPlacementPages;
const seconds = (slide: Slide) => slide.seconds * pages(slide);
const clock = (value: number) => `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`;
const copy = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
const boundedSeconds = (value: number, dynamic: boolean, maximum=180) => Math.max(dynamic ? 5 : 3, Math.min(maximum, Math.round(value) || (dynamic ? 5 : 3)));
const maximumSeconds=maximumPlaylistPlacementSeconds;
const kind = (slide: Slide) => slide.sourceKind === 'youtube' ? 'YouTube' : slide.sourceKind === 'engage' ? 'Engage' : slide.syncDynamic?'Gekoppeld ontwerp':slide.syncStudio ? 'Studio' : slide.kind === 'video' ? 'Video' : slide.design ? (slide.design.provider === 'led-scores' ? 'LED Scores' : slide.design.provider === 'sportlink' ? 'Sportlink' : 'Menubord') : slide.studioSlide ? 'Studio' : 'Afbeelding';
const themeOf = (slide: Slide): ScreenThemeId | undefined => slide.syncDynamic?slide.themeId??slide.syncDynamic.presentation.theme:slide.syncStudio ? slide.themeId??slide.syncStudio.presentation.theme : slide.design ? slide.design.themeId : slide.studioSlide ? slide.studioSlide.themeId : slide.themeId;
const themedSlide = (slide: Slide, themeId: ScreenThemeId): Slide => slide.design
  ? { ...slide, design: { ...slide.design, themeId } }
  : slide.studioSlide ? { ...slide, studioSlide: { ...slide.studioSlide, themeId } } : { ...slide, themeId };

function DurationInput({ value, dynamic, maximum=180, onCommit }: { value: number; dynamic: boolean; maximum?:number; onCommit: (value: number) => void }) {
  const [draft, setDraft] = useState(String(value));
  const touched = useRef(false);
  useEffect(() => setDraft(String(value)), [value]);
  function commit() {
    const next = draft.trim() ? boundedSeconds(Number(draft), dynamic,maximum) : value;
    setDraft(String(next));
    if (next !== value || touched.current) onCommit(next);
    touched.current = false;
  }
  return <input type="number" inputMode="numeric" min={dynamic ? 5 : 3} max={maximum} value={draft} onChange={event => {
    const text = event.target.value;
    touched.current = true;
    setDraft(text);
    const next = Number(text);
    // Keep incomplete input editable, while valid values immediately become
    // part of the draft protected by Escape and the browser Back button.
    if (text.trim() && Number.isInteger(next) && next >= (dynamic ? 5 : 3) && next <= maximum && next !== value) onCommit(next);
  }} onBlur={commit} onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); }} />;
}

export function PlaylistEditor({ playlist, confirmedPlaylist, onChange, onClose, onSave, onPublish, inventory, groups, initialScreenIds, media, onMediaChange, designs,syncDesigns=[], projects, onGoStudio, renderPreview, startAdding = false,notice:serverNotice,canWrite=true,canPublish=true,busy=false,onReplay,onAdvanced,videoUploadConfig }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const scrollBody = useRef<HTMLDivElement>(null);
  const backAction = useRef<() => void>(() => {});
  const initial = useRef(JSON.stringify(playlist));
  const [mode, setMode] = useState<'editor' | 'picker' | 'publish'>(startAdding && canWrite ? 'picker' : 'editor');
  const [view, setView] = useState<'Inhoud' | 'Voorbeeld' | 'Details'>('Inhoud');
  const [activeId, setActiveId] = useState(playlist.slides[0]?.id || '');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [listMode, setListMode] = useState<'normal' | 'reorder' | 'select'>('normal');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkSeconds, setBulkSeconds] = useState('15');
  const [bulkTheme, setBulkTheme] = useState<ScreenThemeId>('onzetrots-tv');
  const [removed, setRemoved] = useState<{ slide: Slide; index: number }[]>([]);
  const [playing, setPlaying] = useState(false);
  const [screenIds, setScreenIds] = useState(initialScreenIds.filter(id => inventory.some(screen => screen.id === id)));
  const [screenQuery, setScreenQuery] = useState('');
  const [leave, setLeave] = useState<'close' | 'studio' | 'advanced' | null>(null);
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);
  const [storageError, setStorageError] = useState('');
  const pending = saving || busy;
  const canEdit = canWrite && !pending;
  const dirty = JSON.stringify(playlist) !== (confirmedPlaylist ? JSON.stringify(confirmedPlaylist) : initial.current);
  const active = playlist.slides.find(slide => slide.id === activeId) || playlist.slides[0];
  const activeIndex = active ? playlist.slides.findIndex(slide => slide.id === active.id) : 0;
  const total = playlist.slides.reduce((sum, slide) => sum + seconds(slide), 0);
  const validSelection = selectedIds.filter(id => playlist.slides.some(slide => slide.id === id));
  const targets = inventory.filter(screen => screenIds.includes(screen.id));
  const visibleScreens = inventory.filter(screen => `${screen.name} ${screen.group}`.toLowerCase().includes(screenQuery.toLowerCase()));

  useEffect(() => {
    const element = dialog.current;
    const priorOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    element?.showModal();
    const storageFailed = () => setStorageError('Opslaan is niet gelukt: de browseropslag is vol of niet beschikbaar. Je wijzigingen staan nog open. Maak ruimte vrij en probeer opnieuw.');
    window.addEventListener('veyocast-storage-error', storageFailed);
    return () => {
      element?.close();
      document.body.style.overflow = priorOverflow;
      window.removeEventListener('veyocast-storage-error', storageFailed);
    };
  }, []);

  useEffect(() => {
    const markerKey = '__veyocastPlaylistEditor';
    const marker = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    let editorUrl = '';
    const state = () => window.history.state && typeof window.history.state === 'object' ? window.history.state : {};
    const holdEditor = () => window.history.pushState({ ...state(), [markerKey]: marker }, '', editorUrl);
    // Next commits the destination URL after a server-action redirect. Defer
    // the sentinel so React's development remount cannot undo that navigation.
    const frame = window.requestAnimationFrame(() => { editorUrl = window.location.href; holdEditor(); });
    const browserBack = () => {
      if (!editorUrl) return;
      // A same-URL entry lets Android Back use the editor's own close flow
      // before the hash router can navigate away from an unfinished playlist.
      holdEditor();
      backAction.current();
    };
    window.addEventListener('popstate', browserBack);
    return () => {
      window.removeEventListener('popstate', browserBack);
      window.cancelAnimationFrame(frame);
      // Cleanup must never navigate: Strict Mode also runs it on first mount.
      if (editorUrl && window.location.href === editorUrl && state()[markerKey] === marker) {
        const remaining = { ...state() }; delete remaining[markerKey];
        window.history.replaceState(remaining, '', editorUrl);
      }
    };
  }, []);

  useEffect(() => {
    if (!dirty) return;
    const beforeLeave = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', beforeLeave);
    return () => window.removeEventListener('beforeunload', beforeLeave);
  }, [dirty]);

  useEffect(() => {
    if (!playing || mode !== 'editor' || !active || !playlist.slides.length) return;
    const timer = window.setTimeout(() => setActiveId(playlist.slides[(activeIndex + 1) % playlist.slides.length]?.id || ''), seconds(active) * 1000);
    return () => window.clearTimeout(timer);
  }, [playing, mode, active, activeIndex, playlist.slides]);

  function updateSlides(slides: Slide[]) { if (canEdit) onChange({ ...playlist, slides }); }
  function patchSlide(id: string, patch: Partial<Slide>) {
    if (!canEdit) return;
    updateSlides(playlist.slides.map(slide => {
      if (slide.id !== id) return slide;
      const updated = { ...slide, ...patch };
      if (patch.seconds !== undefined) {
        updated.seconds = boundedSeconds(patch.seconds, !!updated.design,maximumSeconds(updated));
        if (updated.design) updated.design = { ...updated.design, seconds: updated.seconds };
        if (updated.studioSlide) updated.studioSlide = { ...updated.studioSlide, duration: updated.seconds };
      }
      if (slide.mediaFrame && (patch.seconds !== undefined || patch.name !== undefined)) updated.mediaFrame = { ...slide.mediaFrame, edits: { ...slide.mediaFrame.edits, ...(patch.seconds !== undefined ? { durationSeconds: updated.seconds } : {}), ...(patch.name !== undefined ? { displayTitle: updated.name } : {}) } };
      return updated;
    }));
  }
  function showMode(next: 'editor' | 'picker' | 'publish') { if (next === 'picker' && !canEdit) return; setMode(next); setPlaying(false); setLeave(null); }
  function changeView(next: 'Inhoud' | 'Voorbeeld' | 'Details') { setView(next); setPlaying(false); scrollBody.current?.scrollTo({ top: 0 }); }
  function requestLeave(destination: 'close' | 'studio' | 'advanced') {
    if (pending) { setStorageError('De server verwerkt je opdracht nog. De editor blijft open; wacht op bevestiging voordat je sluit.'); return; }
    setPlaying(false);
    if (dirty) setLeave(destination);
    else if (destination === 'studio') onGoStudio();
    else if (destination === 'advanced') onAdvanced();
    else onClose();
  }
  function back() {
    if (leave) setLeave(null);
    else if (mode !== 'editor') showMode('editor');
    else requestLeave('close');
  }
  useEffect(() => { backAction.current = back; });
  async function save(destination?: 'close' | 'studio' | 'advanced') { if(!canEdit)return;setStorageError('');setSaving(true);try{const confirmed=await onSave({...playlist,name:playlist.name.trim()});if(confirmed){initial.current=JSON.stringify(confirmed);onChange(confirmed);setNotice('Je concept is bevestigd door de server.');setLeave(null);if(destination==='close')onClose();if(destination==='studio')onGoStudio();if(destination==='advanced')onAdvanced();}else setStorageError('Opslaan is niet bevestigd. Je wijzigingen blijven open. Controleer de melding en probeer opnieuw.');}catch{setStorageError('Opslaan is mislukt. Je wijzigingen blijven open; probeer opnieuw.');}finally{setSaving(false);}}
  function addItems(slides: Slide[]) {
    if (!canEdit) return;
    if (!slides.length) return;
    updateSlides([...playlist.slides, ...slides]);
    setActiveId(slides[0]!.id);
    setEditingId(null);
    const suggested = slides.flatMap(slide => slide.design ? [...slide.design.screenIds, ...groups.filter(group => slide.design!.groupNames.includes(group.name)).flatMap(group => group.members)] : []).filter(id => inventory.some(screen => screen.id === id));
    setScreenIds(previous => Array.from(new Set([...previous, ...suggested])));
    setView('Inhoud');
    setListMode('normal');
    setSelectedIds([]);
    showMode('editor');
    setNotice(`${slides.length} ${slides.length === 1 ? 'item toegevoegd' : 'items toegevoegd'} onderaan je playlist.`);
  }
  function move(id: string, offset: number) {
    if (!canEdit) return;
    const index = playlist.slides.findIndex(slide => slide.id === id);
    const destination = index + offset;
    if (index < 0 || destination < 0 || destination >= playlist.slides.length) return;
    const slides = [...playlist.slides];
    [slides[index], slides[destination]] = [slides[destination]!, slides[index]!];
    updateSlides(slides);
    setNotice(`${slides[destination]!.name} staat nu op plek ${destination + 1}.`);
  }
  function remove(ids: string[]) {
    if (!canEdit) return;
    const removing = playlist.slides.map((slide, index) => ({ slide, index })).filter(item => ids.includes(item.slide.id));
    if (!removing.length) return;
    const slides = playlist.slides.filter(slide => !ids.includes(slide.id));
    setRemoved(removing);
    updateSlides(slides);
    setSelectedIds([]);
    setEditingId(null);
    setPlaying(false);
    if (ids.includes(activeId)) setActiveId(slides[Math.min(removing[0]!.index, slides.length - 1)]?.id || '');
    setNotice('');
  }
  function undoRemove() {
    if (!canEdit) return;
    const slides = [...playlist.slides];
    removed.forEach(item => { if (!slides.some(slide => slide.id === item.slide.id)) slides.splice(Math.min(item.index, slides.length), 0, item.slide); });
    updateSlides(slides);
    setActiveId(removed[0]?.slide.id || activeId);
    setNotice(`${removed.length} ${removed.length === 1 ? 'item hersteld' : 'items hersteld'}.`);
    setRemoved([]);
  }
  function duplicate(slide: Slide) {
    if (!canEdit) return;
    const index = playlist.slides.findIndex(item => item.id === slide.id);
    const name = `${slide.name} (kopie)`;
    const next = { ...copy(slide), id: uid(), duplicateOf: slide.id, name, ...(slide.mediaFrame ? { mediaFrame: { ...copy(slide.mediaFrame), edits: { ...slide.mediaFrame.edits, displayTitle: name } } } : {}) };
    updateSlides([...playlist.slides.slice(0, index + 1), next, ...playlist.slides.slice(index + 1)]);
    setActiveId(next.id);
    setEditingId(next.id);
    setNotice('Kopie direct onder het oorspronkelijke item toegevoegd.');
  }
  function applyDuration() {
    if (!canEdit) return;
    updateSlides(playlist.slides.map(slide => {
      if (!validSelection.includes(slide.id)) return slide;
      const value = boundedSeconds(Number(bulkSeconds), !!slide.design,maximumSeconds(slide));
      return { ...slide, seconds: value, ...(slide.mediaFrame ? { mediaFrame: { ...slide.mediaFrame, edits: { ...slide.mediaFrame.edits, durationSeconds: value } } } : {}), ...(slide.design ? { design: { ...slide.design, seconds: value } } : {}), ...(slide.studioSlide ? { studioSlide: { ...slide.studioSlide, duration: value } } : {}) };
    }));
    setNotice(`Duur aangepast voor ${validSelection.length} ${validSelection.length === 1 ? 'item' : 'items'}. Dynamische pagina’s duren minimaal 5 seconden.`);
  }
  function applyTheme(ids: string[], themeId: ScreenThemeId) {
    if (!ids.length||!canEdit) return;
    const supported=playlist.slides.filter(slide=>ids.includes(slide.id)&&!slide.mediaFrame&&(slide.kind!=='video'||slide.studioSlide||slide.syncStudio||slide.syncDynamic)).map(slide=>slide.id);
    updateSlides(playlist.slides.map(slide => supported.includes(slide.id) ? themedSlide(slide, themeId) : slide));
    setNotice(`${themeId === 'onzetrots-tv' ? 'OnzeTrots TV' : 'Oorspronkelijke stijl'} toegepast op ${supported.length} ${supported.length === 1 ? 'item' : 'items'}. Je inhoud en duur per pagina blijven behouden.${supported.length<ids.length?' Video’s behouden hun eigen beeld.':''}`);
  }
  function refresh(slide: Slide) {
    if (slide.mediaFrame) { try { const next = refreshMediaFramePlacement(slide); updateSlides(playlist.slides.map(item => item.id === slide.id ? next : item)); setNotice('De gekozen media-ontwerpversie staat in je concept. Bestaande plaatsingsvoorkeuren blijven behouden; sla op om de versie te bevestigen.'); } catch (failure) { setNotice(failure instanceof Error ? failure.message : 'De media-ontwerpversie kon niet worden gekozen.'); } return; }
    const latestSource=syncDesigns.find(design=>design.id===slide.designId);
    if(slide.syncDynamic&&latestSource){patchSlide(slide.id,{syncDynamic:copy(latestSource),seconds:latestSource.configuration.secondsPerPage,kind:latestSource.kind,mediaId:latestSource.mediaAssetId,mediaChecksumSha256:latestSource.checksumSha256,image:'',orientation:latestSource.presentation.orientation});setNotice('De nieuwste volledige Source-versie staat in je concept. Sla op om deze keuze te bevestigen.');return;}
    const latestDesign = designs.find(design => design.id === slide.designId);
    const latestSlide = projects.find(project => project.id === slide.studioProjectId)?.slides.find(item => item.id === slide.studioSlideId);
    if (slide.design && latestDesign) patchSlide(slide.id, { design: { ...copy(latestDesign), seconds: slide.seconds }, image: latestDesign.background || PHOTOS.club });
    else if (slide.studioSlide && latestSlide) patchSlide(slide.id, { mediaId:latestSlide.exportAssetId,studioSlide: { ...copy(latestSlide), duration: slide.seconds }, image: latestSlide.photo || '' });
    else {setNotice('Er is nog geen nieuwe, gereedstaande versie beschikbaar.');return;}
    setNotice('De nieuwste gereedstaande versie staat in je concept. Sla op om deze keuze te bevestigen.');
  }
  function toggleScreen(id: string) { setScreenIds(previous => previous.includes(id) ? previous.filter(item => item !== id) : [...previous, id]); }
  function toggleGroup(group: Group) {
    const members = group.members.filter(id => inventory.some(screen => screen.id === id));
    setScreenIds(previous => members.every(id => previous.includes(id)) ? previous.filter(id => !members.includes(id)) : Array.from(new Set([...previous, ...members])));
  }

  function itemSettings(slide: Slide) {
    const canRefresh = slide.mediaFrame ? Boolean(slide.mediaFrame.current && slide.mediaFrame.current.id !== slide.mediaFrame.selected.id && slide.mediaFrame.current.number > slide.mediaFrame.pinnedVersionNumber) : !!(slide.syncDynamic&&syncDesigns.some(design=>design.id===slide.designId))||!!(slide.design && designs.some(design => design.id === slide.designId)) || !!(slide.studioSlide && projects.some(project => project.id === slide.studioProjectId && project.slides.some(item => item.id === slide.studioSlideId)));
    return <fieldset disabled={!canEdit}className={s.itemSettings}style={{border:0,margin:0,padding:0,minWidth:0}}>
      <label className={s.field}>Naam in playlist<input value={slide.name} onChange={event => patchSlide(slide.id, { name: event.target.value })} /></label>
      {slide.mediaFrame && <p className={s.hint}>Vastgezet op media-ontwerpversie {slide.mediaFrame.pinnedVersionNumber}.{slide.mediaFrame.selected.id !== slide.mediaFrame.pinnedVersionId ? ` Versie ${slide.mediaFrame.selected.number} is gekozen voor de volgende opslag.` : slide.mediaFrame.current && slide.mediaFrame.current.number > slide.mediaFrame.pinnedVersionNumber ? ` Versie ${slide.mediaFrame.current.number} is beschikbaar; vernieuwen gebeurt alleen op jouw verzoek.` : !slide.mediaFrame.current ? ' De actuele bron is niet beschikbaar voor vernieuwen.' : ''}</p>}
      <div className={s.durationSettings}>
        <label className={s.field}>{pages(slide) > 1 ? 'Seconden per pagina' : 'Seconden in beeld'}<DurationInput key={slide.id} value={slide.seconds} dynamic={!!slide.design} maximum={maximumSeconds(slide)} onCommit={value => patchSlide(slide.id, { seconds: value })} /></label>
        <div className={s.presets} aria-label="Snelle afspeelduur">{[10, 15, 20].filter(value=>value<=maximumSeconds(slide)).map(value => <button key={value} type="button" aria-pressed={slide.seconds === value} onClick={() => patchSlide(slide.id, { seconds: value })}>{value}s</button>)}</div>
      </div>
      {pages(slide) > 1 && <p className={s.hint}>{pages(slide)} pagina’s × {slide.seconds}s = {seconds(slide)} seconden in je playlist.</p>}
      <div className={s.themeSettings}>
        {slide.mediaFrame?<p className={s.hint}>De vormgeving en achtergrond komen uit de gekozen vaste media-ontwerpversie.</p>:slide.kind==='video'&&!slide.studioSlide&&!slide.syncStudio&&!slide.syncDynamic?<p className={s.hint}>Deze video speelt zijn eigen beeld af.</p>:<ScreenThemePicker value={themeOf(slide)} onChange={themeId => applyTheme([slide.id], themeId)} legacyLabel="Oorspronkelijke stijl" compact />}
        {slide.sourceKind&&<p className={s.hint}>Het schermthema geldt voor de lokale back-upkaart.</p>}
        {!slide.syncDynamic&&!slide.syncStudio && !slide.design && !slide.studioSlide && themeOf(slide) === 'onzetrots-tv' && <label className={s.field}>Schermstand<select value={slide.orientation || 'landscape'} onChange={event => patchSlide(slide.id, { orientation: event.target.value as 'landscape' | 'portrait' })}><option value="landscape">Liggend · 16:9</option><option value="portrait">Staand · 9:16</option></select></label>}
        {(slide.syncDynamic||slide.design || slide.studioSlide || slide.syncStudio) && <p className={s.hint}>Het thema geldt voor dit playlistitem. Je bronontwerp in Studio blijft behouden.</p>}
      </div>
      {(slide.syncDynamic||slide.design || slide.studioSlide || slide.syncStudio) && <p className={s.hint}>Dit item bevat je opgeslagen Studio-ontwerp. De naam hierboven is het label in je playlist.</p>}
      <div className={s.itemActions}>
        <button type="button" className={s.secondary} onClick={() => duplicate(slide)}><Copy size={17} />Kopiëren</button>
        <button type="button" className={s.danger} onClick={() => remove([slide.id])}><Trash2 size={17} />Verwijderen</button>
        {canRefresh && <button type="button" className={s.refresh} onClick={() => refresh(slide)}><RotateCcw size={16} />{slide.mediaFrame?`Media-ontwerpversie ${slide.mediaFrame.current!.number} kiezen`:'Nieuwste Studio-versie'}</button>}
      </div>
    </fieldset>;
  }

  function thumbnail(slide:Slide){
    const source=slide.syncDynamic??slide.syncStudio;
    return source?<span aria-hidden="true"className={s.thumbnail}><SyncSlidePreview presentation={{...source.presentation,theme:themeOf(slide)??source.presentation.theme}}assetUrls={source.assetUrls}durationSeconds={source.durationSeconds}id={source.id}compact/></span>:<span className={s.thumbnail}><AssetImage src={slide.image}alt=""/></span>;
  }

  function preview() {
    return <section className={s.previewPanel} aria-label="Playlistvoorbeeld">
      <div className={s.sectionHeading}><div><span className={s.eyebrow}>Zo komt het in beeld</span><h3>Live voorbeeld</h3></div><span className={s.counter}>{playlist.slides.length ? activeIndex + 1 : 0} / {playlist.slides.length}</span></div>
      {active ? <>
        <div className={s.previewFrame}>{renderPreview(active, playing)}</div>
        <div className={s.playback}>
          <button type="button" className={s.iconButton} disabled={playlist.slides.length < 2} aria-label="Vorig item bekijken" onClick={() => { setPlaying(false); setActiveId(playlist.slides[(activeIndex - 1 + playlist.slides.length) % playlist.slides.length]?.id || ''); }}><ArrowLeft size={19} /></button>
          <button type="button" className={s.playButton} onClick={() => setPlaying(value => !value)}>{playing ? <Pause size={18} /> : <Play size={18} />}{playing ? 'Pauzeren' : 'Playlist afspelen'}</button>
          <button type="button" className={s.iconButton} disabled={playlist.slides.length < 2} aria-label="Volgend item bekijken" onClick={() => { setPlaying(false); setActiveId(playlist.slides[(activeIndex + 1) % playlist.slides.length]?.id || ''); }}><ArrowRight size={19} /></button>
        </div>
        <div className={s.previewCaption}><strong>{active.name || 'Naamloos item'}</strong><span>{kind(active)} · {seconds(active)} sec.</span></div>
        <p className={s.hint}>Tijdens het afspelen loopt het voorbeeld automatisch door je playlist.</p>
        <div className={s.previewEdit}>{itemSettings(active)}</div>
      </> : <div className={s.emptyPreview}><Monitor size={42} /><p>Je voorbeeld verschijnt zodra je inhoud toevoegt.</p></div>}
    </section>;
  }

  return <dialog ref={dialog} className={s.dialog} aria-label={mode === 'picker' ? 'Inhoud toevoegen aan playlist' : mode === 'publish' ? 'Playlist publiceren' : 'Playlist bewerken'} onCancel={event => { event.preventDefault(); back(); }} onKeyDown={event => {
    if (event.key !== 'Tab') return;
    const elements = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button,input,select,textarea,a[href],[tabindex]')).filter(element => element.tabIndex >= 0 && !element.matches(':disabled') && element.getClientRects().length > 0);
    const first = elements[0], last = elements.at(-1);
    if (!first || !last) { event.preventDefault(); event.currentTarget.focus(); return; }
    if (!event.currentTarget.contains(document.activeElement) || (!event.shiftKey && document.activeElement === last) || (event.shiftKey && document.activeElement === first)) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
    }
  }}>
    <header className={s.header}>
      <button type="button" className={s.iconButton} aria-label={mode === 'editor' ? 'Terug naar playlists' : 'Terug naar playlist'} onClick={back}><ArrowLeft size={22} /></button>
      <div className={s.heading}><span>{mode === 'picker' ? 'Kies je clubverhaal' : mode === 'publish' ? 'Laat je playlist zien' : 'Playlist bewerken'}</span><h2>{mode === 'picker' ? 'Inhoud toevoegen' : mode === 'publish' ? 'Schermen kiezen' : playlist.name || 'Nieuwe playlist'}</h2></div>
      <button type="button" className={s.closeButton} onClick={() => requestLeave('close')} aria-label="Playlisteditor sluiten"><X size={22} /></button>
    </header>
    {serverNotice && <p className={s.notice} role="status">{serverNotice}</p>}
    {onReplay && <button type="button" className={s.secondary} disabled={pending} onClick={onReplay}><RotateCcw size={17}/>Dezelfde opslag opnieuw bevestigen</button>}
    {storageError && <div className={s.error} role="alert">{storageError}<button type="button" onClick={() => setStorageError('')} aria-label="Melding sluiten"><X size={18} /></button></div>}
    {leave ? <div className={s.leaveScreen}>
      <div className={s.leaveIcon}><Save size={29} /></div><h3>Je hebt nog wijzigingen</h3><p>Bewaar je playlist voordat je {leave === 'studio' ? 'naar Studio gaat' : 'de editor sluit'}.</p>
      <button type="button" className={s.primary} disabled={!canEdit || playlist.name.trim().length < 2} onClick={() => void save(leave)}><Save size={18} />{leave === 'studio' ? 'Opslaan en naar Studio' : leave === 'advanced' ? 'Opslaan en naar uitgebreide instellingen' : 'Opslaan en sluiten'}</button>
      <button type="button" className={s.secondary} onClick={() => setLeave(null)}>Verder bewerken</button>
      {leave === 'close' && <button type="button" className={s.danger} disabled={pending} onClick={onClose}>Wijzigingen niet bewaren</button>}
    </div> : mode === 'picker' ? <PlaylistMediaPicker media={media} onMediaChange={onMediaChange} projects={projects} designs={designs}syncDesigns={syncDesigns} onAdd={addItems}videoUploadConfig={videoUploadConfig} onBack={() => showMode('editor')} onGoStudio={() => requestLeave('studio')} /> : mode === 'publish' ? <>
      <div className={s.body} ref={scrollBody}>
        <div className={s.publishSummary}><span className={s.summaryIcon}><ListChecks size={25} /></span><div><strong>{playlist.name}</strong><p>{playlist.slides.length} items · {clock(total)} afspeeltijd</p></div><button type="button" className={s.textButton} onClick={() => showMode('editor')}>Bewerken</button></div>
        <div className={s.sectionHeading}><div><h3>Waar mag deze playlist spelen?</h3><p>Kies een groep of selecteer losse schermen.</p></div></div>
        <div className={s.groupChips}>{groups.map(group => { const members = group.members.filter(id => inventory.some(screen => screen.id === id)); const chosen = members.length > 0 && members.every(id => screenIds.includes(id)); return <button type="button" key={group.name} aria-pressed={chosen} disabled={!members.length} onClick={() => toggleGroup(group)}>{chosen ? <Check size={16} /> : <Plus size={16} />}{group.name}<span>{members.length}</span></button>; })}</div>
        <label className={s.search}><Search size={18} /><input value={screenQuery} onChange={event => setScreenQuery(event.target.value)} placeholder="Zoek een scherm of ruimte" aria-label="Schermen zoeken" />{screenQuery && <button type="button" aria-label="Zoeken wissen" onClick={() => setScreenQuery('')}><X size={17} /></button>}</label>
        <div className={s.screenList}>{visibleScreens.map(screen => <label key={screen.id} className={s.screenChoice} data-selected={screenIds.includes(screen.id)}><input type="checkbox" checked={screenIds.includes(screen.id)} onChange={() => toggleScreen(screen.id)} /><Monitor size={22} /><span><strong>{screen.name}</strong><small>{screen.group} · {screen.orientation}</small></span><span className={s.screenStatus} data-offline={screen.status === 'offline'}>{screen.status === 'unknown' ? 'Nog niet bevestigd' : screen.status === 'offline' ? 'Offline' : 'Online'}</span></label>)}</div>
        {!visibleScreens.length && <p className={s.emptyResult}>Geen schermen gevonden. Probeer een andere naam.</p>}
          <p className={s.demoNote}><ShieldCheck size={18} />Publiceren controleert je inhoud en maakt een complete, vaste publicatie voor de gekozen schermen. Live gegevens verversen zelfstandig.</p>
      </div>
      <footer className={s.publishFooter}><div><strong>{targets.length} {targets.length === 1 ? 'scherm' : 'schermen'}</strong><span>geselecteerd</span></div><button type="button" className={s.primary} disabled={!canPublish || pending || !targets.length || !playlist.slides.length || playlist.name.trim().length < 2} onClick={() => { setStorageError(''); onPublish({ ...playlist, name: playlist.name.trim() }, targets.map(screen => screen.id)); }}><CheckCheck size={18} />Publiceren</button></footer>
    </> : <>
      <nav className={s.tabs} aria-label="Playlistweergave">{(['Inhoud', 'Voorbeeld', 'Details'] as const).map(tab => <button type="button" key={tab} aria-pressed={view === tab} onClick={() => changeView(tab)}>{tab === 'Inhoud' ? <ListOrdered size={17} /> : tab === 'Voorbeeld' ? <Play size={17} /> : <Settings2 size={17} />}{tab}{tab === 'Inhoud' && <span>{playlist.slides.length}</span>}</button>)}</nav>
      <div className={s.body} ref={scrollBody}>
        {notice && <div className={s.notice} role="status"><Check size={17} /><span>{notice}</span><button type="button" aria-label="Melding sluiten" onClick={() => setNotice('')}><X size={16} /></button></div>}
        {!!removed.length && <div className={s.undoNotice} role="status"><span>{removed.length} {removed.length === 1 ? 'item verwijderd' : 'items verwijderd'}.</span><button type="button" onClick={undoRemove}><Undo2 size={17} />Herstellen</button><button type="button" className={s.iconButton} aria-label="Herstelmelding sluiten" onClick={() => setRemoved([])}><X size={17} /></button></div>}
        {view === 'Details' ? <section className={s.details}>
          {playlist.name.trim().length < 2 && <p role="alert">De playlistnaam is te kort. Opslaan en publiceren wachten; vul minimaal twee tekens in.</p>}
          <div className={s.sectionHeading}><div><span className={s.eyebrow}>Herkenbaar voor je team</span><h3>Over deze playlist</h3></div></div>
          <label className={s.field}>Naam playlist<input disabled={!canEdit}value={playlist.name} onChange={event => onChange({ ...playlist, name: event.target.value })} placeholder="Bijvoorbeeld: Clubhuis — vandaag" /></label>
          <label className={s.field}>Beschrijving <span className={s.optional}>optioneel</span><textarea rows={3} disabled={!canEdit}value={playlist.description} onChange={event => onChange({ ...playlist, description: event.target.value })} placeholder="Wat laat je zien, waar en wanneer?" /></label>
          <div className={s.detailStats}><div><span>Inhoud</span><strong>{playlist.slides.length} items</strong></div><div><span>Afspeeltijd</span><strong>{clock(total)}</strong></div><div><span>Status</span><strong>{dirty ? 'Niet opgeslagen' : playlist.status}</strong></div></div>
          <section className={s.playlistTheme} aria-label="Thema voor de hele playlist">
            <div><h3>Eén stijl voor je hele playlist</h3><p>Pas hetzelfde thema toe op foto’s, Studio-ontwerpen en dynamische slides. Alle inhoud en de duur per pagina blijven behouden.</p></div>
            <ScreenThemePicker value={bulkTheme} onChange={setBulkTheme} legacyLabel="Oorspronkelijke stijl" compact />
            <button type="button" className={s.secondary} disabled={!canEdit || !playlist.slides.length} onClick={() => applyTheme(playlist.slides.map(slide => slide.id), bulkTheme)}>Toepassen op alle {playlist.slides.length} items</button>
          </section>
            <p className={s.demoNote}><ShieldCheck size={18} />Opslaan bevestigt je concept in de database. Gepubliceerde inhoud blijft actief totdat je een complete nieuwe publicatie kiest.</p>
          <button type="button" className={s.secondary} disabled={!canPublish || pending || playlist.name.trim().length < 2 || !playlist.slides.length} onClick={() => showMode('publish')}><Monitor size={18} />Schermen kiezen en publiceren<ArrowRight size={18} /></button>
        </section> : view === 'Voorbeeld' ? <div className={s.previewOnly}>{preview()}</div> : <div className={s.workspace}>
          <section className={s.contentPanel} aria-label="Playlistinhoud">
            <div className={s.listTop}><div><h3>Jouw volgorde</h3><span><Clock3 size={14} />{clock(total)} totaal</span></div><div className={s.listTools}>
              <button type="button" aria-pressed={listMode === 'select'} disabled={!playlist.slides.length} onClick={() => { setListMode(listMode === 'select' ? 'normal' : 'select'); setSelectedIds([]); setEditingId(null); }}><ListChecks size={17} />{listMode === 'select' ? 'Klaar' : 'Selecteer'}</button>
              <button type="button" aria-pressed={listMode === 'reorder'} disabled={playlist.slides.length < 2} onClick={() => { setListMode(listMode === 'reorder' ? 'normal' : 'reorder'); setSelectedIds([]); setEditingId(null); }}><ListOrdered size={17} />{listMode === 'reorder' ? 'Klaar' : 'Volgorde'}</button>
            </div></div>
            {listMode === 'reorder' && <p className={s.modeHint}>Verplaats items met de pijlen. Je wijzigingen worden bewaard als je op Opslaan tikt.</p>}
            {listMode === 'select' && <div className={s.bulkPanel}>
              <div className={s.bulkHeading}><strong>{validSelection.length} geselecteerd</strong><button type="button" onClick={() => setSelectedIds(validSelection.length === playlist.slides.length ? [] : playlist.slides.map(slide => slide.id))}>{validSelection.length === playlist.slides.length ? 'Selectie wissen' : 'Alles selecteren'}</button></div>
              <div className={s.bulkDuration}><label>Duur <input type="number" inputMode="numeric" min={3} max={playlist.slides.some(slide=>validSelection.includes(slide.id)&&slide.mediaFrame)?3600:180} value={bulkSeconds} onChange={event => setBulkSeconds(event.target.value)} /> sec.</label><button type="button" className={s.secondary} disabled={!canEdit || !validSelection.length || !bulkSeconds} onClick={applyDuration}>Toepassen</button><button type="button" className={s.danger} disabled={!canEdit || !validSelection.length} onClick={() => remove(validSelection)} aria-label={`${validSelection.length} geselecteerde items verwijderen`}><Trash2 size={18} /></button></div>
              <div className={s.bulkTheme}><ScreenThemePicker value={bulkTheme} onChange={setBulkTheme} legacyLabel="Oorspronkelijke stijl" compact /><button type="button" className={s.secondary} disabled={!canEdit || !validSelection.length} onClick={() => applyTheme(validSelection, bulkTheme)}>Thema toepassen op {validSelection.length} items</button></div>
            </div>}
            <ol className={s.slideList}>{playlist.slides.map((slide, index) => <li key={slide.id} className={s.slideItem} data-current={active?.id === slide.id} data-expanded={editingId === slide.id} data-selected={validSelection.includes(slide.id)}>
              <div className={s.row}>
                {listMode === 'select' && <label className={s.selectTouch}><input type="checkbox" aria-label={`${slide.name} selecteren`} checked={validSelection.includes(slide.id)} onChange={() => setSelectedIds(previous => previous.includes(slide.id) ? previous.filter(id => id !== slide.id) : [...previous, slide.id])} /></label>}
                <button type="button" className={s.rowMain} aria-expanded={listMode === 'normal' ? editingId === slide.id : undefined} onClick={() => { setActiveId(slide.id); setPlaying(false); if (listMode === 'select') setSelectedIds(previous => previous.includes(slide.id) ? previous.filter(id => id !== slide.id) : [...previous, slide.id]); else if (listMode === 'normal') setEditingId(editingId === slide.id ? null : slide.id); }}>
                  <span className={s.rowNumber}>{index + 1}</span>{thumbnail(slide)}<span className={s.rowCopy}><strong>{slide.name || 'Naamloos item'}</strong><small>{kind(slide)}{pages(slide) > 1 ? ` · ${pages(slide)} pagina’s` : ''}</small></span>
                </button>
                {listMode === 'reorder' ? <div className={s.moveButtons}><button type="button" aria-label={`${slide.name} omhoog`} disabled={!canEdit || index === 0} onClick={() => move(slide.id, -1)}><ArrowUp size={19} /></button><button type="button" aria-label={`${slide.name} omlaag`} disabled={!canEdit || index === playlist.slides.length - 1} onClick={() => move(slide.id, 1)}><ArrowDown size={19} /></button></div> : <button type="button" className={s.durationButton} aria-label={`${slide.name}, ${seconds(slide)} seconden, instellingen openen`} onClick={() => { setActiveId(slide.id); setPlaying(false); if (listMode === 'select') { setView('Voorbeeld'); } else setEditingId(editingId === slide.id ? null : slide.id); }}><span>{seconds(slide)}s</span>{listMode === 'normal' && <ChevronDown size={14} />}</button>}
              </div>
              {listMode === 'normal' && editingId === slide.id && itemSettings(slide)}
            </li>)}</ol>
            {!playlist.slides.length ? <div className={s.empty}><span><ImagePlus size={33} /></span><h3>Wat laat jouw club zien?</h3><p>Kies foto’s, Studio-ontwerpen of een live wedstrijdslide. Je kunt er meerdere tegelijk toevoegen.</p><button type="button" className={s.primary} disabled={!canEdit} onClick={() => showMode('picker')}><Plus size={18} />Eerste inhoud toevoegen</button></div> : <button type="button" className={s.addRow} disabled={!canEdit} onClick={() => showMode('picker')}><Plus size={19} />Inhoud toevoegen</button>}
          </section>
          <aside className={s.desktopPreview}>{preview()}</aside>
        </div>}
      </div>
      <footer className={s.footer}>
        <div className={s.saveStatus} role="status"><span data-dirty={dirty} /><span>{pending ? 'De server controleert je wijzigingen…' : dirty ? 'Nog niet opgeslagen' : 'Geen nieuwe wijzigingen'}</span></div>
        <div className={s.footerActions}><button type="button" className={s.secondary} disabled={!canEdit} onClick={() => showMode('picker')}><Plus size={19} /><span>Toevoegen</span></button><button type="button" className={s.primary} disabled={!canEdit || playlist.name.trim().length < 2} onClick={() => void save()}><Save size={18} />Opslaan</button><button type="button" className={s.publishButton} aria-label="Schermen kiezen en publiceren" title="Schermen kiezen en publiceren" disabled={!canPublish || pending || playlist.name.trim().length < 2 || !playlist.slides.length} onClick={() => showMode('publish')}><Monitor size={18} /><span>Publiceren</span></button></div>
      </footer>
    </>}
  </dialog>;
}
