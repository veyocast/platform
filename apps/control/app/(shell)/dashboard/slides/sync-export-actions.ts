'use server';
import {readSyncDynamicArtifact}from'@veyocast/contracts';
import {requireTenantControlSession}from'../../../../lib/control-session';
import {createControlSupabaseClient}from'../../../../lib/supabase/server';
const uuid=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
export type SyncExportResult={status:'preparing'}|{status:'ready';url:string;video:boolean}|{status:'failed';message:string;retrySame?:boolean};
const failed=():SyncExportResult=>({status:'failed',message:'De download kon niet worden voorbereid. Je ontwerp en uitzending blijven beschikbaar. Probeer de download opnieuw.'});
export async function readSyncExportAction(snapshotId:string):Promise<SyncExportResult>{
 const session=await requireTenantControlSession('tenant.dynamic_slide.read'),client=await createControlSupabaseClient();
 if(!session.isLive||!session.tenantId||!client||!uuid.test(snapshotId))return failed();
 const result=await client.rpc('read_sync_export_v2',{p_tenant_id:session.tenantId,p_snapshot_id:snapshotId});
 const value=result.data as {status?:string;configuration?:unknown;artifact?:unknown}|null;
 if(result.error||!value)return failed();
 if(value.status==='preparing')return{status:'preparing'};
 if(value.status!=='ready')return failed();
 const parsed=readSyncDynamicArtifact(value.configuration,value.artifact);
 if(!parsed)return failed();
 const path=parsed.artifact.storagePath,prefix=`tenants/${session.tenantId}/assets/`;
 const suffix=path.startsWith(prefix)?path.slice(prefix.length):'';
 const parts=/^([a-f0-9-]{36})\/sync-dynamic\/([a-f0-9-]{36})-([a-f0-9]{64})\.(png|mp4)$/.exec(suffix);
 if(!parts||!uuid.test(parts[1]!)||!uuid.test(parts[2]!)||parts[3]!==parsed.artifact.checksumSha256||parts[4]!== (parsed.artifact.mimeType==='video/mp4'?'mp4':'png'))return failed();
 const signed=await client.storage.from('tenant-media').createSignedUrl(path,600,{download:`Source-ontwerp.${parts[4]}`});
 return signed.error||!signed.data?.signedUrl?failed():{status:'ready',url:signed.data.signedUrl,video:parsed.artifact.mimeType==='video/mp4'};
}
export async function requestSyncExportAction(input:{snapshotId:string;idempotencyKey:string}):Promise<SyncExportResult>{
 const session=await requireTenantControlSession('tenant.dynamic_slide.write'),client=await createControlSupabaseClient();
 if(!session.isLive||!session.tenantId||!client||!input||!uuid.test(input.snapshotId)||!uuid.test(input.idempotencyKey))return failed();
 const result=await client.rpc('request_sync_export_v2',{p_tenant_id:session.tenantId,p_snapshot_id:input.snapshotId,p_idempotency_key:input.idempotencyKey});
 if(result.error)return failed();
 return readSyncExportAction(input.snapshotId);
}
