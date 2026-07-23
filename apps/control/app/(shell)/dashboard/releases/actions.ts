"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireTenantCapability } from "../../../../lib/control-session";
import { createControlSupabaseClient } from "../../../../lib/supabase/server";
import { loadReleaseDetail } from "./data";

export async function reassignRelease(formData: FormData) {
  const releaseId = idValue(formData, "releaseId");
  const screenIds = [...new Set(formData.getAll("screenIds").map(String).filter(isId))];
  const session = await requireTenantCapability("tenant.playlist.publish", "publish");
  const supabase = await createControlSupabaseClient();
  if (!supabase) fail(releaseId, "Live Supabase is niet beschikbaar. De bestaande toewijzing is ongewijzigd.");
  if (!screenIds.length) fail(releaseId, "Kies minimaal één beschikbaar doelscherm.");
  if (formData.get("confirmImmutable") !== "on") fail(releaseId, "Bevestig dat je een bestaande immutable release opnieuw toewijst.");
  if (!session.tenantId) fail(releaseId, "De actieve vereniging ontbreekt. Er is niets toegewezen.");
  const detail = await loadReleaseDetail(session.tenantId, releaseId);
  const targets = detail.screenStates.filter((state) => screenIds.includes(state.screen.id));
  if (targets.length !== screenIds.length || targets.some((state) => state.preflight.status === "blocked")) {
    fail(releaseId, "Minimaal één doelscherm is geblokkeerd door status, incompatibiliteit of onvoldoende opslag. Er is niets toegewezen.");
  }
  if (targets.some((state) => state.preflight.status === "warning" || state.preflight.status === "unknown") && formData.get("confirmRisk") !== "on") {
    fail(releaseId, "Bevestig bewust de waarschuwingen en onbekende telemetry voordat je deze release toewijst.");
  }

  const { error } = await supabase.rpc("reassign_playlist_release", {
    p_release_id: releaseId,
    p_screen_ids: screenIds
  });
  if (error) {
    console.error("Bestaande release opnieuw toewijzen mislukt", error);
    fail(releaseId, error.code === "42501"
      ? "Je mag releases niet opnieuw toewijzen. Vraag een beheerder om je rol te controleren."
      : "De release kon niet atomair aan alle schermen worden toegewezen. Geen releasehistorie is gewijzigd.");
  }

  revalidatePath("/dashboard/releases");
  revalidatePath(`/dashboard/releases/${releaseId}`);
  revalidatePath("/dashboard/screens");
  redirect(`/dashboard/releases/${releaseId}?succes=${encodeURIComponent("De bestaande immutable release is opnieuw toegewezen. Players schakelen pas na volledige download en verificatie.")}`);
}

export async function restoreReleaseToDraft(formData: FormData) {
  const releaseId = idValue(formData, "releaseId");
  const session = await requireTenantCapability("tenant.playlist.write");
  const supabase = await createControlSupabaseClient();
  if (!supabase || !session.tenantId) {
    fail(releaseId, "Live Supabase is niet beschikbaar. Het huidige concept is ongewijzigd.");
  }
  if (formData.get("confirmRestore") !== "on") {
    fail(releaseId, "Bevestig dat je deze immutable versie als nieuw concept wilt herstellen.");
  }

  const { data: release, error: releaseError } = await supabase
    .from("playlist_releases")
    .select("playlist_id")
    .eq("tenant_id", session.tenantId)
    .eq("id", releaseId)
    .maybeSingle();
  if (releaseError || !release) fail(releaseId, "De release bestaat niet meer binnen de actieve vereniging.");
  const { data: playlist, error: playlistError } = await supabase
    .from("playlists")
    .select("revision")
    .eq("tenant_id", session.tenantId)
    .eq("id", release.playlist_id)
    .maybeSingle();
  if (playlistError || !playlist) fail(releaseId, "De bijbehorende playlist bestaat niet meer.");

  const { data, error } = await supabase.rpc("restore_playlist_release_to_draft_v1", {
    p_expected_revision: playlist.revision,
    p_idempotency_key: idempotencyValue(formData),
    p_release_id: releaseId
  });
  if (error) {
    console.error("Release als concept herstellen mislukt", error);
    fail(releaseId, error.code === "42501"
      ? "Je mag deze release niet als concept herstellen. Controleer je actieve rol."
      : "De versie kon niet volledig als concept worden hersteld. Het bestaande concept is ongewijzigd.");
  }
  const result = commandResult(data);
  if (!result) fail(releaseId, "De herstelactie gaf geen veilige bevestiging. Vernieuw Release Center.");
  if (result.outcome === "conflict") {
    fail(releaseId, "Het concept is ondertussen gewijzigd. Vernieuw de release en probeer de herstelactie daarna bewust opnieuw.");
  }
  if (typeof result.playlistId !== "string" || !isId(result.playlistId)) {
    fail(releaseId, "De herstelde playlist kon niet worden bevestigd. Controleer de playlist voordat je opnieuw probeert.");
  }

  revalidatePath("/dashboard/playlists");
  revalidatePath(`/dashboard/playlists/${result.playlistId}`);
  revalidatePath("/dashboard/releases");
  redirect(`/dashboard/playlists/${result.playlistId}?succes=${encodeURIComponent("De gekozen immutable versie is als nieuw concept hersteld. De releasehistorie en actieve schermtoewijzingen zijn niet gewijzigd.")}`);
}

function idValue(formData: FormData, name: string) {
  const value = String(formData.get(name) ?? "");
  if (!isId(value)) redirect("/dashboard/releases?fout=De gekozen release is ongeldig.");
  return value;
}

function isId(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function commandResult(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as { outcome?: unknown; playlistId?: unknown };
}

function idempotencyValue(formData: FormData) {
  const value = String(formData.get("idempotencyKey") ?? "");
  return isId(value) ? value : randomUUID();
}

function fail(releaseId: string, message: string): never {
  redirect(`/dashboard/releases/${releaseId}?fout=${encodeURIComponent(message)}`);
}
