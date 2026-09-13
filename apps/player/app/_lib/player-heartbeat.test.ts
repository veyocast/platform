import { describe, expect, it } from "vitest";

import { playbackErrorSyncDetail, safeGoalVideoDiagnostics, safeGoalVideoCapabilities } from "./player-heartbeat";

describe("playbackErrorSyncDetail", () => {
  it("keeps an unresolved playback error active", () => {
    const result = playbackErrorSyncDetail({
      action: "RETRY_ITEM",
      code: "VIDEO_START_TIMEOUT",
      itemId: "video-1",
      occurredAt: "2026-07-21T12:00:00.000Z"
    });

    expect(result.lastPlaybackError).toEqual(expect.objectContaining({
      code: "VIDEO_START_TIMEOUT",
      recoveredAt: null
    }));
    expect(result.recoveredPlaybackError).toBeNull();
  });

  it("clears the active error while retaining bounded recovery evidence", () => {
    const result = playbackErrorSyncDetail({
      action: "SKIP_ITEM",
      code: "VIDEO_START_TIMEOUT<script>",
      itemId: "video-1/unsafe",
      occurredAt: "2026-07-21T12:00:00.000Z",
      recoveredAt: "2026-07-21T12:00:02.000Z"
    });

    expect(result.lastPlaybackError).toBeNull();
    expect(result.recoveredPlaybackError).toEqual({
      action: "SKIP_ITEM",
      code: "VIDEO_START_TIMEOUTscript",
      itemId: "video-1unsafe",
      occurredAt: "2026-07-21T12:00:00.000Z",
      recoveredAt: "2026-07-21T12:00:02.000Z"
    });
  });
});

describe("bounded goal diagnostics", () => {
  it("keeps operational identifiers and drops URLs, names and unknown codes", () => {
    const entry = { code: "GOAL_VIDEO_LOAD_ERROR", eventId: "11111111-1111-4111-8111-111111111111", deliveryId: "22222222-2222-4222-8222-222222222222", orientation: "portrait", width: 1080, height: 1920, mimeType: "video/mp4", at: "2026-09-12T18:00:00Z", url: "private-url", scorerName: "private-name" };
    const result = safeGoalVideoDiagnostics(Array.from({ length: 20 }, () => entry));
    expect(result).toHaveLength(12);
    expect(JSON.stringify(result)).not.toContain("private-");
    expect(safeGoalVideoDiagnostics([{ ...entry, code: "arbitrary-text" }])).toEqual([]);
    expect(safeGoalVideoDiagnostics([{ ...entry, width: Infinity }])[0]?.width).toBeNull();
    expect(safeGoalVideoDiagnostics([{ ...entry, code: "GOAL_VIDEO_SOURCE_FALLBACK", source: "cache_blob", mediaErrorCode: 4 }])[0]).toMatchObject({ source: "cache_blob", mediaErrorCode: 4 });
    expect(safeGoalVideoDiagnostics([{ ...entry, source: "private-url", mediaErrorCode: 400 }])[0]).toMatchObject({ source: null, mediaErrorCode: null });
  });
  it("reports capabilities separately from platform identification", () => {
    expect(safeGoalVideoCapabilities({ runtime: "static-lg", h264: "probably", webm: "", viewportWidth: 1920, viewportHeight: 1080, webOS: true, browserVersion: "79.0.3945", appVersion: "a".repeat(40), userAgent: "private" })).toMatchObject({ runtime: "static-lg", h264: "probably", webOS: true, browserVersion: "79.0.3945" });
    expect(safeGoalVideoCapabilities({ runtime: "arbitrary" })).toBeNull();
  });
});
