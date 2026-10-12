"use client";

import { Archive, ArrowUpRight, Check, Copy, ImagePlus, LayoutGrid, List, ListVideo, Monitor, Plus, RotateCcw, Search, SlidersHorizontal, Sparkles, X } from 'lucide-react';
import { useState } from 'react';
import { AssetImage } from './presentation-adapter';
import type { Playlist } from './model';
import type { Screen } from './model';
import { studioSlidePages } from './presentation-adapter';
import styles from './playlist-library.module.css';

type Props = {
  canWrite?:boolean;canManage?:boolean;
  playlists:Playlist[]; total:number; query:string; onQuery:(query:string)=>void;
  filter:string; onFilter:(filter:string)=>void; sort:string; onSort:(sort:string)=>void;
  view:'grid'|'list'; onView:(view:'grid'|'list')=>void;
  selection:string[]; onSelection:(ids:string[])=>void; inventory:Screen[];
  onOpen:(playlist:Playlist,add?:boolean)=>void; onCreate:()=>void; onStudio:()=>void;
  onDuplicate:()=>void; onArchive:()=>void; onRestore:()=>void;
};

function runningTime(playlist:Playlist) {
  const total=playlist.totalDurationSeconds??playlist.slides.reduce((sum,slide)=>sum+slide.seconds*(slide.design?Math.max(1,Math.ceil(slide.design.rows.length/Math.max(1,Math.min(10,Number(slide.design.config.rowsPerPage)||10)))):slide.studioSlide?studioSlidePages(slide.studioSlide):1),0);
  return `${Math.floor(total/60)}:${String(total%60).padStart(2,'0')}`;
}

export function PlaylistLibrary({playlists,total,query,onQuery,filter,onFilter,sort,onSort,view,onView,selection,onSelection,inventory,onOpen,onCreate,onStudio,onDuplicate,onArchive,onRestore,canWrite=true,canManage=true}:Props) {
  const [filtersOpen,setFiltersOpen]=useState(false);
  const [selecting,setSelecting]=useState(false);
  const allSelected=playlists.length>0&&playlists.every(p=>selection.includes(p.id));
  const toggle=(id:string)=>onSelection(selection.includes(id)?selection.filter(value=>value!==id):[...selection,id]);
  return <section className={styles.library} aria-label="Playlistbibliotheek">
    <div className={styles.intro}>
      <div><span className={styles.eyebrow}>Jouw schermverhalen</span><h2>Even bijwerken. Klaar.</h2><p>Open je playlist of voeg direct nieuwe beelden toe.</p></div>
      <div className={styles.actions}><button className={styles.secondary} onClick={onStudio}><Sparkles size={18}/>Studio</button><button className={styles.primary} disabled={!canWrite}onClick={onCreate}><Plus size={19}/>Nieuwe playlist</button></div>
    </div>
    <div className={styles.tools}>
      <label className={styles.search}><Search size={20}/><input aria-label="Zoek een playlist" placeholder="Welke playlist wil je bijwerken?" value={query} onChange={event=>onQuery(event.target.value)}/>{query&&<button onClick={()=>onQuery('')} aria-label="Zoekopdracht wissen"><X size={18}/></button>}</label>
      <button className={`${styles.filterButton} ${filtersOpen?styles.active:''}`} aria-expanded={filtersOpen} aria-controls="playlist-filters" onClick={()=>setFiltersOpen(!filtersOpen)}><SlidersHorizontal size={19}/><span>Filters</span>{filter!=='Alle playlists'&&<i/>}</button>
      <div className={styles.viewToggle} aria-label="Weergave"><button aria-label="Kaartenweergave" aria-pressed={view==='grid'} onClick={()=>onView('grid')}><LayoutGrid size={19}/></button><button aria-label="Lijstweergave" aria-pressed={view==='list'} onClick={()=>onView('list')}><List size={20}/></button></div>
    </div>
    {filtersOpen&&<div id="playlist-filters" className={styles.filters}><label>Status<select value={filter} onChange={event=>onFilter(event.target.value)}>{['Alle playlists','Gepubliceerd','Concept','Archief'].map(value=><option key={value}>{value}</option>)}</select></label><label>Sorteren<select value={sort} onChange={event=>onSort(event.target.value)}><option value="recent">Recent toegevoegd</option><option value="name">Naam A–Z</option><option value="items">Meeste items</option></select></label></div>}
    <div className={styles.listHeading}><div><strong>{playlists.length} playlists</strong><span>{query||filter!=='Alle playlists'?`van ${total} actieve playlists`:'Klaar voor het volgende clubmoment'}</span></div><button onClick={()=>{setSelecting(!selecting);onSelection([])}}>{selecting?<><Check size={17}/>Klaar</>:<>Selecteren</>}</button></div>
    {selecting&&<div className={styles.selectionBar}><label><input type="checkbox" checked={allSelected} onChange={()=>onSelection(allSelected?selection.filter(id=>!playlists.some(p=>p.id===id)):Array.from(new Set([...selection,...playlists.map(p=>p.id)])))}/>Alles selecteren</label><span>{selection.length} gekozen</span></div>}
    {selection.length>0&&<div className={styles.bulk} aria-label="Acties voor geselecteerde playlists"><button disabled={!canWrite}onClick={onDuplicate}><Copy size={18}/>Dupliceren</button>{filter==='Archief'?<button disabled={!canManage}onClick={onRestore}><RotateCcw size={18}/>Herstellen</button>:<button disabled={!canManage}onClick={onArchive}><Archive size={18}/>Archiveren</button>}<button onClick={()=>onSelection([])} aria-label="Selectie wissen"><X size={18}/></button></div>}
    <div className={`${styles.cards} ${view==='list'?styles.list:''}`}>
      {playlists.map(playlist=>{
        const targets=playlist.assignedScreenCount??inventory.filter(screen=>screen.playlist===playlist.name).length;
        return <article className={styles.card} key={playlist.id} data-selected={selection.includes(playlist.id)}>
          <button className={styles.visual} onClick={()=>selecting?toggle(playlist.id):onOpen(playlist)} aria-label={selecting?`${playlist.name} selecteren`:`${playlist.name} bewerken`} aria-pressed={selecting?selection.includes(playlist.id):undefined}>
            {playlist.slides[0]?.image?<AssetImage src={playlist.slides[0].image} alt=""/>:<ListVideo size={32}/>}
            {selecting?<span className={styles.check} data-checked={selection.includes(playlist.id)}>{selection.includes(playlist.id)&&<Check size={16}/>}</span>:<span className={styles.time}>{runningTime(playlist)}</span>}
          </button>
          <div className={styles.copy}><span className={`${styles.status} ${playlist.status==='Concept'?styles.draft:''}`}>{playlist.archived?'Archief':playlist.status}</span><h3><button onClick={()=>selecting?toggle(playlist.id):onOpen(playlist)}>{playlist.name}</button></h3><p>{playlist.description||'Jouw volgende verhaal begint hier.'}</p><div className={styles.meta}><span>{playlist.itemCount??playlist.slides.length} items</span><span><Monitor size={14}/>{targets} scherm{targets===1?'':'en'}</span></div></div>
          <div className={styles.cardActions}><button onClick={()=>onOpen(playlist)}>Bewerken<ArrowUpRight size={17}/></button><button className={styles.add} onClick={()=>onOpen(playlist,true)} aria-label={`Media toevoegen aan ${playlist.name}`}><ImagePlus size={19}/><span>Media toevoegen</span></button></div>
        </article>;
      })}
    </div>
    {!playlists.length&&<div className={styles.empty}><ListVideo size={36}/><h3>{query||filter!=='Alle playlists'?'Geen playlists gevonden':'Je eerste playlist begint hier'}</h3><p>{query||filter!=='Alle playlists'?'Probeer een andere naam of wis je filters.':'Kies je beelden en stel je eerste schermverhaal samen.'}</p>{query||filter!=='Alle playlists'?<button className={styles.secondary} onClick={()=>{onQuery('');onFilter('Alle playlists')}}>Zoeken en filters wissen</button>:<button className={styles.primary} disabled={!canWrite}onClick={onCreate}><Plus size={18}/>Playlist maken</button>}</div>}
  </section>;
}
