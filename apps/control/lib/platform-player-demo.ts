import "server-only";

import { createControlSupabaseClient } from "./supabase/server";

export type PlatformPlayerDemoOption = {
  label: string;
  latestReleaseVersion: number;
  playlistId: string;
  playlistName: string;
  tenantId: string;
  tenantName: string;
};

export type PlatformPlayerDemoData = {
  configuredPlaylistId: string | null;
  error: boolean;
  options: PlatformPlayerDemoOption[];
  updatedAt: string | null;
};

export async function loadPlatformPlayerDemo(): Promise<PlatformPlayerDemoData> {
  const supabase = await createControlSupabaseClient();
  if (!supabase) return emptyDemoData(true);

  const [configuration, tenants, playlists, releases] = await Promise.all([
    supabase
      .from("platform_player_demo_playlists")
      .select("playlist_id, updated_at")
      .eq("environment", "staging")
      .maybeSingle(),
    supabase
      .from("tenants")
      .select("id, name")
      .eq("status", "active")
      .order("name", { ascending: true }),
    supabase
      .from("playlists")
      .select("id, tenant_id, name, status")
      .neq("status", "archived")
      .order("name", { ascending: true }),
    supabase
      .from("playlist_releases")
      .select("playlist_id, version")
      .order("version", { ascending: false })
  ]);

  if (
    configuration.error ||
    tenants.error ||
    playlists.error ||
    releases.error
  ) {
    return emptyDemoData(true);
  }

  const tenantNames = new Map(
    (tenants.data ?? []).map((tenant) => [tenant.id, tenant.name])
  );
  const latestReleaseVersions = new Map<string, number>();
  for (const release of releases.data ?? []) {
    if (!latestReleaseVersions.has(release.playlist_id)) {
      latestReleaseVersions.set(release.playlist_id, release.version);
    }
  }

  const options = (playlists.data ?? []).flatMap((playlist) => {
    const tenantName = tenantNames.get(playlist.tenant_id);
    const latestReleaseVersion = latestReleaseVersions.get(playlist.id);
    if (!tenantName || latestReleaseVersion === undefined) return [];

    return [{
      label: `${tenantName} · ${playlist.name} · release ${latestReleaseVersion}`,
      latestReleaseVersion,
      playlistId: playlist.id,
      playlistName: playlist.name,
      tenantId: playlist.tenant_id,
      tenantName
    }];
  });

  return {
    configuredPlaylistId: configuration.data?.playlist_id ?? null,
    error: false,
    options,
    updatedAt: configuration.data?.updated_at ?? null
  };
}

function emptyDemoData(error: boolean): PlatformPlayerDemoData {
  return {
    configuredPlaylistId: null,
    error,
    options: [],
    updatedAt: null
  };
}

