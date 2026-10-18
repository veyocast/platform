'use server';
import {syncDynamicPlacementCommandSchema,syncDynamicPlacementReadSchema,type SyncDynamicPlacementCommand} from '@veyocast/contracts';
import {requireTenantCapability} from '../../../../lib/control-session';
import {createControlSupabaseClient} from '../../../../lib/supabase/server';
import {loadCanonicalSnapshotAssets} from './library';
import {readPublisherSyncDynamic,type PublisherSyncMedia} from './sync-dynamic-library';
import type {SyncDynamicLibraryDesign} from './_components/sites/model';

export type SyncDynamicPlacementResult={ok:true;status:'pending'|'failed';jobId:string}|{ok:true;status:'ready';jobId:string;design:SyncDynamicLibraryDesign}|{ok:false;error:string};
const unavailable='De volledige Source-variant kon niet worden bevestigd. Je playlistwijzigingen blijven behouden; controleer de bron en probeer dezelfde keuze opnieuw.';

export async function prepareSyncDynamicPlacementAction(input:SyncDynamicPlacementCommand):Promise<SyncDynamicPlacementResult>{
 const parsed=syncDynamicPlacementCommandSchema.safeParse(input);
 const session=await requireTenantCapability('tenant.playlist.write','mutate');
 const client=await createControlSupabaseClient();
 if(!parsed.success||!session.isLive||!session.tenantId||!client)return{ok:false,error:unavailable};
 const value=parsed.data,reply=await client.rpc('prepare_sync_dynamic_variant_v1',{p_tenant_id:session.tenantId,p_base_snapshot_id:value.snapshotId,p_theme:value.theme,p_seconds_per_page:value.secondsPerPage,p_idempotency_key:value.idempotencyKey});
 const result=reply.data as {jobId?:string}|null;
 if(reply.error||!result?.jobId)return{ok:false,error:unavailable};
 return readSyncDynamicPlacementAction({jobId:result.jobId});
}

export async function readSyncDynamicPlacementAction(input:{jobId:string}):Promise<SyncDynamicPlacementResult>{
 const parsed=syncDynamicPlacementReadSchema.safeParse(input);
 const session=await requireTenantCapability('tenant.playlist.write','mutate');
 const client=await createControlSupabaseClient();
 if(!parsed.success||!session.isLive||!session.tenantId||!client)return{ok:false,error:unavailable};
 const job=await client.from('dynamic_render_jobs').select('id,status,snapshot_id').eq('tenant_id',session.tenantId).eq('id',parsed.data.jobId).maybeSingle();
 if(job.error||!job.data)return{ok:false,error:unavailable};
 const snapshot=await client.from('dynamic_slide_snapshots').select('id,dynamic_slide_id,dynamic_slide_version_id,template_version_id,source_revision_hash,snapshot_data_json,output_media_asset_id,status,sync_render_result_json').eq('tenant_id',session.tenantId).eq('id',job.data.snapshot_id).maybeSingle();
 if(snapshot.error||!snapshot.data)return{ok:false,error:unavailable};
 const version=await client.from('dynamic_slide_versions').select('id,name,is_source_variant').eq('tenant_id',session.tenantId).eq('id',snapshot.data.dynamic_slide_version_id).eq('is_source_variant',true).maybeSingle();
 if(version.error||!version.data)return{ok:false,error:unavailable};
 if(job.data.status==='failed'||snapshot.data.status==='failed')return{ok:true,status:'failed',jobId:job.data.id};
 if(job.data.status!=='completed'||snapshot.data.status!=='ready')return{ok:true,status:'pending',jobId:job.data.id};
 const media=await client.from('media_assets').select('id,status,kind,mime_type,checksum_sha256,file_size_bytes,duration_seconds,width,height').eq('tenant_id',session.tenantId).eq('id',snapshot.data.output_media_asset_id).is('deleted_at',null).maybeSingle();
 if(media.error||!media.data)return{ok:false,error:unavailable};
 try{
  const assets=await loadCanonicalSnapshotAssets(session.tenantId,[snapshot.data.snapshot_data_json,snapshot.data.sync_render_result_json]);
  const design=readPublisherSyncDynamic({snapshot:snapshot.data,definition:{id:snapshot.data.dynamic_slide_id,name:version.data.name},media:media.data as PublisherSyncMedia,assets});
  return{ok:true,status:'ready',jobId:job.data.id,design};
 }catch{return{ok:false,error:unavailable};}
}
