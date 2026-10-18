"use server";
import { hasCapability } from "@veyocast/auth";
import { requireTenantControlSession } from "../../../../lib/control-session";
import { createControlSupabaseClient } from "../../../../lib/supabase/server";
/** Draft HTML is already previewable. Prepare only missing compatibility media. */
export async function preparePublisherStudioSeries(input: {
    seriesId: string;
    revision: number;
    members: Array<{
        id: string;
        draftRevision: number;
        motion: boolean;
    }>;
    key: string;
}) {
    const session = await requireTenantControlSession("tenant.studio.read");
    const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
    if (!session.isLive || !session.tenantId || !uuid.test(input.seriesId) || !uuid.test(input.key) || !Number.isSafeInteger(input.revision) || !input.members.length || input.members.length > 20 || input.members.some(m => !uuid.test(m.id) || !Number.isSafeInteger(m.draftRevision)))
        return { ok: false as const, error: "De ontwerpselectie is ongeldig. Vernieuw de bibliotheek en kies opnieuw." };
    if (!hasCapability(session.capabilities, "tenant.studio.render"))
        return { ok: false as const, error: "Dit ontwerp heeft nog geen afspeelfallback. Vraag een beheerder met Studio-renderrechten om het gereed te maken." };
    const client = await createControlSupabaseClient();
    if (!client)
        return { ok: false as const, error: "Je sessie ontbreekt. Log opnieuw in; je selectie blijft behouden." };
    const result = await client.rpc("prepare_publisher_studio_series_v1", { p_series_id: input.seriesId, p_expected_revision: input.revision, p_members: input.members.map(member => ({ id: member.id, draftRevision: member.draftRevision })), p_idempotency_key: input.key });
    if (result.error)
        return { ok: false as const, error: result.error.code === "40001" ? "Het ontwerp is intussen gewijzigd. Vernieuw de bibliotheek voordat je het toevoegt." : "Het ontwerp kon niet voor offline afspelen worden voorbereid. Je selectie blijft behouden; probeer opnieuw." };
    const jobs = (result.data as {
        jobs?: Array<{
            projectId: string;
            jobId: string;
        }>;
    } | null)?.jobs;
    if (!jobs || jobs.length !== input.members.length || jobs.some((job, index) => job.projectId !== input.members[index]?.id || !uuid.test(job.jobId)))
        return { ok: false as const, error: "De server heeft de voorbereiding niet volledig bevestigd. Je selectie blijft behouden; controleer de bibliotheek." };
    return { ok: true as const, jobs };
}

export async function preparePublisherSyncProject(input:{projectId:string;draftRevision:number;key:string}){
 const session=await requireTenantControlSession('tenant.studio.read');
 const uuid=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
 if(!session.isLive||!session.tenantId||!uuid.test(input.projectId)||!uuid.test(input.key)||!Number.isSafeInteger(input.draftRevision)||input.draftRevision<0)return {ok:false as const,error:'De Source-selectie is ongeldig. Vernieuw de bibliotheek en kies opnieuw.'};
 if(!hasCapability(session.capabilities,'tenant.studio.render'))return {ok:false as const,error:'Dit ontwerp heeft nog geen afspeelfallback. Vraag een beheerder met Studio-renderrechten om het gereed te maken.'};
 const client=await createControlSupabaseClient();if(!client)return {ok:false as const,error:'Je sessie ontbreekt. Log opnieuw in; je selectie blijft behouden.'};
 const result=await client.rpc('prepare_publisher_sync_project_v1',{p_project_id:input.projectId,p_expected_draft_revision:input.draftRevision,p_idempotency_key:input.key});
 if(result.error)return {ok:false as const,error:result.error.code==='40001'?'Het Source-ontwerp is intussen gewijzigd. Vernieuw de bibliotheek voordat je het toevoegt.':'Het Source-ontwerp kon niet voor offline afspelen worden voorbereid. Je selectie blijft behouden; probeer opnieuw.'};
 const value=result.data as {projectId?:string;jobId?:string}|null;
 if(value?.projectId!==input.projectId||!value.jobId||!uuid.test(value.jobId))return {ok:false as const,error:'De server heeft de Source-voorbereiding niet volledig bevestigd. Je selectie blijft behouden; controleer de bibliotheek.'};
 return {ok:true as const,jobs:[{projectId:input.projectId,jobId:value.jobId}]};
}
