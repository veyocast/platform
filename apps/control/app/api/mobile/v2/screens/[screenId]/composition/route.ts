import {mobileScreenCompositionWorkspaceV2Schema,mobileScreenCompositionRequestV2Schema,mobileScreenCompositionResultV2Schema,screenCompositionDraftSchema} from "@veyocast/contracts";
import {getMobileRequestContext,requireMobileTenant,MobileApiContextError,type MobileRequestContext,type MobileTenantContext} from "../../../../../../../lib/mobile-api/context";
import {mobileV2Data} from "../../../../../../../lib/mobile/v2-response";
import {mobileV2Failure} from "../../../../../../../lib/mobile/v2-failure";
import {mobileFailure} from "../../../../../../../lib/mobile-api/response";
import {readMobileV2Body} from "../../../../../../../lib/mobile/read-v2-body";
type RouteContext={params:Promise<{screenId:string}>};
async function scopedScreen(context:MobileRequestContext,tenant:MobileTenantContext,screenId:string){
 const result=await context.supabase.from("screens").select("id,name,orientation,assigned_playlist_id").eq("tenant_id",tenant.id).eq("id",screenId).is("deleted_at",null).maybeSingle();
 if(result.error)throw Error("MOBILE_SCREEN_UNAVAILABLE");
 if(!result.data)throw new MobileApiContextError(404,"NOT_FOUND","Dit scherm hoort niet bij de geselecteerde organisatie.","Kies een scherm vanuit Schermen.",context.requestId);
 return result.data;
}
export async function GET(request:Request,route:RouteContext){try{
 const context=await getMobileRequestContext(request);const tenant=requireMobileTenant(request,context,"tenant.screen.read");requireMobileTenant(request,context,"tenant.playlist.read");const {screenId}=await route.params;const screen=await scopedScreen(context,tenant,screenId);
 const [draft,playlists,publications]=await Promise.all([context.supabase.from("screen_composition_drafts").select("revision,configuration_json").eq("tenant_id",tenant.id).eq("screen_id",screenId).maybeSingle(),context.supabase.from("playlists").select("id,name").eq("tenant_id",tenant.id).neq("status","archived").order("name").limit(1001),context.supabase.from("playlist_publications").select("playlist_id").eq("tenant_id",tenant.id).limit(1001)]);
 if(draft.error||playlists.error||publications.error||(playlists.data?.length??0)>1000||(publications.data?.length??0)>1000)throw Error("MOBILE_SCREEN_CONTENT_UNAVAILABLE");const published=new Set((publications.data??[]).map(value=>value.playlist_id));
 return mobileV2Data(mobileScreenCompositionWorkspaceV2Schema.parse({schemaVersion:2,screen:{id:screen.id,name:screen.name,orientation:screen.orientation,assignedPlaylistId:screen.assigned_playlist_id},draft:{revision:Number(draft.data?.revision??0),configuration:draft.data?screenCompositionDraftSchema.parse(draft.data.configuration_json):null},playlists:(playlists.data??[]).map(value=>({...value,published:published.has(value.id)}))}),context.requestId);
}catch(error){return mobileV2Failure(error);}}
export async function POST(request:Request,route:RouteContext){try{
 const context=await getMobileRequestContext(request);const tenant=requireMobileTenant(request,context,"tenant.screen.manage");requireMobileTenant(request,context,"tenant.playlist.publish");const {screenId}=await route.params;await scopedScreen(context,tenant,screenId);
 const parsed=mobileScreenCompositionRequestV2Schema.safeParse(await readMobileV2Body(request,32768));if(!parsed.success)return mobileFailure({code:"VALIDATION",message:"De indeling of zonecontent is ongeldig.",recovery:"Kies voor iedere zone een gepubliceerde playlist; je invoer blijft behouden.",requestId:context.requestId,status:422});const input=parsed.data;
 const result=await context.supabase.rpc("save_publish_screen_composition_batch_v1",{p_tenant_id:tenant.id,p_targets:[{screenId,expectedDraftRevision:input.expectedDraftRevision,configuration:input.configuration}],p_idempotency_key:input.idempotencyKey});
 if(result.error?.code==="40001"){const current=await context.supabase.from("screen_composition_drafts").select("revision").eq("tenant_id",tenant.id).eq("screen_id",screenId).maybeSingle();if(current.error)throw Error("MOBILE_COMPOSITION_CONFLICT_UNCONFIRMED");return mobileV2Data(mobileScreenCompositionResultV2Schema.parse({outcome:"conflict",actualRevision:Number(current.data?.revision??0)}),context.requestId);}
 if(result.error)throw Error("MOBILE_COMPOSITION_PUBLICATION_UNCONFIRMED");const data=result.data as {outcome?:string;targets?:Array<{screenId:string;outcome:string;compositionId:string;revision:number;actualRevision:number}>}|null;const target=data?.targets?.[0];if(data?.outcome!=="published"||data.targets?.length!==1||target?.screenId!==screenId||target.outcome!=="published")throw Error("MOBILE_COMPOSITION_PUBLICATION_UNCONFIRMED");
 return mobileV2Data(mobileScreenCompositionResultV2Schema.parse({outcome:"published",compositionId:target.compositionId,revision:Number(target.revision),actualRevision:Number(target.actualRevision)}),context.requestId);
}catch(error){return mobileV2Failure(error);}}
