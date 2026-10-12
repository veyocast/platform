"use server";
import {revalidatePath}from"next/cache";
import{requireTenantCapability}from"../../../../lib/control-session";
import{createControlSupabaseClient}from"../../../../lib/supabase/server";

export async function managePlaylistLibrary(input:{action:"duplicate"|"archive"|"restore";targets:Array<{id:string;expectedRevision:number}>;idempotencyKey:string}):Promise<{ok:boolean;message:string;createdIds?:string[]}>{
 if(!['duplicate','archive','restore'].includes(input.action)||!input.targets.length||input.targets.length>100||input.targets.some(target=>!/^[-\da-f]{36}$/i.test(target.id)||!Number.isSafeInteger(target.expectedRevision)||target.expectedRevision<0)||!/^[-\da-f]{36}$/i.test(input.idempotencyKey))return{ok:false,message:'De selectie is ongeldig of te groot. Kies maximaal 100 playlists en probeer opnieuw.'};
 const session=await requireTenantCapability(input.action==='duplicate'?'tenant.playlist.write':'tenant.playlist.archive','mutate');const supabase=await createControlSupabaseClient();
 if(!session.isLive||!session.tenantId||!supabase)return{ok:false,message:'De beveiligde datasessie ontbreekt. Log opnieuw in; er is niets gewijzigd.'};
 const result=await supabase.rpc('mutate_playlist_library_batch_v1',{p_tenant_id:session.tenantId,p_action:input.action,p_targets:input.targets,p_idempotency_key:input.idempotencyKey});
 if(result.error)return{ok:false,message:result.error.code==='40001'?'Een geselecteerde playlist is intussen gewijzigd. Er is niets uit deze actie toegepast. Vernieuw de lijst en controleer je selectie.':result.error.code==='23514'?'Een playlist kan niet worden gearchiveerd terwijl een actief scherm die gebruikt. Er is niets uit deze actie toegepast. Controleer de schermtoewijzingen.':'De server kon deze actie niet veilig uitvoeren. Je selectie blijft behouden; probeer opnieuw.'};
 const saved=result.data as{outcome?:string;count?:number;createdIds?:string[]}|null;
 if(saved?.outcome!=='applied'||saved.count!==input.targets.length)return{ok:false,message:'De server heeft deze actie niet volledig bevestigd. Controleer de lijst voordat je verdergaat.'};
 revalidatePath('/dashboard/playlists');return{ok:true,message:input.action==='duplicate'?`${saved.count} conceptkopieën zijn bevestigd door de server.`:input.action==='restore'?`${saved.count} playlists zijn als concept hersteld.`:`${saved.count} playlists zijn gearchiveerd.`,createdIds:saved.createdIds};
}
