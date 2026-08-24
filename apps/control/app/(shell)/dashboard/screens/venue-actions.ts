"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireTenantCapability } from "../../../../lib/control-session";
import { createControlSupabaseClient } from "../../../../lib/supabase/server";

export async function createVenue(formData: FormData) {
  const { session, supabase } = await requireVenueManager();
  const name = boundedText(formData, "name", 2, 120, "Geef de locatie een naam van 2 tot en met 120 tekens.");
  const addressLabel = optionalText(formData, "addressLabel", 240);
  const { error } = await supabase.rpc("save_venue_v1", {
    p_address_label: addressLabel,
    p_name: name,
    p_tenant_id: session.tenantId,
    p_venue_id: null
  });
  if (error) fail(venueFailure(error.code));
  complete("De venue is opgeslagen. Voeg nu een plattegrond of zone toe.");
}

export async function createVenueFloorplan(formData: FormData) {
  const { session, supabase } = await requireVenueManager();
  const venueId = requiredUuid(formData, "venueId");
  const name = boundedText(formData, "name", 2, 120, "Geef de plattegrond een herkenbare naam.");
  const width = boundedInteger(formData, "width", 320, 16000);
  const height = boundedInteger(formData, "height", 240, 16000);
  const { error } = await supabase.rpc("save_venue_floorplan_v1", {
    p_floorplan_id: null,
    p_height: height,
    p_media_asset_id: optionalUuid(formData, "mediaAssetId"),
    p_name: name,
    p_tenant_id: session.tenantId,
    p_venue_id: venueId,
    p_width: width
  });
  if (error) fail(venueFailure(error.code));
  complete("De plattegrond is opgeslagen zonder fictieve gebouwdata.");
}

export async function createVenueZone(formData: FormData) {
  const { session, supabase } = await requireVenueManager();
  const { error } = await supabase.rpc("save_venue_zone_v1", {
    p_description: optionalText(formData, "description", 500),
    p_floorplan_id: optionalUuid(formData, "floorplanId"),
    p_name: boundedText(formData, "name", 2, 120, "Geef de zone een naam van 2 tot en met 120 tekens."),
    p_tenant_id: session.tenantId,
    p_venue_id: requiredUuid(formData, "venueId"),
    p_zone_id: null
  });
  if (error) fail(venueFailure(error.code));
  complete("De zone is toegevoegd en is ook in de tekstweergave beschikbaar.");
}

export async function saveVenueScreenPlacement(formData: FormData) {
  const { session, supabase } = await requireVenueManager();
  const x = boundedNumber(formData, "xNormalized", 0, 1);
  const y = boundedNumber(formData, "yNormalized", 0, 1);
  const orientation = String(formData.get("orientation") ?? "");
  if (!new Set(["landscape", "portrait"]).has(orientation)) {
    fail("Kies een geldige schermoriëntatie.");
  }
  const wallAngle = optionalNumber(formData, "wallAngleDegrees", -180, 180);
  const { error } = await supabase.rpc("save_venue_screen_placement_v1", {
    p_floorplan_id: optionalUuid(formData, "floorplanId"),
    p_orientation: orientation,
    p_screen_id: requiredUuid(formData, "screenId"),
    p_tenant_id: session.tenantId,
    p_venue_id: requiredUuid(formData, "venueId"),
    p_wall_angle_degrees: wallAngle,
    p_x_normalized: x,
    p_y_normalized: y,
    p_zone_id: optionalUuid(formData, "zoneId")
  });
  if (error) fail(venueFailure(error.code));
  complete("De schermpositie is server-side gevalideerd en als nieuwe revisie opgeslagen.");
}

async function requireVenueManager() {
  const session = await requireTenantCapability("tenant.screen.manage", "mutate");
  const supabase = await createControlSupabaseClient();
  if (!session.isLive || !session.tenantId || !supabase) {
    fail("De beveiligde venuesessie ontbreekt. Er is niets gewijzigd.");
  }
  return { session, supabase };
}

function boundedText(formData: FormData, name: string, min: number, max: number, message: string) {
  const value = String(formData.get(name) ?? "").trim();
  if (value.length < min || value.length > max) fail(message);
  return value;
}

function optionalText(formData: FormData, name: string, max: number) {
  const value = String(formData.get(name) ?? "").trim();
  if (value.length > max) fail(`Het veld ${name} is te lang.`);
  return value || null;
}

function boundedInteger(formData: FormData, name: string, min: number, max: number) {
  const value = Number(String(formData.get(name) ?? ""));
  if (!Number.isInteger(value) || value < min || value > max) {
    fail("De afmetingen van de plattegrond vallen buiten het ondersteunde bereik.");
  }
  return value;
}

function boundedNumber(formData: FormData, name: string, min: number, max: number) {
  const value = Number(String(formData.get(name) ?? ""));
  if (!Number.isFinite(value) || value < min || value > max) {
    fail("Gebruik genormaliseerde coördinaten tussen 0 en 1.");
  }
  return value;
}

function optionalNumber(formData: FormData, name: string, min: number, max: number) {
  const raw = String(formData.get(name) ?? "").trim();
  return raw ? boundedNumber(formData, name, min, max) : null;
}

function requiredUuid(formData: FormData, name: string) {
  const value = optionalUuid(formData, name);
  if (!value) fail("Een gekozen venue-, zone- of schermreferentie is ongeldig.");
  return value;
}

function optionalUuid(formData: FormData, name: string) {
  const value = String(formData.get(name) ?? "").trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    ? value
    : null;
}

function venueFailure(code: string | undefined) {
  if (code === "42501") return "Venue Twin is niet voor deze tenant vrijgegeven of je mist schermbeheerrechten.";
  if (code === "P0002") return "De gekozen venue, plattegrond of zone bestaat niet meer. Vernieuw de pagina.";
  if (code === "23514") return "De venuegegevens zijn ongeldig of verwijzen naar een onbeschikbare afbeelding.";
  return "Venue Twin kon de wijziging niet veilig opslaan. Er is niets gewijzigd.";
}

function fail(message: string): never {
  redirect(`/dashboard/screens?view=venue&fout=${encodeURIComponent(message)}`);
}

function complete(message: string): never {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/screens");
  redirect(`/dashboard/screens?view=venue&succes=${encodeURIComponent(message)}`);
}
