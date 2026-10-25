import {z} from 'zod';
import {playerDynamicTemplateAssetSchema} from './dynamic-content';
import {syncSlideAssets,syncSlidePageCount,syncSlideMinimumDurationMs,syncSlidePresentationSchema} from './sync-slide-presentation';

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
const presentationFields={presentation:syncSlidePresentationSchema,
 assets:z.record(z.uuid(),playerDynamicTemplateAssetSchema),
 liveMatch:z.object({connectionId:z.uuid(),sourceUpdatedAt:z.iso.datetime({offset:true}).optional(),showClock:z.boolean()}).strict().optional(),
};
export const syncDynamicDomMetadataSchema=syncDynamicBinaryPlaybackSchema.omit({fallbackChecksumSha256:true}).extend({
 schemaVersion:z.literal(2),descriptorChecksumSha256:z.string().regex(/^[a-f0-9]{64}$/),
 dataRevision:z.number().int().positive(),
}).strict();
export type SyncDynamicDomMetadata=z.infer<typeof syncDynamicDomMetadataSchema>;
export const syncDomDescriptorMimeType='application/vnd.veyocast.sync-dom+json';
export const syncDynamicPlaybackSchema=z.discriminatedUnion('schemaVersion',[
 z.object({...metadata,...presentationFields}).strict(),
 syncDynamicDomMetadataSchema.extend(presentationFields).strict(),
]).superRefine((value,context)=>{
 if(value.liveMatch&&!['scoreboard','goal'].includes(value.presentation.family))context.addIssue({code:'custom',path:['liveMatch'],message:'Een live wedstrijdbinding hoort uitsluitend bij een Source-wedstrijdontwerp.'});
 const pages=syncSlidePageCount(value.presentation),refs=syncSlideAssets(value.presentation).filter(ref=>ref.kind==='tenant');
 if(value.durationMs<syncSlideMinimumDurationMs(value.presentation)||value.durationMs%(pages*1000)!==0)context.addIssue({code:'custom',path:['durationMs'],message:'Alle gegevenspagina’s en de volledige ranglijstbeweging vereisen dezelfde volledige afspeelduur.'});
 if(Object.keys(value.assets).length!==new Set(refs.map(ref=>ref.mediaAssetId)).size||refs.some(ref=>{const actual=value.assets[ref.mediaAssetId];return !actual||actual.checksumSha256!==ref.checksumSha256||!actual.mimeType.startsWith('image/');}))context.addIssue({code:'custom',path:['assets'],message:'De bronpresentatie mist een gecontroleerde afbeelding.'});
});
export type SyncDynamicPlayback=z.infer<typeof syncDynamicPlaybackSchema>;
/** A device reports this only after an actual visible v2 frame, independently
 * of configuration publication and successful asset download. */
export const syncDomFrameConfirmationSchema=z.object({schemaVersion:z.literal(2),itemId:z.uuid(),configurationSnapshotId:z.uuid(),dataRevision:z.number().int().positive(),contentHash:z.string().regex(/^[a-f0-9]{64}$/),rendererVersion:z.enum(['sync-v1','sync-onzetrots-v1','sync-onzetrots-v9','sites-v11','sites-v17'])}).strict();
export type SyncDomFrameConfirmation=z.infer<typeof syncDomFrameConfirmationSchema>;

/** Explicit legacy binary decoders confirm their actual verified media frame. */
export const syncBinaryFrameConfirmationSchema=syncDomFrameConfirmationSchema.omit({rendererVersion:true}).extend({schemaVersion:z.literal(1),transport:z.literal('binary')}).strict();
export type SyncBinaryFrameConfirmation=z.infer<typeof syncBinaryFrameConfirmationSchema>;
