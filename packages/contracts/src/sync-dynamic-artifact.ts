import {z} from 'zod';
import {syncDynamicConfigurationSchema} from './sync-dynamic-configuration';
import {syncSlidePageCount,syncSlidePresentationSchema,syncSlideDurationMs,syncSlideInternalMotion} from './sync-slide-presentation';
import {syncDomDescriptorMimeType} from './sync-dynamic-playback';

const sha=z.string().regex(/^[a-f0-9]{64}$/),path=z.string().min(1).max(2048);
/** Persisted metadata only. Authorization and canonical-image ownership are
 * enforced by the existing fenced SQL completion before this row is ready. */
export const syncDynamicArtifactSchema=z.object({
 presentation:syncSlidePresentationSchema,width:z.number().int(),height:z.number().int(),
 mimeType:z.enum(['image/png','video/mp4']),byteLength:z.number().int().positive().max(500*1024*1024),
 durationMs:z.number().int().min(3000).max(120000),storagePath:path,checksumSha256:sha,
 poster:z.object({byteLength:z.number().int().positive(),storagePath:path,checksumSha256:sha}).strict(),
}).strict();
export function readSyncDynamicArtifact(configuration:unknown,value:unknown){
 const cfg=syncDynamicConfigurationSchema.safeParse(configuration),artifact=syncDynamicArtifactSchema.safeParse(value);
 if(!cfg.success||!artifact.success)return null;
 const result=artifact.data,pages=syncSlidePageCount(result.presentation),video=pages>1||syncSlideInternalMotion(result.presentation).enabled||['rustig','dynamisch'].includes(result.presentation.style.motion??'geen');
 if(result.presentation.rendererVersion!==cfg.data.rendererVersion||result.presentation.sourceRevision!==cfg.data.sourceRevision||result.presentation.orientation!==cfg.data.seed.orientation||result.presentation.family!==cfg.data.seed.family||result.presentation.theme!==cfg.data.seed.theme||result.durationMs!==syncSlideDurationMs(result.presentation,cfg.data.secondsPerPage)||result.mimeType!==(video?'video/mp4':'image/png')||result.width!==(result.presentation.orientation==='portrait'?1080:1920)||result.height!==(result.presentation.orientation==='portrait'?1920:1080))return null;
 return{configuration:cfg.data,artifact:result};
}
export type SyncDynamicArtifact=z.infer<typeof syncDynamicArtifactSchema>;

/** Version 2 is an immutable, code-free data descriptor, never a whole-slide
 * image or video. Original photographs/fonts remain separate verified assets. */
export const syncDynamicDomArtifactSchema=z.object({
 schemaVersion:z.literal(2),presentation:syncSlidePresentationSchema,
 width:z.number().int(),height:z.number().int(),mimeType:z.literal(syncDomDescriptorMimeType),
 byteLength:z.number().int().positive().max(550000),durationMs:z.number().int().min(3000).max(120000),
 storagePath:path,checksumSha256:sha,
}).strict();
export function readSyncDynamicDomArtifact(configuration:unknown,value:unknown){
 const cfg=syncDynamicConfigurationSchema.safeParse(configuration),artifact=syncDynamicDomArtifactSchema.safeParse(value);
 if(!cfg.success||!artifact.success)return null;
 const result=artifact.data,p=result.presentation;
 if(p.rendererVersion!==cfg.data.rendererVersion||p.sourceRevision!==cfg.data.sourceRevision||p.orientation!==cfg.data.seed.orientation||p.family!==cfg.data.seed.family||p.theme!==cfg.data.seed.theme||result.durationMs!==syncSlideDurationMs(p,cfg.data.secondsPerPage)||result.width!==(p.orientation==='portrait'?1080:1920)||result.height!==(p.orientation==='portrait'?1920:1080))return null;
 return{configuration:cfg.data,artifact:result};
}
export type SyncDynamicDomArtifact=z.infer<typeof syncDynamicDomArtifactSchema>;
