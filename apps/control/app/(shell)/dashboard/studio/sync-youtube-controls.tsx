"use client";
import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {Button} from '@veyocast/ui';
import {SyncStudioField as Field} from './sync-studio-field';
import {readSyncYouTubeChoicesAction} from './sync-youtube-actions';

export function SyncYouTubeControls({url,onSelect,disabled}:{url?:string;onSelect:(url:string|undefined)=>void;disabled:boolean}){
 const[search,setSearch]=useState(''),[choices,setChoices]=useState<Array<{id:string;title:string;url:string}>>([]),[more,setMore]=useState(false),[loading,setLoading]=useState(false),[error,setError]=useState<string|null>(null),generation=useRef(0),mounted=useRef(true);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;generation.current++;};},[]);
 async function load(offset:number,sequence:number){setLoading(true);try{const result=await readSyncYouTubeChoicesAction({search,offset});if(!mounted.current||sequence!==generation.current)return;if(result.ok){setChoices(previous=>offset?[...previous,...result.choices.filter(choice=>!previous.some(value=>value.id===choice.id))]:result.choices);setMore(result.hasMore);setError(null);}else setError(result.error);}catch{if(mounted.current&&sequence===generation.current)setError('De videolijst is niet bevestigd. Je vorige keuze blijft behouden; probeer opnieuw.');}finally{if(mounted.current&&sequence===generation.current)setLoading(false);}}
 useEffect(()=>{const sequence=++generation.current,timer=window.setTimeout(()=>void load(0,sequence),250);return()=>window.clearTimeout(timer);},[search]);
 return <>
  <Field label="Videobron zoeken"><input value={search}maxLength={80}disabled={disabled}onChange={event=>setSearch(event.target.value)}/></Field>
  <Field label="Gecontroleerde YouTube-bron"><select value={url??''}disabled={disabled||loading}onChange={event=>onSelect(event.target.value||undefined)}><option value="">Kies een gecontroleerde bron</option>{url&&!choices.some(choice=>choice.url===url)&&<option value={url}>Huidige link · controleer de bron</option>}{choices.map(choice=><option key={choice.id}value={choice.url}>{choice.title}</option>)}</select></Field>
  {loading&&<p role="status"className="vc-property-hint">Videobronnen lezen…</p>}{more&&<Button variant="secondary"disabled={loading||disabled}onClick={()=>void load(choices.length,generation.current)}>Meer videobronnen</Button>}{error&&<p role="alert"className="notice notice--critical">{error}</p>}
  <div className="vc-source-binding"><strong>Online video met je eigen lokale kaart</strong><p>Kies een bestaande gecontroleerde bron. YouTube speelt via de officiële online player. Dit volledige ontwerp blijft beschikbaar bij verbindingsverlies; de bron zelf verandert niet.</p></div>
  <Button asChild variant="secondary"><Link href="/dashboard/integrations/youtube">YouTube-bronnen beheren</Link></Button>
 </>;
}
