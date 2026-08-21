import {
  getMobileRequestContext,
  requireMobileTenant
} from "../../../../../lib/mobile-api/context";
import {
  mobileContextFailure,
  mobileData,
  mobileFailure
} from "../../../../../lib/mobile-api/response";

export async function GET(request: Request) {
  try {
    const context = await getMobileRequestContext(request);
    const tenant = requireMobileTenant(
      request,
      context,
      "tenant.media.read"
    );
    const [mediaResult, playlistsResult, itemsResult, releasesResult] =
      await Promise.all([
        context.supabase
          .from("media_assets")
          .select("id, title, mime_type, status, file_size_bytes, created_at")
          .eq("tenant_id", tenant.id)
          .eq("source_kind", "user")
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .limit(100),
        context.supabase
          .from("playlists")
          .select("id, name, status, updated_at")
          .eq("tenant_id", tenant.id)
          .neq("status", "archived")
          .order("updated_at", { ascending: false })
          .limit(100),
        context.supabase
          .from("playlist_items")
          .select("playlist_id")
          .eq("tenant_id", tenant.id),
        context.supabase
          .from("playlist_releases")
          .select("playlist_id, version")
          .eq("tenant_id", tenant.id)
          .order("version", { ascending: false })
      ]);
    const queryError = [
      mediaResult.error,
      playlistsResult.error,
      itemsResult.error,
      releasesResult.error
    ].find(Boolean);
    if (queryError) {
      console.error("Mobile content list failed", {
        code: queryError.code,
        requestId: context.requestId
      });
      return mobileFailure({
        code: "TEMPORARILY_UNAVAILABLE",
        message: "Content kon niet volledig worden geladen.",
        recovery: "Controleer je verbinding en probeer het opnieuw.",
        requestId: context.requestId,
        status: 503
      });
    }
    const itemCounts = new Map<string, number>();
    for (const item of itemsResult.data ?? []) {
      itemCounts.set(
        item.playlist_id,
        (itemCounts.get(item.playlist_id) ?? 0) + 1
      );
    }
    const publishedVersions = new Map<string, number>();
    for (const release of releasesResult.data ?? []) {
      if (!publishedVersions.has(release.playlist_id)) {
        publishedVersions.set(release.playlist_id, release.version);
      }
    }
    return mobileData(
      {
        media: (mediaResult.data ?? []).map((asset) => ({
          createdAt: asset.created_at,
          id: asset.id,
          mimeType: asset.mime_type,
          name: asset.title,
          processingStatus:
            asset.status === "ready"
              ? "ready"
              : asset.status === "validation_failed" ||
                  asset.status === "quarantined"
                ? "failed"
                : "processing",
          sizeBytes: Number(asset.file_size_bytes),
          thumbnailUrl: null
        })),
        playlists: (playlistsResult.data ?? []).map((playlist) => ({
          id: playlist.id,
          itemCount: itemCounts.get(playlist.id) ?? 0,
          name: playlist.name,
          publishedVersion: publishedVersions.get(playlist.id) ?? null,
          status: playlist.status,
          updatedAt: playlist.updated_at
        }))
      },
      context.requestId
    );
  } catch (error) {
    return mobileContextFailure(error);
  }
}
