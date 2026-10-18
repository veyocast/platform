import 'server-only';
import {syncDynamicConfigurationSchema,syncSlideAssets} from '@veyocast/contracts';
import {createControlSupabaseClient} from '../../../../lib/supabase/server';
import {loadStudioMediaAssets} from '../studio/data';

export async function loadSyncDynamicEditorData(tenantId:string,slideId:string){
 const client=await createControlSupabaseClient();if(!client)return null;
 const slide=await client.from('dynamic_slides').select('active_draft_version_id,data_source_id').eq('tenant_id',tenantId).eq('id',slideId).neq('status','archived').maybeSingle();
 if(slide.error||!slide.data?.active_draft_version_id)return null;
 const version=await client.from('dynamic_slide_versions').select('id,name,edit_revision,configuration_json,template_version_id,data_source_id,status').eq('tenant_id',tenantId).eq('dynamic_slide_id',slideId).eq('id',slide.data.active_draft_version_id).eq('status','draft').maybeSingle();
 const cfg=syncDynamicConfigurationSchema.safeParse(version.data?.configuration_json?.syncConfiguration);
 if(version.error||!version.data||!cfg.success)return null;
 const source=await client.from('dynamic_data_sources').select('kind').eq('tenant_id',tenantId).eq('id',version.data.data_source_id).single();
 if(source.error)return null;
 const kinds=['menu','price_list'].includes(cfg.data.slideType)?['manual_products','twelve_excel']:[source.data.kind];
 const [sources,templates,media]=await Promise.all([
  client.from('dynamic_data_sources').select('id,name,kind,provider_status,last_successful_sync_at,last_error_code').eq('tenant_id',tenantId).in('kind',kinds).eq('status','active').order('name').limit(200),
  client.from('dynamic_templates').select('current_published_version_id,orientation,slug').eq('slide_type',cfg.data.slideType).eq('status','published').order('slug').limit(100),
  loadStudioMediaAssets(client,tenantId,syncSlideAssets(cfg.data.seed).flatMap(asset=>asset.kind==='tenant'?[asset.mediaAssetId]:[])),
 ]);
 if(sources.error||templates.error)return null;
 return{slideId,versionId:version.data.id,initialRevision:Number(version.data.edit_revision),initialRequest:{templateVersionId:version.data.template_version_id,dataSourceId:version.data.data_source_id,configuration:version.data.configuration_json as Record<string,unknown>},sources:sources.data,templates:templates.data,assets:media.assets,error:media.error};
}
