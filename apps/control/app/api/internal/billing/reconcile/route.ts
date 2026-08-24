import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { getMollieClient, requireBillingWorker } from "../../../../../lib/billing/mollie-server";
import { verifyMolliePayment } from "../../../../../lib/billing/verify-mollie-payment";
import { createControlAdminClient } from "../../../../../lib/supabase/admin";

export async function POST(request:Request){
  if(!requireBillingWorker(request))return NextResponse.json({error:"unauthorized"},{status:401});
  const admin=createControlAdminClient();
  const {mode}=getMollieClient();
  const startedAt=new Date();
  const {data:run}=await admin.from("billing_reconciliation_runs").insert({provider_mode:mode,window_end:startedAt.toISOString(),window_start:new Date(startedAt.getTime()-7*86_400_000).toISOString()}).select("id").single();
  const {data:attempts}=await admin.from("billing_payment_attempts").select("id,tenant_id,mollie_payment_id,provider_status").eq("provider_mode",mode).in("provider_status",["created","open","pending","authorized","paid"]).not("mollie_payment_id","is",null).limit(250);
  let checked=0,mismatches=0;
  for(const attempt of attempts??[]){
    try{
      const verification=await verifyMolliePayment({attemptId:attempt.id,channel:"reconcile",requestBody:`reconcile:${attempt.id}:${startedAt.toISOString()}`,tenantId:attempt.tenant_id});
      checked+=1;if(!verification.found)throw new Error("BillingReconciliationMissingPayment");
    }catch(error){mismatches+=1;if(run)await admin.from("billing_reconciliation_items").insert({expected_hash:createHash("sha256").update(`${attempt.id}:${attempt.provider_status}`).digest("hex"),mismatch_type:error instanceof Error?error.name:"BillingReconciliationError",payment_attempt_id:attempt.id,run_id:run.id,tenant_id:attempt.tenant_id});}
  }
  if(run)await admin.from("billing_reconciliation_runs").update({checked_count:checked,finished_at:new Date().toISOString(),mismatch_count:mismatches,status:mismatches?"diverged":"healthy"}).eq("id",run.id);
  return NextResponse.json({checked,mismatches,ok:mismatches===0});
}
