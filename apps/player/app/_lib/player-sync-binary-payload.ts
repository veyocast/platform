import {readSyncDynamicArtifact,syncDynamicBinaryPlaybackSchema} from '@veyocast/contracts';
import type {readSyncDynamicReleaseSnapshot} from './player-sync-dynamic-payload';

type Base=ReturnType<typeof readSyncDynamicReleaseSnapshot>;
const object=(value:unknown):value is Record<string,unknown>=>Boolean(value&&typeof value==='object'&&!Array.isArray(value));
const sha=/^[a-f0-9]{64}$/;

/** The service-only reader follows authorization of the original release item.
 * Current data may change its complete delivery bytes; frozen configuration,
 * template and snapshot identities remain those of the original publication. */
export function readSyncPublishedBinaryArtifact(base:Base,value:unknown,tenantId:string){
 if(!object(value)||value.snapshotId!==base.metadata.configurationSnapshotId||typeof value.contentHash!=='string'||!sha.test(value.contentHash)||!Number.isSafeInteger(value.dataRevision)||Number(value.dataRevision)<1)throw Error('SYNC_DYNAMIC_BINARY_INVALID');
 const parsed=readSyncDynamicArtifact(base.configuration,value.artifact);if(!parsed)throw Error('SYNC_DYNAMIC_BINARY_INVALID');
 const artifact=parsed.artifact,prefix=`tenants/${tenantId}/assets/`,relative=artifact.storagePath.startsWith(prefix)?artifact.storagePath.slice(prefix.length):'';
 const match=/^([a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12})\/sync-dynamic\/((?:[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}-)?)([a-f0-9]{64})\.(png|mp4)$/.exec(relative);
 if(!match||match[3]!==artifact.checksumSha256||match[4]!== (artifact.mimeType==='video/mp4'?'mp4':'png')||artifact.poster.storagePath!==prefix+match[1]+'/sync-dynamic/'+match[2]+artifact.poster.checksumSha256+'.png')throw Error('SYNC_DYNAMIC_BINARY_INVALID');
 const metadata:Record<string,unknown>={...base.metadata,schemaVersion:1};delete metadata.descriptorChecksumSha256;
 return{artifact,value:{...base,presentation:artifact.presentation,metadata:syncDynamicBinaryPlaybackSchema.parse({...metadata,contentHash:value.contentHash,dataRevision:Number(value.dataRevision),fallbackChecksumSha256:artifact.checksumSha256,durationMs:artifact.durationMs})}};
}
