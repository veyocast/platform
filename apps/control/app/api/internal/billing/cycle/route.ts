import { NextResponse } from "next/server";
import { addUtcBillingMonth } from "@veyocast/domain";
import { requireBillingWorker } from "../../../../../lib/billing/mollie-server";
import { createControlAdminClient } from "../../../../../lib/supabase/admin";

export async function POST(request:Request){
  if(!requireBillingWorker(request))return NextResponse.json({error:"unauthorized"},{status:401});
  const admin=createControlAdminClient();
  const now=new Date();
  await admin.rpc("expire_billing_overrides_v1",{p_now:now.toISOString()});
  await admin.rpc("schedule_billing_dunning_v1",{p_now:now.toISOString()});
  await admin.rpc("advance_billing_entitlements_v1",{p_now:now.toISOString()});
  const {data,error}=await admin.from("billing_subscriptions").select("id,status,trial_ends_at,current_period_end").in("status",["trialing","active","grace"]).limit(100);
  if(error)return NextResponse.json({error:"billing_cycle_unavailable"},{status:503});
  let generated=0;
  for(const subscription of data??[]){
    const startRaw=subscription.current_period_end??subscription.trial_ends_at;
    if(!startRaw)continue;
    const start=new Date(startRaw);
    if(start.getTime()>now.getTime())continue;
    const end=addUtcBillingMonth(start);
    const {error:cycleError}=await admin.rpc("generate_billing_cycle_v1",{p_period_end:end.toISOString(),p_period_start:start.toISOString(),p_subscription_id:subscription.id});
    if(!cycleError)generated+=1;
  }
  return NextResponse.json({generated,ok:true});
}
