import "server-only";

import { createControlSupabaseClient } from "../../../../lib/supabase/server";

export type ScreenGroupListItem = {
  defaultContent: string | null;
  description: string | null;
  id: string;
  memberNames: string[];
  name: string;
  revision: number;
  status: string;
  updatedAt: string;
};

export async function loadScreenGroups(tenantId: string) {
  const supabase = await createControlSupabaseClient();
  if (!supabase) return { error: "De beveiligde datasessie ontbreekt.", groups: [], screens: [] };

  const [groups, memberships, screens, playlists, releases] = await Promise.all([
    supabase
      .from("screen_groups")
      .select("id, name, description, status, revision, default_playlist_id, default_release_id, updated_at")
      .eq("tenant_id", tenantId)
      .order("updated_at", { ascending: false }),
    supabase
      .from("screen_group_memberships")
      .select("screen_group_id, screen_id")
      .eq("tenant_id", tenantId),
    supabase
      .from("screens")
      .select("id, name, status")
      .eq("tenant_id", tenantId)
      .is("deleted_at", null)
      .order("name"),
    supabase
      .from("playlists")
      .select("id, name")
      .eq("tenant_id", tenantId),
    supabase
      .from("playlist_releases")
      .select("id, playlist_id, version")
      .eq("tenant_id", tenantId)
  ]);

  const error = [groups.error, memberships.error, screens.error, playlists.error, releases.error].find(Boolean);
  if (error) {
    console.error("Schermgroepen laden mislukt", error);
    return { error: "De schermgroepen konden niet volledig worden geladen.", groups: [], screens: [] };
  }

  const screenNames = new Map((screens.data ?? []).map((screen) => [screen.id, screen.name]));
  const playlistNames = new Map((playlists.data ?? []).map((playlist) => [playlist.id, playlist.name]));
  const releaseById = new Map((releases.data ?? []).map((release) => [release.id, release]));

  return {
    error: null,
    groups: (groups.data ?? []).map((group): ScreenGroupListItem => {
      const release = group.default_release_id
        ? releaseById.get(group.default_release_id)
        : undefined;
      const playlistId = release?.playlist_id ?? group.default_playlist_id;
      return {
        defaultContent: playlistId
          ? `${playlistNames.get(playlistId) ?? "Verwijderde playlist"}${release ? ` · versie ${release.version}` : ""}`
          : null,
        description: group.description,
        id: group.id,
        memberNames: (memberships.data ?? [])
          .filter((membership) => membership.screen_group_id === group.id)
          .flatMap((membership) => {
            const name = screenNames.get(membership.screen_id);
            return name ? [name] : [];
          }),
        name: group.name,
        revision: Number(group.revision),
        status: group.status,
        updatedAt: group.updated_at
      };
    }),
    screens: screens.data ?? []
  };
}
