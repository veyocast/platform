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

export type SitesEngageSaveResult = {
  status: "saved" | "conflict" | "error";
  message: string;
  campaignId?: string;
  publicId?: string;
  actualRevision?: number;
  retryUnchanged?: boolean;
};

export async function saveSitesEngageCampaign(formData: FormData): Promise<SitesEngageSaveResult> {
  const { tenantId } = await requireTenantCapability("tenant.dynamic_slide.write");
  const supabase = await createControlSupabaseClient();
  const failure: SitesEngageSaveResult = { status: "error", retryUnchanged: true, message: "Het concept kon niet worden opgeslagen. Je invoer blijft behouden; controleer je verbinding, invoer en campagnestatus en probeer opnieuw." };
  if (!tenantId || !supabase) return failure;
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const campaignId = String(formData.get("campaignId") ?? "").trim() || null;
  const idempotencyKey = String(formData.get("idempotencyKey") ?? "");
  const rawRevision = String(formData.get("expectedRevision") ?? "");
  const expectedRevision = Number(rawRevision);
  const title = String(formData.get("title") ?? "").trim();
  const question = String(formData.get("question") ?? "").trim();
  const kind = String(formData.get("kind") ?? "");
  const resultVisibility = String(formData.get("resultVisibility") ?? "");
  const options = formData.getAll("option").map(label => ({ label: String(label).trim() }));
  const date = (name: string) => {
    const raw = String(formData.get(name) ?? "").trim();
    if (!raw) return null;
    const parsed = new Date(raw);
    return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : undefined;
  };
  const startsAt = date("startsAt"), endsAt = date("endsAt");
  if ((campaignId !== null && !uuidPattern.test(campaignId)) || !uuidPattern.test(idempotencyKey)
    || !/^\d+$/.test(rawRevision) || !Number.isSafeInteger(expectedRevision) || expectedRevision < 0
    || (campaignId === null && expectedRevision !== 0) || !["poll", "motm"].includes(kind)
    || !["after_vote", "after_close", "live"].includes(resultVisibility)
    || title.length < 2 || title.length > 160 || question.length < 2 || question.length > 160
    || options.length < 2 || options.length > 24 || options.some(option => option.label.length < 2 || option.label.length > 160)
    || startsAt === undefined || endsAt === undefined || (startsAt && endsAt && endsAt <= startsAt)) {
    return { status: "error", message: "Controleer de vraag, toelichting en minimaal twee antwoorden (2–160 tekens). Het einde moet na de start liggen. Je invoer blijft behouden." };
  }
  const payload = { kind, title, question, resultVisibility, startsAt, endsAt, options };
  if (new TextEncoder().encode(JSON.stringify(payload)).byteLength > 32768) return failure;
  try {
    const { data, error } = await supabase.rpc("save_engage_campaign_v2", {
      p_tenant_id: tenantId, p_campaign_id: campaignId, p_expected_revision: expectedRevision,
      p_payload: payload, p_idempotency_key: idempotencyKey
    });
    if (error || !data || typeof data !== "object" || Array.isArray(data)) return failure;
    const receipt = data as Record<string, unknown>;
    if (typeof receipt.campaignId !== "string" || !uuidPattern.test(receipt.campaignId)
      || typeof receipt.publicId !== "string" || !uuidPattern.test(receipt.publicId)
      || typeof receipt.actualRevision !== "number" || !Number.isSafeInteger(receipt.actualRevision) || receipt.actualRevision < 0
      || (campaignId !== null && receipt.campaignId !== campaignId)) return failure;
    if (receipt.outcome === "conflict") {
      return { status: "conflict", message: "Dit concept is elders gewijzigd. Je invoer blijft behouden. Open de nieuwste campagne voordat je de wijzigingen opnieuw toepast.", actualRevision: receipt.actualRevision };
    }
    if ((campaignId === null && (receipt.outcome !== "created" || receipt.actualRevision !== 0))
      || (campaignId !== null && (receipt.outcome !== "applied" || receipt.actualRevision !== expectedRevision + 1))) return failure;
    revalidatePath(path);
    return { status: "saved", message: "Concept opgeslagen.", campaignId: receipt.campaignId, publicId: receipt.publicId, actualRevision: receipt.actualRevision };
  } catch {
    return failure;
  }
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
