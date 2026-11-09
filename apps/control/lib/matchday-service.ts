import "server-only";

import { hasCapability, type Capability } from "@veyocast/auth";
import {
  matchdayActionInputSchema, matchdayAvailabilitySchema, matchdayCommandReceiptSchema, matchdayDelegationInputSchema,
  matchdayEndActionInputSchema, matchdayFeatureInputSchema, matchdayLifecycleInputSchema,
  matchdayPreflightSchema, matchdayPublishInputSchema, matchdaySaveDraftInputSchema,
  matchdayWorkspaceSchema, type MatchdayPreflight, type MatchdayWorkspace
} from "@veyocast/contracts";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireControlSession } from "./control-session";
import { createControlSupabaseClient } from "./supabase/server";
import type { MatchdayCommandResult, MatchdayFailure } from "./matchday-command-contract";

export type { MatchdayCommandResult, MatchdayFailure, MatchdayReceipt } from "./matchday-command-contract";

type Parser<T> = {safeParse(value:unknown):{success:true;data:T}|{success:false}};

async function context(mutation=false,capability?:Capability,expectedActorScope?:string) {
  const session=await requireControlSession();
  if (!session.isLive) return null;
  if (!session.tenantId) redirect("/context?reden=selectie");
  if (expectedActorScope!==undefined&&(!session.userId||expectedActorScope!==`${session.tenantId}:${session.userId}`)) return null;
  if (!session.tenantMemberships.some(member=>member.id===session.tenantId)) return null;
  if (mutation&&session.tenantStatus!=="active") return null;
  if (capability&&!hasCapability(session.capabilities,capability)) return null;
  const supabase=await createControlSupabaseClient();
  return supabase ? {session,supabase,tenantId:session.tenantId} : null;
}

export async function loadMatchdayWorkspace(runbookId:string|null,day:string|null):Promise<{ok:true;workspace:MatchdayWorkspace}|MatchdayFailure> {
  const current=await context();
  if (!current) return failure("UNAVAILABLE");
  if (runbookId&&!/^[a-f0-9-]{36}$/i.test(runbookId)) return failure("VALIDATION");
  if (day&&(!/^\d{4}-\d{2}-\d{2}$/.test(day)||!Number.isFinite(Date.parse(day))||new Date(day).toISOString().slice(0,10)!==day)) return failure("VALIDATION");
  try {
    const result=await current.supabase.rpc("get_matchday_workspace_s300_v1",{p_tenant_id:current.tenantId,p_runbook_id:runbookId,p_day:day});
    if (result.error) return failure(result.error.code);
    const parsed=matchdayWorkspaceSchema.safeParse(result.data);
    return parsed.success?{ok:true,workspace:parsed.data}:failure("UNAVAILABLE");
  } catch {return failure("NETWORK");}
}

/** Tiny authorized navigation read. No runbook, targets or catalogue payload. */
export async function loadMatchdayAvailability(){
  const current=await context();if(!current)return null;
  try{
    const result=await current.supabase.rpc("get_matchday_availability_s300_v1",{p_tenant_id:current.tenantId});
    if(result.error)return null;
    const parsed=matchdayAvailabilitySchema.safeParse(result.data);
    return parsed.success?parsed.data:null;
  }catch{return null;}
}

async function command<T>(rpc:string,schema:Parser<T>,value:unknown,expectedActorScope:string,capability?:Capability):Promise<MatchdayCommandResult> {
  if(typeof expectedActorScope!=="string"||!expectedActorScope)return failure("42501");
  const current=await context(true,capability,expectedActorScope);
  if (!current) return failure("42501");
  const parsed=schema.safeParse(value);
  if (!parsed.success) return failure("VALIDATION");
  try {
    // The authenticated RPC repeats membership/capability and exact delegation,
    // target, CAS and nonce checks while holding the relevant database locks.
    const result=await current.supabase.rpc(rpc,{p_tenant_id:current.tenantId,p_input:parsed.data});
    if (result.error) return failure(result.error.code);
    const receipt=matchdayCommandReceiptSchema.safeParse(result.data);
    if (!receipt.success) return failure("UNAVAILABLE");
    const expected=parsed.data as {requestId:string;runbookId?:string;publicationId?:string;actionId?:string};
    if(receipt.data.requestId!==expected.requestId||
      expected.runbookId!==undefined&&receipt.data.runbookId!==expected.runbookId||
      expected.publicationId!==undefined&&receipt.data.publicationId!==expected.publicationId||
      expected.actionId!==undefined&&receipt.data.actionId!==expected.actionId||
      rpc==="set_matchday_enabled_s300_v1"&&(receipt.data.runbookId!==null||receipt.data.publicationId!==null||receipt.data.actionId!==null)||
      ["applied","replayed"].includes(receipt.data.outcome)&&(
        rpc==="apply_matchday_action_s300_v1"&&receipt.data.actionId===null||
        rpc==="publish_matchday_runbook_s300_v1"&&receipt.data.publicationId===null))return failure("UNAVAILABLE");
    revalidatePath("/dashboard/matchday");
    revalidatePath("/dashboard/planning");
    return {ok:true,receipt:receipt.data};
  } catch {return failure("NETWORK");}
}

export async function saveMatchdayDraftCommand(value:unknown,expectedActorScope:string) {
  return command("mutate_matchday_draft_s300_v1",matchdaySaveDraftInputSchema,value,expectedActorScope,"tenant.playlist.write");
}
export async function publishMatchdayCommand(value:unknown,expectedActorScope:string) {
  return command("publish_matchday_runbook_s300_v1",matchdayPublishInputSchema,value,expectedActorScope,"tenant.playlist.publish");
}
export async function setMatchdayEnabledCommand(value:unknown,expectedActorScope:string) {
  return command("set_matchday_enabled_s300_v1",matchdayFeatureInputSchema,value,expectedActorScope,"tenant.settings.manage");
}
export async function applyMatchdayActionCommand(value:unknown,expectedActorScope:string) {
  return command("apply_matchday_action_s300_v1",matchdayActionInputSchema,value,expectedActorScope);
}
export async function endMatchdayActionCommand(value:unknown,expectedActorScope:string) {
  return command("end_matchday_action_s300_v1",matchdayEndActionInputSchema,value,expectedActorScope);
}
export async function closeMatchdayCommand(value:unknown,expectedActorScope:string) {
  return command("close_matchday_publication_s300_v1",matchdayLifecycleInputSchema,value,expectedActorScope,"tenant.playlist.publish");
}
export async function grantMatchdayCommand(value:unknown,expectedActorScope:string) {
  return command("grant_matchday_operation_s300_v1",matchdayDelegationInputSchema,value,expectedActorScope,"tenant.playlist.publish");
}

export async function previewMatchdayCommand(runbookId:string,expectedRevision:number,expectedActorScope:string):Promise<{ok:true;preflight:MatchdayPreflight}|MatchdayFailure> {
  if(typeof expectedActorScope!=="string"||!expectedActorScope)return failure("42501");
  const current=await context(false,"tenant.playlist.write",expectedActorScope);
  if (!current) return failure("42501");
  if (!/^[a-f0-9-]{36}$/i.test(runbookId)||!Number.isSafeInteger(expectedRevision)||expectedRevision<1) return failure("VALIDATION");
  try {
    const result=await current.supabase.rpc("preview_matchday_publication_s300_v1",{p_tenant_id:current.tenantId,p_runbook_id:runbookId,p_expected_revision:expectedRevision});
    if (result.error) return failure(result.error.code);
    const parsed=matchdayPreflightSchema.safeParse(result.data);
    return parsed.success&&parsed.data.runbookId===runbookId&&parsed.data.draftRevision===expectedRevision?{ok:true,preflight:parsed.data}:failure("UNAVAILABLE");
  } catch {return failure("NETWORK");}
}

function failure(code:string|undefined):MatchdayFailure {
  if (code==="42501") return {ok:false,code:"FORBIDDEN",message:"Deze handeling is niet toegestaan binnen deze vereniging of draaiboektoewijzing.",recovery:"Open je toegewezen draaiboek of vraag een bevoegde beheerder om toegang."};
  if (code==="40001") return {ok:false,code:"CONFLICT",message:"Dit draaiboek of deze actie is inmiddels gewijzigd.",recovery:"Vernieuw, bekijk de huidige waarde en bevestig daarna opnieuw."};
  if (code==="23514"||code==="VALIDATION") return {ok:false,code:"VALIDATION",message:"De wedstrijd, doelen of eindtijd zijn niet geldig.",recovery:"Controleer de exacte selectie en het begrensde tijdvenster."};
  if (code==="55000") return {ok:false,code:"BLOCKED",message:"Deze opdracht kan nog niet veilig worden uitgevoerd.",recovery:"Open de publicatiecontrole en los de gemelde blokkade op."};
  return {ok:false,code:"UNAVAILABLE",message:"Wedstrijddag kon niet veilig worden bijgewerkt.",recovery:"Probeer dezelfde opdracht opnieuw. Een bestaande geldige publicatie en historie blijven behouden."};
}
