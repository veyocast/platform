"use server";
import {hasCapability} from '@veyocast/auth';
import {engagePublicCampaignSchema,syncSlidePresentationSchema} from '@veyocast/contracts';
import {requireTenantControlSession} from '../../../../lib/control-session';
import {createControlSupabaseClient} from '../../../../lib/supabase/server';

async function context(){
 const session=await requireTenantControlSession('tenant.studio.read');
 if(!session.isLive||!session.tenantId||!hasCapability(session.capabilities,'tenant.dynamic_slide.read'))return null;
 const client=await createControlSupabaseClient();if(!client)return null;
 const flag=await client.from('tenant_feature_flags').select('enabled').eq('tenant_id',session.tenantId).eq('flag_key','engage').maybeSingle();
 return !flag.error&&flag.data?.enabled?{client,tenantId:session.tenantId}:null;
}

/** Paginated current-user metadata only. Opening/searching never writes or
 * fetches provider data; private management metrics are not selected. */
export async function readSyncEngageChoicesAction(input:{search:string;offset:number}){
 if(!input||typeof input.search!=='string'||input.search.length>80||!Number.isSafeInteger(input.offset)||input.offset<0||input.offset>10000)return{ok:false,error:'Controleer de zoekterm en open de campagnekeuze opnieuw.'}as const;
 const ctx=await context();if(!ctx)return{ok:false,error:'Engage of je leesrechten zijn niet beschikbaar. Je ontwerp blijft behouden; controleer de vrijgave en je sessie.'}as const;
 const {client,tenantId}=ctx;let query=client.from('engage_campaigns').select('id,public_id,title,status').eq('tenant_id',tenantId).in('status',['scheduled','live','closed']);
 if(input.search.trim())query=query.ilike('title','%'+input.search.trim().replace(/[\\%_]/g,'\\$&')+'%');
 const result=await query.order('title').order('id').range(input.offset,input.offset+50);
 if(result.error)return{ok:false,error:'De campagnes konden niet volledig worden gelezen. Je keuze blijft behouden; probeer opnieuw.'}as const;
 return{ok:true,choices:result.data.slice(0,50).map(value=>({id:value.public_id,title:value.title,status:value.status})),hasMore:result.data.length>50}as const;
}

/** The campaign UUID in Source is its public identity. Its tenant-owned row is
 * resolved before the existing public RPC supplies only publishable facts. */
export async function readSyncEngageSelectionAction(input:{publicId:string}){
 if(!input||typeof input.publicId!=='string'||!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(input.publicId))return{ok:false,error:'Kies een beschikbare campagne binnen deze vereniging.'}as const;
 const ctx=await context();if(!ctx)return{ok:false,error:'Engage of je leesrechten zijn niet beschikbaar. Je vorige keuze blijft behouden; controleer de vrijgave.'}as const;
 const {client,tenantId}=ctx,campaign=await client.from('engage_campaigns').select('id,public_id,title,question,status,result_visibility').eq('tenant_id',tenantId).eq('public_id',input.publicId).in('status',['scheduled','live','closed']).maybeSingle();
 if(campaign.error||!campaign.data)return{ok:false,error:'Deze campagne hoort niet bij een beschikbare bron. Je vorige keuze blijft behouden; vernieuw de lijst.'}as const;
 const row=campaign.data,options=await client.from('engage_options').select('id,label,sort_order').eq('tenant_id',tenantId).eq('campaign_id',row.id).order('sort_order').order('id').limit(25);
 if(options.error||options.data.length<2||options.data.length>24)return{ok:false,error:'Dit Source-ontwerp vereist twee tot vierentwintig volledige keuzes. Je vorige keuze blijft behouden; kies een passende campagne.'}as const;
 let publicCampaign:null|ReturnType<typeof engagePublicCampaignSchema.parse>=null;
 if(row.status!=='scheduled'){
  const result=await client.rpc('get_engage_campaign_public_v1',{p_public_id:row.public_id}),parsed=engagePublicCampaignSchema.safeParse(result.data);
  if(result.error||!parsed.success||parsed.data.id!==row.public_id||parsed.data.options.length!==options.data.length||parsed.data.options.some(option=>!options.data.some(actual=>actual.id===option.id)))return{ok:false,error:'De publieke campagnestatus is niet bevestigd. Je vorige keuze blijft behouden; probeer opnieuw na bronherstel.'}as const;
  publicCampaign=parsed.data;
 }
 let publicUrl:string|undefined;try{const origin=new URL(process.env.NEXT_PUBLIC_APP_URL??'');if(origin.protocol==='https:')publicUrl=new URL('/engage/'+row.public_id,origin.origin).href;}catch{/* Secure hosted origin is supplied by deployment configuration. */}
 if(publicCampaign?.resultsVisible&&(publicCampaign.options.some(option=>option.voteCount===undefined)||publicCampaign.options.reduce((sum,option)=>sum+(option.voteCount??0),0)!==publicCampaign.totalVotes))return{ok:false,error:'De campagneresultaten zijn niet volledig bevestigd. Je vorige keuze blijft behouden; probeer opnieuw.'}as const;
 const poll={optionsPerPage:4,id:row.public_id,title:row.question,status:row.status,visibility:publicCampaign?.resultsVisible?'live':publicCampaign&&!(publicCampaign.resultVisibility==='after_close'&&publicCampaign.status==='live')?'after_vote':row.result_visibility,publicUrl,options:options.data.map(option=>({id:option.id,label:option.label,votes:publicCampaign?.resultsVisible?publicCampaign.options.find(actual=>actual.id===option.id)?.voteCount??0:0}))};
 // Parse the same Source sub-contract used by save/render; no arbitrary public
 // API body or management count reaches the draft.
 const parsed=syncSlidePresentationSchema.shape.poll.safeParse(poll);
 if(!parsed.success)return{ok:false,error:'De campagne past niet volledig in dit Source-ontwerp. Je vorige keuze blijft behouden; controleer de campagne.'}as const;
 return{ok:true,poll:parsed.data!,secureQrAvailable:Boolean(publicUrl)}as const;
}
