import {z}from'zod';
import {playerDynamicTemplateAssetSchema}from'./dynamic-content';
import {sitesPresentationSchema,sitesDynamicConfigurationSchema}from'./sites-presentation';
import {menuDocumentV2Schema}from'./menu-studio';
const sha=z.string().regex(/^[a-f0-9]{64}$/);
export const menuDomPresentationSchema=sitesPresentationSchema.refine(value=>value.kind==='dynamic'&&value.configuration.provider==='menu'&&value.configuration.menuWidgets===true&&Boolean(value.content.menuPages?.length));
export const menuDomMetadataSchema=z.object({schemaVersion:z.literal(2),configurationSnapshotId:z.uuid(),snapshotId:z.uuid(),templateVersionId:z.uuid(),configurationHash:sha,contentHash:sha,descriptorChecksumSha256:sha,durationMs:z.number().int().min(3000).max(3600000),dataRevision:z.number().int().positive()}).strict();
export function menuDomAssetRefs(value:unknown):Array<{kind:'tenant';mediaAssetId:string;checksumSha256:string}>{
 if(!value||typeof value!=='object')return[];if(Array.isArray(value))return value.flatMap(menuDomAssetRefs);
 const entry=value as Record<string,unknown>;if(entry.kind==='tenant'&&typeof entry.mediaAssetId==='string'&&typeof entry.checksumSha256==='string')return[entry as {kind:'tenant';mediaAssetId:string;checksumSha256:string}];
 return Object.values(entry).flatMap(menuDomAssetRefs);
}
export const menuDomPlaybackSchema=menuDomMetadataSchema.extend({presentation:menuDomPresentationSchema,assets:z.record(z.uuid(),playerDynamicTemplateAssetSchema)}).strict().superRefine((value,context)=>{const refs=menuDomAssetRefs(value.presentation),ids=new Set(refs.map(ref=>ref.mediaAssetId));if(Object.keys(value.assets).length!==ids.size||refs.some(ref=>{const asset=value.assets[ref.mediaAssetId];return !asset||asset.checksumSha256!==ref.checksumSha256||!asset.mimeType.startsWith('image/');}))context.addIssue({code:'custom',path:['assets'],message:'Het menu mist een gecontroleerde afbeelding.'});});
export type MenuDomPlayback=z.infer<typeof menuDomPlaybackSchema>;
export const menuDomArtifactSchema=z.object({schemaVersion:z.literal(2),mimeType:z.literal('application/vnd.veyocast.sync-dom+json'),byteLength:z.number().int().min(1).max(550000),checksumSha256:sha,width:z.number().int(),height:z.number().int(),durationMs:z.number().int().min(3000).max(3600000),storagePath:z.string().min(1).max(2048),presentation:menuDomPresentationSchema}).strict();
export const menuBinaryArtifactSchema=menuDomArtifactSchema.extend({mimeType:z.literal('image/png'),byteLength:z.number().int().min(1).max(67108864)}).strict();
export function readMenuDomArtifact(data:unknown,value:unknown){return readMenuArtifact(data,value,false);}
export function readMenuBinaryArtifact(data:unknown,value:unknown){return readMenuArtifact(data,value,true);}
function readMenuArtifact(data:unknown,value:unknown,binary:boolean){
 if(!data||typeof data!=='object'||Array.isArray(data))return null;
 const snapshot=data as Record<string,unknown>,price=snapshot.priceList as {menuDocument?:unknown}|undefined;
 const document=menuDocumentV2Schema.safeParse(snapshot.menuDocument??price?.menuDocument),artifact=(binary?menuBinaryArtifactSchema:menuDomArtifactSchema).safeParse(value);
 if(snapshot.syncPlaybackProtocol!==2||Object.hasOwn(snapshot,'syncConfiguration')||!document.success||!artifact.success||artifact.data.presentation.kind!=='dynamic')return null;
 const configuration=sitesDynamicConfigurationSchema.safeParse(snapshot.sitesConfiguration??document.data.sitesConfiguration);
 if(!configuration.success||JSON.stringify(configuration.data)!==JSON.stringify(artifact.data.presentation.configuration))return null;
 const portrait=configuration.data.orientation==='portrait',pages=artifact.data.presentation.content.menuPages?.length??0;
 if(artifact.data.width!==(portrait?1080:1920)||artifact.data.height!==(portrait?1920:1080)||artifact.data.durationMs!==pages*configuration.data.seconds*1000)return null;
 return{document:document.data,configuration:configuration.data,artifact:artifact.data};
}
