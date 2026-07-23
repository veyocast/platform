import "server-only";

import type {
  PlayerManifestEnvelope,
  PlayerManifestItem
} from "./player-manifest";
import { createPlayerAdminClient } from "./player-supabase";

type ReleaseRow = {
  id: string;
  manifest_hash: string;
  playlist_id: string;
  published_at: string;
  tenant_id: string;
  total_bytes: number;
  total_duration_seconds: number;
  version: number;
};

type ReleaseItemRow = {
  asset_kind: "image" | "video";
  asset_title: string;
  checksum_sha256: string;
  duration_seconds: number;
  file_size_bytes: number;
  fit_mode: "contain" | "cover";
  id: string;
  mime_type: string;
  muted: boolean;
  storage_bucket: string;
  storage_path: string;
};

export type PlayerReleaseDevice = {
  activeReleaseId: string;
  desiredReleaseId: string;
  id: string;
  screenId: string;
  screenName: string;
};

export async function loadPlayerReleaseEnvelope({
  device,
  releaseId,
  tenantId
}: {
  device: PlayerReleaseDevice;
  releaseId: string;
  tenantId: string;
}): Promise<PlayerManifestEnvelope> {
  const admin = createPlayerAdminClient();
  const [releaseResult, itemResult] = await Promise.all([
    admin
      .from("playlist_releases")
      .select("id, tenant_id, playlist_id, version, manifest_hash, published_at, total_duration_seconds, total_bytes")
      .eq("id", releaseId)
      .eq("tenant_id", tenantId)
      .single(),
    admin
      .from("playlist_release_items")
      .select("id, asset_kind, asset_title, duration_seconds, fit_mode, muted, storage_bucket, storage_path, mime_type, file_size_bytes, checksum_sha256")
      .eq("release_id", releaseId)
      .eq("tenant_id", tenantId)
      .order("sort_order", { ascending: true })
  ]);

  if (releaseResult.error || itemResult.error || !releaseResult.data) {
    throw new Error("release unavailable");
  }

  const release = releaseResult.data as ReleaseRow;
  const releaseItems = (itemResult.data ?? []) as ReleaseItemRow[];
  if (releaseItems.length === 0) throw new Error("release has no items");

  const items = await Promise.all(
    releaseItems.map(async (item): Promise<PlayerManifestItem> => {
      const { data: signed, error: signedError } = await admin.storage
        .from(item.storage_bucket)
        .createSignedUrl(item.storage_path, 60 * 60);

      if (signedError || !signed?.signedUrl) {
        throw new Error("signed asset URL unavailable");
      }

      return {
        durationSeconds: item.duration_seconds,
        fitMode: item.fit_mode,
        id: item.id,
        kind: item.asset_kind,
        muted: item.muted,
        source: {
          bytes: item.file_size_bytes,
          checksumSha256: item.checksum_sha256,
          mimeType: item.mime_type,
          url: signed.signedUrl
        },
        title: item.asset_title
      };
    })
  );

  const fetchedAt = new Date().toISOString();
  return {
    device,
    diagnostics: {
      lastSuccessfulSyncAt: fetchedAt,
      nextSyncReason:
        device.activeReleaseId === device.desiredReleaseId
          ? "desired release already active"
          : "desired release must be verified",
      syncStatus: "online"
    },
    fetchedAt,
    manifest: {
      items,
      label: `Playlist release ${release.version}`,
      manifestHash: release.manifest_hash,
      playlistId: release.playlist_id,
      publishedAt: release.published_at,
      releaseId: release.id,
      schemaVersion: 1,
      tenantId: release.tenant_id,
      totalBytes: release.total_bytes,
      totalDurationSeconds: release.total_duration_seconds,
      version: release.version
    },
    state:
      device.activeReleaseId === device.desiredReleaseId ? "PLAYING" : "READY"
  };
}

