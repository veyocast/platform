import "server-only";

import { createControlSupabaseClient } from "../../../../lib/supabase/server";

export type TenantTemplateListItem = {
  createdAt: string;
  description: string | null;
  id: string;
  itemCount: number;
  name: string;
  revision: number;
  sourcePlaylistName: string | null;
  status: string;
  updatedAt: string;
};

export async function loadTenantTemplates(tenantId: string) {
  const supabase = await createControlSupabaseClient();
  if (!supabase) return { error: "De beveiligde datasessie ontbreekt.", playlists: [], templates: [] };

  const [templates, playlists] = await Promise.all([
    supabase
      .from("tenant_playlist_templates")
      .select("id, source_playlist_id, name, description, snapshot_json, status, revision, created_at, updated_at")
      .eq("tenant_id", tenantId)
      .order("updated_at", { ascending: false }),
    supabase
      .from("playlists")
      .select("id, name")
      .eq("tenant_id", tenantId)
      .neq("status", "archived")
      .order("name")
  ]);
  if (templates.error || playlists.error) {
    console.error("Tenanttemplates laden mislukt", templates.error ?? playlists.error);
    return { error: "De templates konden niet volledig worden geladen.", playlists: [], templates: [] };
  }

  const playlistNames = new Map((playlists.data ?? []).map((playlist) => [playlist.id, playlist.name]));
  return {
    error: null,
    playlists: playlists.data ?? [],
    templates: (templates.data ?? []).map((template): TenantTemplateListItem => ({
      createdAt: template.created_at,
      description: template.description,
      id: template.id,
      itemCount: snapshotItemCount(template.snapshot_json),
      name: template.name,
      revision: Number(template.revision),
      sourcePlaylistName: template.source_playlist_id
        ? playlistNames.get(template.source_playlist_id) ?? "Verwijderde playlist"
        : null,
      status: template.status,
      updatedAt: template.updated_at
    }))
  };
}

function snapshotItemCount(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return 0;
  const items = (value as { items?: unknown }).items;
  return Array.isArray(items) ? items.length : 0;
}
