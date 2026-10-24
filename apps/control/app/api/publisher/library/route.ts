import {NextResponse}from"next/server";
import{hasCapability}from"@veyocast/auth";
import{publisherLibraryFilterSchema,publisherMenuPreparationSchema,menuDocumentV2Schema}from"@veyocast/contracts";
import{getControlSession}from"../../../../lib/control-session";
import{createControlSupabaseClient}from"../../../../lib/supabase/server";
import{loadPublisherLibrary}from"../../../(shell)/dashboard/playlists/library";
import{saveMenuStudioCommand,publishMenuStudio}from"../../../(shell)/dashboard/slides/menu-studio/actions";

export const dynamic="force-dynamic";
export async function GET(request:Request){
 const session=await getControlSession();if(!session?.isLive||!session.tenantId)return NextResponse.json({error:"Log opnieuw in om de bibliotheek te openen."},{status:401});
 const parsed=publisherLibraryFilterSchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));if(!parsed.success)return NextResponse.json({error:"De bibliotheekfilters zijn ongeldig."},{status:400});
 const capability=parsed.data.tab==="media"?"tenant.media.read":parsed.data.tab==="studio"?"tenant.studio.read":"tenant.dynamic_slide.read";
 const access={studio:hasCapability(session.capabilities,"tenant.studio.read"),dynamic:hasCapability(session.capabilities,"tenant.dynamic_slide.read")};
 if(parsed.data.tab==="slides"?!access.studio&&!access.dynamic:!hasCapability(session.capabilities,capability))return NextResponse.json({error:"Je hebt geen toestemming voor deze bibliotheek."},{status:403});
 try{const page=await loadPublisherLibrary(session.tenantId,{...parsed.data,favorites:parsed.data.favorites==="true"},access);return NextResponse.json({...page,...(page.sourceState?{sourceState:{...page.sourceState,canPrepare:session.tenantStatus==='active'&&page.sourceState.pendingDraft&&!page.sourceState.processing&&hasCapability(session.capabilities,'tenant.dynamic_slide.write')&&hasCapability(session.capabilities,'tenant.playlist.write')}}:{})},{headers:{"Cache-Control":"private, no-store"}});}catch{return NextResponse.json({error:"De bibliotheek kon niet volledig worden geladen. Je selectie blijft behouden; probeer opnieuw."},{status:503});}
}

/** Explicitly prepares an already saved menu; never accepts catalog prices or
 * publishes a playlist. Existing guarded, revision-aware commands remain authority. */
export async function POST(request:Request){
 const session=await getControlSession();if(!session?.isLive||!session.tenantId)return NextResponse.json({error:'Log opnieuw in om je gewijzigde menu voor te bereiden.'},{status:401});
 if(request.headers.get('origin')!==new URL(request.url).origin||session.tenantStatus!=='active')return NextResponse.json({error:'Deze menu-opdracht is niet toegestaan. Je playlist blijft behouden.'},{status:403});
 if(!hasCapability(session.capabilities,'tenant.dynamic_slide.write')||!hasCapability(session.capabilities,'tenant.playlist.write'))return NextResponse.json({error:'Je hebt geen toestemming om dit menu voor te bereiden. Je playlist blijft behouden.'},{status:403});
 const parsed=publisherMenuPreparationSchema.safeParse(await request.json().catch(()=>null));if(!parsed.success)return NextResponse.json({error:'De menu-opdracht is ongeldig. Kies het ontwerp opnieuw.'},{status:400});
 try{
  const client=await createControlSupabaseClient();if(!client)throw Error('Session unavailable');
  const row=await client.from('dynamic_slides').select('configuration_json,active_draft_version_id').eq('tenant_id',session.tenantId).eq('id',parsed.data.designId).in('slide_type',['menu','price_list']).is('archived_at',null).maybeSingle();
  if(row.error||!row.data)return NextResponse.json({error:'Dit menu is niet beschikbaar binnen je vereniging.'},{status:404});
  if(!row.data.active_draft_version_id)return NextResponse.json({ok:true},{headers:{'Cache-Control':'private, no-store'}});
  const document=menuDocumentV2Schema.safeParse(row.data.configuration_json);if(!document.success||!document.data.sitesConfiguration?.menuWidgets)return NextResponse.json({error:'Open dit menu in Menu Studio om het ontwerp te controleren en voor te bereiden.'},{status:409});
  let revision=document.data.revision;
  if(document.data.sitesConfiguration.themeId==='onzetrots-tv'&&!document.data.sitesConfiguration.onzeTrotsStyle?.startsWith('v10-')){
   const saved=await saveMenuStudioCommand({slideId:parsed.data.designId,command:{baseRevision:revision,operationId:parsed.data.operationId,operation:{kind:'set-sites-configuration',sitesConfiguration:{...document.data.sitesConfiguration,onzeTrotsStyle:(document.data.sitesConfiguration.onzeTrotsStyle?.endsWith('-dark')??document.data.theme.mode==='dark')?'v10-barlow-dark':'v10-barlow-light'}}}});
   if(!saved.ok)return NextResponse.json({error:saved.message},{status:409});revision=saved.document.revision;
  }
  const prepared=await publishMenuStudio({slideId:parsed.data.designId,expectedRevision:revision,operationId:parsed.data.operationId});
  return prepared.ok?NextResponse.json({ok:true},{headers:{'Cache-Control':'private, no-store'}}):NextResponse.json({error:prepared.message},{status:409});
 }catch{return NextResponse.json({error:'De voorbereiding kon niet worden bevestigd. Je opgeslagen menu en playlist blijven behouden. Probeer opnieuw met dezelfde opdracht.'},{status:503});}
}
