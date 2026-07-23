import "server-only";

import { createControlSupabaseClient } from "../../../../lib/supabase/server";

export type ContentScheduleListItem = {
  enabled: boolean;
  endsAt: string | null;
  id: string;
  name: string;
  playlistName: string;
  priority: number;
  recurrence: Record<string, unknown>;
  releaseId: string;
  releaseVersion: number;
  revision: number;
  scheduleKind: string;
  source: string;
  startsAt: string;
  targetId: string;
  targetKind: string;
  targetName: string;
  timezoneName: string;
};

export async function loadContentSchedules(tenantId: string) {
  const supabase = await createControlSupabaseClient();
  if (!supabase) return planningFailure("De beveiligde datasessie ontbreekt.");

  const [schedules, screens, groups, memberships, playlists, releases, settings] = await Promise.all([
    supabase
      .from("content_schedules")
      .select("id, name, target_kind, target_screen_id, target_screen_group_id, playlist_id, release_id, timezone_name, schedule_kind, starts_at, ends_at, recurrence_json, priority, source, enabled, revision")
      .eq("tenant_id", tenantId)
      .order("starts_at"),
    supabase
      .from("screens")
      .select("id, name, status")
      .eq("tenant_id", tenantId)
      .is("deleted_at", null)
      .order("name"),
    supabase
      .from("screen_groups")
      .select("id, name")
      .eq("tenant_id", tenantId)
      .eq("status", "active")
      .order("name"),
    supabase
      .from("screen_group_memberships")
      .select("screen_group_id, screen_id")
      .eq("tenant_id", tenantId),
    supabase
      .from("playlists")
      .select("id, name")
      .eq("tenant_id", tenantId)
      .order("name"),
    supabase
      .from("playlist_releases")
      .select("id, playlist_id, version")
      .eq("tenant_id", tenantId)
      .order("version", { ascending: false }),
    supabase
      .from("tenant_settings")
      .select("timezone_name")
      .eq("tenant_id", tenantId)
      .maybeSingle()
  ]);

  const error = [schedules.error, screens.error, groups.error, memberships.error, playlists.error, releases.error, settings.error].find(Boolean);
  if (error) {
    console.error("Publisherplanning laden mislukt", error);
    return planningFailure("De planning kon niet volledig worden geladen.");
  }

  const screenNames = new Map((screens.data ?? []).map((screen) => [screen.id, screen.name]));
  const groupNames = new Map((groups.data ?? []).map((group) => [group.id, group.name]));
  const playlistNames = new Map((playlists.data ?? []).map((playlist) => [playlist.id, playlist.name]));
  const releaseById = new Map((releases.data ?? []).map((release) => [release.id, release]));

  return {
    error: null,
    groups: (groups.data ?? []).map((group) => ({
      id: group.id,
      memberCount: (memberships.data ?? []).filter((membership) => membership.screen_group_id === group.id).length,
      memberIds: (memberships.data ?? [])
        .filter((membership) => membership.screen_group_id === group.id)
        .map((membership) => membership.screen_id),
      name: group.name
    })),
    releases: (releases.data ?? []).map((release) => ({
      id: release.id,
      label: `${playlistNames.get(release.playlist_id) ?? "Verwijderde playlist"} · versie ${release.version}`,
      playlistId: release.playlist_id
    })),
    schedules: (schedules.data ?? []).map((schedule): ContentScheduleListItem => {
      const release = releaseById.get(schedule.release_id);
      return {
        enabled: schedule.enabled,
        endsAt: schedule.ends_at,
        id: schedule.id,
        name: schedule.name,
        playlistName: playlistNames.get(schedule.playlist_id) ?? "Verwijderde playlist",
        priority: schedule.priority,
        recurrence: jsonRecord(schedule.recurrence_json),
        releaseId: schedule.release_id,
        releaseVersion: release?.version ?? 0,
        revision: Number(schedule.revision),
        scheduleKind: schedule.schedule_kind,
        source: schedule.source,
        startsAt: schedule.starts_at,
        targetId: schedule.target_kind === "screen"
          ? schedule.target_screen_id ?? ""
          : schedule.target_screen_group_id ?? "",
        targetKind: schedule.target_kind,
        targetName: schedule.target_kind === "screen"
          ? screenNames.get(schedule.target_screen_id ?? "") ?? "Verwijderd scherm"
          : groupNames.get(schedule.target_screen_group_id ?? "") ?? "Verwijderde groep",
        timezoneName: schedule.timezone_name
      };
    }),
    screens: (screens.data ?? []).map((screen) => ({
      disabled: screen.status === "disabled",
      id: screen.id,
      name: screen.name,
      status: screen.status
    })),
    timezoneName: settings.data?.timezone_name ?? "Europe/Amsterdam"
  };
}

function jsonRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function planningFailure(error: string) {
  return {
    error,
    groups: [],
    releases: [],
    schedules: [],
    screens: [],
    timezoneName: "Europe/Amsterdam"
  };
}
