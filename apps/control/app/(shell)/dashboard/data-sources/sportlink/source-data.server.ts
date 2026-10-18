import "server-only";
import { createControlSupabaseClient } from "../../../../../lib/supabase/server";
import { loadLatestSportlinkRuns } from "./sportlink-status";

export async function loadSportlinkSourceData(tenantId: string, connectionId?: string) {
  const supabase = await createControlSupabaseClient();
  if (!supabase) return null;
  let query = supabase.from("sportlink_connections")
    .select("id,status,detected_club_name,client_id_suffix,last_tested_at,last_success_at,last_error_code,privacy_birthdays_enabled,authoring_revision,selected_team_codes")
    .eq("tenant_id", tenantId).neq("status", "revoked");
  if (connectionId) query = query.eq("id", connectionId);
  const result = await query.maybeSingle();
  if (!result.data) return null;
  const [policiesResult, birthdayStatusResult, birthdayConflictsResult, birthdayMembersResult, birthdayImportsResult] = await Promise.all([
    supabase.from("sportlink_sync_policies")
    .select("id,dataset_group,frequency,enabled,next_sync_at,last_success_at")
    .eq("tenant_id", tenantId).eq("connection_id", result.data.id).order("dataset_group"),
    supabase.rpc("get_sportlink_birthday_status_v1", { p_connection_id: result.data.id }),
    supabase.from("sportlink_birthdays").select("id,display_name,normalized_name").eq("tenant_id", tenantId).eq("connection_id", result.data.id).eq("active", true).eq("match_status", "ambiguous").order("display_name").limit(100),
    supabase.from("sportlink_team_members").select("id,display_name,normalized_name,role,team_assignments").eq("tenant_id", tenantId).eq("connection_id", result.data.id).eq("active", true).order("display_name").limit(500),
    supabase.from("sportlink_birthday_imports").select("id,source_file_name,status,valid_count,invalid_count,duplicate_count,conflict_count,created_at").eq("tenant_id", tenantId).eq("connection_id", result.data.id).order("created_at", { ascending: false }).limit(10)
  ]);
  const latestRunByGroup = await loadLatestSportlinkRuns(
    supabase, tenantId, result.data.id,
    (policiesResult.data ?? []).map((policy) => policy.dataset_group)
  );
  return {
    birthdayConflicts: birthdayConflictsResult.data ?? [],
    birthdayImports: birthdayImportsResult.data ?? [],
    birthdayMembers: birthdayMembersResult.data ?? [],
    birthdayStatus: birthdayStatus(birthdayStatusResult.data),
    connection: result.data,
    policiesUnavailable: Boolean(policiesResult.error),
    policies: (policiesResult.data ?? []).map((policy) => {
      const latestRun = latestRunByGroup.get(policy.dataset_group);
      return {
        ...policy,
        last_error_code: latestRun?.errorCode ?? null,
        last_run_status: latestRun?.status ?? null,
        run_status_unavailable: latestRun?.unavailable ?? false
      };
    })
  };
}

function birthdayStatus(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return emptyBirthdayStatus();
  const status = value as Record<string, unknown>;
  const counts = status.counts && typeof status.counts === "object" && !Array.isArray(status.counts)
    ? status.counts as Record<string, unknown> : {};
  return {
    active: status.active === true,
    counts: { ambiguous: Number(counts.ambiguous ?? 0), birthdays: Number(counts.birthdays ?? 0), knownAge: Number(counts.knownAge ?? 0), matched: Number(counts.matched ?? 0), withPhoto: Number(counts.withPhoto ?? 0) },
    featureEnabled: status.featureEnabled === true,
    freshness: String(status.freshness ?? "never"),
    lastErrorCode: typeof status.lastErrorCode === "string" ? status.lastErrorCode : null,
    lastSuccessAt: typeof status.lastSuccessAt === "string" ? status.lastSuccessAt : null,
    nextSyncAt: typeof status.nextSyncAt === "string" ? status.nextSyncAt : null
  };
}

export function emptyBirthdayStatus() { return { active: false, counts: { ambiguous: 0, birthdays: 0, knownAge: 0, matched: 0, withPhoto: 0 }, featureEnabled: false, freshness: "never", lastErrorCode: null, lastSuccessAt: null, nextSyncAt: null }; }
