import {NextResponse}from"next/server";
import{hasCapability}from"@veyocast/auth";
import{publisherLibraryFilterSchema}from"@veyocast/contracts";
import{getControlSession}from"../../../../lib/control-session";
import{loadPublisherLibrary}from"../../../(shell)/dashboard/playlists/library";

export const dynamic="force-dynamic";
export async function GET(request:Request){
 const session=await getControlSession();if(!session?.isLive||!session.tenantId)return NextResponse.json({error:"Log opnieuw in om de bibliotheek te openen."},{status:401});
 const parsed=publisherLibraryFilterSchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));if(!parsed.success)return NextResponse.json({error:"De bibliotheekfilters zijn ongeldig."},{status:400});
 const capability=parsed.data.tab==="media"?"tenant.media.read":parsed.data.tab==="studio"?"tenant.studio.read":"tenant.dynamic_slide.read";
 if(!hasCapability(session.capabilities,capability))return NextResponse.json({error:"Je hebt geen toestemming voor deze bibliotheek."},{status:403});
 try{return NextResponse.json(await loadPublisherLibrary(session.tenantId,{...parsed.data,favorites:parsed.data.favorites==="true"}),{headers:{"Cache-Control":"private, no-store"}});}catch{return NextResponse.json({error:"De bibliotheek kon niet volledig worden geladen. Je selectie blijft behouden; probeer opnieuw."},{status:503});}
}
