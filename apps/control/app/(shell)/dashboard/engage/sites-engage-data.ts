import "server-only";
import {engagePublicCampaignSchema,type EngagePublicCampaign} from "@veyocast/contracts";
import {createControlSupabaseClient} from "../../../../lib/supabase/server";

/** Only public identities read from the active tenant's RLS workspace are used.
 * The existing public RPC enforces rollout, period and result visibility. */
export async function loadVisibleEngageResults(campaigns:readonly{id:string;public_id:string;status:string}[]):Promise<Record<string,EngagePublicCampaign>>{
 const supabase=await createControlSupabaseClient();const result:Record<string,EngagePublicCampaign>={};if(!supabase)return result;
 const candidates=campaigns.filter(campaign=>["live","closed"].includes(campaign.status)&&/^[0-9a-f-]{36}$/i.test(campaign.public_id)).slice(0,100);
 for(let offset=0;offset<candidates.length;offset+=10)await Promise.all(candidates.slice(offset,offset+10).map(async campaign=>{try{const response=await supabase.rpc("get_engage_campaign_public_v1",{p_public_id:campaign.public_id});const parsed=engagePublicCampaignSchema.safeParse(response.data);if(!response.error&&parsed.success&&parsed.data.id===campaign.public_id)result[campaign.id]=parsed.data;}catch{/* Missing public read access keeps actual counts unknown. */}}));
 return result;
}
