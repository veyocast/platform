"use client";

import {useEffect, useRef, useState, type SetStateAction} from 'react';
import {Check, ChevronDown, ChevronUp, CloudUpload, ImagePlus, Layers, LoaderCircle, Plus, Search, Sparkles, Star, X} from 'lucide-react';
import type {Media, Slide} from './content';
import {AssetImage, ExperiencePreview, uploadBackground, type DynamicDesign} from './experience';
import {SlideCanvas, type StudioProject} from './studio';
import {PHOTOS} from './shared';
import styles from './playlist-media-picker.module.css';

export interface PlaylistMediaPickerProps {
  media: Media[];
  onMediaChange: (action: SetStateAction<Media[]>) => void;
  projects: StudioProject[];
  designs: DynamicDesign[];
  onAdd: (slides: Slide[]) => void;
  onBack: () => void;
  onGoStudio: () => void;
}

type Tab = 'media' | 'studio' | 'dynamic';
type Choice =
  | {key: string; source: 'media'; item: Media}
  | {key: string; source: 'studio'; item: StudioProject}
  | {key: string; source: 'dynamic'; item: DynamicDesign};
type UploadProgress = {done: number; total: number; name: string; added: number};
const tabs: {id: Tab; label: string}[] = [
  {id: 'media', label: 'Media'},
  {id: 'studio', label: 'Studio'},
  {id: 'dynamic', label: 'Sportlink & LED'},
];
const createId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
const itemCount = (choice: Choice) => choice.source === 'studio' ? choice.item.slides.length : 1;
const providerLabel = (design: DynamicDesign) => design.provider === 'led-scores' ? 'LED Scores' : design.provider === 'sportlink' ? 'Sportlink' : 'Kantine';

function toSlides(choice: Choice): Slide[] {
  if (choice.source === 'media') {
    const media = choice.item;
    return [{id: createId('sl'), mediaId: media.id, name: media.name, image: media.image, seconds: 12}];
  }
  if (choice.source === 'studio') {
    return choice.item.slides.map(slide => ({
      id: createId('sl'), name: slide.name, image: slide.photo, seconds: slide.duration,
      studioProjectId: choice.item.id, studioSlideId: slide.id,
      studioSlide: JSON.parse(JSON.stringify(slide)),
    }));
  }
  const design = choice.item;
  return [{
    id: createId('sl'), name: design.name, image: design.background || PHOTOS.club,
    seconds: design.seconds || 12, designId: design.id,
    design: JSON.parse(JSON.stringify(design)),
  }];
}

export function PlaylistMediaPicker({media, onMediaChange, projects, designs, onAdd, onGoStudio}: PlaylistMediaPickerProps) {
  const [tab, setTab] = useState<Tab>('media');
  const [query, setQuery] = useState('');
  const [folder, setFolder] = useState('all');
  const [favorites, setFavorites] = useState(false);
  const [provider, setProvider] = useState('all');
  const [selection, setSelection] = useState<Choice[]>([]);
  const [showSelection, setShowSelection] = useState(false);
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [uploadErrors, setUploadErrors] = useState<string[]>([]);
  const [uploadResult, setUploadResult] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const scrollArea = useRef<HTMLDivElement>(null);
  const mounted = useRef(true);
  const uploading = useRef(false);
  useEffect(() => {mounted.current = true; return () => {mounted.current = false;};}, []);
  useEffect(() => {scrollArea.current?.scrollTo({top: 0});}, [tab, folder, favorites, provider, query]);

  const activeMedia = media.filter(item => !item.archived);
  const folders = Array.from(new Set(activeMedia.map(item => item.folder).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'nl'));
  const normalizedQuery = query.trim().toLocaleLowerCase('nl');
  const matches = (value: string) => value.toLocaleLowerCase('nl').includes(normalizedQuery);
  const choices: Choice[] = tab === 'media'
    ? activeMedia.filter(item => (folder === 'all' || item.folder === folder) && (!favorites || item.favorite) && matches(`${item.name} ${(item.tags || []).join(' ')} ${(item.collections || []).join(' ')}`)).map(item => ({key: `media:${item.id}`, source: 'media' as const, item}))
    : tab === 'studio'
      ? projects.filter(item => matches(`${item.name} ${item.slides.map(slide => `${slide.name} ${slide.title}`).join(' ')}`)).map(item => ({key: `studio:${item.id}`, source: 'studio' as const, item}))
      : designs.filter(item => (provider === 'all' || item.provider === provider) && matches(`${item.name} ${item.title} ${item.subtitle} ${providerLabel(item)}`)).map(item => ({key: `dynamic:${item.id}`, source: 'dynamic' as const, item}));
  const selectable = choices.filter(choice => itemCount(choice) > 0 && !(choice.source === 'media' && choice.item.kind === 'video'));
  const selectedKeys = new Set(selection.map(choice => choice.key));
  const allVisibleSelected = selectable.length > 0 && selectable.every(choice => selectedKeys.has(choice.key));
  const totalSlides = selection.reduce((total, choice) => total + itemCount(choice), 0);
  const filtered = !!query || (tab === 'media' && (folder !== 'all' || favorites)) || (tab === 'dynamic' && provider !== 'all');

  function toggle(choice: Choice) {
    setSelection(previous => previous.some(item => item.key === choice.key) ? previous.filter(item => item.key !== choice.key) : [...previous, choice]);
  }
  function resetFilters() {setQuery(''); setFolder('all'); setFavorites(false); setProvider('all');}
  function toggleVisible() {
    const visibleKeys = new Set(selectable.map(choice => choice.key));
    setSelection(previous => allVisibleSelected
      ? previous.filter(choice => !visibleKeys.has(choice.key))
      : [...previous, ...selectable.filter(choice => !previous.some(item => item.key === choice.key))]);
  }

  async function addFiles(files: FileList | null) {
    if (!files?.length || uploading.current) return;
    uploading.current = true;
    const pending = Array.from(files);
    let added = 0;
    setUploadErrors([]);
    setUploadResult('');
    setTab('media');
    resetFilters();
    setProgress({done: 0, total: pending.length, name: pending[0].name, added: 0});
    for (let index = 0; index < pending.length; index++) {
      if (!mounted.current) break;
      const file = pending[index];
      setProgress({done: index, total: pending.length, name: file.name, added});
      try {
        const image = await uploadBackground(file);
        const item: Media = {
          id: createId('m'), name: file.name.replace(/\.[^.]+$/, '') || 'Nieuwe afbeelding',
          image, folder: 'Uploads', size: `${(file.size / 1024 / 1024).toLocaleString('nl-NL', {maximumFractionDigits: 1})} MB`,
          kind: 'image', tags: [], collections: [],
        };
        // Keep each completed upload in the image library, even if the picker closes meanwhile.
        let metadataFailed = false;
        const failed = () => {metadataFailed = true;};
        window.addEventListener('veyocast-storage-error', failed);
        try {onMediaChange(previous => [item, ...previous]);}
        finally {window.removeEventListener('veyocast-storage-error', failed);}
        if (metadataFailed) throw new Error('De foto kon niet in de beeldbank worden bewaard. Maak ruimte vrij in de browser en probeer opnieuw.');
        added++;
        if (mounted.current) setSelection(previous => [...previous, {key: `media:${item.id}`, source: 'media', item}]);
      } catch (error) {
        if (mounted.current) setUploadErrors(previous => [...previous, `${file.name}: ${error instanceof Error ? error.message : 'Dit bestand kon niet worden toegevoegd.'}`]);
      }
    }
    uploading.current = false;
    if (mounted.current) {
      setProgress(null);
      if (added) setUploadResult(`${added} afbeelding${added === 1 ? '' : 'en'} toegevoegd aan de beeldbank en geselecteerd.`);
      if (input.current) input.current.value = '';
    }
  }

  return <div className={styles.picker}>
    <div className={styles.scrollBody} ref={scrollArea}>
    <div className={styles.tools}>
      <div className={styles.tabs} aria-label="Inhoud kiezen uit">
        {tabs.map(item => <button type="button" key={item.id} aria-pressed={tab === item.id} onClick={() => setTab(item.id)}>
          {item.label}
          {selection.some(choice => choice.source === item.id) && <span className={styles.tabCount}>{selection.filter(choice => choice.source === item.id).length}</span>}
        </button>)}
      </div>
      <div className={styles.searchRow}>
        <label className={styles.search}>
          <Search size={19} aria-hidden="true"/>
          <input type="search" value={query} onChange={event => setQuery(event.target.value)} aria-label="Inhoud zoeken" placeholder={tab === 'media' ? 'Zoek naam, tag of collectie' : 'Zoek een ontwerp'} autoComplete="off"/>
          {query && <button type="button" aria-label="Zoekveld wissen" onClick={() => setQuery('')}><X size={17}/></button>}
        </label>
        {tab === 'media' && <button type="button" className={styles.uploadButton} disabled={!!progress} onClick={() => input.current?.click()}>
          {progress ? <LoaderCircle size={18} className={styles.spin}/> : <CloudUpload size={19}/>}<span>Uploaden</span>
        </button>}
      </div>
      <input ref={input} type="file" hidden accept="image/jpeg,image/png,image/webp,image/avif" multiple onChange={event => void addFiles(event.target.files)}/>
      {tab === 'media' && <div className={styles.filters}>
        <label className={styles.folder}><Layers size={16} aria-hidden="true"/><select aria-label="Filter op map" value={folder} onChange={event => setFolder(event.target.value)}><option value="all">Alle mappen</option>{folders.map(name => <option key={name} value={name}>{name}</option>)}</select></label>
        <button type="button" className={styles.favorite} aria-pressed={favorites} onClick={() => setFavorites(value => !value)}><Star size={16} fill={favorites ? 'currentColor' : 'none'}/>Favorieten</button>
      </div>}
      {tab === 'dynamic' && <div className={styles.filters}>
        {([{value: 'all', label: 'Alle ontwerpen'}, {value: 'sportlink', label: 'Sportlink'}, {value: 'led-scores', label: 'LED Scores'}, {value: 'menu', label: 'Kantine'}]).map(item => <button type="button" className={styles.filterChip} key={item.value} aria-pressed={provider === item.value} onClick={() => setProvider(item.value)}>{item.label}</button>)}
      </div>}
    </div>

    <div className={styles.content}>
      {!!progress && <div className={styles.uploadStatus} role="status"><LoaderCircle size={18} className={styles.spin}/><div><strong>Afbeelding {progress.done + 1} van {progress.total} verwerken…</strong><span>{progress.name}</span><progress aria-label="Voortgang upload" value={progress.done} max={progress.total}/></div></div>}
      {!!uploadResult && <div className={styles.success} role="status"><Check size={18}/><span>{uploadResult}</span><button type="button" onClick={() => setUploadResult('')} aria-label="Uploadmelding sluiten"><X size={16}/></button></div>}
      {uploadErrors.length > 0 && <div className={styles.errors} role="alert"><strong>{uploadErrors.length === 1 ? 'Dit bestand is niet toegevoegd' : 'Deze bestanden zijn niet toegevoegd'}</strong><ul>{uploadErrors.map((error, index) => <li key={`${index}-${error}`}>{error}</li>)}</ul><button type="button" onClick={() => setUploadErrors([])}>Melding sluiten</button></div>}
      <div className={styles.resultRow}><p>{choices.length} {tab === 'media' ? (choices.length === 1 ? 'bestand' : 'bestanden') : (choices.length === 1 ? 'ontwerp' : 'ontwerpen')}</p>{selectable.length > 0 && <button type="button" onClick={toggleVisible}>{allVisibleSelected ? 'Zichtbare selectie wissen' : 'Selecteer alles'}</button>}</div>
      {choices.length ? <div className={styles.grid}>
        {choices.map(choice => {
          const order = selection.findIndex(item => item.key === choice.key);
          const disabled = itemCount(choice) === 0 || (choice.source === 'media' && choice.item.kind === 'video');
          return <button type="button" key={choice.key} className={styles.card} aria-pressed={order >= 0} disabled={disabled} onClick={() => toggle(choice)} aria-label={`${choice.item.name}${choice.source === 'studio' ? `, ${itemCount(choice)} items` : ''}${disabled ? ', niet beschikbaar' : order >= 0 ? `, selectie ${order + 1}, deselecteren` : ', selecteren'}`}>
            <div className={styles.thumbnail} aria-hidden="true" data-orientation={choice.source === 'studio' ? choice.item.slides[0]?.orientation : choice.source === 'dynamic' ? choice.item.orientation : 'landscape'}>
              {choice.source === 'media' ? <AssetImage src={choice.item.image} alt="" loading="lazy"/>
                : choice.source === 'studio' ? choice.item.slides[0] ? <SlideCanvas slide={choice.item.slides[0]}/> : <Sparkles size={30}/>
                : <ExperiencePreview design={choice.item} compact/>}
              {!disabled && <span className={styles.check}>{order >= 0 ? order + 1 : <Plus size={17}/>}</span>}
              {choice.source === 'media' && choice.item.favorite && <span className={styles.favoriteMark}><Star size={13} fill="currentColor"/></span>}
              {choice.source === 'studio' && itemCount(choice) > 0 && <span className={styles.bundle}><Layers size={12}/>{itemCount(choice)} items</span>}
            </div>
            <span className={styles.cardCopy}><strong>{choice.item.name}</strong><small>{choice.source === 'media' ? choice.item.kind === 'video' ? 'Video niet beschikbaar in deze demo' : `${choice.item.folder || 'Media'} · 12 sec.` : choice.source === 'studio' ? itemCount(choice) ? 'Hele Studio-reeks' : 'Nog geen slides' : `${providerLabel(choice.item)} · ${choice.item.seconds} sec.`}</small></span>
          </button>;
        })}
      </div> : <div className={styles.empty}>
        {tab === 'media' ? <ImagePlus size={34}/> : <Sparkles size={34}/>}
        <h3>{filtered ? 'Geen resultaten gevonden' : tab === 'media' ? 'Jouw clubbeelden beginnen hier' : 'Nog geen ontwerpen'}</h3>
        <p>{filtered ? 'Probeer een andere zoekterm of maak de filters leeg. Je selectie blijft bewaard.' : tab === 'media' ? 'Kies meerdere foto’s op je telefoon en voeg ze in één keer toe.' : 'Maak in Studio een ontwerp. Daarna kun je het hier aan je playlist toevoegen.'}</p>
        {filtered ? <button type="button" className={styles.outlineButton} onClick={resetFilters}>Filters wissen</button> : tab === 'media' ? <button type="button" className={styles.uploadButton} disabled={!!progress} onClick={() => input.current?.click()}><CloudUpload size={18}/>Afbeeldingen kiezen</button> : !selection.length ? <button type="button" className={styles.uploadButton} onClick={onGoStudio}><Sparkles size={18}/>Naar Studio</button> : <p>Voeg eerst je selectie toe om deze te bewaren.</p>}
      </div>}
      <p className={styles.hint}>{tab === 'media' ? 'JPG, PNG, WebP of AVIF · maximaal 20 MB per foto. Eigen beelden blijven bewaard in deze browser.' : tab === 'studio' ? 'Een Studio-reeks voegt alle slides toe, met jouw tekst, opmaak en ingestelde duur.' : 'Je achtergrond, indeling en instellingen worden meegenomen als opgeslagen versie.'}</p>
    </div>
    </div>

    <footer className={styles.footer}>
      {selection.length > 0 && <div className={styles.selectionSummary}>
        <button type="button" className={styles.selectionToggle} aria-expanded={showSelection} aria-controls="playlist-picker-selection" onClick={() => setShowSelection(value => !value)}><Check size={16}/>{selection.length} geselecteerd{showSelection ? <ChevronDown size={16}/> : <ChevronUp size={16}/>}</button>
        <button type="button" className={styles.clear} onClick={() => {setSelection([]); setShowSelection(false);}}>Wissen</button>
      </div>}
      {showSelection && selection.length > 0 && <ol id="playlist-picker-selection" className={styles.selectionTray}>{selection.map((choice, index) => <li key={choice.key}><span>{index + 1}</span><strong>{choice.item.name}</strong>{itemCount(choice) > 1 && <small>{itemCount(choice)} items</small>}<button type="button" aria-label={`${choice.item.name} uit selectie verwijderen`} onClick={() => toggle(choice)}><X size={16}/></button></li>)}</ol>}
      <button type="button" className={styles.addButton} disabled={!totalSlides || !!progress} onClick={() => onAdd(selection.flatMap(toSlides))}><Plus size={20}/>{progress ? 'Afbeeldingen verwerken…' : totalSlides ? `${totalSlides} item${totalSlides === 1 ? '' : 's'} toevoegen` : 'Kies de inhoud voor je playlist'}</button>
      <span className={styles.srOnly} role="status" aria-live="polite">{selection.length} geselecteerd. {totalSlides} items worden toegevoegd in de volgorde van je selectie.</span>
    </footer>
  </div>;
}
