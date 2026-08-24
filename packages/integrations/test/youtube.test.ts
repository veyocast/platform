import { describe, expect, it, vi } from "vitest";

import {
  buildYouTubeEmbedUrl,
  fetchYouTubeMetadata,
  parseYouTubeVideoId
} from "../src/youtube";

describe("YouTube official playback boundary", () => {
  it.each([
    ["dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://www.youtube.com/watch?v=dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://youtu.be/dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://www.youtube.com/shorts/dQw4w9WgXcQ", "dQw4w9WgXcQ"]
  ])("normaliseert %s", (input, expected) => {
    expect(parseYouTubeVideoId(input)).toBe(expected);
  });

  it("weigert onveilige en niet-YouTube URL's", () => {
    expect(parseYouTubeVideoId("http://youtube.com/watch?v=dQw4w9WgXcQ")).toBeNull();
    expect(parseYouTubeVideoId("https://example.com/watch?v=dQw4w9WgXcQ")).toBeNull();
  });

  it("bouwt een privacybewuste officiële embed met origin", () => {
    const url = new URL(buildYouTubeEmbedUrl("dQw4w9WgXcQ", "https://player.veyocast.nl"));
    expect(url.hostname).toBe("www.youtube-nocookie.com");
    expect(url.searchParams.get("origin")).toBe("https://player.veyocast.nl");
    expect(url.searchParams.get("enablejsapi")).toBe("1");
  });

  it("leest alleen begrensde officiële Data API metadata", async () => {
    const fetchMock = vi.fn(async (
      _input: Parameters<typeof fetch>[0],
      _init?: Parameters<typeof fetch>[1]
    ) => new Response(JSON.stringify({ items: [{
      id: "dQw4w9WgXcQ",
      snippet: { channelTitle: "Kanaal", title: "Video" },
      status: { embeddable: true, privacyStatus: "public" }
    }] }), { status: 200 }));
    const fetchImpl = fetchMock as unknown as typeof fetch;
    await expect(fetchYouTubeMetadata({ apiKey: "test-key", fetchImpl, videoId: "dQw4w9WgXcQ" }))
      .resolves.toMatchObject({ embeddable: true, title: "Video" });
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("youtube/v3/videos");
  });
});
