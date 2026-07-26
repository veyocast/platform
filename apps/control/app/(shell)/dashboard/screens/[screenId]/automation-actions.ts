"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { screenAutomationSettingsInputSchema } from "@veyocast/contracts";

import { requireTenantCapability } from "../../../../../lib/control-session";
import { createControlSupabaseClient } from "../../../../../lib/supabase/server";

export async function saveScreenAutomation(formData: FormData) {
  const { session, supabase } = await automationWriter();
  const screenId = requiredUuid(formData, "screenId");
  const path = automationPath(screenId);
  const expectedRevision = Number.parseInt(
    String(formData.get("expectedRevision") ?? "0"),
    10
  );
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0) {
    fail(path, "De configuratierevisie is ongeldig. Vernieuw de pagina.");
  }
  let input: unknown;
  try {
    input = JSON.parse(String(formData.get("settingsJson") ?? ""));
  } catch {
    fail(path, "De automatiseringsconfiguratie is onvolledig. Controleer de velden.");
  }
  const parsed = screenAutomationSettingsInputSchema.safeParse(input);
  if (!parsed.success) {
    fail(
      path,
      parsed.error.issues[0]?.message
        ?? "Controleer de tijden, uitzonderingen en instellingen."
    );
  }
  const { error } = await supabase.rpc("save_screen_automation_v1", {
    p_accept_hdmi_cec_disclaimer:
      formData.get("acceptHdmiCecDisclaimer") === "yes",
    p_expected_revision: expectedRevision,
    p_screen_id: screenId,
    p_settings: parsed.data,
    p_tenant_id: session.tenantId
  });
  if (error) {
    fail(path, automationSaveFailure(error.code));
  }
  complete(
    screenId,
    "Automatisering is opgeslagen. De Player ontvangt de nieuwe revisie bij de eerstvolgende heartbeat."
  );
}

export async function requestScreenAutomationTest(formData: FormData) {
  const { session, supabase } = await automationWriter();
  const screenId = requiredUuid(formData, "screenId");
  const path = automationPath(screenId);
  if (formData.get("confirmScope") !== "yes") {
    fail(
      path,
      "Bevestig eerst dat een Playerstart niet bewijst dat het televisiepaneel beeld toont."
    );
  }
  const { error } = await supabase.rpc("request_screen_automation_test_v1", {
    p_screen_id: screenId,
    p_tenant_id: session.tenantId
  });
  if (error) {
    fail(path, automationTestFailure(error.code));
  }
  complete(
    screenId,
    "Testopdracht aangemaakt. Het online apparaat ontvangt deze via de eerstvolgende heartbeat."
  );
}

async function automationWriter() {
  const session = await requireTenantCapability("tenant.screen.manage", "mutate");
  const supabase = await createControlSupabaseClient();
  if (!session.isLive || !session.tenantId || !supabase) {
    fail(
      "/dashboard/screens",
      "Live Supabase is niet beschikbaar. Er is niets gewijzigd."
    );
  }
  return { session, supabase };
}

function automationSaveFailure(code: string | undefined) {
  if (code === "40001") {
    return "Iemand anders heeft deze automatisering gewijzigd. Vernieuw de pagina en controleer de nieuwe revisie.";
  }
  if (code === "42501") {
    return "Je hebt geen recht om schermautomatisering te wijzigen.";
  }
  if (code === "22023") {
    return "De gekozen tijdzone wordt niet ondersteund.";
  }
  if (code === "23503") {
    return "Het scherm bestaat niet meer of hoort niet bij deze vereniging.";
  }
  if (code === "23514") {
    return "De configuratie is niet geldig. Controleer overlap, tijdvensters en de HDMI-CEC-bevestiging.";
  }
  return "Automatisering kon niet veilig worden opgeslagen. Er is niets gewijzigd.";
}

function automationTestFailure(code: string | undefined) {
  if (code === "0A000") {
    return "Werk de VeyoCast Player bij om schermautomatisering te testen.";
  }
  if (code === "55000") {
    return "De Player is offline. Zonder FCM kan VeyoCast een gesloten of offline app niet op afstand starten.";
  }
  if (code === "23503") {
    return "Er is geen actieve Player aan dit scherm gekoppeld.";
  }
  if (code === "42501") {
    return "Je hebt geen recht om een starttest uit te voeren.";
  }
  return "De testopdracht kon niet veilig worden aangemaakt.";
}

function requiredUuid(formData: FormData, name: string) {
  const value = String(formData.get(name) ?? "").trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    fail("/dashboard/screens", "De schermreferentie is ongeldig. Vernieuw de pagina.");
  }
  return value;
}

function complete(screenId: string, message: string): never {
  revalidatePath("/dashboard/screens");
  revalidatePath(`/dashboard/screens/${screenId}`);
  redirect(withMessage(automationPath(screenId), "succes", message));
}

function fail(path: string, message: string): never {
  redirect(withMessage(path, "fout", message));
}

function automationPath(screenId: string) {
  return `/dashboard/screens/${screenId}?tab=automation`;
}

function withMessage(path: string, key: "fout" | "succes", message: string) {
  return `${path}&${key}=${encodeURIComponent(message)}`;
}
