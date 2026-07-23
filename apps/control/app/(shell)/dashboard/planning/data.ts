import "server-only";

import { createControlSupabaseClient } from "../../../../lib/supabase/server";

export type ContentScheduleListItem = {
  enabled: boolean;
  endsAt: string | null;
  id: string;
  name: string;
  playlistName: string;
  priority: number;
  releaseVersion: number;
  revision: number;
  scheduleKind: string;
  source: string;
  startsAt: string;
  targetKind: string;
  targetName: string;
  timezoneName: string;
};

export async function loadContentSchedules(tenantId: string) {
  const supabase = await createControlSupabaseClient();
  if (!supabase) return planningFailure("De beveiligde datasessie ontbreekt.");

  const [schedules, screens, groups, playlists, releases, settings] = await Promise.all([
    supabase
      .from("content_schedules")
      .select("id, name, target_kind, target_screen_id, target_screen_group_id, playlist_id, release_id, timezone_name, schedule_kind, starts_at, ends_at, priority, source, enabled, revision")
      .eq("tenant_id", tenantId)
      .order("starts_at"),
    supabase
      .from("screens")
      .select("id, name")
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

  const error = [schedules.error, screens.error, groups.error, playlists.error, releases.error, settings.error].find(Boolean);
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
    groups: groups.data ?? [],
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
        releaseVersion: release?.version ?? 0,
        revision: Number(schedule.revision),
        scheduleKind: schedule.schedule_kind,
        source: schedule.source,
        startsAt: schedule.starts_at,
        targetKind: schedule.target_kind,
        targetName: schedule.target_kind === "screen"
          ? screenNames.get(schedule.target_screen_id ?? "") ?? "Verwijderd scherm"
          : groupNames.get(schedule.target_screen_group_id ?? "") ?? "Verwijderde groep",
        timezoneName: schedule.timezone_name
      };
    }),
    screens: screens.data ?? [],
    timezoneName: settings.data?.timezone_name ?? "Europe/Amsterdam"
  };
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
