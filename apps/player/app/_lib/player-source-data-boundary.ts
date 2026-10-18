import type {PlayerManifestEnvelope} from './player-manifest';
import {playerItemDataIdentity} from './player-screen-composition';

/** Compare data identity across the authorized main/zone envelopes. Source
 * pages and their complete binary are replaced at an existing natural boundary. */
export function sourceDataNeedsBoundary(before:PlayerManifestEnvelope,after:PlayerManifestEnvelope){
 const all=(envelope:PlayerManifestEnvelope)=>[envelope,...Object.values(envelope.composition?.zones??{})];
 const previous=new Map(all(before).flatMap(zone=>zone.manifest.items.map(item=>[`${zone.manifest.releaseId}:${item.id}`,{source:Boolean(item.syncDynamic||item.syncDynamicBinary),identity:playerItemDataIdentity(item)}]as const)));
 return all(after).some(zone=>zone.manifest.items.some(item=>{
  const old=previous.get(`${zone.manifest.releaseId}:${item.id}`);
  return (old?.source||Boolean(item.syncDynamic||item.syncDynamicBinary))&&old?.identity!==playerItemDataIdentity(item);
 }));
}
