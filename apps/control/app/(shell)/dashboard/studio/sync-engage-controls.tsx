"use client";
import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {Button} from '@veyocast/ui';
import {SyncStudioField as Field} from './sync-studio-field';
import type {SyncSlidePresentation} from '@veyocast/contracts';
import {readSyncEngageChoicesAction,readSyncEngageSelectionAction} from './sync-engage-actions';

export function SyncEngageControls({poll,onSelect,disabled}:{poll:SyncSlidePresentation['poll'];onSelect:(poll:SyncSlidePresentation['poll'])=>void;disabled:boolean}){
 const[search,setSearch]=useState(''),[choices,setChoices]=useState<Array<{id:string;title:string;status:string}>>([]),[more,setMore]=useState(false),[loading,setLoading]=useState(false),[selecting,setSelecting]=useState(false),[error,setError]=useState<string|null>(null),generation=useRef(0),mounted=useRef(true);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;generation.current++;};},[]);
 async function load(offset:number,sequence:number){
  setLoading(true);try{const result=await readSyncEngageChoicesAction({search,offset});if(!mounted.current||sequence!==generation.current)return;
   if(result.ok){setChoices(previous=>offset?[...previous,...result.choices.filter(choice=>!previous.some(value=>value.id===choice.id))]:result.choices);setMore(result.hasMore);setError(null);}else setError(result.error);
  }catch{if(mounted.current&&sequence===generation.current)setError('De campagnelijst is niet bevestigd. Je vorige keuze blijft behouden; probeer opnieuw.');}finally{if(mounted.current&&sequence===generation.current)setLoading(false);}
 }
 useEffect(()=>{const sequence=++generation.current;const timer=window.setTimeout(()=>void load(0,sequence),250);return()=>window.clearTimeout(timer);},[search]);
 async function select(publicId:string){
  if(disabled||selecting)return;if(!publicId){onSelect(undefined);return;}setSelecting(true);setError(null);
  try{const result=await readSyncEngageSelectionAction({publicId});if(!mounted.current)return;if(result.ok){onSelect(result.poll);}else setError(result.error);}catch{if(mounted.current)setError('De campagnekeuze is niet bevestigd. Je vorige keuze blijft behouden; probeer opnieuw.');}finally{if(mounted.current)setSelecting(false);}
 }
 return <>
  <Field label="Campagne zoeken"><input value={search}maxLength={80}disabled={disabled||selecting}onChange={event=>setSearch(event.target.value)}/></Field>
  <Field label="Gekoppelde publieksvraag"><select value={poll?.id??''}disabled={disabled||selecting}onChange={event=>void select(event.target.value)}><option value="">Kies een campagne</option>{poll&&!choices.some(value=>value.id===poll.id)&&<option value={poll.id}>Huidige campagne · {poll.title}</option>}{choices.map(choice=><option key={choice.id}value={choice.id}>{choice.title} · {choice.status==='live'?'Live':choice.status==='closed'?'Gesloten':'Gepland'}</option>)}</select></Field>
  {loading&&<p role="status"className="vc-property-hint">Campagnes lezen…</p>}{selecting&&<p role="status"className="vc-property-hint">Publieke inhoud controleren…</p>}{more&&<Button variant="secondary"disabled={loading||disabled||selecting}onClick={()=>void load(choices.length,generation.current)}>Meer campagnes</Button>}
  {error&&<p role="alert"className="notice notice--critical">{error}</p>}
  <div className="vc-source-binding"><strong>{poll?'Gecontroleerde campagne':'Kies een publieksvraag'}</strong><p>Vraag, keuzes en zichtbaarheid komen uit Engage. De opgeslagen kaart blijft de volledige offlinefallback; actuele resultaten volgen de publieke campagnerechten.</p></div>
  {poll&&!poll.publicUrl&&<p role="status"className="vc-property-hint">Een beveiligde publieke URL ontbreekt in deze omgeving. De QR-code verschijnt zodra die URL is geconfigureerd; je campagnekeuze blijft behouden.</p>}
  <Button asChild variant="secondary"><Link href="/dashboard/engage">Campagnes beheren</Link></Button>
 </>;
}
