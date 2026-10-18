"use client";
import {useEffect,useRef,useState} from 'react';
import {useRouter} from 'next/navigation';
import {ArrowLeft,ArrowRight,Copy,Plus,Trash2} from 'lucide-react';
import {Button} from '@veyocast/ui';
import {SyncStudioField} from './sync-studio-field';
import {mutateSyncStudioSeriesAction} from './sync-studio-series-actions';
import {parseSyncStudioSeriesCommand,type SyncStudioSeriesCommand} from './sync-studio-series-command';
import type {StudioSeriesDetail} from './types';

/** Collection commands keep their full original receipt across a reload. */
export function useSyncStudioSeries({tenantId,projectId,series,canEdit,canCreate,canArchive,busy,prepare}:{tenantId:string;projectId:string;series?:StudioSeriesDetail|null;canEdit:boolean;canCreate:boolean;canArchive:boolean;busy:boolean;prepare:()=>Promise<number|null>}){
 const router=useRouter(),storageKey=`veyocast-sync-series-v1:${tenantId}:${projectId}`;
 const [name,setName]=useState(series?.name??''),[pending,setPending]=useState<SyncStudioSeriesCommand|null>(null),[running,setRunning]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState(''),[hydrated,setHydrated]=useState(false),[unreadable,setUnreadable]=useState(false),[confirmed,setConfirmed]=useState<{projectId:string;seriesId:string}|null>(null);
 const attempt=useRef<SyncStudioSeriesCommand|null>(null),preparing=useRef(false),loaded=useRef(false);
 const blocked=Boolean(pending)||running||unreadable;
 function persist(command:SyncStudioSeriesCommand|null,nextName=name){try{sessionStorage.setItem(storageKey,JSON.stringify({name:nextName,command}));}catch{setError('Lokaal bewaren is niet gelukt. Houd dit venster open totdat de reeksopdracht is bevestigd.');}}
 useEffect(()=>{
  if(loaded.current)return;loaded.current=true;
  try{const raw=sessionStorage.getItem(storageKey);if(raw){if(raw.length>16000)throw Error('bounds');const value=JSON.parse(raw) as {name?:unknown;command?:unknown};if(typeof value.name!=='string'||value.name.length>120)throw Error('name');setName(value.name);if(value.command){const command=parseSyncStudioSeriesCommand(value.command);if(!command||command.projectId!==projectId)throw Error('command');attempt.current=command;setPending(command);setMessage('Een eerdere reeksopdracht is nog niet bevestigd. Bevestig dezelfde opdracht opnieuw voordat je verdergaat.');}}}
  catch{setUnreadable(true);setError('De lokale reeksopdracht kan niet veilig worden gelezen. Bewaar je invoer en open de actuele reeks opnieuw vanuit de bibliotheek.');}
  setHydrated(true);
 },[storageKey,projectId]);
 async function run(operation:SyncStudioSeriesCommand['operation'],memberIds:string[]|null=null){
  if(!canEdit||busy||running||preparing.current||unreadable||!hydrated||!navigator.onLine)return;
  preparing.current=true;setError('');setMessage('');
  try{
   let command=attempt.current;
   if(!command){
    const revision=await prepare();if(revision===null)return;
    command={projectId,draftRevision:revision,seriesId:series?.id??null,seriesRevision:series?.revision??null,operation,name:operation==='add'||operation==='rename'?name.trim()||null:null,memberIds,idempotencyKey:crypto.randomUUID()};
    attempt.current=command;setPending(command);persist(command);
   }
   setRunning(true);
   const result=await mutateSyncStudioSeriesAction(command);
   if(!result.ok){
    // A new definitive rejection did not commit. A rejection while recovering
    // an earlier unknown answer does not disprove that original commit.
    if(result.rejected&&pending===null){attempt.current=null;setPending(null);persist(null);}
    setError(result.error);return;
   }
   attempt.current=null;setPending(null);persist(null);setMessage('Je reekswijziging is bevestigd door de server.');setConfirmed({projectId:result.nextProjectId,seriesId:result.seriesId});
   if(result.nextProjectId!==projectId)router.push(`/dashboard/studio/${result.nextProjectId}`);else router.refresh();
  }catch{setError('De reeksopdracht is niet bevestigd. Je invoer en oorspronkelijke opdracht blijven bewaard; bevestig dezelfde opdracht opnieuw.');}
  finally{preparing.current=false;setRunning(false);}
 }
 async function navigate(id:string){if(blocked||busy||preparing.current)return;preparing.current=true;try{if(!canEdit||await prepare()!==null)router.push(`/dashboard/studio/${id}`);}finally{preparing.current=false;}}
 function move(direction:-1|1){if(!series)return;const ids=series.items.map(item=>item.id),index=ids.indexOf(projectId),destination=index+direction;if(index<0||destination<0||destination>=ids.length)return;[ids[index],ids[destination]]=[ids[destination]!,ids[index]!];void run('reorder',ids);}
 const index=series?.items.findIndex(item=>item.id===projectId)??-1;
 const controls=<>
  <SyncStudioField label="Onderdeel van een reeks"><input value={name}maxLength={120}placeholder="Bijvoorbeeld: Zondag · wedstrijddag"onChange={event=>{setName(event.target.value);persist(attempt.current,event.target.value);}}disabled={!canEdit||blocked||busy||!hydrated}/></SyncStudioField>
  {series&&name.trim()!==series.name&&<Button variant="secondary"disabled={!canEdit||blocked||busy||name.trim().length<2}onClick={()=>void run('rename')}>Reeksnaam opslaan</Button>}
  <Button variant="secondary"disabled={!canEdit||!canCreate||blocked||busy||!hydrated||(series?.items.length??1)>=20}onClick={()=>void run('add')}><Plus size={16}/>Slide aan deze reeks toevoegen</Button>
  {series&&<div className="stack"aria-label="Reeks bewerken"><p className="vc-property-hint">{series.items.length} ontwerpen · opgeslagen reeksversie {series.revision}</p><div className="row"><Button variant="secondary"disabled={!canEdit||!canCreate||blocked||busy||series.items.length>=20}onClick={()=>void run('duplicate')}><Copy size={15}/>Slide kopiëren</Button><Button variant="secondary"disabled={!canEdit||!canArchive||blocked||busy||series.items.length<=1}onClick={()=>void run('remove')}><Trash2 size={15}/>Uit reeks verwijderen</Button></div><div className="row"><Button variant="secondary"disabled={!canEdit||blocked||busy||index<=0}onClick={()=>move(-1)}><ArrowLeft size={15}/>Eerder in reeks</Button><Button variant="secondary"disabled={!canEdit||blocked||busy||index<0||index>=series.items.length-1}onClick={()=>move(1)}>Later in reeks<ArrowRight size={15}/></Button></div></div>}
 </>;
 const feedback=<>
  {message&&<div className="vc-recovered-note"role="status">{message}</div>}
  {error&&<div className="vc-recovered-note"role="alert">{error}</div>}
  {pending&&<div className="vc-recovered-note"><span>Reeksopdracht: {({add:'slide toevoegen',duplicate:'slide kopiëren',remove:'slide verwijderen',reorder:'volgorde opslaan',rename:'reeksnaam opslaan'} as const)[pending.operation]}.</span><Button variant="secondary"disabled={!canEdit||busy||running}onClick={()=>void run(pending.operation)}>Dezelfde reeksopdracht bevestigen</Button></div>}
  {confirmed&&confirmed.projectId!==projectId&&<div className="vc-recovered-note"><a href={`/dashboard/studio/${confirmed.projectId}`}>Bevestigd ontwerp openen</a></div>}
 </>;
 return {controls,feedback,blocked,series,navigate};
}
