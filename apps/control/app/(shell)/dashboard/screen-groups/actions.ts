"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireTenantCapability } from "../../../../lib/control-session";
import { createControlSupabaseClient } from "../../../../lib/supabase/server";

type GroupCommandResult = {
  actualRevision?: unknown;
  groupId?: unknown;
  outcome?: unknown;
};

export async function createScreenGroup(formData: FormData) {
  await saveScreenGroup(formData, "create");
}

export async function updateScreenGroup(formData: FormData) {
  await saveScreenGroup(formData, "update");
}

export async function archiveScreenGroup(formData: FormData) {
  const { session, supabase } = await screenGroupManager();
  const groupId = requiredUuid(formData, "groupId");
  const expectedRevision = revisionValue(formData);
  const { data, error } = await supabase.rpc("mutate_screen_group_v1", {
    p_expected_revision: expectedRevision,
    p_group_id: groupId,
    p_idempotency_key: idempotencyValue(formData),
    p_operation: "archive",
    p_payload: {},
    p_tenant_id: session.tenantId
  });
  if (error) fail(groupFailure(error.code, "archive"));
  const result = commandResult(data);
  if (!result || result.outcome === "conflict") {
    fail(conflictMessage(result?.actualRevision));
  }
  complete("De schermgroep is gearchiveerd. Bestaande immutable publicaties en historie blijven behouden.");
}

async function saveScreenGroup(formData: FormData, operation: "create" | "update") {
  const { session, supabase } = await screenGroupManager();
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const defaultPlaylistId = optionalUuid(formData, "defaultPlaylistId");
  let defaultReleaseId: string | null = null;
  if (defaultPlaylistId) {
    const latestRelease = await supabase
      .from("playlist_releases")
      .select("id")
      .eq("tenant_id", session.tenantId)
      .eq("playlist_id", defaultPlaylistId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (latestRelease.error || !latestRelease.data?.id) {
      fail("Deze playlist heeft nog geen geldige publicatie. Publiceer hem eerst.");
    }
    defaultReleaseId = latestRelease.data.id;
  }
  const screenIds = uniqueUuids(formData.getAll("screenIds"));
  if (name.length < 2 || name.length > 120) {
    fail("Gebruik een groepsnaam van 2 tot en met 120 tekens.");
  }
  if (description.length > 500) {
    fail("De beschrijving mag maximaal 500 tekens bevatten.");
  }

  const groupId = operation === "update" ? requiredUuid(formData, "groupId") : null;
  const expectedRevision = operation === "update" ? revisionValue(formData) : 0;
  const { data, error } = await supabase.rpc("mutate_screen_group_v1", {
    p_expected_revision: expectedRevision,
    p_group_id: groupId,
    p_idempotency_key: idempotencyValue(formData),
    p_operation: operation,
    p_payload: {
      defaultReleaseId,
      description: description || null,
      name,
      screenIds
    },
    p_tenant_id: session.tenantId
  });
  if (error) fail(groupFailure(error.code, operation));
  const result = commandResult(data);
  if (!result || result.outcome === "conflict") {
    fail(conflictMessage(result?.actualRevision));
  }
  complete(operation === "create"
    ? "De schermgroep en alle gekozen leden zijn transactioneel vastgelegd."
    : "De schermgroep, standaardcontent en leden zijn samen bijgewerkt.");
}

async function screenGroupManager() {
  const session = await screenGroupSession();
  const supabase = await createControlSupabaseClient();
  if (!supabase) fail("Live Supabase is niet beschikbaar. Er is niets gewijzigd.");
  return { session, supabase };
}

async function screenGroupSession() {
  const session = await requireTenantCapability("tenant.screen.manage");
  if (!session.isLive || !session.tenantId) {
    fail("Live Supabase is niet beschikbaar. Er is niets gewijzigd.");
  }
  return { ...session, tenantId: session.tenantId };
}

function commandResult(value: unknown): GroupCommandResult | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as GroupCommandResult;
}

function uniqueUuids(values: FormDataEntryValue[]) {
  const result = [...new Set(values.map(String))];
  if (result.some((value) => !uuidPattern.test(value))) {
    fail("Een gekozen scherm bestaat niet meer. Vernieuw de pagina en probeer opnieuw.");
  }
  return result;
}

function requiredUuid(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "");
  if (!uuidPattern.test(value)) fail("De gekozen schermgroep is ongeldig. Vernieuw de pagina.");
  return value;
}

function optionalUuid(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "");
  if (!value) return null;
  if (!uuidPattern.test(value)) fail("De gekozen immutable release is ongeldig.");
  return value;
}

function revisionValue(formData: FormData) {
  const revision = Number.parseInt(String(formData.get("expectedRevision") ?? ""), 10);
  if (!Number.isInteger(revision) || revision < 0) {
    fail("De groepsrevisie ontbreekt. Vernieuw de pagina voordat je opslaat.");
  }
  return revision;
}

function idempotencyValue(formData: FormData) {
  const value = String(formData.get("idempotencyKey") ?? "");
  return uuidPattern.test(value) ? value : randomUUID();
}

function groupFailure(code: string | undefined, operation: "archive" | "create" | "update") {
  if (code === "23505") return "Er bestaat al een actieve schermgroep met deze naam. Kies een andere naam.";
  if (code === "42501") return "Je mag schermgroepen niet beheren. Er is niets gewijzigd.";
  if (code === "P0002") return "De schermgroep bestaat niet meer. Vernieuw de pagina.";
  if (code === "23514" && operation === "archive") {
    return "Deze groep heeft nog actieve planningen. Schakel die eerst uit en archiveer de groep daarna.";
  }
  if (code === "23514") {
    return "Een gekozen scherm of release is niet meer beschikbaar. Vernieuw de pagina en controleer je selectie.";
  }
  return "De schermgroep kon niet veilig worden opgeslagen. Er is niets gedeeltelijk gewijzigd; probeer opnieuw.";
}

function conflictMessage(actualRevision: unknown) {
  const suffix = typeof actualRevision === "number" ? ` De actuele revisie is ${actualRevision}.` : "";
  return `Iemand anders wijzigde deze schermgroep.${suffix} Vernieuw de pagina en pas je wijziging opnieuw toe.`;
}

function complete(message: string): never {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/screens/groups");
  revalidatePath("/dashboard/planning");
  revalidatePath("/dashboard/screens");
  redirect(`/dashboard/screens/groups?succes=${encodeURIComponent(message)}`);
}

function fail(message: string): never {
  redirect(`/dashboard/screens/groups?fout=${encodeURIComponent(message)}`);
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
