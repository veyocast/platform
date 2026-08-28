"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { sportlinkBirthdayConfigurationSchema } from "@veyocast/contracts";

import { requireTenantControlSession } from "../../../../../../../lib/control-session";
import { createControlSupabaseClient } from "../../../../../../../lib/supabase/server";

export async function createBirthdaySlide(formData: FormData) {
  const session = await requireTenantControlSession("tenant.dynamic_slide.write");
  const configuration = sportlinkBirthdayConfigurationSchema.safeParse(
    safeJson(String(formData.get("configuration") ?? ""))
  );
  const dataSourceId = String(formData.get("dataSourceId") ?? "");
  const templateVersionId = String(formData.get("templateVersionId") ?? "");
  const name = String(formData.get("name") ?? "Verjaardagen").trim();
  if (!configuration.success || !uuid(dataSourceId) || !uuid(templateVersionId) ||
    !name || name.length > 160 || !session.tenantId) {
    redirect("/dashboard/studio/sportlink/birthdays/new?fout=Controleer+de+instellingen+en+probeer+opnieuw.");
  }
  const supabase = await createControlSupabaseClient();
  const result = supabase ? await supabase.rpc("create_sportlink_birthday_slide_v1", {
    p_configuration: configuration.data,
    p_data_source_id: dataSourceId,
    p_name: name,
    p_template_version_id: templateVersionId,
    p_tenant_id: session.tenantId
  }) : null;
  if (!result || result.error || !result.data) {
    redirect("/dashboard/studio/sportlink/birthdays/new?fout=De+verjaardagsslide+kon+niet+veilig+worden+aangemaakt.+Controleer+de+Sportlink-status.");
  }
  revalidatePath("/dashboard/slides");
  redirect("/dashboard/slides?succes=De+verjaardagsslide+is+aangemaakt.+De+eerste+immutable+snapshot+wordt+nu+gerenderd.");
}

export async function refreshBirthdays(formData: FormData) {
  await requireTenantControlSession("tenant.data_source.manage");
  const connectionId = String(formData.get("connectionId") ?? "");
  const supabase = await createControlSupabaseClient();
  const result = supabase && uuid(connectionId)
    ? await supabase.rpc("request_sportlink_birthday_sync_v1", { p_connection_id: connectionId })
    : null;
  const suffix = result?.error
    ? "fout=Er+is+recent+al+ververst+of+de+module+is+niet+actief.+Probeer+het+over+vijftien+minuten+opnieuw."
    : "succes=De+verjaardagen+worden+op+de+achtergrond+ververst.";
  revalidatePath("/dashboard/studio/sportlink/birthdays/new");
  redirect(`/dashboard/studio/sportlink/birthdays/new?${suffix}`);
}

function safeJson(value: string): unknown {
  try { return JSON.parse(value); } catch { return null; }
}

function uuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value);
}
