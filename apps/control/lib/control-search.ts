import "server-only";

import { hasCapability } from "@veyocast/auth";

import type { ControlSession } from "../app/(shell)/_lib/control-navigation";
import type { ControlSearchResult } from "../app/(shell)/_lib/control-search-contract";
import { createControlSupabaseClient } from "./supabase/server";

export async function searchControlResources(
  session: ControlSession,
  unsafeQuery: string
): Promise<ControlSearchResult[]> {
  const query = unsafeQuery.trim().slice(0, 80);
  if (query.length < 2 || !session.isLive) return [];
  const supabase = await createControlSupabaseClient();
  if (!supabase) return [];
  const escaped = `%${escapeLike(query)}%`;

  if (!session.tenantId) {
    if (!hasCapability(session.capabilities, "platform.tenant.read")) return [];
    const tenants = await supabase
      .from("tenants")
      .select("id, name, slug, status")
      .ilike("name", escaped)
      .order("name")
      .limit(12);
    if (tenants.error) return [];
    return (tenants.data ?? []).map((tenant) => ({
      description: `${tenant.slug} · ${tenant.status}`,
      href: `/platform/tenants/${tenant.id}`,
      id: `tenant:${tenant.id}`,
      kind: "tenant" as const,
      label: tenant.name
    }));
  }

  const tenantId = session.tenantId;
  const jobs: Array<PromiseLike<ControlSearchResult[]>> = [];
  if (hasCapability(session.capabilities, "tenant.media.read")) {
    jobs.push(supabase.from("media_assets")
      .select("id, title, kind, status")
      .eq("tenant_id", tenantId)
      .is("deleted_at", null)
      .ilike("title", escaped)
      .order("created_at", { ascending: false })
      .limit(8)
      .then(({ data, error }) => error ? [] : (data ?? []).map((asset) => ({
        description: `${asset.kind === "video" ? "Video" : "Afbeelding"} · ${asset.status}`,
        href: `/dashboard/media?asset=${asset.id}`,
        id: `media:${asset.id}`,
        kind: "media" as const,
        label: asset.title
      }))));
  }
  if (hasCapability(session.capabilities, "tenant.playlist.read")) {
    jobs.push(supabase.from("playlists")
      .select("id, name, status")
      .eq("tenant_id", tenantId)
      .ilike("name", escaped)
      .order("updated_at", { ascending: false })
      .limit(8)
      .then(({ data, error }) => error ? [] : (data ?? []).map((playlist) => ({
        description: `Playlist · ${playlist.status}`,
        href: `/dashboard/playlists/${playlist.id}`,
        id: `playlist:${playlist.id}`,
        kind: "playlist" as const,
        label: playlist.name
      }))));
  }
  if (hasCapability(session.capabilities, "tenant.screen.read")) {
    jobs.push(supabase.from("screens")
      .select("id, name, location, status")
      .eq("tenant_id", tenantId)
      .is("deleted_at", null)
      .ilike("name", escaped)
      .order("name")
      .limit(8)
      .then(({ data, error }) => error ? [] : (data ?? []).map((screen) => ({
        description: `${screen.location || "Geen locatie"} · ${screen.status}`,
        href: `/dashboard/screens/${screen.id}`,
        id: `screen:${screen.id}`,
        kind: "screen" as const,
        label: screen.name
      }))));
  }
  if (hasCapability(session.capabilities, "tenant.release.read")) {
    jobs.push(Promise.all([
      supabase.from("playlist_releases").select("id, playlist_id, version, published_at").eq("tenant_id", tenantId).order("published_at", { ascending: false }).limit(40),
      supabase.from("playlists").select("id, name").eq("tenant_id", tenantId)
    ]).then(([releaseResult, playlistResult]) => {
      if (releaseResult.error || playlistResult.error) return [];
      const names = new Map((playlistResult.data ?? []).map((playlist) => [playlist.id, playlist.name]));
      const lowered = query.toLocaleLowerCase("nl-NL");
      return (releaseResult.data ?? []).flatMap((release) => {
        const playlistName = names.get(release.playlist_id) ?? "Verwijderde playlist";
        const label = `${playlistName} · versie ${release.version}`;
        return label.toLocaleLowerCase("nl-NL").includes(lowered)
          ? [{
              description: `Immutable release · ${formatDate(release.published_at)}`,
              href: `/dashboard/publications/${release.id}`,
              id: `release:${release.id}`,
              kind: "release" as const,
              label
            }]
          : [];
      }).slice(0, 8);
    }));
  }

  return (await Promise.all(jobs)).flat().slice(0, 16);
}

function escapeLike(value: string) {
  return value.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_").replaceAll(",", "");
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("nl-NL", { dateStyle: "medium" }).format(new Date(value));
}
