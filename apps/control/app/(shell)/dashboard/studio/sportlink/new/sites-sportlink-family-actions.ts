"use server";
import { requireTenantControlSession } from "../../../../../../lib/control-session";
import { createControlSupabaseClient } from "../../../../../../lib/supabase/server";
import { canonicalSitesSportlinkFamilyConfiguration, parseSitesSportlinkFamilyDraft } from "./sites-sportlink-family-model";
import { loadCanonicalSitesSportlinkPreview } from "./sites-sportlink-preview-data";
const uuid=(value:string)=>/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
export async function previewSitesSportlinkFamily(sourceId:string,value:unknown){
 await requireTenantControlSession("tenant.dynamic_slide.write");const draft=parseSitesSportlinkFamilyDraft(value);
 if(!draft||!uuid(sourceId))return {ok:false as const,message:"Kies een beschikbare bron, familie, teams en schermformaat."};
 return loadCanonicalSitesSportlinkPreview({sourceId,name:draft.name,templateVersionId:draft.templateVersionId,configuration:canonicalSitesSportlinkFamilyConfiguration(draft),orientation:draft.configuration.sitesConfiguration.orientation,expectedSlideType:draft.family});
}
export async function createSitesSportlinkFamily(sourceId:string,value:unknown,idempotencyKey:string):Promise<{ok:true;slideId:string;snapshotId:string}|{ok:false;message:string}>{
 const session=await requireTenantControlSession("tenant.dynamic_slide.write");const draft=parseSitesSportlinkFamilyDraft(value);
 if(!draft||!uuid(sourceId)||!uuid(idempotencyKey))return {ok:false,message:"Je selectie is niet meer volledig. Er is niets opgeslagen. Controleer je bron, teams en formaat."};
 try{
 const supabase=await createControlSupabaseClient();if(!supabase||!session.tenantId)return {ok:false,message:"De veilige verbinding is tijdelijk niet beschikbaar. Je ontwerp is niet opgeslagen. Probeer opnieuw."};
 const template=await supabase.from("dynamic_templates").select("slide_type,orientation").eq("status","published").eq("current_published_version_id",draft.templateVersionId).maybeSingle();
 if(template.error||template.data?.slide_type!==draft.family||template.data.orientation!==draft.configuration.sitesConfiguration.orientation)return {ok:false,message:"Dit template past niet meer bij je familie of formaat. Er is niets opgeslagen. Kies een beschikbaar formaat en probeer opnieuw."};
 const {data,error}=await supabase.rpc("create_sites_sportlink_family_v1",{p_tenant_id:session.tenantId,p_data_source_id:sourceId,p_name:draft.name,p_template_version_id:draft.templateVersionId,p_configuration:draft.configuration,p_idempotency_key:idempotencyKey});
 if(error||!data||typeof data!=="object")return {ok:false,message:error?.code==="55000"?"Deze module is nog niet actief of gesynchroniseerd. Je ontwerp is niet opgeslagen. Controleer de Sportlink-bron en probeer opnieuw.":"Het ontwerp kon niet veilig worden opgeslagen. Je selectie blijft staan. Controleer de bronstatus en probeer opnieuw."};
 const result=data as Record<string,unknown>;if(typeof result.slideId!=="string"||!uuid(result.slideId)||typeof result.snapshotId!=="string"||!uuid(result.snapshotId))return {ok:false,message:"Het opslaan is nog niet bevestigd. Probeer opnieuw; dezelfde sleutel voorkomt dubbele ontwerpen."};
 return {ok:true,slideId:result.slideId,snapshotId:result.snapshotId};
 }catch{return {ok:false,message:"De verbinding werd onderbroken. Probeer opnieuw om het opslaan met dezelfde sleutel te controleren."};}
}
