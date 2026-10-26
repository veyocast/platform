import {type SyncDynamicConfiguration,type PlayerDynamicTemplateAsset}from'../../packages/contracts/src/index';
import {menuDomFixtureJob}from'./menu-dom-fixture';
import {prepareSyncDynamicDescriptor}from'../../apps/media-worker/src/sync-dynamic-render';
import {dynamicRenderStoragePath}from'../../apps/media-worker/src/dynamic-render-backend';

/** Cross-application transport fixtures belong outside application packages. */
export function sourceRefreshDescriptorFixture(configuration:SyncDynamicConfiguration,data:Record<string,unknown>,assets:Record<string,PlayerDynamicTemplateAsset>,ids:{tenantId?:string;templateVersionId?:string}={}){
 const original=menuDomFixtureJob(configuration.seed.orientation);
 const job={...original,...ids,templateSlug:'rss-refresh',manifest:{...original.manifest,slideType:configuration.slideType},snapshotData:data};
 const prepared=prepareSyncDynamicDescriptor({job,assets});
 return{job,prepared,path:dynamicRenderStoragePath(job,prepared.dom.mimeType,prepared.checksumSha256)};
}
