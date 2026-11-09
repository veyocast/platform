import {expect,it} from 'vitest';
import {getPlayerManifestForToken,demoOnlineDeviceToken} from './player-manifest';
import {sourceDataNeedsBoundary} from './player-source-data-boundary';
import {screenCompositionDataIdentity} from './player-screen-composition';
import {syncSlidePresentationSchema,type PlayerDynamicTemplateAsset} from '@veyocast/contracts';
function fixture(){const result=getPlayerManifestForToken(demoOnlineDeviceToken);if(!result.ok)throw Error('Existing fixture missing');const envelope=structuredClone(result.body);envelope.manifest.items=[envelope.manifest.items[0]!];envelope.manifest.items[0]!.syncDynamicBinary={schemaVersion:1,configurationSnapshotId:'10000000-0000-4000-8000-000000000231',snapshotId:'20000000-0000-4000-8000-000000000231',templateVersionId:'30000000-0000-4000-8000-000000000231',configurationHash:'a'.repeat(64),contentHash:'b'.repeat(64),fallbackChecksumSha256:envelope.manifest.items[0]!.source.checksumSha256,durationMs:3000};return envelope;}
it('stages changed Source data at a natural boundary and leaves signed-access refreshes alone',()=>{const before=fixture(),access=structuredClone(before);access.manifest.items[0]!.source.url='https://media.example/renewed.mp4';expect(sourceDataNeedsBoundary(before,access)).toBe(false);const next=structuredClone(access);next.manifest.items[0]!.syncDynamicBinary!.contentHash='c'.repeat(64);expect(sourceDataNeedsBoundary(before,next)).toBe(true);expect(next.manifest.releaseId).toBe(before.manifest.releaseId);expect(next.manifest.items.map(item=>item.id)).toEqual(before.manifest.items.map(item=>item.id));});
it('requires full Source preparation when a binary profile gains DOM even with the same data hash',()=>{const before=fixture(),next=structuredClone(before),item=next.manifest.items[0]!;item.syncDynamic={...item.syncDynamicBinary!,presentation:syncSlidePresentationSchema.parse({schemaVersion:1,rendererVersion:'sync-v1',sourceRevision:'8b1fdf1f8637dda23d48ecdaf08e0e5978e2707a',family:'free',orientation:'landscape',theme:'fieldflow',name:'Own design',title:'Own title',club:{name:'Own club'},style:{}}),assets:{}};delete item.syncDynamicBinary;expect(sourceDataNeedsBoundary(before,next)).toBe(true);expect(screenCompositionDataIdentity(before)).not.toBe(screenCompositionDataIdentity(next));});
it('keeps ordinary legacy datasets on their existing independent refresh path',()=>{const before=fixture(),next=structuredClone(before);delete before.manifest.items[0]!.syncDynamicBinary;delete next.manifest.items[0]!.syncDynamicBinary;expect(sourceDataNeedsBoundary(before,next)).toBe(false);});
it('stages historical RSS, menu and Sportlink facts at the existing page/item boundary',()=>{
 for(const slideType of ['news','menu','sport_results']as const){
  const before=fixture(),item=before.manifest.items[0]!;delete item.syncDynamicBinary;
  item.dynamicTemplate={schemaVersion:1,snapshotId:'10000000-0000-4000-8000-000000000295',templateVersionId:'20000000-0000-4000-8000-000000000295',snapshotHash:'b'.repeat(64),templateSlug:'historical-dynamic',orientation:'landscape',slideType,data:{},assets:{}};
  const next=structuredClone(before);next.manifest.items[0]!.dynamicTemplate!.snapshotHash='c'.repeat(64);
  expect(sourceDataNeedsBoundary(before,next)).toBe(true);
  next.manifest.items[0]!.dynamicTemplate!.snapshotHash='b'.repeat(64);next.manifest.items[0]!.source.url='https://media.example/renewed.png';
  expect(sourceDataNeedsBoundary(before,next)).toBe(false);
 }
});
function domFixture(){const value=fixture(),item=value.manifest.items[0]!;item.syncDynamic={...item.syncDynamicBinary!,presentation:syncSlidePresentationSchema.parse({schemaVersion:1,rendererVersion:'sync-v1',sourceRevision:'8b1fdf1f8637dda23d48ecdaf08e0e5978e2707a',family:'free',orientation:'landscape',theme:'fieldflow',name:'Own design',title:'Own title',club:{name:'Own club'},style:{}}),assets:{}};delete item.syncDynamicBinary;return value;}
const media:PlayerDynamicTemplateAsset={bytes:100,checksumSha256:'d'.repeat(64),mimeType:'image/png',url:'https://media.example/original.png'};
it('fully prepares a repaired Source asset set even when canonical data hash and revision are unchanged',()=>{
 const before=domFixture(),next=structuredClone(before);next.manifest.items[0]!.syncDynamic!.assets['10000000-0000-4000-8000-000000000294']=media;
 expect(next.manifest.items[0]!.syncDynamic!.contentHash).toBe(before.manifest.items[0]!.syncDynamic!.contentHash);expect(sourceDataNeedsBoundary(before,next)).toBe(true);expect(screenCompositionDataIdentity(next)).not.toBe(screenCompositionDataIdentity(before));
});
it.each(['checksum','bytes','mime','removed']as const)('stages changed Source media %s independently of the fact hash',change=>{
 const before=domFixture(),key='10000000-0000-4000-8000-000000000294';before.manifest.items[0]!.syncDynamic!.assets[key]={...media};const next=structuredClone(before),asset=next.manifest.items[0]!.syncDynamic!.assets[key]!;
 if(change==='checksum')asset.checksumSha256='e'.repeat(64);else if(change==='bytes')asset.bytes++;else if(change==='mime')asset.mimeType='image/webp';else delete next.manifest.items[0]!.syncDynamic!.assets[key];
 expect(sourceDataNeedsBoundary(before,next)).toBe(true);
});
it('ignores signed-access renewal and asset map order in the Source preparation identity',()=>{
 const before=domFixture(),ids=['10000000-0000-4000-8000-000000000294','20000000-0000-4000-8000-000000000294'];before.manifest.items[0]!.syncDynamic!.assets=Object.fromEntries(ids.map(id=>[id,{...media}]));const next=structuredClone(before);next.manifest.items[0]!.syncDynamic!.assets=Object.fromEntries([...ids].reverse().map(id=>[id,{...media,url:'https://media.example/renewed.png'}]));
 expect(sourceDataNeedsBoundary(before,next)).toBe(false);expect(screenCompositionDataIdentity(next)).toBe(screenCompositionDataIdentity(before));
});
it('stages authorized Menu facts without treating renewed access as a dataset change',async()=>{
 const{menuDomFixtureJob}=await import('../../../../tests/helpers/menu-dom-fixture');const{buildSitesPresentationFromDynamicPayload}=await import('@veyocast/content-templates/sites-dynamic-projector');const{menuDomPlaybackSchema}=await import('@veyocast/contracts');const job=menuDomFixtureJob(),before=fixture(),item=before.manifest.items[0]!;delete item.syncDynamicBinary;
 item.menuDom=menuDomPlaybackSchema.parse({schemaVersion:2,configurationSnapshotId:job.snapshotId,snapshotId:job.snapshotId,templateVersionId:job.templateVersionId,configurationHash:'a'.repeat(64),contentHash:'b'.repeat(64),descriptorChecksumSha256:item.source.checksumSha256,durationMs:12000,dataRevision:1,presentation:buildSitesPresentationFromDynamicPayload({schemaVersion:1,snapshotId:job.snapshotId,snapshotHash:job.snapshotHash,templateVersionId:job.templateVersionId,templateSlug:job.templateSlug,orientation:job.orientation,slideType:'price_list',data:job.snapshotData,assets:{}}),assets:{}});
 const next=structuredClone(before);next.manifest.items[0]!.source.url='https://media.example/renewed.json';expect(sourceDataNeedsBoundary(before,next)).toBe(false);next.manifest.items[0]!.menuDom!.contentHash='c'.repeat(64);next.manifest.items[0]!.menuDom!.dataRevision=2;expect(sourceDataNeedsBoundary(before,next)).toBe(true);
 const repaired=structuredClone(before);repaired.manifest.items[0]!.menuDom!.assets['10000000-0000-4000-8000-000000000294']={...media};expect(sourceDataNeedsBoundary(before,repaired)).toBe(true);
 const access=structuredClone(repaired);access.manifest.items[0]!.menuDom!.assets['10000000-0000-4000-8000-000000000294']!.url='https://media.example/renewed.png';expect(sourceDataNeedsBoundary(repaired,access)).toBe(false);
});
it('accepts complete facts before the affected occurrence has shown a verified frame',()=>{
 const before=fixture(),after=structuredClone(before);after.manifest.items[0]!.syncDynamicBinary!.contentHash='c'.repeat(64);
 expect(sourceDataNeedsBoundary(before,after,()=>false)).toBe(false);
 // A renderer readiness reset cannot erase the independent, already-seen proof.
 expect(sourceDataNeedsBoundary(before,after,()=>true)).toBe(true);
});
it('updates prepared future items without waiting for the different currently visible item',()=>{
 const before=fixture(),future=structuredClone(before.manifest.items[0]!);future.id='future-item';before.manifest.items.push(future);const after=structuredClone(before);after.manifest.items[1]!.syncDynamicBinary!.contentHash='c'.repeat(64);
 expect(sourceDataNeedsBoundary(before,after,(_zone,itemId)=>itemId===before.manifest.items[0]!.id)).toBe(false);
});
it('uses the changed zone own frame evidence while a different zone is still preparing',()=>{
 const before=fixture(),side=fixture();side.manifest.releaseId='10000000-0000-4000-8000-000000000296';
 const ids=['main','side']as const;const envelopes=[before,side];
 before.composition={published:{id:'10000000-0000-4000-8000-000000000297',revision:1,configuration:{schemaVersion:1,layout:'sidebar',orientation:'landscape',mainWidthPercent:70,bottomHeightPercent:20,zones:ids.map((id,index)=>({id,playlistId:envelopes[index]!.manifest.playlistId}))},bindings:ids.map((zoneId,index)=>({zoneId,playlistId:envelopes[index]!.manifest.playlistId,releaseId:envelopes[index]!.manifest.releaseId,publicationId:'10000000-0000-4000-8000-000000000298',configRevision:1}))},zones:{side}};
 const after=structuredClone(before);after.composition!.zones.side!.manifest.items[0]!.syncDynamicBinary!.contentHash='c'.repeat(64);
 expect(sourceDataNeedsBoundary(before,after,zone=>zone==='side')).toBe(true);
 expect(sourceDataNeedsBoundary(before,after,zone=>zone==='main')).toBe(false);
 after.composition!.zones.side!.manifest.items[0]!.syncDynamicBinary!.contentHash=side.manifest.items[0]!.syncDynamicBinary!.contentHash;after.manifest.items[0]!.syncDynamicBinary!.contentHash='d'.repeat(64);
 expect(sourceDataNeedsBoundary(before,after,zone=>zone==='side')).toBe(false);
});
it('tracks revisioned historical facts and verified resources without treating signed access as new content',()=>{
 const before=fixture(),item=before.manifest.items[0]!;delete item.syncDynamicBinary;
 const snapshot='10000000-0000-4000-8000-000000000627',template='20000000-0000-4000-8000-000000000627';
 item.dynamicTemplate={schemaVersion:1,snapshotId:snapshot,templateVersionId:template,snapshotHash:'b'.repeat(64),templateSlug:'historical-menu',orientation:'landscape',slideType:'price_list',data:{},assets:{}};
 item.dynamicData={schemaVersion:1,configurationSnapshotId:snapshot,snapshotId:snapshot,templateVersionId:template,configurationHash:'a'.repeat(64),contentHash:'b'.repeat(64),dataRevision:1};
 const access=structuredClone(before);access.manifest.items[0]!.source.url='https://media.example/renewed.png';expect(sourceDataNeedsBoundary(before,access)).toBe(false);
 const next=structuredClone(before);next.manifest.items[0]!.dynamicData!.dataRevision=2;expect(sourceDataNeedsBoundary(before,next)).toBe(true);
 const repaired=structuredClone(before);repaired.manifest.items[0]!.dynamicTemplate!.assets!['30000000-0000-4000-8000-000000000627']={...media};expect(sourceDataNeedsBoundary(before,repaired)).toBe(true);
 const binary=structuredClone(before);binary.manifest.items[0]!.source.checksumSha256='f'.repeat(64);expect(sourceDataNeedsBoundary(before,binary)).toBe(true);
});
