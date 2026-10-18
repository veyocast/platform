"use server";
import {hasCapability} from '@veyocast/auth';
import {requireTenantControlSession} from '../../../../lib/control-session';
import {createControlSupabaseClient} from '../../../../lib/supabase/server';

/** Only already verified tenant sources. Listing never validates a provider,
 * changes a source fallback, or persists a Studio/playlist command. */
export async function readSyncYouTubeChoicesAction(input:{search:string;offset:number}){
 if(!input||typeof input.search!=='string'||input.search.length>80||!Number.isSafeInteger(input.offset)||input.offset<0||input.offset>10000)return{ok:false,error:'Controleer de zoekterm en open de videokeuze opnieuw.'}as const;
 const session=await requireTenantControlSession('tenant.studio.read');
 if(!session.isLive||!session.tenantId||!hasCapability(session.capabilities,'tenant.data_source.read'))return{ok:false,error:'Je bronrechten zijn niet beschikbaar. Je ontwerp blijft behouden; controleer je sessie.'}as const;
 const client=await createControlSupabaseClient();if(!client)return{ok:false,error:'De beveiligde verbinding ontbreekt. Probeer de videokeuze opnieuw.'}as const;
 const flag=await client.from('tenant_feature_flags').select('enabled').eq('tenant_id',session.tenantId).eq('flag_key','youtube_integration').maybeSingle();
 if(flag.error||!flag.data?.enabled)return{ok:false,error:'YouTube is nog niet vrijgegeven voor deze vereniging. Je lokale kaart blijft behouden; controleer Bronnen.'}as const;
 let query=client.from('youtube_sources').select('id,title,video_id,playlist_id').eq('tenant_id',session.tenantId).eq('status','active').eq('validation_status','verified').eq('embeddable',true);
 if(input.search.trim())query=query.ilike('title','%'+input.search.trim().replace(/[\\%_]/g,'\\$&')+'%');
 const result=await query.order('title').order('id').range(input.offset,input.offset+50);
 if(result.error)return{ok:false,error:'De gecontroleerde videobronnen konden niet worden gelezen. Je vorige keuze blijft behouden; probeer opnieuw.'}as const;
 return{ok:true,choices:result.data.slice(0,50).map(source=>({id:source.id,title:source.title,url:source.playlist_id?'https://www.youtube.com/playlist?list='+source.playlist_id:'https://www.youtube.com/watch?v='+source.video_id})),hasMore:result.data.length>50}as const;
}
