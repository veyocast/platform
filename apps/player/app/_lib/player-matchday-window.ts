import type{PlayerManifestEnvelope}from"./player-manifest";
import{screenCompositionDataIdentity,screenCompositionIdentity}from"./player-screen-composition";
import{assertSyncDynamicEnvelopeContinuity}from"./sync-player-assets";

export const matchdayExpiryHeader="X-VeyoCast-Matchday";
export const matchdayRequestHeader="X-VeyoCast-Matchday-Request";
export const matchdayExpiryVersion="matchday-expiry-v1";
export type PlayerMatchdayWindow={schemaVersion:1;publicationId:string;targetId:string;windowId:string;contentHash:string;startsAt:string;expiresAt:string;serverTime:string;requestId:string;compositionHash?:string|null;fallbackCompositionHash?:string|null;ordinaryCompositionHash?:string|null;fallback:PlayerManifestEnvelope;ordinary:PlayerManifestEnvelope};
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
export function supportsMatchdayExpiry(){return typeof window!=="undefined"&&typeof performance!=="undefined"&&typeof performance.now==="function"&&typeof crypto!=="undefined"&&typeof crypto.randomUUID==="function"&&typeof crypto.subtle?.digest==="function"&&typeof indexedDB!=="undefined"&&typeof caches!=="undefined"&&typeof caches.open==="function"&&"serviceWorker"in navigator;}

/** A fallback is a complete ordinary publication for this exact credential
 * binding. Recursive windows and temporal child zones are never accepted. */
export function assertMatchdayWindowEnvelope(envelope:PlayerManifestEnvelope){
 const window=envelope.matchdayWindow;if(!window)return;
 if(window.schemaVersion!==1||![window.publicationId,window.targetId,window.windowId,window.requestId].every(value=>typeof value==="string"&&uuid.test(value))||!/^[a-f0-9]{64}$/.test(window.contentHash))throw Error("MATCHDAY_WINDOW_INVALID");
 const start=Date.parse(window.startsAt),end=Date.parse(window.expiresAt),server=Date.parse(window.serverTime);
 if(!Number.isFinite(start)||!Number.isFinite(end)||!Number.isFinite(server)||end<=start||end-start>48*60*60_000)throw Error("MATCHDAY_WINDOW_INVALID");
 for(const [body,hash]of [[envelope,window.compositionHash],[window.fallback,window.fallbackCompositionHash],[window.ordinary,window.ordinaryCompositionHash]]as const)if(body?.composition&&(typeof hash!=="string"||!/^[a-f0-9]{64}$/.test(hash)))throw Error("MATCHDAY_COMPOSITION_IDENTITY_INVALID");
 for(const fallback of [window.fallback,window.ordinary]){
 if(!fallback?.manifest||fallback.matchdayWindow||fallback.manifest.tenantId!==envelope.manifest.tenantId||fallback.device.id!==envelope.device.id||fallback.device.screenId!==envelope.device.screenId||!fallback.manifest.releaseId||fallback.device.desiredReleaseId!==fallback.manifest.releaseId)throw Error("MATCHDAY_FALLBACK_BINDING_INVALID");
 if([...Object.values(envelope.composition?.zones??{}),...Object.values(fallback.composition?.zones??{})].some(zone=>Boolean(zone.matchdayWindow)||Boolean(zone.composition)))throw Error("MATCHDAY_RECURSIVE_WINDOW");
 }
}

export function matchdayWindowIdentity(envelope:PlayerManifestEnvelope){
 const window=envelope.matchdayWindow;if(!window)return"ordinary";
 return JSON.stringify([window.publicationId,window.targetId,window.windowId,window.contentHash,window.startsAt,window.expiresAt,window.compositionHash??null,window.fallbackCompositionHash??null,window.ordinaryCompositionHash??null,window.fallback.manifest.releaseId,window.fallback.manifest.manifestHash,screenCompositionIdentity(window.fallback),screenCompositionDataIdentity(window.fallback),window.ordinary.manifest.releaseId,window.ordinary.manifest.manifestHash,screenCompositionIdentity(window.ordinary),screenCompositionDataIdentity(window.ordinary)]);
}

/** Recovery publications remain independently revisioned. A fresh temporary
 * response must not replace either verified recovery set with older facts. */
export function assertMatchdayWindowContinuity(previous:PlayerManifestEnvelope,next:PlayerManifestEnvelope){
 assertSyncDynamicEnvelopeContinuity(previous,next);
 const before=previous.matchdayWindow,after=next.matchdayWindow;
 for(const old of [previous,...(before?[before.ordinary,before.fallback]:[])])for(const fresh of [next,...(after?[after.ordinary,after.fallback]:[])])assertSyncDynamicEnvelopeContinuity(old,fresh);
}

/** Boot cannot recover the preceding session's monotonic clock. A cached
 * temporal publication therefore starts with its already verified fallback;
 * only a fresh nonce-bound authorized response may enable a new deadline. */
export function matchdayColdBootEnvelope(envelope:PlayerManifestEnvelope){assertMatchdayWindowEnvelope(envelope);return envelope.matchdayWindow?.ordinary??envelope;}

export class PlayerMatchdayClock{
 private readonly deadlines=new Map<string,number>();
 private readonly ended=new Set<string>();
 observe(envelope:PlayerManifestEnvelope,requestId:string,requestStartedAt:number,now:number){
  assertMatchdayWindowEnvelope(envelope);const window=envelope.matchdayWindow;if(!window)return;
  if(window.requestId!==requestId||!Number.isFinite(requestStartedAt)||!Number.isFinite(now)||now<requestStartedAt)throw Error("MATCHDAY_RESPONSE_UNBOUND");
  const server=Date.parse(window.serverTime),start=Date.parse(window.startsAt),end=Date.parse(window.expiresAt);
  if(server<start||server>=end||this.ended.has(window.windowId)){this.ended.add(window.windowId);throw Error("MATCHDAY_WINDOW_EXPIRED");}
  // Starting at request time subtracts the entire transport delay. Repeated
  // responses for one window can shorten, never extend, its local lifetime.
  const deadline=Math.min(this.deadlines.get(window.windowId)??Infinity,requestStartedAt+end-server);
  this.deadlines.set(window.windowId,deadline);
  if(now>=deadline){this.ended.add(window.windowId);throw Error("MATCHDAY_WINDOW_EXPIRED");}
 }
 expired(envelope:PlayerManifestEnvelope,now:number){
  const window=envelope.matchdayWindow;if(!window)return false;
  const deadline=this.deadlines.get(window.windowId);
  if(this.ended.has(window.windowId)||deadline===undefined||!Number.isFinite(now)||now>=deadline){this.ended.add(window.windowId);return true;}return false;
 }
 remaining(envelope:PlayerManifestEnvelope,now:number){const window=envelope.matchdayWindow;return window?Math.max(0,(this.deadlines.get(window.windowId)??now)-now):Infinity;}
 retire(envelope:PlayerManifestEnvelope){if(envelope.matchdayWindow)this.ended.add(envelope.matchdayWindow.windowId);}
}

/** Browsers may fire a truncated/clamped timeout just before a fractional
 * monotonic deadline. Re-arm that remainder instead of losing expiry forever. */
export function armMatchdayExpiry(clock:PlayerMatchdayClock,envelope:PlayerManifestEnvelope,expire:()=>void,now:()=>number,schedule:(callback:()=>void,delay:number)=>number,cancel:(timer:number)=>void){
 let stopped=false,timer:number|undefined;
 const check=()=>{if(stopped)return;const remaining=clock.remaining(envelope,now());if(remaining>0){timer=schedule(check,Math.max(1,Math.min(2_147_483_647,Math.ceil(remaining))));return;}expire();};
 check();return()=>{stopped=true;if(timer!==undefined)cancel(timer);};
}
