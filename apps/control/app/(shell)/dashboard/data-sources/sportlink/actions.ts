"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createHash } from "node:crypto";

import {
  guessBirthdayImportMapping,
  normalizeBirthdayImportRows,
  parseBirthdayImportFile,
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

export async function setSportlinkBirthdays(formData: FormData) {
  await requireTenantControlSession("tenant.data_source.manage");
  const connectionId = String(formData.get("connectionId") ?? "");
  const enabled = formData.get("enabled") === "on";
  const supabase = await createControlSupabaseClient();
  const result = supabase && /^[0-9a-f-]{36}$/iu.test(connectionId)
    ? await supabase.rpc("activate_sportlink_birthdays_v1", {
      p_connection_id: connectionId, p_enabled: enabled
    }) : null;
  if (!result || result.error) {
    redirect("/dashboard/data-sources/sportlink?fout=BIRTHDAYS_ACTIVATION_FAILED#verjaardagen");
  }
  revalidatePath("/dashboard/data-sources/sportlink");
  redirect(`/dashboard/data-sources/sportlink?succes=Verjaardagen+zijn+${enabled ? "geactiveerd" : "gepauzeerd"}.#verjaardagen`);
}

export async function requestBirthdaySync(formData: FormData) {
  await requireTenantControlSession("tenant.data_source.manage");
  const connectionId = String(formData.get("connectionId") ?? "");
  const supabase = await createControlSupabaseClient();
  const result = supabase && /^[0-9a-f-]{36}$/iu.test(connectionId)
    ? await supabase.rpc("request_sportlink_birthday_sync_v1", { p_connection_id: connectionId })
    : null;
  if (!result || result.error) {
    redirect("/dashboard/data-sources/sportlink?fout=BIRTHDAYS_SYNC_COOLDOWN#verjaardagen");
  }
  revalidatePath("/dashboard/data-sources/sportlink");
  redirect("/dashboard/data-sources/sportlink?succes=De+verjaardagen+worden+veilig+ververst.#verjaardagen");
}

export async function previewBirthdayImport(formData: FormData) {
  await requireTenantControlSession("tenant.data_source.manage");
  const file = formData.get("file");
  if (!(file instanceof File)) return { error: "Kies een CSV- of XLSX-bestand." };
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const parsed = await parseBirthdayImportFile(file.name, bytes);
    const mapping = guessBirthdayImportMapping(parsed.headers);
    return {
      checksum: createHash("sha256").update(bytes).digest("hex"),
      fileName: parsed.fileName, headers: parsed.headers, mapping,
      normalized: normalizeBirthdayImportRows(parsed.rows, mapping), rows: parsed.rows
    };
  } catch {
    return { error: "Het bestand kon niet veilig worden gelezen. Gebruik CSV of XLSX, maximaal 8 MB en 10.000 regels." };
  }
}

export async function applyBirthdayImport(input: {
  checksum: string; connectionId: string; fileName: string; idempotencyKey: string;
  mapping: Record<string, string | null>; rows: Array<Record<string, boolean | number | string | null>>;
}) {
  const session = await requireTenantControlSession("tenant.data_source.manage");
  if (!session.tenantId || !/^[0-9a-f-]{36}$/iu.test(input.connectionId) ||
    !/^[0-9a-f-]{36}$/iu.test(input.idempotencyKey) ||
    !/^[a-f0-9]{64}$/u.test(input.checksum) || input.rows.length > 10_000) {
    return { error: "De importpreview is verlopen of ongeldig." };
  }
  const normalized = normalizeBirthdayImportRows(input.rows, input.mapping as never);
  const supabase = await createControlSupabaseClient();
  const result = supabase ? await supabase.rpc("apply_sportlink_birthday_import_v1", {
    p_connection_id: input.connectionId, p_idempotency_key: input.idempotencyKey,
    p_rows: normalized, p_source_checksum_sha256: input.checksum,
    p_source_file_name: input.fileName, p_tenant_id: session.tenantId
  }) : null;
  if (!result || result.error) return { error: "De verrijking kon niet worden toegepast. Bestaande betrouwbare waarden zijn ongewijzigd." };
  revalidatePath("/dashboard/data-sources/sportlink");
  return { data: result.data };
}

export async function remapBirthdayImport(input: {
  mapping: Record<string, string | null>;
  rows: Array<Record<string, boolean | number | string | null>>;
}) {
  await requireTenantControlSession("tenant.data_source.manage");
  if (!Array.isArray(input.rows) || input.rows.length > 10_000) return [];
  return normalizeBirthdayImportRows(input.rows, input.mapping as never);
}

export async function rollbackBirthdayImport(formData: FormData) {
  await requireTenantControlSession("tenant.data_source.manage");
  const importId = String(formData.get("importId") ?? "");
  const supabase = await createControlSupabaseClient();
  const result = supabase && /^[0-9a-f-]{36}$/iu.test(importId)
    ? await supabase.rpc("rollback_sportlink_birthday_import_v1", { p_import_id: importId })
    : null;
  if (!result || result.error) redirect("/dashboard/data-sources/sportlink?fout=BIRTHDAYS_ROLLBACK_FAILED#verjaardagen");
  revalidatePath("/dashboard/data-sources/sportlink");
  redirect("/dashboard/data-sources/sportlink?succes=De+laatste+geboortejaarimport+is+veilig+teruggedraaid.#verjaardagen");
}

export async function resolveBirthdayConflict(formData: FormData) {
  await requireTenantControlSession("tenant.data_source.manage");
  const birthdayId = String(formData.get("birthdayId") ?? "");
  const memberId = String(formData.get("memberId") ?? "");
  const supabase = await createControlSupabaseClient();
  const result = supabase && [birthdayId, memberId].every((value) => /^[0-9a-f-]{36}$/iu.test(value))
    ? await supabase.rpc("resolve_sportlink_birthday_match_v1", { p_birthday_id: birthdayId, p_team_member_id: memberId })
    : null;
  if (!result || result.error) redirect("/dashboard/data-sources/sportlink?fout=BIRTHDAYS_MATCH_FAILED#verjaardagen");
  revalidatePath("/dashboard/data-sources/sportlink");
  redirect("/dashboard/data-sources/sportlink?succes=De+persoon+is+handmatig+en+controleerbaar+gekoppeld.#verjaardagen");
}

export async function deleteBirthdayEnrichments(formData: FormData) {
  await requireTenantControlSession("tenant.data_source.manage");
  const connectionId = String(formData.get("connectionId") ?? "");
  const confirmed = formData.get("confirm") === "VERWIJDEREN";
  const supabase = await createControlSupabaseClient();
  const result = confirmed && supabase && /^[0-9a-f-]{36}$/iu.test(connectionId)
    ? await supabase.rpc("delete_sportlink_birthday_enrichments_v1", {
      p_connection_id: connectionId
    }) : null;
  if (!result || result.error) {
    redirect("/dashboard/data-sources/sportlink?fout=BIRTHDAYS_DELETE_FAILED#verjaardagen");
  }
  revalidatePath("/dashboard/data-sources/sportlink");
  redirect("/dashboard/data-sources/sportlink?succes=Alle+verjaardagsverrijkingen+zijn+verwijderd.#verjaardagen");
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
const frequencies = [
  "five_minutes",
  "hourly",
  "daily",
  "weekly",
  "monthly"
] as const;
