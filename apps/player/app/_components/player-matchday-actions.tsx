"use client";
import{useCallback,useEffect,useRef,useState}from"react";
import{playerMatchdayAckReceiptSchema,type PlayerMatchdayAction,type PlayerMatchdayAckInput}from"@veyocast/contracts";
import type{PlayerManifestEnvelope}from"../_lib/player-manifest";
import{formatMatchdayKickoff,PlayerMatchdayActionsState}from"../_lib/player-matchday-actions";
import{matchdayExpiryHeader,matchdayExpiryVersion}from"../_lib/player-matchday-window";
import{fetchPlayerOrigin}from"../_lib/player-connectivity";
import styles from"./player-matchday-actions.module.css";

async function fetchMatchday(url:string,init:RequestInit,parent?:AbortSignal){
 const controller=new AbortController(),abort=()=>controller.abort();
 parent?.addEventListener('abort',abort,{once:true});if(parent?.aborted)controller.abort();
 const timer=globalThis.setTimeout(abort,8000);
 try{return await fetchPlayerOrigin(url,{...init,signal:controller.signal});}
 finally{clearTimeout(timer);parent?.removeEventListener('abort',abort);}
}
function hasVisibleBaseFrame(){
 if(document.visibilityState!=='visible')return false;
 return Array.from(document.querySelectorAll<HTMLElement>('[data-player-handoff="first-frame-ready"]')).some(element=>{
  if(element.closest('[data-player-transition-outgoing]'))return false;
  const bounds=element.getBoundingClientRect();if(bounds.width<=0||bounds.height<=0||bounds.bottom<=0||bounds.right<=0||bounds.top>=innerHeight||bounds.left>=innerWidth)return false;
  for(let node:HTMLElement|null=element;node;node=node.parentElement){const style=getComputedStyle(node);if(style.display==='none'||style.visibility==='hidden'||Number(style.opacity)===0)return false;}
  return [[.5,.5],[.1,.1],[.1,.9]].some(([x,y])=>{const top=document.elementFromPoint(Math.min(innerWidth-1,Math.max(0,bounds.left+bounds.width*x!)),Math.min(innerHeight-1,Math.max(0,bounds.top+bounds.height*y!)));return Boolean(top&&element.contains(top));});
 });
}

export function PlayerMatchdayActions({envelope,credential,ready,paused}:{envelope:PlayerManifestEnvelope;credential:string|null;ready:boolean;paused:boolean}){
 const current=useRef({envelope,credential,ready,paused});current.current={envelope,credential,ready,paused};
 const[actions,setActions]=useState<PlayerMatchdayAction[]>([]),[index,setIndex]=useState(0),[restoring,setRestoring]=useState<PlayerMatchdayAction[]>([]);
 const projection=useRef(new PlayerMatchdayActionsState()),activeRef=useRef(actions);activeRef.current=actions;
 const[visibilityVersion,setVisibilityVersion]=useState(0);
 const ackController=useRef(new AbortController());
 const queued=useRef(new Map<string,PlayerMatchdayAckInput>()),acknowledged=useRef(new Set<string>()),retired=useRef(new Set<string>()),ackBusy=useRef(false),disposed=useRef(false);
 const window=envelope.matchdayWindow,scopeKey=window?`${envelope.device.id}:${envelope.device.screenId}:${window.publicationId}:${window.targetId}`:'';
 const flush=useCallback(async()=>{
  if(ackBusy.current||disposed.current)return;ackBusy.current=true;
  try{for(const[key,input]of queued.current){
   const token=current.current.credential;if(!token)break;
   try{const response=await fetchMatchday('/api/player/matchday',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json',[matchdayExpiryHeader]:matchdayExpiryVersion},body:JSON.stringify(input)},ackController.current.signal);
    if(current.current.credential!==token||disposed.current)return;
    if(response.status>=400&&response.status<500&&![408,429].includes(response.status)){queued.current.delete(key);retired.current.add(key);continue;}
    const receipt=playerMatchdayAckReceiptSchema.safeParse(await response.json());
    if(response.ok&&receipt.success&&receipt.data.accepted&&receipt.data.deliveryId===input.deliveryId&&receipt.data.phase===input.phase){queued.current.delete(key);acknowledged.current.add(key);}
   }catch{/* Preserve this exact nonce for the next bounded online retry. */}
  }}finally{ackBusy.current=false;}
 },[]);
 const acknowledge=useCallback((action:PlayerMatchdayAction,phase:PlayerMatchdayAckInput['phase'],reasonCode:PlayerMatchdayAckInput['reasonCode']=null)=>{
  if(action.deviceId!==current.current.envelope.device.id||action.screenId!==current.current.envelope.device.screenId)return;
  const key=`${action.deliveryId}:${phase}`;if(queued.current.has(key)||acknowledged.current.has(key)||retired.current.has(key))return;
  const value=current.current;
  queued.current.set(key,{schemaVersion:1,requestId:crypto.randomUUID(),deliveryId:action.deliveryId,actionId:action.actionId,runbookId:action.runbookId,publicationId:action.publicationId,targetId:action.targetId,actionRevision:action.actionRevision,contentHash:action.contentHash,phase,reportedAt:new Date().toISOString(),activeReleaseId:value.envelope.manifest.releaseId,reasonCode});
  void flush();
 },[flush]);
 useEffect(()=>{disposed.current=false;const visible=()=>setVisibilityVersion(value=>value+1);document.addEventListener('visibilitychange',visible);return()=>{disposed.current=true;ackController.current.abort();document.removeEventListener('visibilitychange',visible);};},[]);
 useEffect(()=>{
  ackController.current.abort();ackController.current=new AbortController();
  projection.current=new PlayerMatchdayActionsState();queued.current.clear();acknowledged.current.clear();retired.current.clear();activeRef.current=[];setActions([]);setRestoring([]);
 },[credential]);
 useEffect(()=>{
  if(!credential)return;
  const retry=()=>{void flush();},timer=globalThis.setInterval(retry,4000);
  globalThis.addEventListener('online',retry);
  return()=>{clearInterval(timer);globalThis.removeEventListener('online',retry);};
 },[credential,flush]);
 useEffect(()=>{
  let cancelled=false,inFlight=false,followup=false;const controller=new AbortController();
  const clear=()=>{const old=activeRef.current;if(old.length)setRestoring(values=>[...values,...old]);activeRef.current=[];setActions([]);};
  clear();setIndex(0);
  if(!scopeKey||!credential)return;
  const poll=async()=>{
   if(cancelled)return;if(inFlight){followup=true;return;}inFlight=true;
   const context=current.current,window=context.envelope.matchdayWindow;if(!window){inFlight=false;return;}
   const requestId=crypto.randomUUID(),started=performance.now();
   try{
    const response=await fetchMatchday(`/api/player/matchday?requestId=${requestId}&publicationId=${window.publicationId}`,{cache:'no-store',headers:{Authorization:`Bearer ${credential}`,[matchdayExpiryHeader]:matchdayExpiryVersion}},controller.signal);
    if(!response.ok||cancelled)return;
    const active=projection.current.observe(await response.json(),requestId,started,performance.now(),{deviceId:context.envelope.device.id,screenId:context.envelope.device.screenId,publicationId:window.publicationId,targetId:window.targetId});
    if(cancelled)return;
    const ids=new Set(active.map(action=>action.deliveryId)),old=activeRef.current.filter(action=>!ids.has(action.deliveryId));
    if(old.length)setRestoring(values=>[...values,...old]);
    for(const action of active){acknowledge(action,'received');acknowledge(action,'prepared');}
    activeRef.current=active;setActions(active);
   }catch{/* A failed observation retains the last valid offers until their own expiry. */}
   finally{inFlight=false;if(followup&&!cancelled){followup=false;void poll();}}
  };
  void poll();const interval=globalThis.setInterval(()=>{void poll();},4000);
  const online=()=>{void poll();};globalThis.addEventListener('online',online);
  return()=>{cancelled=true;controller.abort();clearInterval(interval);globalThis.removeEventListener('online',online);};
 },[scopeKey,credential,acknowledge,flush]);
 useEffect(()=>{
  const timer=globalThis.setInterval(()=>{
   const active=projection.current.active(activeRef.current,performance.now());
   if(active.length===activeRef.current.length)return;
   const ids=new Set(active.map(action=>action.deliveryId)),old=activeRef.current.filter(action=>!ids.has(action.deliveryId));
   setRestoring(values=>[...values,...old]);activeRef.current=active;setActions(active);
  },250);return()=>clearInterval(timer);
 },[]);
 useEffect(()=>{if(actions.length<2||paused||!ready)return;const timer=globalThis.setInterval(()=>setIndex(value=>value+1),5000);return()=>clearInterval(timer);},[actions.length,paused,ready]);
 const active=actions[index%Math.max(1,actions.length)];
 const card=useRef<HTMLElement>(null);
 useEffect(()=>{
  if(!active||paused||!ready)return;let second=0,cancelled=false;
  const first=requestAnimationFrame(()=>{second=requestAnimationFrame(()=>{
   if(cancelled||!hasVisibleBaseFrame()||current.current.paused||!current.current.ready||!activeRef.current.some(value=>value.deliveryId===active.deliveryId&&value.contentHash===active.contentHash&&value.actionRevision===active.actionRevision)||projection.current.remaining(active,performance.now())<=0)return;
   const element=card.current;if(!element||element.dataset.matchdayDelivery!==active.deliveryId||element.dataset.matchdayContentHash!==active.contentHash)return;
   const bounds=element.getBoundingClientRect();if(bounds.width<=0||bounds.height<=0||bounds.bottom<=0||bounds.right<=0||bounds.top>=innerHeight||bounds.left>=innerWidth)return;
   for(let node:HTMLElement|null=element;node;node=node.parentElement){const style=getComputedStyle(node);if(style.display==='none'||style.visibility==='hidden'||Number(style.opacity)===0)return;}
   const top=document.elementFromPoint(bounds.left+bounds.width/2,bounds.top+bounds.height/2);if(!top||!element.contains(top))return;
   element.dataset.matchdayFrame='verified';acknowledge(active,'rendered');
  });});return()=>{cancelled=true;cancelAnimationFrame(first);cancelAnimationFrame(second);};
 },[active,paused,ready,acknowledge,visibilityVersion]);
 useEffect(()=>{
  if(!restoring.length||!ready||paused)return;let second=0;
  const first=requestAnimationFrame(()=>{second=requestAnimationFrame(()=>{
   if(!current.current.ready||current.current.paused||!hasVisibleBaseFrame())return;
   const visible=new Set(activeRef.current.map(action=>action.deliveryId));
   for(const action of restoring)if(!visible.has(action.deliveryId))acknowledge(action,'restored',projection.current.remaining(action,performance.now())<=0?'EXPIRED':'ENDED');
   setRestoring(values=>values.filter(action=>visible.has(action.deliveryId)));
  });});return()=>{cancelAnimationFrame(first);cancelAnimationFrame(second);};
 },[restoring,ready,paused,acknowledge,visibilityVersion]);
 if(!active||paused||!ready)return null;
 return <aside ref={card} className={styles.card} data-matchday-delivery={active.deliveryId} data-matchday-content-hash={active.contentHash} data-matchday-frame="preparing" aria-label="Actuele wedstrijddagmelding"><p>{active.homeTeamName} · {active.awayTeamName}</p><strong>{active.kind==='field'?`Veld ${active.field}`:active.kind==='cancelled'?'Wedstrijd afgelast':'Wedstrijd uitgesteld'}</strong>{active.kind==='postponed'&&active.newKickoffAt?<p>Nieuwe aanvang: {formatMatchdayKickoff(active.newKickoffAt,envelope.branding?.timezone)}</p>:null}</aside>;
}
