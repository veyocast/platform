export type YouTubeSelectionValidation = { ok: false; code: string } | {
  ok: true; kind: "video" | "playlist"; title: string; providerTitle: string; channelTitle: string;
  videoCount: number; unavailableItems: number; providerItemCount: number; validationId?: string;
};
export type YouTubeWorkspaceAsset = { id: string; title: string; kind: string; url?: string; posterUrl?: string };
export type YouTubeWorkspaceSource = {
  id: string; video_id: string; title: string; channel_title: string | null; fallback_media_asset_id: string;
  validation_status: string; embeddable: boolean; status: "active" | "paused"; playlist_id: string | null; playlist_video_ids: unknown;
  playlist_repeat: boolean | null; playlist_unavailable_count: number; revision: number;
};
