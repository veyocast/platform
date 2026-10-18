"use client";

import { Archive, ArrowUpRight, Check, Copy, LayoutGrid, List, ListVideo, Plus, RotateCcw, Search, SlidersHorizontal, Trash2, X } from "lucide-react";
import { useState } from "react";
import { AssetImage, studioSlidePages } from "./presentation-adapter";
import type { Playlist, Screen } from "./model";

type Props = {
  canWrite?: boolean; canManage?: boolean;
  playlists: Playlist[]; total: number; query: string; onQuery: (query: string) => void;
  filter: string; onFilter: (filter: string) => void; sort: string; onSort: (sort: string) => void;
  view: "grid" | "list"; onView: (view: "grid" | "list") => void;
  selection: string[]; onSelection: (ids: string[]) => void; inventory: Screen[];
  onOpen: (playlist: Playlist, add?: boolean) => void; onCreate: () => void; onStudio: () => void;
  onDuplicate: () => void; onArchive: () => void; onRestore: () => void; onDelete?: () => void;
};
function runningTime(playlist: Playlist) {
  const total = playlist.totalDurationSeconds ?? playlist.slides.reduce((sum, slide) => sum + slide.seconds * (slide.design ? Math.max(1, Math.ceil(slide.design.rows.length / Math.max(1, Math.min(10, Number(slide.design.config.rowsPerPage) || 10)))) : slide.studioSlide ? studioSlidePages(slide.studioSlide) : 1), 0);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}
export function PlaylistLibrary({ playlists, total, query, onQuery, filter, onFilter, sort, onSort, view, onView, selection, onSelection, onOpen, onCreate, onDuplicate, onArchive, onRestore, onDelete, canWrite = true, canManage = true }: Props) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const allSelected = playlists.length > 0 && playlists.every(playlist => selection.includes(playlist.id));
  const toggle = (id: string) => onSelection(selection.includes(id) ? selection.filter(value => value !== id) : [...selection, id]);
  return <section className="sync-playlist-library" aria-label="Playlistbibliotheek">
    <header className="section-header"><div><div className="eyebrow">Van content naar uitzending</div><h1>Je playlists</h1><p>Combineer je verhaal. Kies je schermen. Zet het live.</p></div><div className="header-actions"><button className="btn btn-primary" disabled={!canWrite} onClick={onCreate}><Plus size={18} />Nieuwe playlist</button></div></header>
    <div className="toolbar"><div className="search-field"><Search size={18} /><input aria-label="Playlists zoeken" placeholder="Zoek een playlist…" value={query} onChange={event => onQuery(event.target.value)} />{query ? <button aria-label="Zoekopdracht wissen" onClick={() => onQuery("")}><X size={18} /></button> : null}</div><div className="row"><button className={`btn btn-small btn-${filter === "Archief" ? "primary" : "secondary"}`} onClick={() => onFilter(filter === "Archief" ? "Alle playlists" : "Archief")}>{filter === "Archief" ? "Terug naar actief" : "Archief"}</button><span className="badge">{total} playlists</span><button className="btn btn-small btn-ghost" aria-expanded={filtersOpen} aria-controls="playlist-filters" onClick={() => setFiltersOpen(!filtersOpen)}><SlidersHorizontal size={17} />Filters</button></div></div>
    {filtersOpen ? <div id="playlist-filters" className="row sync-library-options"><label className="field"><span>Status</span><select value={filter} onChange={event => onFilter(event.target.value)}>{["Alle playlists", "Gepubliceerd", "Concept", "Archief"].map(value => <option key={value}>{value}</option>)}</select></label><label className="field"><span>Sorteren</span><select value={sort} onChange={event => onSort(event.target.value)}><option value="recent">Recent gewijzigd</option><option value="name">Naam A–Z</option><option value="items">Meeste items</option></select></label><div className="row" aria-label="Weergave"><button className="btn btn-secondary" aria-label="Kaartenweergave" aria-pressed={view === "grid"} onClick={() => onView("grid")}><LayoutGrid size={18} /></button><button className="btn btn-secondary" aria-label="Lijstweergave" aria-pressed={view === "list"} onClick={() => onView("list")}><List size={18} /></button></div><button className="btn btn-secondary" onClick={() => { setSelecting(!selecting); onSelection([]); }}>{selecting ? <><Check size={17} />Klaar</> : "Selecteren"}</button></div> : null}
    {selecting ? <div className="row sync-library-options"><label className="check-label"><input type="checkbox" checked={allSelected} onChange={() => onSelection(allSelected ? selection.filter(id => !playlists.some(playlist => playlist.id === id)) : Array.from(new Set([...selection, ...playlists.map(playlist => playlist.id)])))} />Alles selecteren</label><span>{selection.length} gekozen</span></div> : null}
    {selection.length ? <div className="row sync-library-options" aria-label="Acties voor geselecteerde playlists"><button className="btn btn-secondary" disabled={!canWrite} onClick={onDuplicate}><Copy size={18} />Dupliceren</button>{filter === "Archief" ? <button className="btn btn-secondary" disabled={!canManage} onClick={onRestore}><RotateCcw size={18} />Herstellen</button> : <button className="btn btn-secondary" disabled={!canManage} onClick={onArchive}><Archive size={18} />Archiveren</button>}{onDelete ? <button className="btn btn-secondary" disabled={!canManage} onClick={onDelete}><Trash2 size={18} />Definitief verwijderen</button> : null}<button className="btn btn-ghost" onClick={() => onSelection([])} aria-label="Selectie wissen"><X size={18} /></button></div> : null}
    <h2 className="sync-sr-only">Playlists in de bibliotheek</h2>
    <div className={`playlist-grid${view === "list" ? " sync-playlist-list" : ""}`}>
      {playlists.map(playlist => <article className="playlist-card card" key={playlist.id} data-selected={selection.includes(playlist.id)}><button className="playlist-cover" onClick={() => selecting ? toggle(playlist.id) : onOpen(playlist)} aria-label={selecting ? `${playlist.name} selecteren` : `Open ${playlist.name}`} aria-pressed={selecting ? selection.includes(playlist.id) : undefined}>{playlist.slides[0]?.image ? <AssetImage src={playlist.slides[0].image} alt="" /> : <div className="playlist-empty-cover"><ListVideo size={54} /></div>}<span className="cover-open">{selecting && selection.includes(playlist.id) ? <Check size={18} /> : <ArrowUpRight size={18} />}</span></button><div className="playlist-card-info"><div className="row between"><span className={`badge badge-${playlist.status === "Gepubliceerd" ? "green" : "amber"}`}>{playlist.archived ? "Gearchiveerd" : playlist.status === "Concept" && playlist.publishedVersion ? "Gewijzigd concept" : playlist.status}</span></div><h3><button className="text-button" onClick={() => onOpen(playlist)}>{playlist.name}</button></h3><p className="muted">{playlist.description || "Een nieuw verhaal voor je schermen."}</p><div className="row between playlist-card-foot"><span>{playlist.itemCount ?? playlist.slides.length} items · {runningTime(playlist)}</span><button className="btn btn-small btn-ghost" disabled={!canWrite} onClick={() => { onSelection([playlist.id]); onDuplicate(); }}><Copy size={18} />Kopieer</button></div></div></article>)}
      <button className="playlist-new-card" disabled={!canWrite} onClick={onCreate}><span><Plus size={30} /></span><h3>Een nieuw verhaal</h3><p>Begin met een lege playlist</p></button>
    </div>
    {!playlists.length && (query || filter !== "Alle playlists") ? <div className="empty"><Search size={36} /><h2>Geen playlists gevonden</h2><p>Probeer een andere naam of wis je filters.</p><button className="btn btn-secondary" onClick={() => { onQuery(""); onFilter("Alle playlists"); }}>Zoeken en filters wissen</button></div> : null}
  </section>;
}
