import { describe, expect, it } from "vitest";

import {
  createMediaProcessingPlan,
  maxUploadBytes,
  maxVideoDurationSeconds,
  validateMediaCandidate
} from "../src/media-processing";

const baseCandidate = {
  assetId: "20000000-0000-4000-8000-000000000003",
  fileName: "poster.webp",
  fileSizeBytes: 409_600,
  mimeType: "image/webp",
  tenantId: "10000000-0000-4000-8000-000000000001"
};

describe("media processing shell", () => {
  it("queues image uploads with original and thumbnail variants", () => {
    expect(createMediaProcessingPlan(baseCandidate)).toEqual({
      candidate: baseCandidate,
      kind: "image",
      status: "queued",
      variants: [{ type: "original" }, { type: "thumbnail" }]
    });
  });

  it("queues MVP video uploads with a player variant", () => {
    expect(
      createMediaProcessingPlan({
        ...baseCandidate,
        durationSeconds: maxVideoDurationSeconds,
        fileName: "intro.mp4",
        mimeType: "video/mp4"
      })
    ).toEqual({
      candidate: {
        ...baseCandidate,
        durationSeconds: maxVideoDurationSeconds,
        fileName: "intro.mp4",
        mimeType: "video/mp4"
      },
      kind: "video",
      status: "queued",
      variants: [
        { type: "original" },
        { maxHeight: 1080, type: "player_1080p" },
        { type: "thumbnail" }
      ]
    });
  });

  it("accepteert de uitgebreide, vooraf gevalideerde Menu Studio-formaten", () => {
    expect(
      validateMediaCandidate({
        ...baseCandidate,
        fileName: "logo.svg",
        mimeType: "image/svg+xml"
      })
    ).toBeNull();
    expect(createMediaProcessingPlan({
      ...baseCandidate,
      fileName: "intro.webm",
      mimeType: "video/webm"
    })).toMatchObject({ kind: "video", status: "queued" });
    expect(createMediaProcessingPlan({
      ...baseCandidate,
      fileName: "animatie.gif",
      mimeType: "image/gif"
    })).toMatchObject({
      kind: "video",
      status: "queued",
      variants: expect.arrayContaining([{ type: "thumbnail" }])
    });
  });

  it("rejects unsafe or unsupported file types with recovery copy", () => {
    expect(
      validateMediaCandidate({
        ...baseCandidate,
        fileName: "payload.exe",
        mimeType: "application/x-msdownload"
      })
    ).toEqual({
      code: "unsupported_mime_type",
      effect: "De worker verwerkt dit bestandstype niet.",
      recovery: "Gebruik JPEG, PNG, WebP, GIF, veilig SVG, MP4 of WebM."
    });

    expect(
      validateMediaCandidate({
        ...baseCandidate,
        fileName: "poster.exe",
        mimeType: "image/png"
      })?.code
    ).toBe("unsupported_extension");
  });

  it("rejects oversize or overlong videos before queueing", () => {
    expect(
      validateMediaCandidate({
        ...baseCandidate,
        fileSizeBytes: maxUploadBytes + 1
      })?.code
    ).toBe("file_too_large");

    expect(
      createMediaProcessingPlan({
        ...baseCandidate,
        durationSeconds: maxVideoDurationSeconds + 1,
        fileName: "intro.mp4",
        mimeType: "video/mp4"
      })
    ).toMatchObject({
      rejection: { code: "video_too_long" },
      status: "rejected"
    });
  });
});
