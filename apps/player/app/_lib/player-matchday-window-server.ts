import"server-only";
import{createHash}from"node:crypto";
import type{PlayerManifestEnvelope}from"./player-manifest";
import{assertMatchdayWindowEnvelope}from"./player-matchday-window";

export type MatchdayBootstrapWindow={publication_id:string;target_id:string;window_id:string;content_hash:string;starts_at:string;expires_at:string;server_time:string;fallback_release_id:string;fallback_data_key:string;fallback_composition:unknown;fallback_composition_hash?:string|null;composition_hash?:string|null;unsupported_composition_hash?:string|null;unsupported_release_id:string;unsupported_data_key:string;unsupported_composition:unknown};
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
export function readMatchdayBootstrapWindow(value:unknown):MatchdayBootstrapWindow|null{
 if(value==null)return null;if(typeof value!=="object"||Array.isArray(value))throw Error("MATCHDAY_BOOTSTRAP_INVALID");const row=value as Record<string,unknown>;
 if(![row.publication_id,row.target_id,row.window_id,row.fallback_release_id,row.unsupported_release_id].every(value=>typeof value==="string"&&uuid.test(value))||typeof row.content_hash!=="string"||!/^[a-f0-9]{64}$/.test(row.content_hash)||typeof row.fallback_data_key!=="string"||row.fallback_data_key.length>20000||typeof row.unsupported_data_key!=="string"||row.unsupported_data_key.length>20000)throw Error("MATCHDAY_BOOTSTRAP_INVALID");
 if(![row.starts_at,row.expires_at,row.server_time].every(value=>typeof value==="string"&&Number.isFinite(Date.parse(value))))throw Error("MATCHDAY_BOOTSTRAP_INVALID");
 if(row.fallback_composition!=null&&(typeof row.fallback_composition_hash!=="string"||!/^[a-f0-9]{64}$/.test(row.fallback_composition_hash)))throw Error("MATCHDAY_BOOTSTRAP_INVALID");
 if(Date.parse(String(row.expires_at))<=Date.parse(String(row.starts_at))||Date.parse(String(row.expires_at))-Date.parse(String(row.starts_at))>48*60*60_000)throw Error("MATCHDAY_BOOTSTRAP_INVALID");return row as unknown as MatchdayBootstrapWindow;
}
export function canUseMatchdayWindow(window:MatchdayBootstrapWindow|null,capable:boolean,requestId:string|null,now:number){return Boolean(window&&capable&&requestId&&uuid.test(requestId)&&Date.parse(window.server_time)>=Date.parse(window.starts_at)&&Date.parse(window.server_time)<Date.parse(window.expires_at)&&now>=Date.parse(window.starts_at)&&now<Date.parse(window.expires_at));}
/** Access observation timestamps and request nonces never change content. */
export function matchdayBootstrapKey(window:MatchdayBootstrapWindow|null,active:boolean){return window?createHash("sha256").update(JSON.stringify([window.publication_id,window.target_id,window.window_id,window.content_hash,window.starts_at,window.expires_at,window.fallback_release_id,window.fallback_data_key,window.fallback_composition,window.fallback_composition_hash??null,window.composition_hash??null,window.unsupported_composition_hash??null,window.unsupported_release_id,window.unsupported_data_key,window.unsupported_composition,active])).digest("hex"):"";}
export function bindMatchdayWindow(body:PlayerManifestEnvelope,fallback:PlayerManifestEnvelope,ordinary:PlayerManifestEnvelope,window:MatchdayBootstrapWindow,requestId:string){
 const bound={...body,matchdayWindow:{schemaVersion:1 as const,publicationId:window.publication_id,targetId:window.target_id,windowId:window.window_id,contentHash:window.content_hash,startsAt:window.starts_at,expiresAt:window.expires_at,serverTime:window.server_time,requestId,compositionHash:window.composition_hash??null,fallbackCompositionHash:window.fallback_composition_hash??null,ordinaryCompositionHash:window.unsupported_composition_hash??null,fallback,ordinary}};
 assertMatchdayWindowEnvelope(bound);return bound;
}
