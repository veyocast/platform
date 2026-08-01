"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  SportlinkClient, SportlinkClientError, encryptSportlinkClientId,
  mapSportlinkClub
} from "@veyocast/integrations/server";

import { requireTenantControlSession } from "../../../../../lib/control-session";
import { createControlSupabaseClient } from "../../../../../lib/supabase/server";

export async function connectSportlink(formData: FormData) {
  const session = await requireTenantControlSession("tenant.data_source.manage");
  const clientId = String(formData.get("clientId") ?? "").trim();
  if (!clientId || clientId.length > 512) {
    redirect("/dashboard/data-sources/sportlink?fout=CLIENT_ID_INVALID");
  }
  const encryptionKey = process.env.SPORTLINK_CONFIG_ENCRYPTION_KEY;
  if (!encryptionKey) {
    redirect("/dashboard/data-sources/sportlink?fout=CONFIGURATION_UNAVAILABLE");
  }
  try {
    const client = new SportlinkClient(clientId);
    const test = await client.testConnection();
    const club = mapSportlinkClub(test.club.payload);
    if (!club) {
      redirect("/dashboard/data-sources/sportlink?fout=CLUB_NOT_FOUND");
    }
    const encrypted = encryptSportlinkClientId(clientId, encryptionKey);
    const supabase = await createControlSupabaseClient();
    if (!supabase) redirect("/dashboard/data-sources/sportlink?fout=SAVE_FAILED");
    const result = await supabase.rpc("upsert_sportlink_connection_v1", {
      p_client_id_suffix: clientId.slice(-4),
      p_data_source_name: `Sportlink · ${club.name}`,
      p_detected_club_name: club.name,
      p_encrypted_client_id: encrypted.ciphertext,
      p_encryption_iv: encrypted.iv,
      p_encryption_tag: encrypted.tag,
      p_tenant_id: session.tenantId!
    });
    if (result.error) redirect("/dashboard/data-sources/sportlink?fout=SAVE_FAILED");
  } catch (error) {
    const code = error instanceof SportlinkClientError ? error.code : "CONNECTION_FAILED";
    redirect(`/dashboard/data-sources/sportlink?fout=${encodeURIComponent(code)}`);
  }
  revalidatePath("/dashboard/data-sources");
  revalidatePath("/dashboard/data-sources/sportlink");
  redirect("/dashboard/data-sources/sportlink?succes=Verbinding+getest+en+veilig+opgeslagen.");
}

export async function updateSportlinkPolicy(formData: FormData) {
  await requireTenantControlSession("tenant.data_source.manage");
  const connectionId = String(formData.get("connectionId") ?? "");
  const datasetGroup = String(formData.get("datasetGroup") ?? "");
  const frequency = String(formData.get("frequency") ?? "");
  const enabled = formData.get("enabled") === "on";
  if (
    !/^[0-9a-f-]{36}$/i.test(connectionId) ||
    !syncGroups.includes(datasetGroup as typeof syncGroups[number]) ||
    !frequencies.includes(frequency as typeof frequencies[number])
  ) {
    redirect("/dashboard/data-sources/sportlink?fout=POLICY_INVALID");
  }
  const supabase = await createControlSupabaseClient();
  if (!supabase) redirect("/dashboard/data-sources/sportlink?fout=SAVE_FAILED");
  const result = await supabase.rpc("update_sportlink_sync_policy_v1", {
    p_connection_id: connectionId,
    p_dataset_group: datasetGroup,
    p_enabled: enabled,
    p_frequency: frequency
  });
  if (result.error) {
    const code = result.error.code === "42501"
      ? "PRIVACY_OPT_IN_REQUIRED"
      : "POLICY_SAVE_FAILED";
    redirect(`/dashboard/data-sources/sportlink?fout=${code}`);
  }
  revalidatePath("/dashboard/data-sources/sportlink");
  redirect("/dashboard/data-sources/sportlink?succes=Synchronisatiebeleid+bijgewerkt.");
}

export async function requestSportlinkSync(formData: FormData) {
  await requireTenantControlSession("tenant.data_source.manage");
  const connectionId = String(formData.get("connectionId") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(connectionId)) {
    redirect("/dashboard/data-sources/sportlink?fout=SYNC_FAILED");
  }
  const supabase = await createControlSupabaseClient();
  if (!supabase) redirect("/dashboard/data-sources/sportlink?fout=SYNC_FAILED");
  const result = await supabase.rpc("request_sportlink_sync_v1", {
    p_connection_id: connectionId
  });
  if (result.error) {
    redirect(`/dashboard/data-sources/sportlink?fout=${
      result.error.code === "55000" ? "SYNC_COOLDOWN" : "SYNC_FAILED"
    }`);
  }
  revalidatePath("/dashboard/data-sources/sportlink");
  revalidatePath("/dashboard/slides/new");
  redirect("/dashboard/data-sources/sportlink?succes=Synchronisatie+ingepland.+De+status+wordt+automatisch+bijgewerkt.");
}

const syncGroups = [
  "club_profile",
  "teams",
  "competitions",
  "matches",
  "match_details",
  "activities",
  "public_people",
  "volunteers"
] as const;
const frequencies = ["hourly", "daily", "weekly", "monthly"] as const;
