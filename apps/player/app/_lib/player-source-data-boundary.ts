import type {PlayerManifestEnvelope} from './player-manifest';
import {playerItemDataIdentity} from './player-screen-composition';
import {isDynamicPlayerItem} from './player-dynamic-activation';

/** Compare data identity across the authorized main/zone envelopes. Dynamic
 * pages and their complete binary are replaced at an existing natural boundary,
 * including the historical RSS/Menu/Sportlink transport. Fully prepared facts
 * for an occurrence that has never shown a verified frame can start immediately. */
export function sourceDataNeedsBoundary(before:PlayerManifestEnvelope,after:PlayerManifestEnvelope,hasVisibleOccurrence?:(zoneId:string,itemId:string)=>boolean){
 const all=(envelope:PlayerManifestEnvelope)=>[['main',envelope],...Object.entries(envelope.composition?.zones??{})]as Array<[string,PlayerManifestEnvelope]>;
 const previous=new Map(all(before).flatMap(([id,zone])=>zone.manifest.items.map(item=>[`${id}:${zone.manifest.releaseId}:${item.id}`,{source:isDynamicPlayerItem(item),identity:playerItemDataIdentity(item)}]as const)));
 return all(after).some(([id,zone])=>zone.manifest.items.some(item=>{
  const old=previous.get(`${id}:${zone.manifest.releaseId}:${item.id}`);
  return (old?.source||isDynamicPlayerItem(item))&&old?.identity!==playerItemDataIdentity(item)&&(!hasVisibleOccurrence||hasVisibleOccurrence(id,item.id));
 }));
}
