"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireTenantCapability } from "../../../../lib/control-session";
import { createControlSupabaseClient } from "../../../../lib/supabase/server";

export async function createTenantTemplate(formData: FormData) {
  const { supabase } = await templateWriter();
  const playlistId = uuidValue(formData, "playlistId");
  const name = nameValue(formData);
  const description = String(formData.get("description") ?? "").trim();
  if (description.length > 500) fail("De templatebeschrijving mag maximaal 500 tekens bevatten.");

  const { data, error } = await supabase.rpc("create_tenant_playlist_template_v1", {
    p_description: description || null,
    p_idempotency_key: idempotencyValue(formData),
    p_name: name,
    p_playlist_id: playlistId
  });
  if (error || !resultId(data, "templateId")) {
    console.error("Tenanttemplate maken mislukt", error);
    fail(templateError(error?.code));
  }

  revalidatePath("/dashboard/templates");
  redirect("/dashboard/templates?succes=De+playlist+is+als+herbruikbare+template+vastgelegd.");
}

export async function instantiateTenantTemplate(formData: FormData) {
  const { supabase } = await templateWriter();
  const templateId = uuidValue(formData, "templateId");
  const name = nameValue(formData);

  const { data, error } = await supabase.rpc("instantiate_tenant_playlist_template_v1", {
    p_idempotency_key: idempotencyValue(formData),
    p_name: name,
    p_template_id: templateId
  });
  const playlistId = resultId(data, "playlistId");
  if (error || !playlistId) {
    console.error("Tenanttemplate gebruiken mislukt", error);
    fail(templateError(error?.code));
  }

  revalidatePath("/dashboard/playlists");
  redirect(`/dashboard/playlists/${playlistId}?succes=${encodeURIComponent("De template is als nieuw concept geopend. Releasehistorie en schermtoewijzingen zijn niet overgenomen.")}`);
}

export async function updateTenantTemplate(formData: FormData) {
  const { supabase } = await templateWriter();
  const templateId = uuidValue(formData, "templateId");
  const playlistId = uuidValue(formData, "playlistId");
  const name = nameValue(formData);
  const description = String(formData.get("description") ?? "").trim();
  const expectedRevision = nonNegativeIntegerValue(formData, "expectedRevision");
  if (description.length > 500) fail("De templatebeschrijving mag maximaal 500 tekens bevatten.");

  const { data, error } = await supabase.rpc("update_tenant_playlist_template_v1", {
    p_description: description || null,
    p_expected_revision: expectedRevision,
    p_idempotency_key: idempotencyValue(formData),
    p_name: name,
    p_playlist_id: playlistId,
    p_template_id: templateId
  });
  if (error) {
    console.error("Tenanttemplate bijwerken mislukt", error);
    fail(templateError(error.code));
  }
  if (resultOutcome(data) === "conflict") {
    fail("Iemand heeft deze template intussen gewijzigd. De nieuwste versie is geladen; controleer je invoer opnieuw.");
  }
  if (!resultId(data, "templateId")) {
    fail("De templateactie kon niet veilig worden bevestigd. Vernieuw de pagina en probeer opnieuw.");
  }

  revalidatePath("/dashboard/templates");
  redirect("/dashboard/templates?succes=De+template+en+inhoudssnapshot+zijn+bijgewerkt.");
}

async function templateWriter() {
  const session = await requireTenantCapability("tenant.playlist.write");
  const supabase = await createControlSupabaseClient();
  if (!session.isLive || !session.tenantId || !supabase) {
    fail("Live Supabase is niet beschikbaar. Er is niets gewijzigd.");
  }
  return { session, supabase };
}

function resultId(value: unknown, key: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const result = (value as Record<string, unknown>)[key];
  return typeof result === "string" && uuidPattern.test(result) ? result : null;
}

function resultOutcome(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const result = (value as Record<string, unknown>).outcome;
  return typeof result === "string" ? result : null;
}

function nameValue(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 2 || name.length > 120) {
    fail("Gebruik een naam van 2 tot en met 120 tekens.");
  }
  return name;
}

function uuidValue(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "");
  if (!uuidPattern.test(value)) fail("De gekozen resource is ongeldig.");
  return value;
}

function nonNegativeIntegerValue(formData: FormData, key: string) {
  const value = Number(formData.get(key));
  if (!Number.isSafeInteger(value) || value < 0) fail("De templaterevisie is ongeldig.");
  return value;
}

function idempotencyValue(formData: FormData) {
  const value = String(formData.get("idempotencyKey") ?? "");
  return uuidPattern.test(value) ? value : randomUUID();
}

function templateError(code: string | undefined) {
  if (code === "23514") return "De template bevat media die niet meer beschikbaar is. Herstel eerst de bronplaylist.";
  if (code === "42501") return "Je mag geen templates maken of gebruiken. Controleer je actieve rol.";
  if (code === "P0002") return "De gekozen playlist of template bestaat niet meer.";
  return "De templateactie kon niet veilig en volledig worden uitgevoerd. Probeer opnieuw.";
}

function fail(message: string): never {
  redirect(`/dashboard/templates?fout=${encodeURIComponent(message)}`);
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
