import { describe, expect, it, vi } from "vitest";
import { fetchYouTubePlaylistMetadata, parseYouTubePlaylistId } from "../src/youtube";
const playlistId = "PL1234567890abcdefgh";
const videoA = "dQw4w9WgXcQ", videoB = "abcdefghijk", unavailable = "zzzzzzzzzzz";
describe("server-resolved official YouTube playlists", () => {
  it("accepts only HTTPS YouTube identities and never follows an arbitrary provider URL", () => {
    expect(parseYouTubePlaylistId(`https://www.youtube.com/playlist?list=${playlistId}`)).toBe(playlistId);
    expect(parseYouTubePlaylistId(`https://example.com/playlist?list=${playlistId}`)).toBeNull();
    expect(parseYouTubePlaylistId(`https://name:pass@youtube.com/playlist?list=${playlistId}`)).toBeNull();
  });
  it("preserves all provider positions including repeat occurrences and reports unavailable items", async () => {
    const fetchImpl = vi.fn(async (input: Parameters<typeof fetch>[0]) => {
      const url = new URL(String(input));
      const body = url.pathname.endsWith("/playlists") ? { items: [{ snippet: { title: "Club", channelTitle: "Kanaal" }, status: { privacyStatus: "public" } }] }
        : url.pathname.endsWith("/videos") ? { items: [videoA, videoB].map((id) => ({ id, status: { embeddable: true, privacyStatus: "public" } })) }
          : { pageInfo: { totalResults: 4 }, items: [videoB, unavailable, videoA, videoA].map((videoId, index) => ({ snippet: { position: [3, 2, 1, 0][index], resourceId: { videoId } } })) };
      return new Response(JSON.stringify(body));
    }) as unknown as typeof fetch;
    const result = await fetchYouTubePlaylistMetadata({ apiKey: "test-only", playlistId, fetchImpl });
    expect(result.videoIds).toEqual([videoA, videoA, videoB]);
    expect(result.unavailableItems).toBe(1);
  });
  it("refuses oversized provider playlists without saving a truncated first page", async () => {
    let request = 0;
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify(++request === 1
      ? { items: [{ snippet: { title: "Club", channelTitle: "Kanaal" } }] }
      : { pageInfo: { totalResults: 201 }, items: [] }))) as unknown as typeof fetch;
    await expect(fetchYouTubePlaylistMetadata({ apiKey: "test-only", playlistId, fetchImpl })).rejects.toThrow("maximaal 200");
  });
});
