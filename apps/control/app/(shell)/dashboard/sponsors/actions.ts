"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireTenantCapability } from "../../../../lib/control-session";
import { createControlSupabaseClient } from "../../../../lib/supabase/server";

const hubPath = "/dashboard/sponsors";

export async function initializeSponsorHub() {
  const { tenantId } = await requireTenantCapability("tenant.sponsor.write");
  const supabase = await createControlSupabaseClient();
  if (!tenantId || !supabase) fail("configuratie");
  const { error } = await supabase.rpc("ensure_sponsor_positions_v1", { p_tenant_id: tenantId });
  if (error) fail("posities");
  done("posities");
}

export async function createSponsor(formData: FormData) {
  const { tenantId } = await requireTenantCapability("tenant.sponsor.write");
  const supabase = await createControlSupabaseClient();
  if (!tenantId || !supabase) fail("configuratie");
  const { error } = await supabase.rpc("create_sponsor_v1", {
    p_name: text(formData, "name", 160),
    p_notes: optionalText(formData, "notes", 4000),
    p_tenant_id: tenantId,
    p_website_url: optionalText(formData, "websiteUrl", 500)
  });
  if (error) fail("sponsor");
  done("sponsor");
}

export async function createCampaign(formData: FormData) {
  const { tenantId } = await requireTenantCapability("tenant.sponsor.write");
  const supabase = await createControlSupabaseClient();
  if (!tenantId || !supabase) fail("configuratie");
  const { error } = await supabase.rpc("create_sponsor_campaign_v1", {
    p_ends_at: dateTime(formData, "endsAt"),
    p_name: text(formData, "name", 180),
    p_sponsor_id: uuid(formData, "sponsorId"),
    p_starts_at: dateTime(formData, "startsAt"),
    p_tenant_id: tenantId,
    p_weight: decimal(formData, "weight", 1)
  });
  if (error) fail("campagne");
  done("campagne");
}

export async function addCreative(formData: FormData) {
  const { tenantId } = await requireTenantCapability("tenant.sponsor.write");
  const supabase = await createControlSupabaseClient();
  if (!tenantId || !supabase) fail("configuratie");
  const { error } = await supabase.rpc("add_sponsor_creative_v1", {
    p_campaign_id: uuid(formData, "campaignId"),
    p_duration_seconds: decimal(formData, "durationSeconds", 8),
    p_media_asset_id: uuid(formData, "mediaAssetId"),
    p_orientation: enumValue(formData, "orientation", ["any", "landscape", "portrait"]),
    p_position_key: enumValue(formData, "positionKey", ["fullscreen", "presented_by", "footer", "corner", "match_sponsor", "match_ball_sponsor"]),
    p_tenant_id: tenantId
  });
  if (error) fail("creative");
  done("creative");
}

export async function registerSponsorMedia(formData: FormData) {
  const { tenantId } = await requireTenantCapability("tenant.sponsor.write");
  const supabase = await createControlSupabaseClient();
  if (!tenantId || !supabase) fail("configuratie");
  const { error } = await supabase.rpc("register_sponsor_media_v1", {
    p_media_asset_id: uuid(formData, "mediaAssetId"),
    p_sponsor_id: uuid(formData, "sponsorId"),
    p_tenant_id: tenantId
  });
  if (error) fail("sponsormedia");
  done("sponsormedia");
}

export async function placeCampaign(formData: FormData) {
  const { tenantId } = await requireTenantCapability("tenant.sponsor.write");
  const supabase = await createControlSupabaseClient();
  if (!tenantId || !supabase) fail("configuratie");
  const { error } = await supabase.rpc("place_sponsor_campaign_v1", {
    p_campaign_id: uuid(formData, "campaignId"),
    p_orientation: enumValue(formData, "orientation", ["any", "landscape", "portrait"]),
    p_position_id: uuid(formData, "positionId"),
    p_tenant_id: tenantId
  });
  if (error) fail("plaatsing");
  done("plaatsing");
}

export async function submitCampaign(formData: FormData) {
  const { tenantId } = await requireTenantCapability("tenant.sponsor.write");
  await campaignCommand("submit_sponsor_campaign_v1", tenantId, formData);
  done("ingediend");
}

export async function approveCampaign(formData: FormData) {
  const { tenantId } = await requireTenantCapability("tenant.sponsor.approve");
  await campaignCommand("approve_sponsor_campaign_v1", tenantId, formData, { p_approve: true });
  done("goedgekeurd");
}

export async function publishSponsorPlan() {
  const { tenantId } = await requireTenantCapability("tenant.sponsor.publish", "publish");
  const supabase = await createControlSupabaseClient();
  if (!tenantId || !supabase) fail("configuratie");
  const { error } = await supabase.rpc("publish_sponsor_plan_v1", {
    p_screen_ids: null,
    p_tenant_id: tenantId,
    p_valid_days: 14
  });
  if (error) fail("publicatie");
  done("gepubliceerd");
}

async function campaignCommand(name: string, tenantId: string | null, formData: FormData, extra: Record<string, unknown> = {}) {
  const supabase = await createControlSupabaseClient();
  if (!tenantId || !supabase) fail("configuratie");
  const { error } = await supabase.rpc(name, {
    p_campaign_id: uuid(formData, "campaignId"),
    p_tenant_id: tenantId,
    ...extra
  });
  if (error) fail("campagneactie");
}

function text(data: FormData, name: string, max: number) {
  const value = String(data.get(name) ?? "").trim();
  if (value.length < 2 || value.length > max) throw new Error("Ongeldige invoer.");
  return value;
}
function optionalText(data: FormData, name: string, max: number) {
  const value = String(data.get(name) ?? "").trim();
  if (value.length > max) throw new Error("Ongeldige invoer.");
  return value || null;
}
function uuid(data: FormData, name: string) {
  const value = String(data.get(name) ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(value)) throw new Error("Ongeldige identifier.");
  return value;
}
function dateTime(data: FormData, name: string) {
  const value = new Date(String(data.get(name) ?? ""));
  if (!Number.isFinite(value.getTime())) throw new Error("Ongeldige datum.");
  return value.toISOString();
}
function decimal(data: FormData, name: string, fallback: number) {
  const value = Number(data.get(name) ?? fallback);
  if (!Number.isFinite(value) || value <= 0) throw new Error("Ongeldig getal.");
  return value;
}
function enumValue<T extends string>(data: FormData, name: string, allowed: readonly T[]) {
  const value = String(data.get(name) ?? "") as T;
  if (!allowed.includes(value)) throw new Error("Ongeldige keuze.");
  return value;
}
function fail(code: string): never { redirect(`${hubPath}?fout=${encodeURIComponent(code)}`); }
function done(code: string): never { revalidatePath(hubPath); redirect(`${hubPath}?succes=${encodeURIComponent(code)}`); }
