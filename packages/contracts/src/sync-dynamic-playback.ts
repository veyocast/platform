import {z} from 'zod';
import {playerDynamicTemplateAssetSchema} from './dynamic-content';
import {syncSlideAssets,syncSlidePageCount,syncSlidePresentationSchema} from './sync-slide-presentation';

/** Complete verified data presentation; its configuration and content have
 * separate identities. Older dynamic decoders never receive this object. */
const metadata={
 schemaVersion:z.literal(1),configurationSnapshotId:z.uuid(),snapshotId:z.uuid(),templateVersionId:z.uuid(),
 configurationHash:z.string().regex(/^[a-f0-9]{64}$/),contentHash:z.string().regex(/^[a-f0-9]{64}$/),fallbackChecksumSha256:z.string().regex(/^[a-f0-9]{64}$/),
 durationMs:z.number().int().min(3000).max(120000),
 dataRevision:z.number().int().nonnegative().optional(),
};
export const syncDynamicBinaryPlaybackSchema=z.object(metadata).strict();
export type SyncDynamicBinaryPlayback=z.infer<typeof syncDynamicBinaryPlaybackSchema>;
export const syncDynamicPlaybackSchema=z.object({...metadata,presentation:syncSlidePresentationSchema,
 assets:z.record(z.uuid(),playerDynamicTemplateAssetSchema),
 liveMatch:z.object({connectionId:z.uuid(),sourceUpdatedAt:z.iso.datetime({offset:true}).optional(),showClock:z.boolean()}).strict().optional(),
}).strict().superRefine((value,context)=>{
 if(value.liveMatch&&!['scoreboard','goal'].includes(value.presentation.family))context.addIssue({code:'custom',path:['liveMatch'],message:'Een live wedstrijdbinding hoort uitsluitend bij een Source-wedstrijdontwerp.'});
 const pages=syncSlidePageCount(value.presentation),refs=syncSlideAssets(value.presentation).filter(ref=>ref.kind==='tenant');
 if(value.durationMs<pages*3000||value.durationMs%(pages*1000)!==0)context.addIssue({code:'custom',path:['durationMs'],message:'Alle gegevenspagina’s vereisen dezelfde volledige afspeelduur.'});
 if(Object.keys(value.assets).length!==new Set(refs.map(ref=>ref.mediaAssetId)).size||refs.some(ref=>{const actual=value.assets[ref.mediaAssetId];return !actual||actual.checksumSha256!==ref.checksumSha256||!actual.mimeType.startsWith('image/');}))context.addIssue({code:'custom',path:['assets'],message:'De bronpresentatie mist een gecontroleerde afbeelding.'});
});
export type SyncDynamicPlayback=z.infer<typeof syncDynamicPlaybackSchema>;
