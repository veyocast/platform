import "server-only";

import { screenCompositionDraftSchema, type ScreenCompositionDraft } from "@veyocast/contracts";
import { createControlSupabaseClient } from "../../../../lib/supabase/server";

export type CompositionPlaylistOption = { id: string; name: string; published: boolean; previewUrl: string | null; rawPhotoPreview?: { title: string; clubName: string } };
export type CompositionSeriesOption = { id: string; name: string; revision: number };
export type CompositionScreenDraft = { screenId: string; revision: number; configuration: ScreenCompositionDraft | null };
export type CompositionWorkspaceData = {
  drafts: CompositionScreenDraft[];
  error: string | null;
  playlists: CompositionPlaylistOption[];
  series: CompositionSeriesOption[];
};
export async function loadCompositionWorkspace(tenantId: string | null, isLive: boolean, tenantName?: string): Promise<CompositionWorkspaceData> {
  const empty: CompositionWorkspaceData = { drafts: [], error: null, playlists: [], series: [] };
  if (!tenantId || !isLive) return empty;
  const supabase = await createControlSupabaseClient();
  if (!supabase) return { ...empty, error: "De beveiligde datasessie ontbreekt. Vernieuw de pagina voordat je een indeling opslaat." };
  const [drafts, playlists, publications, series] = await Promise.all([
    supabase.from("screen_composition_drafts").select("screen_id,revision,configuration_json").eq("tenant_id", tenantId).limit(2000),
    supabase.from("playlists").select("id,name").eq("tenant_id", tenantId).neq("status", "archived").order("name").limit(1000),
    supabase.from("playlist_publications").select("playlist_id,release_id").eq("tenant_id", tenantId).limit(1000),
    supabase.from("studio_series").select("id,name,revision").eq("tenant_id", tenantId).eq("status", "active").order("name").limit(1000)
  ]);
  const error = drafts.error ?? playlists.error ?? publications.error ?? series.error;
  if (error) {
    console.error("Schermindeling niet geladen", { code: error.code });
    return { ...empty, error: "De indelingen of content konden niet volledig worden geladen. Vernieuw de pagina; bestaande schermcontent blijft actief." };
  }
  const publicationIds = new Set((publications.data ?? []).map((row) => row.playlist_id));
  // Previews use current immutable publication bytes. They never import source
  // payloads, advance a release or make saving depend on optional image storage.
  const releaseIds = (publications.data ?? []).slice(0,100).map(row=>row.release_id);
  const previewByRelease = new Map<string,string>();
  const rawPhotosByRelease = new Map<string, { title: string; clubName: string }>();
  if(releaseIds.length){
    const images=await supabase.from("playlist_release_items").select("release_id,storage_bucket,storage_path,media_asset_id,display_title,asset_title,dynamic_snapshot_id,sites_studio_presentation_json").eq("tenant_id",tenantId).in("release_id",releaseIds).eq("asset_kind","image").eq("enabled",true).order("sort_order").limit(1000);
    if(!images.error){
      const firstImages=new Map<string,NonNullable<typeof images.data>[number]>();
      for(const image of images.data??[]){if(image.storage_bucket!=="tenant-media"||!image.storage_path.startsWith(`tenants/${tenantId}/assets/`)||image.storage_path.includes("..")||firstImages.has(image.release_id))continue;firstImages.set(image.release_id,image);}
      const entries=[...firstImages.values()];
      for(let offset=0;offset<entries.length;offset+=10)await Promise.all(entries.slice(offset,offset+10).map(async image=>{try{const signed=await supabase.storage.from("tenant-media").createSignedUrl(image.storage_path,600);if(signed.data?.signedUrl){previewByRelease.set(image.release_id,signed.data.signedUrl);
        // Only an explicitly frozen raw original gets a visual placement cover.
        // Rendered Studio/dynamic bytes already contain their complete artwork.
        const originalPrefix=`tenants/${tenantId}/assets/${image.media_asset_id}/original/`;
        const title=(image.display_title??image.asset_title)?.trim();
        if(tenantName?.trim()&&title&&image.media_asset_id&&image.dynamic_snapshot_id===null&&image.sites_studio_presentation_json===null&&image.storage_path.startsWith(originalPrefix)&&image.storage_path.length>originalPrefix.length)rawPhotosByRelease.set(image.release_id,{title:title.slice(0,120),clubName:tenantName.trim()});
      }}catch{/* Optional preview keeps the available publication selectable. */}}));
    }
  }
  const previewByPlaylist=new Map((publications.data??[]).map(row=>[row.playlist_id,previewByRelease.get(row.release_id)??null]));
  const rawPhotosByPlaylist=new Map((publications.data??[]).map(row=>[row.playlist_id,rawPhotosByRelease.get(row.release_id)]));
  return {
    drafts: (drafts.data ?? []).map((row) => { const parsed = screenCompositionDraftSchema.safeParse(row.configuration_json); return { screenId: row.screen_id, revision: Number(row.revision), configuration: parsed.success ? parsed.data : null }; }),
    error: null,
    playlists: (playlists.data ?? []).map((row) => ({ id: row.id, name: row.name, published: publicationIds.has(row.id), previewUrl: previewByPlaylist.get(row.id)??null, ...(rawPhotosByPlaylist.get(row.id)?{rawPhotoPreview:rawPhotosByPlaylist.get(row.id)}:{}) })),
    series: (series.data ?? []).map((row) => ({ id: row.id, name: row.name, revision: Number(row.revision) }))
  };
}
