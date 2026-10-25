'use client';
import {useEffect,useRef,useState}from'react';
import {Button}from'@veyocast/ui';
import {readSyncExportAction,requestSyncExportAction,type SyncExportResult}from'./sync-export-actions';
export function SyncExportDownload({snapshotId}:{snapshotId:string}){
 const [result,setResult]=useState<SyncExportResult|null>(null),attempt=useRef<string|null>(null),generation=useRef(0);
 useEffect(()=>()=>{generation.current++;},[snapshotId]);
 useEffect(()=>{
  if(result?.status!=='preparing')return;
  const active=generation.current;let timer:ReturnType<typeof setTimeout>|undefined,checks=0;
  const poll=async()=>{
   if(++checks>180){if(active===generation.current)setResult({status:'failed',message:'De download is nog niet gereed. Je ontwerp blijft beschikbaar. Probeer de download later opnieuw.'});return;}
   try{
    const next=await readSyncExportAction(snapshotId);
    if(active!==generation.current)return;
    if(next.status!=='preparing'){setResult(next);return;}
    timer=setTimeout(()=>void poll(),2000);
   }catch{if(active===generation.current)timer=setTimeout(()=>void poll(),2000);}
  };
  timer=setTimeout(()=>void poll(),2000);
  return()=>{generation.current++;if(timer)clearTimeout(timer);};
 },[result?.status,snapshotId]);
 const request=async()=>{
  attempt.current??=crypto.randomUUID();const active=++generation.current;setResult({status:'preparing'});
  try{const next=await requestSyncExportAction({snapshotId,idempotencyKey:attempt.current});if(active===generation.current)setResult(next);}catch{if(active===generation.current)setResult({status:'failed',retrySame:true,message:'De ontvangst van je aanvraag is onzeker. Je ontwerp blijft beschikbaar. Probeer dezelfde download opnieuw.'});}
 };
 return <div>
  {result?.status==='ready'?<Button asChild variant='secondary'><a href={result.url} download>Download {result.video?'video':'afbeelding'}</a></Button>:<Button variant='secondary' disabled={result?.status==='preparing'} onClick={()=>{if(result?.status==='failed'&&!result.retrySame)attempt.current=null;void request();}}>Download bestand</Button>}
  {result?.status==='preparing'?<p role='status'>Download voorbereiden. Je kunt je ontwerp blijven gebruiken.</p>:result?.status==='failed'?<p role='alert'>{result.message}</p>:null}
 </div>;
}
