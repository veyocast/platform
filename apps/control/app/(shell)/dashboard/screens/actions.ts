"use server";

import { createHash } from "node:crypto";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireTenantCapability } from "../../../../lib/control-session";
import { createControlSupabaseClient } from "../../../../lib/supabase/server";

export async function createScreen(formData: FormData) {
  const { session, supabase } = await requireScreenManagement("mutate");
  const name = String(formData.get("name") ?? "").trim();
  const location = String(formData.get("location") ?? "").trim();
  const orientation = String(formData.get("orientation") ?? "landscape");
  const resolutionWidth = Number.parseInt(String(formData.get("resolutionWidth") ?? "1920"), 10);
  const resolutionHeight = Number.parseInt(String(formData.get("resolutionHeight") ?? "1080"), 10);

  if (name.length < 2 || name.length > 120) {
    fail("Geef het scherm een naam van 2 tot en met 120 tekens.");
  }
  if (location.length > 160) {
    fail("De locatie mag maximaal 160 tekens bevatten.");
  }
  if (orientation !== "landscape" && orientation !== "portrait") {
    fail("Kies liggende of staande oriëntatie.");
  }
  if (!Number.isInteger(resolutionWidth) || resolutionWidth < 320 || resolutionWidth > 7680 || !Number.isInteger(resolutionHeight) || resolutionHeight < 240 || resolutionHeight > 4320) {
    fail("De schermresolutie valt buiten het ondersteunde bereik.");
  }

  const { error } = await supabase.from("screens").insert({
    created_by: session.userId,
    location: location || null,
    name,
    orientation,
    resolution_height: resolutionHeight,
    resolution_width: resolutionWidth,
    tenant_id: session.tenantId
  });

  if (error) {
    fail("Het scherm kon niet worden opgeslagen. Er is niets gekoppeld; controleer je beheerrechten en probeer opnieuw.");
  }

  complete("Het scherm is aangemaakt en kan nu veilig aan een Player worden gekoppeld.");
}

export async function claimScreenPairing(formData: FormData) {
  const { session, supabase } = await requireScreenManagement("pair");
  const screenId = String(formData.get("screenId") ?? "");
  const deviceName = String(formData.get("deviceName") ?? "").trim();
  const pairingCode = normalizePairingCode(String(formData.get("pairingCode") ?? ""));

  if (!screenId || pairingCode.length !== 6) {
    fail("Neem alle zes tekens van de Player over en kies het juiste scherm.");
  }
  if (deviceName.length > 120) {
    fail("De apparaatnaam mag maximaal 120 tekens bevatten.");
  }

  const { error } = await supabase.rpc("claim_pairing_session_v2", {
    p_code_hash: createHash("sha256").update(pairingCode).digest("hex"),
    p_device_name: deviceName || "LG webOS Signage",
    p_screen_id: screenId,
    p_tenant_id: session.tenantId
  });

  if (error) {
    fail(pairingFailureMessage(error.code));
  }

  complete("De Player is gekoppeld. Het geheime device-token is uitsluitend op de Player bewaard.");
}

async function requireScreenManagement(operation: "mutate" | "pair") {
  const session = await requireTenantCapability(
    "tenant.screen.manage",
    operation
  );
  const supabase = await createControlSupabaseClient();

  if (!session.isLive || !session.tenantId || !supabase) {
    fail("Live Supabase is niet beschikbaar. Er is niets gewijzigd; herstel de configuratie en log opnieuw in.");
  }
  return { session, supabase };
}

function normalizePairingCode(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function pairingFailureMessage(code: string | undefined) {
  if (code === "P0002") {
    return "De koppelcode is niet beschikbaar. De Player blijft ongekoppeld; vernieuw de Player voor een nieuwe code en probeer opnieuw.";
  }
  if (code === "23514") {
    return "De koppelcode is verlopen of het scherm is niet beschikbaar. De Player blijft ongekoppeld; vernieuw de code en controleer het scherm.";
  }
  if (code === "42501") {
    return "Je mag deze Player niet koppelen. Er is niets gewijzigd; gebruik een tenantbeheerder binnen dezelfde tenant.";
  }
  return "Koppelen is niet voltooid. De Player blijft ongekoppeld; controleer Supabase en probeer met een nieuwe code opnieuw.";
}

function fail(message: string): never {
  redirect(`/dashboard/screens?fout=${encodeURIComponent(message)}`);
}

function complete(message: string): never {
  revalidatePath("/dashboard/screens");
  revalidatePath("/dashboard/pilot");
  redirect(`/dashboard/screens?succes=${encodeURIComponent(message)}`);
}
