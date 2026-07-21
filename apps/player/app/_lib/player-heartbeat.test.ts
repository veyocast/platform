import { describe, expect, it } from "vitest";

import { playbackErrorSyncDetail } from "./player-heartbeat";

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
