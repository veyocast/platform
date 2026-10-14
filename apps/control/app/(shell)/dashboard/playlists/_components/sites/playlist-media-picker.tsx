"use client";

import {useEffect, useRef, useState, type SetStateAction} from 'react';
import {Check, ChevronDown, ChevronUp, CloudUpload, ImagePlus, Layers, LoaderCircle, Plus, Search, Sparkles, Star, X} from 'lucide-react';
import type {Media, Slide} from './model';
import {AssetImage, ExperiencePreview, uploadBackground, type DynamicDesign} from './presentation-adapter';
import {SlideCanvas, type StudioProject} from './presentation-adapter';
import {PHOTOS, mediaPlacementDuration} from './model';
import {VideoUploadForm}from'../../../media/video-upload-form';
import type{PublisherLibraryPage}from'../../library';
import styles from './playlist-media-picker.module.css';

export interface PlaylistMediaPickerProps {
  media: Media[];
  onMediaChange: (action: SetStateAction<Media[]>) => void;
  projects: StudioProject[];
  designs: DynamicDesign[];
  onAdd: (slides: Slide[]) => void;
  onBack: () => void;
  onGoStudio: () => void;
  videoUploadConfig?:{anonKey:string;supabaseUrl:string};
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
const createId = () => crypto.randomUUID();
const itemCount = (choice: Choice) => choice.source === 'studio' ? choice.item.slides.length : 1;
const providerLabel = (design: DynamicDesign) => design.provider === 'led-scores' ? 'LED Scores' : design.provider === 'sportlink' ? 'Sportlink' : 'Kantine';

function toSlides(choice: Choice): Slide[] {
  if (choice.source === 'media') {
    const media = choice.item;
    return [{id: createId(), mediaId:media.sourceKind?media.fallbackAssetId:media.id,mediaChecksumSha256:media.checksumSha256, name: media.name, image: media.image, seconds: mediaPlacementDuration(media), kind:media.kind, sourceKind:media.sourceKind,sourceId:media.sourceId,fallbackAssetId:media.fallbackAssetId}];
  }
  if (choice.source === 'studio') {
    const ids=choice.item.slides.map(()=>createId());
    return choice.item.slides.map((slide,index) => ({
      id: ids[index]!, seriesClientId:ids[0]!,seriesClientItemIds:ids,seriesIndex:index,seriesRevision:choice.item.revision, name: slide.name, image: slide.photo || '', seconds: slide.duration,
      studioProjectId: choice.item.id, studioSlideId: slide.id,
      studioSlide: JSON.parse(JSON.stringify(slide)),kind:slide.exportKind,mediaId:slide.exportAssetId,
    }));
  }
  const design = choice.item;
  return [{
    id: createId(), name: design.name, image: design.background || PHOTOS.club,
    seconds: design.seconds || 12, designId: design.id,
    design: JSON.parse(JSON.stringify(design)),
  }];
}

export function PlaylistMediaPicker({media, onMediaChange, projects, designs, onAdd, onGoStudio,videoUploadConfig}: PlaylistMediaPickerProps) {
  const [tab, setTab] = useState<Tab>('media');
  const [query, setQuery] = useState('');
  const [folder, setFolder] = useState('all');
  const [favorites, setFavorites] = useState(false);
  const [collection,setCollection]=useState('all');
  const [offset,setOffset]=useState(0);
  const [library,setLibrary]=useState<PublisherLibraryPage|null>(null);
  const [loading,setLoading]=useState(false);
  const [libraryError,setLibraryError]=useState('');
  const [refresh,setRefresh]=useState(0);
  const [videoUpload,setVideoUpload]=useState(false);
  const [provider, setProvider] = useState('all');
  const [selection, setSelection] = useState<Choice[]>([]);
  const [engageFallback,setEngageFallback]=useState<Media|null>(null);
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

  useEffect(()=>{setOffset(0);},[tab,query,folder,collection,favorites]);
  const folderId=library?.folders.find(item=>item.name===folder)?.id;
  useEffect(()=>{
    const controller=new AbortController();const delay=setTimeout(()=>{setLoading(true);setLibraryError('');
      const params=new URLSearchParams({tab,offset:String(offset)});if(query.trim())params.set('query',query.trim());if(folderId)params.set('folderId',folderId);if(collection!=='all')params.set('collectionId',collection);if(favorites)params.set('favorites','true');
      const deadline=setTimeout(()=>{setLibraryError('De bibliotheek antwoordde niet op tijd. Je selectie blijft behouden; probeer opnieuw.');setLoading(false);controller.abort();},20000);
      void fetch(`/api/publisher/library?${params}`,{cache:'no-store',signal:controller.signal}).then(async response=>{const page=await response.json()as PublisherLibraryPage&{error?:string};if(!response.ok)throw new Error(page.error||'De bibliotheek kon niet worden geladen.');if(!controller.signal.aborted)setLibrary(page);}).catch(()=>{if(!controller.signal.aborted)setLibraryError('De bibliotheek kon niet worden geladen. Je selectie blijft behouden; probeer opnieuw.');}).finally(()=>{clearTimeout(deadline);if(!controller.signal.aborted)setLoading(false);});
    },250);return()=>{clearTimeout(delay);controller.abort();};
  },[tab,query,folderId,collection,favorites,offset,refresh]);
  const processingMedia=library?.unavailableMedia?.some(item=>item.status==='processing');
  useEffect(()=>{
    if(tab!=='media'||!processingMedia||loading)return;
    const timer=setTimeout(()=>setRefresh(value=>value+1),2000);
    return()=>clearTimeout(timer);
  },[tab,processingMedia,loading,refresh]);
  const activeMedia = [...new Map([...(library?.media??media),...media.filter(item=>item.sourceKind)].filter(item=>!item.archived).map(item=>[item.id,item])).values()];
  const needsEngageFallback=selection.some(choice=>choice.source==='media'&&choice.item.sourceKind==='engage'&&!choice.item.fallbackAssetId);
  const fallbackChoices=[...new Map([...activeMedia,...(engageFallback?[engageFallback]:[])].filter(item=>item.kind==='image'&&!item.sourceKind).map(item=>[item.id,item])).values()];
  const folders = Array.from(new Set([...activeMedia.map(item => item.folder),...(library?.folders.map(item=>item.name)??[])].filter(Boolean))).sort((a, b) => a.localeCompare(b, 'nl'));
  const normalizedQuery = query.trim().toLocaleLowerCase('nl');
  const matches = (value: string) => value.toLocaleLowerCase('nl').includes(normalizedQuery);
  const choices: Choice[] = tab === 'media'
    ? activeMedia.filter(item => (folder === 'all' || item.folder === folder) && (!favorites || item.favorite) && matches(`${item.name} ${(item.tags || []).join(' ')} ${(item.collections || []).join(' ')}`)).map(item => ({key: `media:${item.id}`, source: 'media' as const, item}))
    : tab === 'studio'
      ? (library?.projects??projects).filter(item => matches(`${item.name} ${item.slides.map(slide => `${slide.name} ${slide.title}`).join(' ')}`)).map(item => ({key: `studio:${item.id}`, source: 'studio' as const, item}))
      : (library?.designs??designs).filter(item => (provider === 'all' || item.provider === provider) && matches(`${item.name} ${item.title} ${item.subtitle} ${providerLabel(item)}`)).map(item => ({key: `dynamic:${item.id}`, source: 'dynamic' as const, item}));
  const selectable = choices.filter(choice => itemCount(choice) > 0);
  const selectedKeys = new Set(selection.map(choice => choice.key));
  const allVisibleSelected = selectable.length > 0 && selectable.every(choice => selectedKeys.has(choice.key));
  const totalSlides = selection.reduce((total, choice) => total + itemCount(choice), 0);
  const filtered = !!query || (tab === 'media' && (folder !== 'all' || favorites)) || (tab === 'dynamic' && provider !== 'all');

  function toggle(choice: Choice) {
    setSelection(previous => previous.some(item => item.key === choice.key) ? previous.filter(item => item.key !== choice.key) : [...previous, choice]);
  }
  function resetFilters() {setQuery(''); setFolder('all');setCollection('all');setOffset(0); setFavorites(false); setProvider('all');}
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
    setProgress({done: 0, total: pending.length, name: pending[0]!.name, added: 0});
    for (let index = 0; index < pending.length; index++) {
      if (!mounted.current) break;
      const file = pending[index]!;
      setProgress({done: index, total: pending.length, name: file.name, added});
      try {
        const uploaded = await uploadBackground(file);
        const image = uploaded.previewUrl;
        const item: Media = {
          id: uploaded.assetId, checksumSha256: uploaded.checksumSha256, name: file.name.replace(/\.[^.]+$/, '') || 'Nieuwe afbeelding',
          image, folder: 'Uploads', size: `${(file.size / 1024 / 1024).toLocaleString('nl-NL', {maximumFractionDigits: 1})} MB`,
          kind: 'image', tags: [], collections: [],
        };
        onMediaChange(previous => [item,...previous]);
        setRefresh(value=>value+1);
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
        {(!!library?.collections.length||collection!=='all')&&<label className={styles.folder}>Collectie<select aria-label="Filter op collectie"value={collection}onChange={event=>setCollection(event.target.value)}><option value="all">Alle collecties</option>{library?.collections.map(item=><option key={item.id}value={item.id}>{item.name}</option>)}</select></label>}
        {videoUploadConfig&&<button type="button"className={styles.favorite}aria-expanded={videoUpload}onClick={()=>setVideoUpload(value=>!value)}>Video uploaden</button>}
        <button type="button" className={styles.favorite} aria-pressed={favorites} onClick={() => setFavorites(value => !value)}><Star size={16} fill={favorites ? 'currentColor' : 'none'}/>Favorieten</button>
      </div>}
      {tab === 'dynamic' && <div className={styles.filters}>
        {([{value: 'all', label: 'Alle ontwerpen'}, {value: 'sportlink', label: 'Sportlink'}, {value: 'led-scores', label: 'LED Scores'}, {value: 'menu', label: 'Kantine'}]).map(item => <button type="button" className={styles.filterChip} key={item.value} aria-pressed={provider === item.value} onClick={() => setProvider(item.value)}>{item.label}</button>)}
      </div>}
    </div>

    <div className={styles.content} aria-busy={loading}>
      {libraryError&&<div className={styles.errors}role="alert">{libraryError}<button type="button"onClick={()=>setRefresh(value=>value+1)}>Opnieuw laden</button></div>}
      {tab==='media'&&!!library?.unavailableMedia?.length&&<section className={styles.processingStatus}aria-label="Uploads in verwerking"><strong>Deze uploads zijn nog niet beschikbaar</strong>{library.unavailableMedia.map(item=><p key={item.id}><strong>{item.name}</strong> · {item.status==='validation_failed'?'Verwerking mislukt':item.status==='processing'?'Wordt verwerkt':'Upload niet afgerond'}<br/>{item.message}</p>)}<a href="/dashboard/media">Bekijk de beeldbank</a></section>}
      {videoUpload&&videoUploadConfig&&<section aria-label="Video uploaden"><VideoUploadForm canUpload anonKey={videoUploadConfig.anonKey}supabaseUrl={videoUploadConfig.supabaseUrl}/><button type="button"className={styles.outlineButton}onClick={()=>{setVideoUpload(false);setRefresh(value=>value+1);}}>Terug naar gereedstaande media</button></section>}
      {!!progress && <div className={styles.uploadStatus} role="status"><LoaderCircle size={18} className={styles.spin}/><div><strong>Afbeelding {progress.done + 1} van {progress.total} verwerken…</strong><span>{progress.name}</span><progress aria-label="Voortgang upload" value={progress.done} max={progress.total}/></div></div>}
      {!!uploadResult && <div className={styles.success} role="status"><Check size={18}/><span>{uploadResult}</span><button type="button" onClick={() => setUploadResult('')} aria-label="Uploadmelding sluiten"><X size={16}/></button></div>}
      {uploadErrors.length > 0 && <div className={styles.errors} role="alert"><strong>{uploadErrors.length === 1 ? 'Dit bestand is niet toegevoegd' : 'Deze bestanden zijn niet toegevoegd'}</strong><ul>{uploadErrors.map((error, index) => <li key={`${index}-${error}`}>{error}</li>)}</ul><button type="button" onClick={() => setUploadErrors([])}>Melding sluiten</button></div>}
      <div className={styles.resultRow}><p>{choices.length} {tab === 'media' ? (choices.length === 1 ? 'bestand' : 'bestanden') : (choices.length === 1 ? 'ontwerp' : 'ontwerpen')}</p>{selectable.length > 0 && <button type="button" onClick={toggleVisible}>{allVisibleSelected ? 'Zichtbare selectie wissen' : 'Selecteer alles'}</button>}</div>
      {choices.length ? <div className={styles.grid}>
        {choices.map(choice => {
          const order = selection.findIndex(item => item.key === choice.key);
          const disabled = itemCount(choice) === 0;
          return <button type="button" key={choice.key} className={styles.card} aria-pressed={order >= 0} disabled={disabled} onClick={() => toggle(choice)} aria-label={`${choice.item.name}${choice.source === 'studio' ? `, ${itemCount(choice)} items` : ''}${disabled ? ', niet beschikbaar' : order >= 0 ? `, selectie ${order + 1}, deselecteren` : ', selecteren'}`}>
            <div className={styles.thumbnail} aria-hidden="true" data-orientation={choice.source === 'studio' ? choice.item.slides[0]?.orientation : choice.source === 'dynamic' ? choice.item.orientation : 'landscape'}>
              {choice.source === 'media' ? choice.item.kind==='video'?<video src={choice.item.image} muted playsInline preload="metadata"><track kind="captions"/></video>:<AssetImage src={choice.item.image} alt="" loading="lazy"/>
                : choice.source === 'studio' ? choice.item.slides[0] ? <SlideCanvas slide={choice.item.slides[0]}/> : <Sparkles size={30}/>
                : <ExperiencePreview design={choice.item} compact/>}
              {!disabled && <span className={styles.check}>{order >= 0 ? order + 1 : <Plus size={17}/>}</span>}
              {choice.source === 'media' && choice.item.favorite && <span className={styles.favoriteMark}><Star size={13} fill="currentColor"/></span>}
              {choice.source === 'studio' && itemCount(choice) > 0 && <span className={styles.bundle}><Layers size={12}/>{itemCount(choice)} items</span>}
            </div>
            <span className={styles.cardCopy}><strong>{choice.item.name}</strong><small>{choice.source === 'media' ? choice.item.kind === 'video' ? 'Geverifieerde video' : `${choice.item.folder || 'Media'} · 12 sec.` : choice.source === 'studio' ? itemCount(choice) ? 'Hele Studio-reeks' : 'Nog geen slides' : `${providerLabel(choice.item)} · ${choice.item.seconds} sec.`}</small></span>
          </button>;
        })}
      </div> : <div className={styles.empty}>
        {tab === 'media' ? <ImagePlus size={34}/> : <Sparkles size={34}/>}
        <h3>{filtered ? 'Geen resultaten gevonden' : tab === 'media' ? 'Jouw clubbeelden beginnen hier' : 'Nog geen ontwerpen'}</h3>
        <p>{filtered ? 'Probeer een andere zoekterm of maak de filters leeg. Je selectie blijft bewaard.' : tab === 'media' ? 'Kies meerdere foto’s op je telefoon en voeg ze in één keer toe.' : 'Maak in Studio een ontwerp. Daarna kun je het hier aan je playlist toevoegen.'}</p>
        {filtered ? <button type="button" className={styles.outlineButton} onClick={resetFilters}>Filters wissen</button> : tab === 'media' ? <button type="button" className={styles.uploadButton} disabled={!!progress} onClick={() => input.current?.click()}><CloudUpload size={18}/>Afbeeldingen kiezen</button> : !selection.length ? <button type="button" className={styles.uploadButton} onClick={onGoStudio}><Sparkles size={18}/>Naar Studio</button> : <p>Voeg eerst je selectie toe om deze te bewaren.</p>}
      </div>}
      {library&&(offset>0||library.hasMore)&&<nav aria-label="Bibliotheekpagina's"className={styles.resultRow}><button type="button"disabled={loading||offset===0}onClick={()=>setOffset(value=>Math.max(0,value-(tab==='studio'||tab==='dynamic'?8:48)))}>Vorige pagina</button><span>{Math.min(offset+1,library.total)}–{Math.min(offset+(tab==='studio'||tab==='dynamic'?8:48),library.total)} van {library.total}</span><button type="button"disabled={loading||!library.hasMore}onClick={()=>setOffset(value=>value+(tab==='studio'||tab==='dynamic'?8:48))}>Volgende pagina</button></nav>}
      <p className={styles.hint}>{tab === 'media' ? 'JPG, PNG, WebP of AVIF · maximaal 25 MB per foto. Uploads worden privé opgeslagen en gecontroleerd.' : tab === 'studio' ? 'Een Studio-reeks voegt alle slides toe, met jouw tekst, opmaak en ingestelde duur.' : 'Je achtergrond, indeling en instellingen worden meegenomen als opgeslagen versie.'}</p>
    </div>
    </div>

    <footer className={styles.footer}>
      {selection.length > 0 && <div className={styles.selectionSummary}>
        <button type="button" className={styles.selectionToggle} aria-expanded={showSelection} aria-controls="playlist-picker-selection" onClick={() => setShowSelection(value => !value)}><Check size={16}/>{selection.length} geselecteerd{showSelection ? <ChevronDown size={16}/> : <ChevronUp size={16}/>}</button>
        <button type="button" className={styles.clear} onClick={() => {setSelection([]); setShowSelection(false);}}>Wissen</button>
      </div>}
      {showSelection && selection.length > 0 && <ol id="playlist-picker-selection" className={styles.selectionTray}>{selection.map((choice, index) => <li key={choice.key}><span>{index + 1}</span><strong>{choice.item.name}</strong>{itemCount(choice) > 1 && <small>{itemCount(choice)} items</small>}<button type="button" aria-label={`${choice.item.name} uit selectie verwijderen`} onClick={() => toggle(choice)}><X size={16}/></button></li>)}</ol>}
      {needsEngageFallback&&<label>Back-upbeeld voor Engage<select value={engageFallback?.id??''}onChange={event=>setEngageFallback(fallbackChoices.find(item=>item.id===event.target.value)??null)}><option value="">Kies een gereedstaand beeld</option>{fallbackChoices.map(item=><option key={item.id}value={item.id}>{item.name}</option>)}</select></label>}
      <button type="button" className={styles.addButton} disabled={!totalSlides || !!progress||(needsEngageFallback&&!engageFallback)} onClick={() => onAdd(selection.flatMap(choice=>toSlides(choice.source==='media'&&choice.item.sourceKind==='engage'&&!choice.item.fallbackAssetId&&engageFallback?{...choice,item:{...choice.item,fallbackAssetId:engageFallback.id,image:engageFallback.image,checksumSha256:engageFallback.checksumSha256}}:choice)))}><Plus size={20}/>{progress ? 'Afbeeldingen verwerken…' : totalSlides ? `${totalSlides} item${totalSlides === 1 ? '' : 's'} toevoegen` : 'Kies de inhoud voor je playlist'}</button>
      <span className={styles.srOnly} role="status" aria-live="polite">{selection.length} geselecteerd. {totalSlides} items worden toegevoegd in de volgorde van je selectie.</span>
    </footer>
  </div>;
}
