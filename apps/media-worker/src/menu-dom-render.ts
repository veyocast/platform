import {createHash}from'node:crypto';
import {buildSitesPresentationFromDynamicPayload}from'@veyocast/content-templates/sites-dynamic-projector';
import {sitesPresentationPages}from'@veyocast/content-templates/sites-presentation-model';
import {menuDomPresentationSchema,syncDomDescriptorMimeType,type PlayerDynamicTemplateAsset}from'@veyocast/contracts';
import type{ClaimedDynamicRenderJob}from'./dynamic-render-backend';
export function prepareMenuDomDescriptor(job:ClaimedDynamicRenderJob,assets:Record<string,PlayerDynamicTemplateAsset>){
 const presentation=buildSitesPresentationFromDynamicPayload({schemaVersion:1,snapshotId:job.snapshotId,snapshotHash:job.snapshotHash,templateVersionId:job.templateVersionId,templateSlug:job.templateSlug,orientation:job.orientation,slideType:'price_list',data:job.snapshotData,assets});
 const checked=menuDomPresentationSchema.parse(presentation);if(checked.kind!=='dynamic')throw Error('MENU_DOM_PRESENTATION_INVALID');
 const bytes=Buffer.from(JSON.stringify({schemaVersion:2,presentation:checked}));if(bytes.byteLength>550000)throw Error('MENU_DOM_DESCRIPTOR_BOUNDS');
 const durationMs=sitesPresentationPages(checked)*checked.configuration.seconds*1000;if(durationMs<3000||durationMs>3600000)throw Error('MENU_DOM_DURATION_BOUNDS');
 return{bytes,byteLength:bytes.byteLength,checksumSha256:createHash('sha256').update(bytes).digest('hex'),width:job.orientation==='portrait'?1080:1920,height:job.orientation==='portrait'?1920:1080,menuDom:{schemaVersion:2 as const,mimeType:syncDomDescriptorMimeType as typeof syncDomDescriptorMimeType,durationMs,presentation:checked}};
}
