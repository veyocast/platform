import {publishedScreenCompositionSchema,type PublishedScreenComposition} from "@veyocast/contracts";
import type {PlayerManifestEnvelope,PlayerManifestItem} from "./player-manifest";

export type PlayerScreenComposition={published:PublishedScreenComposition;zones:Partial<Record<"side"|"bottom",PlayerManifestEnvelope>>};
export function screenCompositionIdentity(envelope:PlayerManifestEnvelope){return envelope.composition?`${envelope.composition.published.id}:${envelope.composition.published.revision}:${envelope.composition.published.bindings.map(binding=>`${binding.zoneId}:${binding.releaseId}`).join(":")}`:"full";}
/** Access URLs rotate independently. A changed verified resource set still
 * needs full preparation and a natural boundary, including a repaired payload
 * with the same canonical fact hash. Never hydrate new media via access refresh. */
function sourceAssetIdentity(assets:NonNullable<PlayerManifestItem['syncDynamic']>['assets']){return JSON.stringify(Object.entries(assets).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([id,asset])=>[id,asset.checksumSha256,asset.mimeType,asset.bytes,asset.posterChecksumSha256,asset.posterMimeType,asset.posterBytes]));}
export function playerItemDataIdentity(item:PlayerManifestItem){return (item.menuDom?`menu-dom-v2:${item.menuDom.contentHash}:${sourceAssetIdentity(item.menuDom.assets)}`:undefined)??item.dynamicTemplate?.snapshotHash??(item.syncDynamic?`sync-dynamic-v${item.syncDynamic.schemaVersion}:${item.syncDynamic.contentHash}:${sourceAssetIdentity(item.syncDynamic.assets)}`:item.syncDynamicBinary?`sync-dynamic-binary-v1:${item.syncDynamicBinary.contentHash}`:'');}
export function screenCompositionZoneFrameIdentity(envelope:PlayerManifestEnvelope){return `${envelope.manifest.releaseId}:${envelope.manifest.items.map(playerItemDataIdentity).join(':')}`;}
export function screenCompositionDataIdentity(envelope:PlayerManifestEnvelope){return [envelope,...Object.values(envelope.composition?.zones??{})].map(zone=>zone.manifest.items.map(playerItemDataIdentity).join(":")).join("|");}
/** Authorization happens once via the device target; this never accepts a child ID from a request. */
export async function loadAuthorizedScreenComposition({candidate,main,load}:{candidate:unknown;main:PlayerManifestEnvelope;load:(releaseId:string)=>Promise<PlayerManifestEnvelope>}):Promise<PlayerScreenComposition|undefined>{
 if(candidate==null)return undefined;const published=publishedScreenCompositionSchema.parse(candidate);
 const zones:PlayerScreenComposition["zones"]={};
 for(const binding of published.bindings){if(binding.zoneId==="main")continue;const envelope=await load(binding.releaseId);if(envelope.manifest.releaseId!==binding.releaseId||envelope.manifest.tenantId!==main.manifest.tenantId||envelope.device.id!==main.device.id||envelope.device.screenId!==main.device.screenId||envelope.manifest.playlistId!==binding.playlistId||envelope.composition)throw new Error("COMPOSITION_ASSETS_UNAVAILABLE");zones[binding.zoneId]=envelope;}
 return {published,zones};
}
