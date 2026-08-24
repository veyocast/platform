"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireTenantCapability } from "../../../../lib/control-session";
import { createControlSupabaseClient } from "../../../../lib/supabase/server";

const path = "/dashboard/engage";

export async function saveEngageCampaign(formData: FormData) {
  const { tenantId } = await requireTenantCapability("tenant.dynamic_slide.write");
  const supabase = await createControlSupabaseClient();
  if (!tenantId || !supabase) fail("configuratie");
  const options = String(formData.get("options") ?? "").split(/\r?\n/)
    .map((label) => label.trim()).filter(Boolean).map((label) => ({ label }));
  if (options.length < 2 || options.length > 24) fail("opties");
  const { error } = await supabase.rpc("save_engage_campaign_v1", {
    p_campaign_id: null,
    p_ends_at: optionalDate(formData, "endsAt"),
    p_kind: enumValue(formData, "kind", ["poll", "motm"]),
    p_options: options,
    p_question: text(formData, "question", 160),
    p_result_visibility: enumValue(formData, "resultVisibility", ["after_vote", "after_close", "live"]),
    p_starts_at: optionalDate(formData, "startsAt"),
    p_tenant_id: tenantId,
    p_title: text(formData, "title", 160)
  });
  if (error) fail("opslaan");
  done("concept-opgeslagen");
}

export async function transitionEngageCampaign(formData: FormData) {
  const { tenantId } = await requireTenantCapability("tenant.dynamic_slide.write");
  const supabase = await createControlSupabaseClient();
  if (!tenantId || !supabase) fail("configuratie");
  const { error } = await supabase.rpc("transition_engage_campaign_v1", {
    p_campaign_id: uuid(formData, "campaignId"),
    p_target_status: enumValue(formData, "targetStatus", ["scheduled", "live", "closed", "archived"]),
    p_tenant_id: tenantId
  });
  if (error) fail("status");
  done("status-bijgewerkt");
}

function text(data: FormData, name: string, max: number) {
  const value = String(data.get(name) ?? "").trim();
  if (value.length < 2 || value.length > max) fail("invoer");
  return value;
}
function optionalDate(data: FormData, name: string) {
  const raw = String(data.get(name) ?? "").trim();
  if (!raw) return null;
  const date = new Date(raw);
  if (!Number.isFinite(date.getTime())) fail("datum");
  return date.toISOString();
}
function uuid(data: FormData, name: string) {
  const value = String(data.get(name) ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(value)) fail("id");
  return value;
}
function enumValue<T extends string>(data: FormData, name: string, values: readonly T[]) {
  const value = String(data.get(name) ?? "") as T;
  if (!values.includes(value)) fail("keuze");
  return value;
}
function fail(reason: string): never { redirect(`${path}?fout=${encodeURIComponent(reason)}`); }
function done(reason: string): never { revalidatePath(path); redirect(`${path}?succes=${encodeURIComponent(reason)}`); }
