"use server";
import {hasCapability} from '@veyocast/auth';
import {revalidatePath} from 'next/cache';
import {requireTenantControlSession} from '../../../../lib/control-session';
import {createControlSupabaseClient} from '../../../../lib/supabase/server';
import {parseSyncStudioSeriesCommand,type SyncStudioSeriesCommand} from './sync-studio-series-command';
type Result={ok:true;seriesId:string;revision:number;projectIds:string[];nextProjectId:string}|{ok:false;error:string;rejected?:boolean;conflict?:boolean};
export async function mutateSyncStudioSeriesAction(input:SyncStudioSeriesCommand):Promise<Result>{
 const session=await requireTenantControlSession('tenant.studio.read');
 if(!session.isLive||!session.tenantId||session.tenantStatus!=='active'||!(hasCapability(session.capabilities,'tenant.studio.edit_all')||hasCapability(session.capabilities,'tenant.studio.edit_own')))return {ok:false,rejected:true,error:'Je hebt geen toestemming om deze reeks te wijzigen. Je invoer blijft behouden; controleer je sessie en rechten.'};
 const value=parseSyncStudioSeriesCommand(input);if(!value)return {ok:false,rejected:true,error:'De reeksopdracht is ongeldig. Open het ontwerp opnieuw; je invoer blijft behouden.'};
 if(['add','duplicate'].includes(value.operation)&&!hasCapability(session.capabilities,'tenant.studio.create'))return {ok:false,rejected:true,error:'Je hebt aanmaakrechten nodig om een slide aan deze reeks toe te voegen.'};
 if(value.operation==='remove'&&!hasCapability(session.capabilities,'tenant.studio.archive'))return {ok:false,rejected:true,error:'Je hebt archiefrechten nodig om een slide uit de reeks te verwijderen.'};
 const client=await createControlSupabaseClient();if(!client)return {ok:false,error:'De beveiligde verbinding ontbreekt. Je opdracht blijft bewaard; bevestig dezelfde opdracht opnieuw zodra je verbonden bent.'};
 const result=await client.rpc('mutate_sync_studio_series_v1',{p_project_id:value.projectId,p_expected_draft_revision:value.draftRevision,p_series_id:value.seriesId,p_expected_series_revision:value.seriesRevision,p_operation:value.operation,p_name:value.name,p_member_ids:value.memberIds,p_idempotency_key:value.idempotencyKey});
 if(result.error)return {ok:false,rejected:['40001','22023','23514','23503','42501','P0002','55000','23505'].includes(result.error.code),conflict:result.error.code==='40001',error:result.error.code==='40001'?'De reeks of het ontwerp is intussen gewijzigd. Je invoer blijft hier; herlaad de actuele reeks voordat je een nieuwe wijziging maakt.':'De reekswijziging is niet bevestigd. Je ontwerpen blijven behouden; controleer je rechten en verbinding en bevestig dezelfde opdracht opnieuw.'};
 const data=result.data as {outcome?:string;seriesId?:string;revision?:number;projectIds?:string[];nextProjectId?:string}|null;
 const uuid=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
 if(data?.outcome!=='applied'||!data.seriesId||!uuid.test(data.seriesId)||!Number.isSafeInteger(data.revision)||Number(data.revision)<1||!Array.isArray(data.projectIds)||!data.projectIds.length||data.projectIds.length>20||data.projectIds.some(id=>typeof id!=='string'||!uuid.test(id))||new Set(data.projectIds).size!==data.projectIds.length||!data.nextProjectId||!data.projectIds.includes(data.nextProjectId))return {ok:false,error:'De server gaf geen volledig ontvangstbewijs voor de reeks. Je opdracht blijft bewaard; bevestig dezelfde opdracht opnieuw.'};
 revalidatePath('/dashboard/studio');revalidatePath('/dashboard/content');revalidatePath('/dashboard/playlists');
 return {ok:true,seriesId:data.seriesId,revision:Number(data.revision),projectIds:data.projectIds,nextProjectId:data.nextProjectId};
}
