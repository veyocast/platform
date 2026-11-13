'use client';

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import {
  ArrowUpRight, BookOpen, ChevronLeft, CircleAlert, CircleCheck, Clock3, ExternalLink,
  Eye, FileText, Image as ImageIcon, Link2, Pencil, Plug, Plus, Save, Search, Send, Upload, X,
} from 'lucide-react';

import { BlogContent } from '../../../../(marketing)/blog/_blog/blog-content';
import { BlogEditor } from './blog-editor';
import type { ArticleDraft } from '../../../../../lib/blog/draft';
import type { BlogEntry } from '../../../../../lib/blog/store';
import s from './blog-admin.module.css';


type Props = { initialEntries?: BlogEntry[]; blogBase?: string; canonicalOrigin?: string };
type Message = { text: string; error?: boolean };
type View = 'list' | 'edit' | 'socialhero';
type Connection = 'idle' | 'active' | 'paused';
type Scheduled = { id: string; revision: number; at: string };

const noHero: ArticleDraft['hero'] = { src: '', alt: '', x: .5, y: .5 };
const draftSeed: ArticleDraft = {
  type: 'blog', title: '', slug: '', excerpt: '', locale: 'nl-NL', author: 'VeyoCast', category: '', tags: [],
  content: { type: 'doc', content: [{ type: 'paragraph' }] }, seoTitle: '', seoDescription: '',
  hero: noHero, socialImage: '',
};
const stableDate = new Intl.DateTimeFormat('nl-NL', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Amsterdam' });
const statusText = { draft: 'Concept', live: 'Live', revision: 'Revisie open' };

function getStatus(entry: BlogEntry) {
  if (!entry.live) return 'draft';
  return entry.revision === entry.publishedRevision ? 'live' : 'revision';
}

function toSlug(value: string) {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 100).replace(/-$/, '');
}

function hasArticleContent(node: ArticleDraft['content']): boolean {
  return Boolean(node.text?.trim() || ['image', 'youtube'].includes(node.type ?? '') || node.content?.some(hasArticleContent));
}

async function uploadImage(file: File): Promise<string> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5_000_000) {
    throw new Error('Kies een JPG-, PNG- of WebP-bestand van maximaal 5 MB.');
  }
  const body = new FormData();
  body.append('file', file);
  const response = await fetch('/api/blog-demo/media', { method: 'POST', body });
  const result = await response.json().catch(() => null) as { src?: string; error?: string | { message?: string }; message?: string } | null;
  if (!response.ok || !result?.src?.startsWith('/api/blog-demo/media/')) {
    const error = typeof result?.error === 'string' ? result.error : result?.error?.message;
    throw new Error(result?.message ?? error ?? 'De afbeelding kon niet worden opgeslagen. Probeer het opnieuw.');
  }
  return result.src;
}

async function requestBlog(init?: RequestInit) {
  const response = await fetch('/api/blog-demo', { cache: 'no-store', ...init });
  const result = await response.json().catch(() => null) as {
    entries?: BlogEntry[]; entry?: BlogEntry; error?: string | { message?: string }; message?: string;
  } | null;
  if (!response.ok || !result) {
    const error = typeof result?.error === 'string' ? result.error : result?.error?.message;
    throw new Error(result?.message ?? error ?? 'De bloggegevens konden niet worden geladen. Probeer het opnieuw.');
  }
  return result;
}

function buildExample(): ArticleDraft {
  return {
    ...draftSeed,
    title: 'Een weekplanning maken voor je schermen',
    slug: 'weekplanning-voor-je-schermen',
    excerpt: 'Gebruik verschillende afspeellijsten voor vaste dagdelen en maak een aparte planning voor bijzondere momenten.',
    seoTitle: 'Weekplanning voor je narrowcasting | VeyoCast',
    seoDescription: 'Maak een weekplanning voor je schermen met afspeellijsten per dagdeel, een controle op locatie en ruimte voor bijzondere momenten.',
    category: 'handleidingen', tags: ['planning', 'afspeellijsten'],
    hero: { src: '/fieldflow/photos/FF-PHOTO-04-matchday-live-4x5.webp', alt: 'Een ClubTV-scherm aan de wand van een kantine.', x: .53, y: .44 },
    socialImage: '/blog-assets/clubtv-wedstrijddag-og.jpg',
    content: { type: 'doc', content: [
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Begin met je vaste momenten' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Zet voor elk dagdeel op papier wat bezoekers moeten zien. In de ochtend kan dat een welkomstbericht zijn, terwijl je rond lunchtijd praktische informatie en het dagmenu wilt tonen.' }] },
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Controleer het wisselmoment op locatie' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Bekijk de overgang op het scherm zelf. Houd rekening met de leesafstand, de hoeveelheid tekst en het moment waarop bezoekers langslopen. Plan een aparte uitzondering voor een evenement of sluitingsdag.' }] },
    ] },
  };
}

export function BlogAdmin({ initialEntries = [], blogBase = '/blog', canonicalOrigin }: Props) {
  const [view, setView] = useState<View>('list');
  const [entries, setEntries] = useState(initialEntries);
  const [entry, setEntry] = useState<BlogEntry | null>(null);
  const [draft, setDraft] = useState<ArticleDraft>(draftSeed);
  const [tags, setTags] = useState('');
  const [manualSlug, setManualSlug] = useState(false);
  const [allowSlugChange, setAllowSlugChange] = useState(false);
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [message, setMessage] = useState<Message | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [connection, setConnection] = useState<Connection>('idle');
  const [scheduled, setScheduled] = useState<Scheduled | null>(null);
  const [scheduleInput, setScheduleInput] = useState('');
  const [scheduleEntryId, setScheduleEntryId] = useState('');
  const [origin, setOrigin] = useState(canonicalOrigin ?? '');
  const [sessionReady, setSessionReady] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    let cancelled = false;
    if (!canonicalOrigin) setOrigin(window.location.origin);
    try {
      const saved = JSON.parse(sessionStorage.getItem('veyocast-blog-socialhero-demo') ?? '{}') as { connection?: Connection; scheduled?: Scheduled };
      if (saved.connection === 'idle' || saved.connection === 'active' || saved.connection === 'paused') setConnection(saved.connection);
      if (saved.scheduled?.id && Number.isFinite(Date.parse(saved.scheduled.at))) setScheduled(saved.scheduled);
    } catch { /* The test tab can run without browser storage. */ }
    setSessionReady(true);
    requestBlog().then((result) => {
      if (!cancelled && result.entries) setEntries(result.entries);
    }).catch((error: Error) => {
      if (!cancelled) setMessage({ text: error.message, error: true });
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [canonicalOrigin]);

  useEffect(() => {
    if (!sessionReady) return;
    try { sessionStorage.setItem('veyocast-blog-socialhero-demo', JSON.stringify({ connection, scheduled })); } catch { /* The test tab can run without browser storage. */ }
  }, [connection, scheduled, sessionReady]);

  const base = blogBase.replace(/\/$/, '');
  const slug = toSlug(draft.slug || draft.title);
  const url = `${origin}${base}/${slug || 'je-artikel'}`;
  const activeStatus = entry ? getStatus(entry) : 'draft';
  const effectiveSeoTitle = draft.seoTitle.trim() || draft.title.trim() || 'Titel van je artikel';
  const effectiveSeoDescription = draft.seoDescription.trim() || draft.excerpt.trim() || 'De samenvatting van je artikel verschijnt hier.';
  const visibleEntries = entries.filter((record) => {
    const words = `${record.draft.title} ${record.draft.slug} ${record.draft.category} ${record.draft.tags.join(' ')}`;
    return (filter === 'all' || getStatus(record) === filter) && words.toLowerCase().includes(query.toLowerCase().trim());
  });
  const scheduleCandidates = entries.filter((record) => record.source === 'socialhero' && getStatus(record) !== 'live');

  function openEntry(record: BlogEntry | null) {
    setEntry(record);
    setDraft(record?.draft ?? draftSeed);
    setTags(record?.draft.tags.join(', ') ?? '');
    setManualSlug(Boolean(record));
    setAllowSlugChange(false);
    setMessage(null);
    setView('edit');
  }

  function goTo(target: View) {
    setMessage(null);
    setView(target);
  }

  function changeTitle(title: string) {
    setDraft((current) => ({ ...current, title, slug: manualSlug ? current.slug : toSlug(title) }));
  }

  async function mutate(action: 'save' | 'publish', value: ArticleDraft, current: BlogEntry | null, source?: BlogEntry['source']) {
    const result = await requestBlog({
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, id: current?.id, expectedRevision: current?.revision, source, draft: value }),
    });
    if (!result.entry || !result.entries) throw new Error('De website gaf geen bevestiging terug. Open het artikel opnieuw om de status te controleren.');
    setEntries(result.entries);
    return result.entry;
  }

  async function persist(action: 'save' | 'publish') {
    const value = {
      ...draft,
      title: draft.title.trim(), slug,
      tags: [...new Set(tags.split(',').map((tag) => tag.trim().slice(0, 50)).filter(Boolean))].slice(0, 16),
    };
    if (!value.title || !slug) {
      setMessage({ text: 'Vul een titel en een geldige slug in.', error: true });
      return;
    }
    if (action === 'publish' && (!value.excerpt.trim() || !hasArticleContent(value.content))) {
      setMessage({ text: 'Voeg een samenvatting en inhoud toe voordat je publiceert.', error: true });
      return;
    }
    if (action === 'publish' && (!value.author.trim() || !value.hero.src || !value.hero.alt.trim())) {
      setMessage({ text: 'Vul de auteur in en voeg een hero-afbeelding met alt-tekst toe.', error: true });
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const record = await mutate(action, value, entry, entry?.source ?? 'manual');
      setEntry(record);
      setDraft(record.draft);
      setTags(record.draft.tags.join(', '));
      setManualSlug(true);
      setAllowSlugChange(false);
      setMessage({ text: action === 'publish' ? `Gepubliceerd op ${base}/${record.live?.slug ?? slug}.` : 'Concept opgeslagen.' });
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : 'Opslaan is mislukt.', error: true });
    } finally {
      setBusy(false);
    }
  }

  async function onMedia(event: ChangeEvent<HTMLInputElement>, kind: 'hero' | 'share') {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;
    setUploading(true);
    try {
      const src = await uploadImage(file);
      setDraft((current) => kind === 'hero'
        ? { ...current, hero: { src, alt: '', x: .5, y: .5 } }
        : { ...current, socialImage: src });
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : 'De upload is mislukt.', error: true });
    } finally {
      setUploading(false);
    }
  }

  async function importExample() {
    setMessage(null);
    setBusy(true);
    try {
      const record = entries.find((item) => item.source === 'socialhero' && item.draft.slug === buildExample().slug)
        ?? await mutate('save', buildExample(), null, 'socialhero');
      openEntry(record);
      setMessage({ text: 'SocialHero-voorbeeldconcept staat klaar voor redactie.' });
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : 'Importeren is mislukt.', error: true });
    } finally {
      setBusy(false);
    }
  }

  function scheduleExample(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const record = scheduleCandidates.find((item) => item.id === scheduleEntryId);
    const date = new Date(scheduleInput);
    if (!record || Number.isNaN(date.getTime())) {
      setMessage({ text: 'Kies een concept en een geldig tijdstip.', error: true });
      return;
    }
    setScheduled({ id: record.id, revision: record.revision, at: date.toISOString() });
    setMessage({ text: 'Testpublicatie ingepland. Voer de test uit zodra je de publicatiestap wilt simuleren.' });
  }

  async function runExample() {
    if (!scheduled || connection !== 'active') return;
    const record = scheduleCandidates.find((item) => item.id === scheduled.id && item.revision === scheduled.revision);
    if (!record) {
      setMessage({ text: 'De geplande revisie is gewijzigd. Kies opnieuw welk concept je wilt publiceren.', error: true });
      return;
    }
    if (!record.draft.hero.src || !record.draft.hero.alt.trim()) {
      setMessage({ text: 'Voeg een hero-afbeelding met alt-tekst toe en plan de nieuwe revisie in.', error: true });
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const published = await mutate('publish', record.draft, record, 'socialhero');
      setScheduled(null);
      setMessage({ text: `Testpublicatie live op ${base}/${published.live?.slug ?? published.draft.slug}.` });
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : 'Publiceren is mislukt.', error: true });
    } finally {
      setBusy(false);
    }
  }

  function updateHero(update: Partial<NonNullable<ArticleDraft['hero']>>) {
    setDraft((current) => ({ ...current, hero: { ...current.hero, ...update } }));
  }

  return (
    <div className={s.page}>
      {view === 'edit' && <button className={s.crumb} type="button" onClick={() => goTo('list')}><ChevronLeft size={16} aria-hidden="true" /> Blogbeheer</button>}
      <header className={s.heading}>
        <div>
          <h1>{view === 'edit' ? entry?.draft.title || 'Nieuw artikel' : 'Blogbeheer'}</h1>
          <p>{view === 'edit' ? 'Bewerk je artikel en bekijk hoe het online verschijnt.' : 'Schrijf, beheer en publiceer artikelen op de VeyoCast-website.'}</p>
        </div>
        <div className={s.titleActions}>
          {view === 'edit' ? <>
            <button className={s.button} type="button" onClick={() => dialog.current?.showModal()}><Eye size={16} aria-hidden="true" /> Voorbeeld</button>
            <button className={s.button} type="button" disabled={busy || uploading} onClick={() => void persist('save')}><Save size={16} aria-hidden="true" /> Concept opslaan</button>
            <button className={`${s.button} ${s.primary}`} type="button" disabled={busy || uploading} onClick={() => void persist('publish')}><Send size={16} aria-hidden="true" /> Publiceren</button>
          </> : <>
            <a className={s.button} href={base} target="_blank" rel="noreferrer"><ArrowUpRight size={16} aria-hidden="true" /> Bekijk blog</a>
            <button className={`${s.button} ${s.primary}`} type="button" onClick={() => openEntry(null)}><Plus size={16} aria-hidden="true" /> Nieuw artikel</button>
          </>}
        </div>
      </header>
      {view !== 'edit' && <nav className={s.tabs} aria-label="Blogbeheer">
        <button className={s.tab} aria-pressed={view === 'list'} type="button" onClick={() => goTo('list')}><FileText size={16} aria-hidden="true" /> Artikelen</button>
        <button className={s.tab} aria-pressed={view === 'socialhero'} type="button" onClick={() => goTo('socialhero')}><Plug size={16} aria-hidden="true" /> SocialHero</button>
      </nav>}
      {message && <p className={s.banner} data-tone={message.error ? 'error' : 'info'} role={message.error ? 'alert' : 'status'}>
        {message.error ? <CircleAlert size={17} aria-hidden="true" /> : <CircleCheck size={17} aria-hidden="true" />}{message.text}
      </p>}
      {view === 'list' && <section className={s.sheet} aria-labelledby="blog-articles-heading">
        <div className={s.sectionHeading}><div><h2 id="blog-articles-heading">Artikelen</h2><p>{entries.length} {entries.length === 1 ? 'artikel' : 'artikelen'}</p></div></div>
        <div className={s.filterBar}>
          <label className={s.filterSearch}><Search size={16} aria-hidden="true" /><input className={s.input} type="search" aria-label="Zoek artikelen" placeholder="Zoek op titel of categorie" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
          <select className={s.input} aria-label="Filter op status" value={filter} onChange={(event) => setFilter(event.target.value)}><option value="all">Alle statussen</option><option value="draft">Concept</option><option value="live">Live</option><option value="revision">Revisie open</option></select>
        </div>
        {visibleEntries.length ? <div className={s.tableWrap}><table className={s.table}>
          <thead><tr><th scope="col">Titel</th><th scope="col">Status</th><th scope="col">Bron</th><th scope="col">Bewerkt</th><th scope="col">Acties</th></tr></thead>
          <tbody>{visibleEntries.map((record) => {
            const status = getStatus(record);
            return <tr key={record.id}>
              <td><div className={s.record}>
                {record.draft.hero.src ? <img className={s.recordThumb} src={record.draft.hero.src} alt="" /> : <span className={`${s.recordThumb} ${s.recordIcon}`}><FileText size={17} aria-hidden="true" /></span>}
                <span><strong>{record.draft.title}</strong><small>{base}/{record.draft.slug}</small></span>
              </div></td>
              <td><span className={s.pill} data-tone={status}>{statusText[status]}</span></td>
              <td>{record.source === 'socialhero' ? 'SocialHero' : 'Redactie'}</td>
              <td>{record.updatedAt ? stableDate.format(new Date(record.updatedAt)) : '–'}</td>
              <td><div className={s.rowActions}>
                {record.live && <a className={`${s.button} ${s.small} ${s.ghost}`} href={`${base}/${record.live.slug}`} target="_blank" rel="noreferrer" aria-label={`Bekijk ${record.live.title}`}><ExternalLink size={15} aria-hidden="true" /></a>}
                <button className={`${s.button} ${s.small}`} type="button" onClick={() => openEntry(record)}><Pencil size={14} aria-hidden="true" /> Bewerken</button>
              </div></td>
            </tr>;
          })}</tbody>
        </table></div> : <p className={s.empty} role="status">{loading ? 'Artikelen laden…' : entries.length ? 'Geen artikelen gevonden met deze filters.' : 'Er zijn nog geen artikelen. Begin met een nieuw artikel.'}</p>}
      </section>}
      {view === 'edit' && <div className={s.grid}>
        <div className={s.stack}>
          <section className={s.card} aria-labelledby="article-heading">
            <h2 id="article-heading">Artikel</h2>
            <div className={s.fields}>
              <label className={s.field}>Titel<input autoComplete="off" className={s.titleInput} maxLength={160} value={draft.title} placeholder="Geef je artikel een titel" onChange={(event) => changeTitle(event.target.value)} /></label>
              <div className={s.field}>
                <div className={s.fieldTop}><label htmlFor="blog-slug">Slug</label>{entry?.live && !allowSlugChange && <button className={`${s.button} ${s.small} ${s.ghost}`} type="button" onClick={() => setAllowSlugChange(true)}><Pencil size={13} aria-hidden="true" /> URL wijzigen</button>}</div>
                <input id="blog-slug" aria-describedby="blog-slug-url" value={draft.slug} disabled={Boolean(entry?.live) && !allowSlugChange} maxLength={100} onChange={(event) => {
                  setManualSlug(true);
                  setDraft((current) => ({ ...current, slug: event.target.value }));
                }} onBlur={() => setDraft((current) => ({ ...current, slug: toSlug(current.slug) }))} />
                <p id="blog-slug-url" className={s.url}>{url}</p>
                {entry?.live && allowSlugChange && <p className={s.help}>De huidige URL wijzigt zodra je deze revisie publiceert.</p>}
              </div>
              <label className={s.field}>Samenvatting<textarea value={draft.excerpt} maxLength={320} placeholder="Korte introductie voor het overzicht en het artikel" onChange={(event) => setDraft({ ...draft, excerpt: event.target.value })} /></label>
            </div>
          </section>
          <section className={s.card} aria-labelledby="blog-body-heading">
            <h2 id="blog-body-heading">Inhoud</h2>
            <BlogEditor key={entry?.id ?? 'new'} content={draft.content} onChange={(content) => setDraft((current) => ({ ...current, content }))} onUploadImage={uploadImage} />
          </section>
          <section className={s.card} aria-labelledby="blog-media-heading">
            <h2 id="blog-media-heading">Afbeeldingen</h2>
            <p>Gebruik een portretbeeld voor het artikel en eventueel een breed beeld voor sociale kanalen.</p>
            <div className={s.mediaGrid}>
              <section aria-labelledby="hero-image-heading">
                <h3 id="hero-image-heading">Hero-afbeelding</h3>
                <div className={s.assetFrame}>{draft.hero.src ? <img src={draft.hero.src} alt={draft.hero.alt} style={{ objectPosition: `${draft.hero.x * 100}% ${draft.hero.y * 100}%` }} /> : <ImageIcon size={25} aria-hidden="true" />}</div>
                <div className={s.assetActions}>
                  <label className={`${s.button} ${s.small} ${s.fileLabel}`}><Upload size={14} aria-hidden="true" /> {draft.hero.src ? 'Vervangen' : 'Uploaden'}<input type="file" className={s.fileInput} aria-label="Hero-afbeelding uploaden" accept="image/png,image/jpeg,image/webp" disabled={uploading} onChange={(event) => void onMedia(event, 'hero')} /></label>
                  {draft.hero.src && <button className={`${s.button} ${s.small} ${s.ghost}`} type="button" onClick={() => setDraft({ ...draft, hero: noHero })}>Verwijderen</button>}
                </div>
                {draft.hero.src && <>
                  <label className={s.field}>Alt-tekst<input value={draft.hero.alt} maxLength={250} onChange={(event) => updateHero({ alt: event.target.value })} /></label>
                  <label className={s.field}>Focus horizontaal <input type="range" min="0" max="100" value={Math.round(draft.hero.x * 100)} onChange={(event) => updateHero({ x: Number(event.target.value) / 100 })} /></label>
                  <label className={s.field}>Focus verticaal <input type="range" min="0" max="100" value={Math.round(draft.hero.y * 100)} onChange={(event) => updateHero({ y: Number(event.target.value) / 100 })} /></label>
                </>}
              </section>
              <section aria-labelledby="share-image-heading">
                <h3 id="share-image-heading">Deelafbeelding <span className={s.assetMeta}>optioneel</span></h3>
                <div className={`${s.assetFrame} ${s.landscape}`}>{draft.socialImage ? <img src={draft.socialImage} alt="" /> : <ImageIcon size={25} aria-hidden="true" />}</div>
                <div className={s.assetActions}>
                  <label className={`${s.button} ${s.small} ${s.fileLabel}`}><Upload size={14} aria-hidden="true" /> {draft.socialImage ? 'Vervangen' : 'Uploaden'}<input type="file" className={s.fileInput} aria-label="Deelafbeelding uploaden" accept="image/png,image/jpeg,image/webp" disabled={uploading} onChange={(event) => void onMedia(event, 'share')} /></label>
                  {draft.socialImage && <button className={`${s.button} ${s.small} ${s.ghost}`} type="button" onClick={() => setDraft({ ...draft, socialImage: '' })}>Verwijderen</button>}
                </div>
                <p className={s.help}>Aanbevolen verhouding 1200 × 630. Zonder deelafbeelding gebruikt het artikel de hero-afbeelding.</p>
              </section>
            </div>
          </section>
        </div>
        <div className={s.stack}>
          <section className={s.card} aria-labelledby="publication-heading">
            <h2 id="publication-heading">Publicatie</h2>
            <div className={s.statusLine}><span className={s.pill} data-tone={activeStatus}>{statusText[activeStatus]}</span>{entry && <p>Revisie {entry.revision}{entry.publishedRevision && entry.publishedRevision !== entry.revision ? ` · live ${entry.publishedRevision}` : ''}</p>}</div>
            {entry?.live && <><hr className={s.sep} /><a className={`${s.button} ${s.small}`} href={`${base}/${entry.live.slug}`} target="_blank" rel="noreferrer"><ExternalLink size={14} aria-hidden="true" /> Open live artikel</a></>}
          </section>
          <section className={s.card} aria-labelledby="details-heading">
            <h2 id="details-heading">Details</h2>
            <div className={s.fields}>
              <div className={s.fieldGroup}>
                <label className={s.field}>Type<select value={draft.type} onChange={(event) => setDraft({ ...draft, type: event.target.value as ArticleDraft['type'] })}><option value="blog">Blog</option><option value="article">Artikel</option></select></label>
                <label className={s.field}>Taal<select value={draft.locale} onChange={(event) => setDraft({ ...draft, locale: event.target.value })}><option value="nl-NL">Nederlands</option><option value="en-GB">Engels</option></select></label>
              </div>
              <label className={s.field}>Auteur<input value={draft.author} maxLength={100} onChange={(event) => setDraft({ ...draft, author: event.target.value })} /></label>
              <label className={s.field}>Categorie<input value={draft.category} maxLength={80} onChange={(event) => setDraft({ ...draft, category: event.target.value })} /></label>
              <label className={s.field}>Tags<input value={tags} maxLength={500} placeholder="Scheid tags met komma’s" onChange={(event) => setTags(event.target.value)} /></label>
            </div>
          </section>
          <section className={s.card} aria-labelledby="seo-heading">
            <h2 id="seo-heading">Zoekmachines</h2>
            <div className={s.fields}>
              <label className={s.field}><span className={s.fieldTop}>SEO-titel <small>{draft.seoTitle.length} tekens · richtlijn 60</small></span><input value={draft.seoTitle} maxLength={120} placeholder="Gebruikt anders de artikeltitel" onChange={(event) => setDraft({ ...draft, seoTitle: event.target.value })} /></label>
              <label className={s.field}><span className={s.fieldTop}>Metaomschrijving <small>{draft.seoDescription.length} tekens · richtlijn 155</small></span><textarea value={draft.seoDescription} maxLength={320} placeholder="Gebruikt anders de samenvatting" onChange={(event) => setDraft({ ...draft, seoDescription: event.target.value })} /></label>
              <div className={s.searchCard} aria-label="Voorbeeld zoekresultaat"><p className={s.url}>{url}</p><p className={s.searchTitle}>{effectiveSeoTitle}</p><p className={s.searchText}>{effectiveSeoDescription}</p></div>
            </div>
          </section>
          <section className={s.card} aria-labelledby="social-heading">
            <h2 id="social-heading">Sociaal voorbeeld</h2>
            <div className={s.socialCard}>
              {(draft.socialImage || draft.hero.src) && <div className={`${s.assetFrame} ${s.landscape}`}><img src={draft.socialImage || draft.hero.src} alt="" style={draft.socialImage ? undefined : { objectPosition: `${draft.hero.x * 100}% ${draft.hero.y * 100}%` }} /></div>}
              <div className={s.socialText}><small>{origin.replace(/^https?:\/\//, '') || 'VeyoCast'}</small><p><strong>{effectiveSeoTitle}</strong>{effectiveSeoDescription}</p></div>
            </div>
          </section>
        </div>
      </div>}
      {view === 'socialhero' && <div className={`${s.stack} ${s.connection}`}>
        <section className={s.card} aria-labelledby="socialhero-connection-heading">
          <h2 id="socialhero-connection-heading">SocialHero-verbinding</h2>
          <p>Doorloop de publicatiestappen met de testadapter van dit prototype.</p>
          <div className={s.statusLine}><span className={s.pill} data-tone={connection === 'active' ? 'live' : connection === 'paused' ? 'planned' : 'draft'}>{connection === 'active' ? 'Testverbinding actief' : connection === 'paused' ? 'Gepauzeerd' : 'Verbinding niet getest'}</span><p>{origin}{base}</p></div>
          <ol className={s.steps}>
            <li><Link2 size={18} aria-hidden="true" /><span><strong>Verbinding testen</strong><small>Leest de bloggegevens van de testwebsite.</small></span></li>
            <li><BookOpen size={18} aria-hidden="true" /><span><strong>Voorbeeldconcept ophalen</strong><small>Maakt een concept dat je kunt bewerken voordat het online komt.</small></span></li>
            <li><Clock3 size={18} aria-hidden="true" /><span><strong>Publicatiestap testen</strong><small>Leg de revisie en het tijdstip vast en simuleer daarna de geplande uitvoering.</small></span></li>
          </ol>
          <hr className={s.sep} />
          <div className={s.assetActions}>
            <button className={s.button} type="button" disabled={busy} onClick={async () => {
              setBusy(true);
              setMessage(null);
              try {
                await requestBlog();
                setConnection('active');
                setMessage({ text: 'Testwebsite en bloggegevens zijn bereikbaar. De controle heeft alleen gelezen.' });
              } catch (error) {
                setMessage({ text: error instanceof Error ? error.message : 'De testwebsite is onbereikbaar.', error: true });
              } finally { setBusy(false); }
            }}><Plug size={16} aria-hidden="true" /> Verbinding testen</button>
            <button className={`${s.button} ${s.primary}`} type="button" disabled={busy || connection !== 'active'} onClick={() => void importExample()}><Plus size={16} aria-hidden="true" /> Voorbeeldconcept ophalen</button>
            {connection === 'active' && <button className={`${s.button} ${s.ghost}`} type="button" onClick={() => setConnection('paused')}>Pauzeren</button>}
          </div>
        </section>
        <section className={s.card} aria-labelledby="socialhero-schedule-heading">
          <h2 id="socialhero-schedule-heading">Testplanning</h2>
          {scheduleCandidates.length ? <form className={s.fields} onSubmit={scheduleExample}>
            <div className={s.fieldGroup}>
              <label className={s.field}>SocialHero-concept<select required value={scheduleEntryId} onChange={(event) => setScheduleEntryId(event.target.value)}><option value="">Kies een concept</option>{scheduleCandidates.map((item) => <option key={item.id} value={item.id}>{item.draft.title}</option>)}</select></label>
              <label className={s.field}>Publicatiemoment<input required type="datetime-local" value={scheduleInput} onChange={(event) => setScheduleInput(event.target.value)} /></label>
            </div>
            <div className={s.assetActions}><button className={s.button} type="submit" disabled={busy || connection !== 'active'}><Clock3 size={16} aria-hidden="true" /> Test inplannen</button></div>
          </form> : <p>Haal eerst een voorbeeldconcept op.</p>}
          {scheduled && <><hr className={s.sep} /><div className={s.statusLine}><span className={s.pill} data-tone="planned">Ingepland</span><p>{stableDate.format(new Date(scheduled.at))} (Amsterdam) · revisie {scheduled.revision}</p><button className={`${s.button} ${s.small}`} type="button" disabled={busy || connection !== 'active'} onClick={() => void runExample()}><Send size={14} aria-hidden="true" /> Testpublicatie uitvoeren</button></div></>}
        </section>
      </div>}
      <dialog className={s.dialog} ref={dialog} aria-labelledby="blog-draft-preview-label">
        <div className={s.dialogHeading}><div><h2 id="blog-draft-preview-label">Conceptvoorbeeld</h2><p>Alleen zichtbaar binnen blogbeheer.</p></div><button className={`${s.button} ${s.small} ${s.ghost}`} type="button" aria-label="Sluit voorbeeld" onClick={() => dialog.current?.close()}><X size={20} aria-hidden="true" /></button></div>
        <div className={s.dialogContent}>
          {draft.hero.src && <img className={s.previewHero} src={draft.hero.src} alt={draft.hero.alt} style={{ objectPosition: `${draft.hero.x * 100}% ${draft.hero.y * 100}%` }} />}
          {draft.category && <span className={s.pill}>{draft.category}</span>}
          <h2 className={s.previewTitle}>{draft.title || 'Titel van je artikel'}</h2>
          {draft.excerpt && <p className={s.previewIntro}>{draft.excerpt}</p>}
          {draft.author && <p className={s.help}>{draft.author}</p>}
          <BlogContent className={s.previewBody} content={draft.content} />
        </div>
      </dialog>
    </div>
  );
}
