import { describe, expect, it, vi } from "vitest";

import {
  buildNormalizationArguments,
  normalizePlayerVideo,
  parseVideoProbe,
  validatePlayerVariant,
  VideoProcessingError,
  type CommandRunner
} from "../src/video-normalization";

const inputProbe = JSON.stringify({
  format: { duration: "12.400", format_name: "mov,mp4,m4a,3gp,3g2,mj2" },
  streams: [
    { codec_name: "hevc", codec_type: "video", height: 2160, pix_fmt: "yuv420p10le", r_frame_rate: "60000/1001", width: 3840 },
    { codec_name: "mp3", codec_type: "audio" }
  ]
});
const normalizedProbe = JSON.stringify({
  format: { duration: "12.400", format_name: "mov,mp4,m4a,3gp,3g2,mj2" },
  streams: [
    { codec_name: "h264", codec_type: "video", height: 1080, pix_fmt: "yuv420p", r_frame_rate: "30/1", width: 1920 },
    { codec_name: "aac", codec_type: "audio" }
  ]
});

describe("video normalization", () => {
  it("parses container, codecs, dimensions, duration and fractional fps", () => {
    expect(parseVideoProbe(normalizedProbe)).toEqual({
      audioCodec: "aac", durationSeconds: 12.4,
      formatNames: ["mov", "mp4", "m4a", "3gp", "3g2", "mj2"],
      framesPerSecond: 30, height: 1080, pixelFormat: "yuv420p",
      videoCodec: "h264", width: 1920
    });
  });

  it("builds a shell-free, deterministic 1080p30 H.264/AAC command", () => {
    const args = buildNormalizationArguments("/tmp/input with spaces.mp4", "/tmp/player.mp4");
    expect(args).toContain("/tmp/input with spaces.mp4");
    expect(args).toContain("libx264");
    expect(args).toContain("+faststart");
    expect(args.at(-1)).toBe("/tmp/player.mp4");
  });

  it("probes, normalizes and verifies the generated player variant", async () => {
    const runner = vi.fn<CommandRunner>()
      .mockResolvedValueOnce({ stderr: "", stdout: inputProbe })
      .mockResolvedValueOnce({ stderr: "encoded", stdout: "" })
      .mockResolvedValueOnce({ stderr: "", stdout: normalizedProbe });
    const result = await normalizePlayerVideo({
      inputPath: "/jobs/input.mp4", outputPath: "/jobs/player-1080p.mp4", runner
    });
    expect(result.output.videoCodec).toBe("h264");
    expect(runner).toHaveBeenNthCalledWith(
      2, "ffmpeg",
      expect.arrayContaining(["-nostdin", "libx264", "/jobs/player-1080p.mp4"]),
      expect.objectContaining({ timeoutMs: 300_000 })
    );
  });

  it("rejects invalid probes and non-conforming generated variants", () => {
    expect(() => parseVideoProbe("not-json")).toThrowError(
      expect.objectContaining({ code: "invalid_probe" })
    );
    expect(() => validatePlayerVariant(parseVideoProbe(inputProbe))).toThrowError(VideoProcessingError);
  });
});
