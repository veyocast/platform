import { describe, expect, it } from "vitest";

import {
  isLedScoresMediaEligible,
  resolveLedScoresPlaybackMime
} from "./media-policy";

const userImage = {
  kind: "image",
  mimeType: "image/png",
  sourceKind: "user"
};

describe("LED Scores mediabeleid", () => {
  it("laat alleen een doelgericht clublogo toe in het logoveld", () => {
    expect(isLedScoresMediaEligible({ ...userImage, purposeApproved: true }, "logo")).toBe(true);
    expect(isLedScoresMediaEligible(userImage, "logo")).toBe(false);
    expect(isLedScoresMediaEligible({
      ...userImage,
      purposeApproved: true,
      sourceKind: "provider_legacy"
    }, "logo")).toBe(true);
    expect(isLedScoresMediaEligible({
      kind: "video",
      mimeType: "video/mp4",
      purposeApproved: true,
      sourceKind: "user"
    }, "logo")).toBe(false);
  });

  it("sluit technische en gegenereerde media uit van nieuwe fallbacks", () => {
    expect(isLedScoresMediaEligible(userImage, "fallback")).toBe(true);
    expect(isLedScoresMediaEligible({ ...userImage, sourceKind: "generated" }, "fallback")).toBe(false);
    expect(isLedScoresMediaEligible({ ...userImage, sourceKind: "provider_legacy" }, "fallback")).toBe(false);
    expect(isLedScoresMediaEligible({ ...userImage, canvasCompatible: false }, "fallback")).toBe(false);
  });

  it("accepteert voor geluid alleen een eigen MP4-upload", () => {
    expect(isLedScoresMediaEligible({
      kind: "video",
      mimeType: "video/mp4",
      sourceKind: "user"
    }, "sound")).toBe(true);
    expect(isLedScoresMediaEligible({
      kind: "image",
      mimeType: "image/png",
      sourceKind: "user"
    }, "sound")).toBe(false);
    expect(isLedScoresMediaEligible({
      kind: "video",
      mimeType: "video/mp4",
      sourceKind: "generated"
    }, "sound")).toBe(false);
  });

  it("beoordeelt geconverteerde video op de player-variant", () => {
    const convertedMime = resolveLedScoresPlaybackMime(
      "video",
      "video/webm",
      "video/mp4"
    );
    expect(convertedMime).toBe("video/mp4");
    expect(isLedScoresMediaEligible({
      canvasCompatible: convertedMime === "video/mp4",
      kind: "video",
      mimeType: convertedMime,
      sourceKind: "user"
    }, "fallback")).toBe(true);
    expect(resolveLedScoresPlaybackMime("video", "video/webm", null)).toBeNull();
  });
});
