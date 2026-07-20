"use server";

import { createHash } from "node:crypto";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireTenantCapability } from "../../../../lib/control-session";
import { createControlSupabaseClient } from "../../../../lib/supabase/server";

type ScreenCommandContext = Awaited<ReturnType<typeof requireScreenManagement>>;

export async function createScreen(formData: FormData) {
  const context = await requireScreenManagement("mutate");
  const screenId = await runCreateScreen(context, formData);
  complete(
    `/dashboard/screens/${screenId}`,
    "Het scherm is transactioneel aangemaakt en staat klaar voor onboarding.",
    screenId
  );
}

export async function createScreenOnboarding(formData: FormData) {
  const context = await requireScreenManagement("mutate");
  const screenId = await runCreateScreen(context, formData);
  complete(
    `/dashboard/screens/new?screen=${screenId}`,
    "Schermdetails zijn opgeslagen. Voeg nu de fysieke Player toe.",
    screenId
  );
}

export async function claimScreenPairing(formData: FormData) {
  const { session, supabase } = await requireScreenManagement("pair");
  const screenId = requiredUuid(formData, "screenId");
  const returnPath = formData.get("flow") === "onboarding"
    ? `/dashboard/screens/new?screen=${screenId}`
    : `/dashboard/screens/${screenId}?tab=player`;
  const deviceName = String(formData.get("deviceName") ?? "").trim();
  const pairingCode = normalizePairingCode(String(formData.get("pairingCode") ?? ""));

  if (pairingCode.length !== 6) {
    fail(returnPath, "Neem alle zes tekens van de Player over.");
  }
  if (deviceName.length > 120) {
    fail(returnPath, "De apparaatnaam mag maximaal 120 tekens bevatten.");
  }

  const { data, error } = await supabase.rpc("claim_pairing_session_v3", {
    p_code_hash: createHash("sha256").update(pairingCode).digest("hex"),
    p_device_name: deviceName || "LG webOS Signage",
    p_screen_id: screenId,
    p_tenant_id: session.tenantId
  });
  if (error) fail(returnPath, pairingDatabaseFailure(error.code));
  const result = commandResult(data);
  if (!result.ok) fail(returnPath, pairingResultFailure(result.code));

  complete(
    returnPath,
    "De Player is gekoppeld. Het geheime device-token blijft uitsluitend op de Player.",
    screenId
  );
}

export async function updateScreen(formData: FormData) {
  const { session, supabase } = await requireScreenManagement("mutate");
  const screenId = requiredUuid(formData, "screenId");
  const input = screenInput(formData, `/dashboard/screens/${screenId}?tab=overview`);
  const status = String(formData.get("status") ?? "active");
  if (!new Set(["active", "maintenance", "disabled"]).has(status)) {
    fail(`/dashboard/screens/${screenId}?tab=overview`, "Kies een geldige schermstatus.");
  }

  const { error } = await supabase.rpc("update_screen_v1", {
    p_location: input.location,
    p_name: input.name,
    p_orientation: input.orientation,
    p_resolution_height: input.resolutionHeight,
    p_resolution_width: input.resolutionWidth,
    p_screen_id: screenId,
    p_status: status,
    p_tenant_id: session.tenantId
  });
  if (error) fail(`/dashboard/screens/${screenId}?tab=overview`, screenMutationFailure(error.code));
  const message = status === "disabled"
    ? "Het scherm is uitgeschakeld en de gekoppelde Player is ingetrokken. Een offline Player stopt pas bij de eerstvolgende serververbinding."
    : status === "maintenance"
      ? "Onderhoudsmodus is actief. Lokale last-known-good content blijft beschikbaar; nieuwe sync en pairing wachten."
      : "Schermdetails en lifecycle zijn veilig bijgewerkt.";
  complete(`/dashboard/screens/${screenId}?tab=overview`, message, screenId);
}

export async function renamePlayerDevice(formData: FormData) {
  const { session, supabase } = await requireScreenManagement("mutate");
  const screenId = requiredUuid(formData, "screenId");
  const deviceId = requiredUuid(formData, "deviceId");
  const deviceName = String(formData.get("deviceName") ?? "").trim();
  if (deviceName.length < 2 || deviceName.length > 120) {
    fail(`/dashboard/screens/${screenId}?tab=player`, "Geef de Player een naam van 2 tot en met 120 tekens.");
  }
  const { error } = await supabase.rpc("rename_player_device_v1", {
    p_device_id: deviceId,
    p_device_name: deviceName,
    p_tenant_id: session.tenantId
  });
  if (error) fail(`/dashboard/screens/${screenId}?tab=player`, deviceMutationFailure(error.code));
  complete(`/dashboard/screens/${screenId}?tab=player`, "De Playernaam is bijgewerkt.", screenId);
}

export async function revokePlayerDevice(formData: FormData) {
  const { session, supabase } = await requireScreenManagement("mutate");
  const screenId = requiredUuid(formData, "screenId");
  const deviceId = requiredUuid(formData, "deviceId");
  const rePair = formData.get("rePair") === "true";
  if (formData.get("confirmOffline") !== "yes") {
    fail(`/dashboard/screens/${screenId}?tab=player`, "Bevestig eerst het gevolg voor een Player die nu offline is.");
  }
  const { error } = await supabase.rpc("revoke_player_device_v1", {
    p_device_id: deviceId,
    p_tenant_id: session.tenantId
  });
  if (error) fail(`/dashboard/screens/${screenId}?tab=player`, deviceMutationFailure(error.code));
  const path = rePair
    ? `/dashboard/screens/new?screen=${screenId}`
    : `/dashboard/screens/${screenId}?tab=player`;
  complete(
    path,
    rePair
      ? "De oude Player is ingetrokken. Voer nu een nieuwe tijdelijke code in."
      : "De Player is ingetrokken. Offline content kan zichtbaar blijven tot het apparaat opnieuw verbinding maakt.",
    screenId
  );
}

export async function requestScreenSyncRetry(formData: FormData) {
  const { session, supabase } = await requireScreenManagement("mutate");
  const screenId = requiredUuid(formData, "screenId");
  const { error } = await supabase.rpc("request_screen_sync_retry_v1", {
    p_screen_id: screenId,
    p_tenant_id: session.tenantId
  });
  if (error) fail(`/dashboard/screens/${screenId}?tab=sync`, deviceMutationFailure(error.code));
  complete(
    `/dashboard/screens/${screenId}?tab=sync`,
    "Het retryverzoek is vastgelegd. De Player pakt dit op bij de eerstvolgende verbinding; de huidige release blijft spelen.",
    screenId
  );
}

async function runCreateScreen(context: ScreenCommandContext, formData: FormData) {
  const input = screenInput(formData);
  const initialReleaseId = optionalUuid(formData, "initialReleaseId");
  const { data, error } = await context.supabase.rpc("create_screen_v1", {
    p_initial_release_id: initialReleaseId,
    p_location: input.location,
    p_name: input.name,
    p_orientation: input.orientation,
    p_resolution_height: input.resolutionHeight,
    p_resolution_width: input.resolutionWidth,
    p_tenant_id: context.session.tenantId
  });
  if (error || typeof data !== "string") {
    fail("/dashboard/screens/new", screenMutationFailure(error?.code));
  }
  return data;
}

function screenInput(formData: FormData, failurePath = "/dashboard/screens/new") {
  const name = String(formData.get("name") ?? "").trim();
  const location = String(formData.get("location") ?? "").trim();
  const orientation = String(formData.get("orientation") ?? "landscape");
  const resolutionWidth = Number.parseInt(String(formData.get("resolutionWidth") ?? "1920"), 10);
  const resolutionHeight = Number.parseInt(String(formData.get("resolutionHeight") ?? "1080"), 10);
  if (name.length < 2 || name.length > 120) {
    fail(failurePath, "Geef het scherm een naam van 2 tot en met 120 tekens.");
  }
  if (location.length > 160) {
    fail(failurePath, "De locatie mag maximaal 160 tekens bevatten.");
  }
  if (orientation !== "landscape" && orientation !== "portrait") {
    fail(failurePath, "Kies liggende of staande oriëntatie.");
  }
  if (!Number.isInteger(resolutionWidth) || resolutionWidth < 320 || resolutionWidth > 7680 || !Number.isInteger(resolutionHeight) || resolutionHeight < 240 || resolutionHeight > 4320) {
    fail(failurePath, "De schermresolutie valt buiten het ondersteunde bereik.");
  }
  return { location, name, orientation, resolutionHeight, resolutionWidth };
}

async function requireScreenManagement(operation: "mutate" | "pair") {
  const session = await requireTenantCapability("tenant.screen.manage", operation);
  const supabase = await createControlSupabaseClient();
  if (!session.isLive || !session.tenantId || !supabase) {
    fail("/dashboard/screens", "Live Supabase is niet beschikbaar. Er is niets gewijzigd; herstel de configuratie en log opnieuw in.");
  }
  return { session, supabase };
}

function normalizePairingCode(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function screenMutationFailure(code: string | undefined) {
  if (code === "P0001") return "De schermlimiet is bereikt. Er is niets aangemaakt; verhoog eerst de limiet of beheer een bestaand scherm.";
  if (code === "23514") return "De schermgegevens zijn niet geldig. Er is niets gewijzigd; controleer naam, oriëntatie, resolutie en content.";
  if (code === "42501") return "Deze schermmutatie is niet toegestaan. Er is niets gewijzigd; controleer je beheerrechten en de verenigingsstatus.";
  if (code === "P0002") return "Het scherm bestaat niet meer binnen deze vereniging. Vernieuw de schermvloot.";
  return "Het scherm kon niet veilig worden opgeslagen. Er is niets gewijzigd; probeer opnieuw.";
}

function pairingDatabaseFailure(code: string | undefined) {
  return code === "42501"
    ? "Je mag deze Player niet koppelen. Er is niets gewijzigd; gebruik een beheerder binnen dezelfde vereniging."
    : "Koppelen is niet voltooid. De Player blijft ongekoppeld; probeer met een nieuwe code opnieuw.";
}

function pairingResultFailure(code: string | null) {
  if (code === "RATE_LIMITED") return "Er zijn te veel koppelcodes geprobeerd. De Player blijft ongekoppeld; wacht vijf minuten en probeer daarna één nieuwe code.";
  if (code === "EXPIRED") return "De koppelcode is verlopen. De Player blijft ongekoppeld; vernieuw de Player en voer de nieuwe code in.";
  if (code === "SCREEN_UNAVAILABLE") return "Dit scherm staat niet actief. Activeer het scherm voordat je een Player koppelt.";
  return "De code is ongeldig of al gebruikt. De Player blijft ongekoppeld; vernieuw de Player voor een nieuwe code.";
}

function deviceMutationFailure(code: string | undefined) {
  if (code === "42501") return "Deze deviceactie is niet toegestaan. Er is niets gewijzigd; controleer je beheerrechten en de verenigingsstatus.";
  if (code === "P0002") return "Er is geen actieve gekoppelde Player voor deze actie. Controleer de Playerstatus of koppel opnieuw.";
  if (code === "23514") return "De Playergegevens zijn niet geldig. Er is niets gewijzigd.";
  return "De deviceactie kon niet veilig worden uitgevoerd. Er is niets gewijzigd; probeer opnieuw.";
}

function commandResult(value: unknown) {
  if (!value || typeof value !== "object") return { code: null, ok: false };
  const result = value as { code?: unknown; ok?: unknown };
  return {
    code: typeof result.code === "string" ? result.code : null,
    ok: result.ok === true
  };
}

function requiredUuid(formData: FormData, name: string) {
  const value = optionalUuid(formData, name);
  if (!value) fail("/dashboard/screens", "De gekozen scherm- of Playerreferentie is ongeldig. Vernieuw de pagina.");
  return value;
}

function optionalUuid(formData: FormData, name: string) {
  const value = String(formData.get(name) ?? "").trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    ? value
    : null;
}

function fail(path: string, message: string): never {
  redirect(withMessage(path, "fout", message));
}

function complete(path: string, message: string, screenId: string): never {
  revalidatePath("/dashboard/screens");
  revalidatePath(`/dashboard/screens/${screenId}`);
  revalidatePath("/dashboard/screens/new");
  redirect(withMessage(path, "succes", message));
}

function withMessage(path: string, key: "fout" | "succes", message: string) {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}${key}=${encodeURIComponent(message)}`;
}
