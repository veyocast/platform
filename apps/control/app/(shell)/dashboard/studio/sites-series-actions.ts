"use server";
import {createHash} from "node:crypto";
import {revalidatePath} from "next/cache";
import {redirect} from "next/navigation";
import {studioSitesSystemTemplates,createTenantSitesStudioStarter,studioDocumentAssetIds,parseStudioDocument,type StudioDocument} from "@veyocast/studio";
import {requireTenantControlSession} from "../../../../lib/control-session";
import {getVerifiedSitesTenantBrandLogo} from "./sites-tenant-brand";
import {createControlSupabaseClient} from "../../../../lib/supabase/server";

export async function createStudioTvCollection(formData:FormData){
 const session=await requireTenantControlSession("tenant.studio.create");const supabase=await createControlSupabaseClient();
 if(!session.tenantId||!session.isLive||!supabase)redirect("/dashboard/studio?fout=Een%20collectie%20maken%20vereist%20een%20actieve%20vereniging.");
 const orientation=formData.get("orientation")==="portrait"?"portrait":"landscape";const key=uuid(formData.get("idempotencyKey"));
 const brandLogo=await getVerifiedSitesTenantBrandLogo(supabase,session.tenantId);const slides=studioSitesSystemTemplates.filter(template=>template.id.startsWith("sites-v11-tv-")&&template.document.artboard.orientation===orientation).map((template,index)=>{const document=createTenantSitesStudioStarter(template.document,session.tenant,brandLogo);return {name:template.name,document,referencedAssetIds:studioDocumentAssetIds(document),commandKey:childKey(key,String(index))};});
 const {data,error}=await supabase.rpc("create_studio_series_v1",{p_tenant_id:session.tenantId,p_name:"OnzeTrots TV · Clubmuur-collectie",p_slides:slides,p_idempotency_key:key});const result=data as {seriesId?:string}|null;
 if(error||!result?.seriesId)redirect("/dashboard/studio?fout=De%20collectie%20kon%20niet%20worden%20gemaakt.%20Probeer%20opnieuw.");revalidatePath("/dashboard/studio");redirect(`/dashboard/studio/${result.seriesId}`);
}
export async function saveStudioSeriesAction(input:{seriesId:string;expectedRevision:number;slides:{projectId:string|null;expectedDraftRevision:number;document:StudioDocument}[];idempotencyKey:string}){
 await requireTenantControlSession("tenant.studio.read");const supabase=await createControlSupabaseClient();if(!supabase)return {ok:false,error:"Opslaan vereist een actieve verbinding."};
 const seriesId=uuid(input.seriesId),key=uuid(input.idempotencyKey);const revision=integer(input.expectedRevision,1);if(!input.slides.length||input.slides.length>20)return {ok:false,error:"Een reeks bevat 1 tot 20 slides."};
 const slides=input.slides.map((slide,index)=>{const document=parseStudioDocument(slide.document);return {projectId:slide.projectId===null?null:uuid(slide.projectId),expectedDraftRevision:integer(slide.expectedDraftRevision,0),document,referencedAssetIds:studioDocumentAssetIds(document),commandKey:childKey(key,slide.projectId??`new-${index}`)};});
 const {data,error}=await supabase.rpc("save_studio_series_v1",{p_series_id:seriesId,p_expected_revision:revision,p_slides:slides,p_idempotency_key:key});const result=data as {outcome?:string;revision?:number;projectIds?:string[]}|null;
 if(error||result?.outcome!=="saved")return {ok:false,error:error?.code==="40001"||result?.outcome==="conflict"?"Een slide is intussen gewijzigd. Geen enkele wijziging is opgeslagen; laad de serverversie opnieuw.":"De reeks kon niet worden opgeslagen. Je lokale inhoud blijft behouden; probeer opnieuw."};revalidatePath("/dashboard/studio");return {ok:true,revision:result.revision,projectIds:result.projectIds};
}

function uuid(value:unknown):string{if(typeof value!=="string"||! /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value))throw new Error("Ongeldige opdrachtidentiteit.");return value;}
function integer(value:number,minimum:number){if(!Number.isSafeInteger(value)||value<minimum)throw new Error("Ongeldige revisie.");return value;}
function childKey(parent:string,identity:string){const bytes=createHash("sha256").update(`${parent}:${identity}`).digest().subarray(0,16);bytes[6]=((bytes[6]??0)&15)|64;bytes[8]=((bytes[8]??0)&63)|128;const hex=bytes.toString("hex");return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;}
