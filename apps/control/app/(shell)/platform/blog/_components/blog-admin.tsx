"use client";

/* Controlled, authenticated media routes require unoptimized browser requests. */
/* eslint-disable @next/next/no-img-element */

import React, {useEffect, useRef, useState, type ChangeEvent} from "react";
import Link from "next/link";
import {ArrowUpRight, ChevronLeft, CircleAlert, CircleCheck, ExternalLink, Eye, FileText, Image as ImageIcon, Pencil, Plus, Save, Search, Send, Upload} from "lucide-react";
import {Button, Dialog, DialogContent, DialogTitle, DialogDescription} from "@veyocast/ui";
import type {ArticleDraft, BlogEntry} from "@veyocast/blog";
import {BlogEditor} from "./blog-editor";
import {articleStatus as getStatus, emptyDraft, hasArticleContent, mediaUrl, toSlug} from "./blog-form";
import s from "./blog-admin.module.css";

type Props = {initialEntries?: BlogEntry[]; blogBase?: string; canonicalOrigin: string; canWrite: boolean; canPublish: boolean};
type Message = {text: string; error?: boolean; code?: string};
type Asset = {assetId: string; width: number; height: number; type: string; url: string};
const noHero: ArticleDraft['hero'] = {assetId: '', alt: '', focalPoint: {x:.5,y:.5}};
const stableDate = new Intl.DateTimeFormat('nl-NL', {dateStyle:'short', timeStyle:'short', timeZone:'Europe/Amsterdam'});
const statusText = {draft:'Concept', live:'Live', revision:'Revisie open'};
class BlogRequestError extends Error {constructor(message: string, readonly code: string) {super(message);}}
async function requestBlog(init?: RequestInit) {
  const response = await fetch('/api/platform/blog', {cache:'no-store', credentials:'same-origin', ...init});
  const result = await response.json().catch(() => null) as {entries?: BlogEntry[]; entry?: BlogEntry; error?: {code?: string; message?: string}} | null;
  if (!response.ok || !result) throw new BlogRequestError(result?.error?.message || 'De bloggegevens konden niet worden verwerkt. Je wijzigingen blijven hier staan. Probeer opnieuw.', result?.error?.code || 'REQUEST_FAILED');
  return result;
}
async function uploadImage(file: File): Promise<Asset> {
  if (!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 8*1024*1024) throw new Error('Kies een JPG-, PNG- of WebP-bestand van maximaal 8 MiB. Er is niets geüpload.');
  const body = new FormData(); body.append('file', file);
  const response = await fetch('/api/platform/blog/media', {method:'POST', credentials:'same-origin', headers:{'Idempotency-Key':crypto.randomUUID()}, body});
  const result = await response.json().catch(() => null) as (Asset & {error?: {message?: string}}) | null;
  if (!response.ok || !result?.assetId || !mediaUrl(result.assetId) || !Number.isSafeInteger(result.width) || !Number.isSafeInteger(result.height)) throw new Error(result?.error?.message || 'De upload is niet bevestigd. Je artikel is behouden. Probeer dezelfde afbeelding opnieuw.');
  return {...result, url:mediaUrl(result.assetId)};
}

export function BlogAdmin({initialEntries=[],blogBase='/blog',canonicalOrigin,canWrite,canPublish}: Props) {
  const [view,setView] = useState<'list'|'edit'>('list');
  const [entries,setEntries] = useState(initialEntries);
  const [entry,setEntry] = useState<BlogEntry|null>(null);
  const [draft,setDraft] = useState<ArticleDraft>(structuredClone(emptyDraft));
  const [tags,setTags] = useState('');
  const [manualSlug,setManualSlug] = useState(false);
  const [allowSlugChange,setAllowSlugChange] = useState(false);
  const [filter,setFilter] = useState('all');
  const [query,setQuery] = useState('');
  const [message,setMessage] = useState<Message|null>(null);
  const [loading,setLoading] = useState(false);
  const [busy,setBusy] = useState(false);
  const [uploading,setUploading] = useState(false);
  const [preview,setPreview] = useState(false);
  const operation = useRef<{fingerprint:string; key:string}|null>(null);
  const origin = canonicalOrigin.replace(/\/$/,'');
  const base = blogBase.replace(/\/$/,'');
  const slug = toSlug(draft.slug || draft.title);
  const url = `${origin}${base}/${slug || 'je-artikel'}`;
  const activeStatus = entry ? getStatus(entry) : 'draft';
  const effectiveSeoTitle = draft.seoTitle.trim() || draft.title.trim() || 'Titel van je artikel';
  const effectiveSeoDescription = draft.seoDescription.trim() || draft.excerpt.trim() || 'De samenvatting van je artikel verschijnt hier.';
  const visibleEntries = entries.filter(record => (filter==='all' || getStatus(record)===filter) && `${record.draft.title} ${record.draft.slug} ${record.draft.categoryId} ${record.draft.tags.join(' ')}`.toLowerCase().includes(query.toLowerCase().trim()));
  useEffect(() => {
    let cancelled=false; setLoading(true);
    requestBlog().then(result => {if(!cancelled && result.entries) setEntries(result.entries);})
      .catch((error: Error) => {if(!cancelled) setMessage({text:error.message,error:true});})
      .finally(() => {if(!cancelled) setLoading(false);});
    return () => {cancelled=true;};
  }, []);
  function openEntry(record: BlogEntry|null) {
    setEntry(record); setDraft(structuredClone(record?.draft || emptyDraft)); setTags(record?.draft.tags.join(', ') || '');
    setManualSlug(Boolean(record)); setAllowSlugChange(false); setMessage(null); operation.current=null; setView('edit');
  }
  function goTo(target:'list'|'edit') {
    setMessage(null);setView(target);
    if (target==='list') {
      setLoading(true);
      requestBlog().then(result=>{if(result.entries)setEntries(result.entries);})
        .catch((error:Error)=>setMessage({text:error.message,error:true})).finally(()=>setLoading(false));
    }
  }
  function changeTitle(title:string) {setDraft(current => ({...current,title,slug:manualSlug ? current.slug : toSlug(title)}));}
  function updateHero(update:Partial<ArticleDraft['hero']>) {setDraft(current => ({...current,hero:{...current.hero,...update}}));}
  async function persist(action:'save'|'publish') {
    if (busy || uploading || !canWrite || action==='publish' && !canPublish) return;
    const value:ArticleDraft={...draft,seoTitle:draft.seoTitle.trim() || draft.title.trim(),seoDescription:draft.seoDescription.trim() || draft.excerpt.trim(),slug:toSlug(draft.slug || draft.title),tags:tags.split(',').map(tag=>tag.trim()).filter(Boolean)};
    if (!value.title.trim() || !value.slug) {setMessage({text:'Vul een titel en geldige slug in. Je artikel is nog niet opgeslagen.',error:true});return;}
    if (action==='publish' && (!value.hero.assetId || !value.hero.alt.trim())) {setMessage({text:'Voeg een hero-afbeelding en beschrijvende alt-tekst toe. Je artikel blijft hier beschikbaar.',error:true});return;}
    if (action==='publish' && (!value.excerpt.trim() || !hasArticleContent(value.content))) {setMessage({text:'Voeg een samenvatting en inhoud toe. Het artikel is nog niet gepubliceerd.',error:true});return;}
    const payload={action,externalId:entry?.externalId,expectedRevision:entry?.draftRevision,draft:value};
    const fingerprint=JSON.stringify(payload);
    if(operation.current?.fingerprint!==fingerprint) operation.current={fingerprint,key:crypto.randomUUID()};
    setBusy(true);setMessage(null);
    try {
      const result=await requestBlog({method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...payload,idempotencyKey:operation.current.key})});
      if(!result.entry) throw new Error('De opslag is niet bevestigd. Probeer opnieuw; dezelfde opdracht blijft behouden.');
      const record=result.entry;setEntry(record);setDraft(structuredClone(record.draft));setTags(record.draft.tags.join(', '));
      setEntries(current=>[record,...current.filter(item=>item.id!==record.id)]);setManualSlug(true);setAllowSlugChange(false);operation.current=null;
      setMessage({text:action==='publish' ? `Gepubliceerd op ${origin}${base}/${record.draft.slug}.` : 'Concept opgeslagen. Een bestaande live revisie blijft gepubliceerd.'});
    } catch(error) {setMessage({text:error instanceof Error ? error.message : 'Opslaan is mislukt. Je wijzigingen zijn behouden. Probeer opnieuw.',error:true,code:error instanceof BlogRequestError ? error.code : undefined});}
    finally {setBusy(false);}
  }
  async function onMedia(event:ChangeEvent<HTMLInputElement>,kind:'hero'|'share') {
    const file=event.currentTarget.files?.[0];event.currentTarget.value='';if(!file || !canWrite)return;
    setUploading(true);setMessage(null);
    try {const asset=await uploadImage(file);setDraft(current=>kind==='hero' ? {...current,hero:{assetId:asset.assetId,alt:'',focalPoint:{x:.5,y:.5}}} : {...current,ogImageAssetId:asset.assetId});setMessage({text:`Afbeelding gecontroleerd en opgeslagen: ${asset.width} × ${asset.height} pixels.`});}
    catch(error) {setMessage({text:error instanceof Error ? error.message : 'De upload is mislukt. Probeer opnieuw.',error:true});}
    finally {setUploading(false);}
  }

  return (
    <div className={s.page}>
      {view === 'edit' && <Button variant="secondary" size="md" className={s.crumb} type="button" onClick={() => goTo('list')}><ChevronLeft size={16} aria-hidden="true" /> Blogbeheer</Button>}
      <header className={s.heading}>
        <div>
          <h1 tabIndex={-1}>{view === 'edit' ? entry?.draft.title || 'Nieuw artikel' : 'Blogbeheer'}</h1>
          <p>{view === 'edit' ? 'Bewerk je artikel en bekijk hoe het online verschijnt.' : 'Schrijf, beheer en publiceer artikelen op de VeyoCast-website.'}</p>
        </div>
        <div className={s.titleActions}>
          {view === 'edit' ? <>
            <Button id="blog-preview-trigger" variant="secondary" size="md" className={s.button} type="button" onClick={() => setPreview(true)}><Eye size={16} aria-hidden="true" /> Voorbeeld</Button>
            <Button variant="secondary" size="md" className={s.button} type="button" disabled={busy || uploading || !canWrite} onClick={() => void persist('save')}><Save size={16} aria-hidden="true" /> Concept opslaan</Button>
            <Button variant="primary" size="md" className={s.button} type="button" disabled={busy || uploading || !canWrite || !canPublish} onClick={() => void persist('publish')}><Send size={16} aria-hidden="true" /> Publiceren</Button>
          </> : <>
            <a className={s.button} href={`${origin}${base}`} target="_blank" rel="noreferrer"><ArrowUpRight size={16} aria-hidden="true" /> Bekijk blog</a>
            <Button variant="primary" size="md" className={s.button} type="button" disabled={!canWrite} onClick={() => openEntry(null)}><Plus size={16} aria-hidden="true" /> Nieuw artikel</Button>
          </>}
        </div>
      </header>
      {!canWrite && <p className={s.banner} role="status">Je kunt artikelen bekijken. Voor bewerken en publiceren zijn afzonderlijke redactierechten nodig.</p>}
      {message && <p className={s.banner} data-tone={message.error ? 'error' : 'info'} role={message.error ? 'alert' : 'status'}>
        {message.error ? <CircleAlert size={17} aria-hidden="true" /> : <CircleCheck size={17} aria-hidden="true" />}{message.text}
      </p>}
      {message?.code === 'MFA_REQUIRED' && <Link className={s.button} href="/auth/mfa?reden=aal2&terug=%2Fplatform%2Fblog" target="_blank" rel="noreferrer">Tweestapsverificatie openen</Link>}
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
                {mediaUrl(record.draft.hero.assetId) ? <img className={s.recordThumb} src={mediaUrl(record.draft.hero.assetId)} alt="" /> : <span className={`${s.recordThumb} ${s.recordIcon}`}><FileText size={17} aria-hidden="true" /></span>}
                <span><strong>{record.draft.title}</strong><small>{base}/{record.draft.slug}</small></span>
              </div></td>
              <td data-label="Status"><span className={s.pill} data-tone={status}>{statusText[status]}</span></td>
              <td data-label="Bron">{record.externalId.startsWith('sh_content_') ? 'SocialHero' : 'Redactie'}</td>
              <td data-label="Bewerkt">{record.updatedAt ? stableDate.format(new Date(record.updatedAt)) : '–'}</td>
              <td data-label="Acties"><div className={s.rowActions}>
                {record.publicUrl && <a className={`${s.button} ${s.small} ${s.ghost}`} href={record.publicUrl || undefined} target="_blank" rel="noreferrer" aria-label={`Bekijk ${record.draft.title}`}><ExternalLink size={15} aria-hidden="true" /></a>}
                <Button variant="secondary" size="md" className={`${s.button} ${s.small}`} type="button" disabled={loading} onClick={() => openEntry(record)}><Pencil size={14} aria-hidden="true" /> {canWrite ? 'Bewerken' : 'Bekijken'}</Button>
              </div></td>
            </tr>;
          })}</tbody>
        </table></div> : <p className={s.empty} role="status">{loading ? 'Artikelen laden…' : entries.length ? 'Geen artikelen gevonden met deze filters.' : canWrite ? 'Er zijn nog geen artikelen. Begin met een nieuw artikel.' : 'Er zijn nog geen artikelen.'}</p>}
      </section>}
      {view === 'edit' && <fieldset disabled={!canWrite || busy || uploading} className={`${s.grid} ${s.editFields}`}><legend className={s.srOnly}>Artikel bewerken</legend>
        <div className={s.stack}>
          <section className={s.card} aria-labelledby="article-heading">
            <h2 id="article-heading">Artikel</h2>
            <div className={s.fields}>
              <label className={s.field}>Titel<input autoComplete="off" className={s.titleInput} maxLength={160} value={draft.title} placeholder="Geef je artikel een titel" onChange={(event) => changeTitle(event.target.value)} /></label>
              <div className={s.field}>
                <div className={s.fieldTop}><label htmlFor="blog-slug">Slug</label>{entry?.publishedRevision && !allowSlugChange && <Button variant="secondary" size="md" className={`${s.button} ${s.small} ${s.ghost}`} type="button" onClick={() => setAllowSlugChange(true)}><Pencil size={13} aria-hidden="true" /> URL wijzigen</Button>}</div>
                <input id="blog-slug" aria-invalid={message?.code === "SLUG_CONFLICT" || undefined} aria-describedby="blog-slug-url" value={draft.slug} disabled={!canWrite || Boolean(entry?.publishedRevision) && !allowSlugChange} maxLength={100} onChange={(event) => {
                  setManualSlug(true);
                  setDraft((current) => ({ ...current, slug: event.target.value }));
                }} onBlur={() => setDraft((current) => ({ ...current, slug: toSlug(current.slug) }))} />
                {message?.code === "SLUG_CONFLICT" && <p className={s.fieldError} role="alert">Deze URL is al gereserveerd. Kies een andere slug en sla opnieuw op.</p>}
                <p id="blog-slug-url" className={s.url}>{url}</p>
                {entry?.publishedRevision && allowSlugChange && <p className={s.help}>Na publicatie verwijzen eerdere URL’s blijvend door naar de nieuwe URL.</p>}
              </div>
              <label className={s.field}>Samenvatting<textarea value={draft.excerpt} maxLength={320} placeholder="Korte introductie voor het overzicht en het artikel" onChange={(event) => setDraft({ ...draft, excerpt: event.target.value })} /></label>
            </div>
          </section>
          <section className={s.card} aria-labelledby="blog-body-heading">
            <h2 id="blog-body-heading">Inhoud</h2>
            <BlogEditor readOnly={!canWrite || busy || uploading} key={entry?.id ?? 'new'} content={draft.content} onChange={(content) => setDraft((current) => ({ ...current, content: content as ArticleDraft["content"] }))} onUploadImage={uploadImage} />
          </section>
          <section className={s.card} aria-labelledby="blog-media-heading">
            <h2 id="blog-media-heading">Afbeeldingen</h2>
            <p>Gebruik een portretbeeld voor het artikel en eventueel een breed beeld voor sociale kanalen.</p>
            <div className={s.mediaGrid}>
              <section aria-labelledby="hero-image-heading">
                <h3 id="hero-image-heading">Hero-afbeelding</h3>
                <div className={s.assetFrame}>{mediaUrl(draft.hero.assetId) ? <img src={mediaUrl(draft.hero.assetId)} alt={draft.hero.alt} style={{ objectPosition: `${draft.hero.focalPoint.x * 100}% ${draft.hero.focalPoint.y * 100}%` }} /> : <ImageIcon size={25} aria-hidden="true" />}</div>
                <div className={s.assetActions}>
                  <label className={`${s.button} ${s.small} ${s.fileLabel}`}><Upload size={14} aria-hidden="true" /> {mediaUrl(draft.hero.assetId) ? 'Vervangen' : 'Uploaden'}<input type="file" className={s.fileInput} aria-label="Hero-afbeelding uploaden" accept="image/png,image/jpeg,image/webp" disabled={uploading} onChange={(event) => void onMedia(event, 'hero')} /></label>
                  {mediaUrl(draft.hero.assetId) && <Button variant="secondary" size="md" className={`${s.button} ${s.small} ${s.ghost}`} type="button" onClick={() => setDraft({ ...draft, hero: noHero })}>Verwijderen</Button>}
                </div>
                {mediaUrl(draft.hero.assetId) && <>
                  <label className={s.field}>Alt-tekst<input value={draft.hero.alt} maxLength={250} onChange={(event) => updateHero({ alt: event.target.value })} /></label>
                  <label className={s.field}>Focus horizontaal <input type="range" min="0" max="100" value={Math.round(draft.hero.focalPoint.x * 100)} onChange={(event) => updateHero({ focalPoint: { ...draft.hero.focalPoint, x: Number(event.target.value) / 100 } })} /></label>
                  <label className={s.field}>Focus verticaal <input type="range" min="0" max="100" value={Math.round(draft.hero.focalPoint.y * 100)} onChange={(event) => updateHero({ focalPoint: { ...draft.hero.focalPoint, y: Number(event.target.value) / 100 } })} /></label>
                </>}
              </section>
              <section aria-labelledby="share-image-heading">
                <h3 id="share-image-heading">Deelafbeelding <span className={s.assetMeta}>optioneel</span></h3>
                <div className={`${s.assetFrame} ${s.landscape}`}>{draft.ogImageAssetId ? <img src={mediaUrl(draft.ogImageAssetId)} alt="" /> : <ImageIcon size={25} aria-hidden="true" />}</div>
                <div className={s.assetActions}>
                  <label className={`${s.button} ${s.small} ${s.fileLabel}`}><Upload size={14} aria-hidden="true" /> {draft.ogImageAssetId ? 'Vervangen' : 'Uploaden'}<input type="file" className={s.fileInput} aria-label="Deelafbeelding uploaden" accept="image/png,image/jpeg,image/webp" disabled={uploading} onChange={(event) => void onMedia(event, 'share')} /></label>
                  {draft.ogImageAssetId && <Button variant="secondary" size="md" className={`${s.button} ${s.small} ${s.ghost}`} type="button" onClick={() => setDraft({ ...draft, ogImageAssetId: null })}>Verwijderen</Button>}
                </div>
                <p className={s.help}>Aanbevolen verhouding 1200 × 630. Zonder deelafbeelding gebruikt het artikel de hero-afbeelding.</p>
              </section>
            </div>
          </section>
        </div>
        <div className={s.stack}>
          <section className={s.card} aria-labelledby="publication-heading">
            <h2 id="publication-heading">Publicatie</h2>
            <div className={s.statusLine}><span className={s.pill} data-tone={activeStatus}>{statusText[activeStatus]}</span>{entry && <p>Revisie {entry.draftRevision}{entry.publishedRevision && entry.publishedRevision !== entry.draftRevision ? ` · live ${entry.publishedRevision}` : ''}</p>}</div>
            {entry && <><hr className={s.sep} /><Link className={`${s.button} ${s.small}`} href={`/platform/blog/preview/${encodeURIComponent(entry.externalId)}`} target="_blank" rel="noreferrer"><Eye size={14} aria-hidden="true" /> Opgeslagen concept bekijken</Link></>}
            {entry?.publicUrl && <><hr className={s.sep} /><a className={`${s.button} ${s.small}`} href={entry.publicUrl} target="_blank" rel="noreferrer"><ExternalLink size={14} aria-hidden="true" /> Open live artikel</a></>}
          </section>
          <section className={s.card} aria-labelledby="details-heading">
            <h2 id="details-heading">Details</h2>
            <div className={s.fields}>
              <div className={s.fieldGroup}>
                <label className={s.field}>Type<select value={draft.type} onChange={(event) => setDraft({ ...draft, type: event.target.value as ArticleDraft['type'] })}><option value="blog">Blog</option><option value="article">Artikel</option></select></label>
                <label className={s.field}>Taal<select value={draft.locale} onChange={(event) => setDraft({ ...draft, locale: event.target.value as ArticleDraft["locale"] })}><option value="nl-NL">Nederlands</option></select></label>
              </div>
              <label className={s.field}>Auteur<select value={draft.authorId} onChange={(event) => setDraft({ ...draft, authorId: event.target.value })}><option value="redactie">VeyoCast</option></select></label>
              <label className={s.field}>Categorie<select value={draft.categoryId} onChange={(event) => setDraft({ ...draft, categoryId: event.target.value })}><option value="clubtv">ClubTV</option><option value="sponsoring">Sponsoring</option><option value="schermen">Schermen</option><option value="narrowcasting">Narrowcasting</option></select></label>
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
              {(draft.ogImageAssetId || mediaUrl(draft.hero.assetId)) && <div className={`${s.assetFrame} ${s.landscape}`}><img src={mediaUrl(draft.ogImageAssetId || draft.hero.assetId)} alt="" style={draft.ogImageAssetId ? undefined : { objectPosition: `${draft.hero.focalPoint.x * 100}% ${draft.hero.focalPoint.y * 100}%` }} /></div>}
              <div className={s.socialText}><small>{origin.replace(/^https?:\/\//, '') || 'VeyoCast'}</small><p><strong>{effectiveSeoTitle}</strong>{effectiveSeoDescription}</p></div>
            </div>
          </section>
        </div>
      </fieldset>}
      <Dialog open={preview} onOpenChange={setPreview}><DialogContent className={`${s.page} ${s.dialog}`} size="wide" closeLabel="Sluit voorbeeld"
        onCloseAutoFocus={(event) => {event.preventDefault(); document.getElementById('blog-preview-trigger')?.focus();}}>
        <div className={s.dialogHeading}><div><DialogTitle>Conceptvoorbeeld</DialogTitle><DialogDescription>Alleen zichtbaar binnen de platformredactie. Dit voorbeeld publiceert niets.</DialogDescription></div></div>
        <div className={s.dialogContent}>
          {mediaUrl(draft.hero.assetId) && <img className={s.previewHero} src={mediaUrl(draft.hero.assetId)} alt={draft.hero.alt} style={{objectPosition: `${draft.hero.focalPoint.x*100}% ${draft.hero.focalPoint.y*100}%`}} />}
          <span className={s.pill}>{draft.categoryId}</span>
          <h2 className={s.previewTitle}>{draft.title || 'Titel van je artikel'}</h2>
          <p className={s.previewIntro}>{draft.excerpt}</p><p className={s.help}>VeyoCast</p>
          <div className={s.previewBody}><BlogEditor content={draft.content} onChange={() => undefined} readOnly /></div>
        </div>
      </DialogContent></Dialog>
    </div>
  );
}
