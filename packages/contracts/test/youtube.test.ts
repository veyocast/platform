import { describe, expect, it } from "vitest";

import { playerYouTubePlaybackSchema } from "../src/youtube";

describe("YouTube Player contract", () => {
  it("accepts only privacy-enhanced immutable playback metadata", () => {
    expect(playerYouTubePlaybackSchema.parse({
      kind: "youtube",
      privacyEnhanced: true,
      title: "Clubvideo",
      videoId: "dQw4w9WgXcQ"
    })).toMatchObject({ videoId: "dQw4w9WgXcQ" });
    expect(playerYouTubePlaybackSchema.safeParse({
      kind: "youtube",
      privacyEnhanced: false,
      title: "Clubvideo",
      videoId: "https://youtube.test/watch"
    }).success).toBe(false);
  });
});
