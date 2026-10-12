import {createHash} from "node:crypto";
import {NextResponse} from "next/server";
import {createPlayerAdminClient} from "../../../../_lib/player-supabase";

/** A device sends this only after its complete verified composition has rendered. */
export async function POST(request:Request){
 const authorization=request.headers.get("authorization");if(!authorization?.toLowerCase().startsWith("bearer ")||! /^[A-Za-z0-9_-]{20,200}$/.test(authorization.slice(7).trim()))return NextResponse.json({error:"INVALID_DEVICE_TOKEN"},{status:401});
 const body=await request.json().catch(()=>null) as {compositionId?:unknown;targetRevision?:unknown}|null;
 if(typeof body?.compositionId!=="string"||! /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.compositionId)||typeof body.targetRevision!=="string"||! /^[0-9]{1,18}$/.test(body.targetRevision))return NextResponse.json({error:"INVALID_COMPOSITION_PROOF"},{status:400});
 try{const result=await createPlayerAdminClient().rpc("acknowledge_player_composition_v1",{p_token_hash:createHash("sha256").update(authorization.slice(7).trim()).digest("hex"),p_composition_id:body.compositionId,p_target_revision:body.targetRevision});if(result.error)return NextResponse.json({error:"PLAYER_API_UNAVAILABLE"},{status:503});return NextResponse.json({acknowledged:result.data===true},{status:result.data===true?200:409});}catch{return NextResponse.json({error:"PLAYER_API_UNAVAILABLE"},{status:503});}
}
