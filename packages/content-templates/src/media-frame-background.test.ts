import { describe, expect, it } from "vitest";
import type { MediaFramePlaybackBackground } from "@veyocast/contracts";
import { mediaFrameBackgroundStyle } from "./media-frame-background";

const value = (background: MediaFramePlaybackBackground["background"], themeId: MediaFramePlaybackBackground["themeId"] = "onzetrots-tv"): MediaFramePlaybackBackground => ({ schemaVersion: 1, themeId, accentColor: "#1763ed", background });
describe("rawmedia Source backgrounds", () => {
  it("retains both original theme gradients without inventing a dark override", () => {
    for (const theme of ["fieldflow", "onzetrots-tv"] as const) expect(mediaFrameBackgroundStyle(value({ kind: "preset", preset: "dark" }, theme))).toEqual(mediaFrameBackgroundStyle(value({ kind: "preset", preset: "stadium" }, theme)));
    expect(mediaFrameBackgroundStyle(value({ kind: "preset", preset: "stadium" }))).not.toEqual(mediaFrameBackgroundStyle(value({ kind: "preset", preset: "stadium" }, "fieldflow")));
  });
  it("never falls back to a remote image when a verified background URL is missing", () => {
    expect(mediaFrameBackgroundStyle(value({ kind: "preset", preset: "clubmuur" }))).toBeNull();
    expect(mediaFrameBackgroundStyle(value({ kind: "image", mediaAssetId: "19170000-0000-4000-8000-000000000010", checksumSha256: "a".repeat(64), position: "left" }))).toBeNull();
  });
  it("keeps the Source image treatment and actual chosen focus without a text overlay", () => {
    const result = mediaFrameBackgroundStyle(value({ kind: "image", mediaAssetId: "19170000-0000-4000-8000-000000000010", checksumSha256: "a".repeat(64), position: "bottom" }), { image: "blob:verified-private-background" });
    expect(result?.backgroundImage).toContain('url("blob:verified-private-background")');
    expect(result?.backgroundPosition).toBe("bottom");
    expect(result?.backgroundImage).toContain("linear-gradient(90deg,rgba(6,19,45,.92),rgba(6,19,45,.3))");
  });
});
