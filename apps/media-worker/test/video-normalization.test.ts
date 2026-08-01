import { describe, expect, it, vi } from "vitest";

import {
  buildNormalizationArguments,
  canRemuxWithoutTranscoding,
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
const portraitProbe = JSON.stringify({
  format: { duration: "8.200", format_name: "mov,mp4,m4a,3gp,3g2,mj2" },
  streams: [
    { codec_name: "h264", codec_type: "video", height: 1920, pix_fmt: "yuv420p", r_frame_rate: "30/1", width: 1080 }
  ]
});
const rotatedPortraitProbe = JSON.stringify({
  format: { duration: "8.200", format_name: "mov,mp4,m4a,3gp,3g2,mj2" },
  streams: [
    {
      codec_name: "h264",
      codec_type: "video",
      height: 1080,
      pix_fmt: "yuv420p",
      r_frame_rate: "30/1",
      side_data_list: [{ rotation: -90 }],
      width: 1920
    }
  ]
});

describe("video normalization", () => {
  it("parses container, codecs, dimensions, duration and fractional fps", () => {
    expect(parseVideoProbe(normalizedProbe)).toEqual({
      audioCodec: "aac", durationSeconds: 12.4,
      formatNames: ["mov", "mp4", "m4a", "3gp", "3g2", "mj2"],
      framesPerSecond: 30, height: 1080, pixelFormat: "yuv420p",
      rotationDegrees: 0, videoCodec: "h264", width: 1920
    });
  });

  it("builds a shell-free, orientation-aware 1080p30 H.264/AAC command", () => {
    const args = buildNormalizationArguments("/tmp/input with spaces.mp4", "/tmp/player.mp4");
    expect(args).toContain("/tmp/input with spaces.mp4");
    expect(args).toContain("libx264");
    expect(args).toContain(
      "scale=w='if(gte(iw,ih),min(1920,iw),min(1080,iw))':h='if(gte(iw,ih),min(1080,ih),min(1920,ih))':force_original_aspect_ratio=decrease:force_divisible_by=2,setsar=1,fps=30"
    );
    expect(args).toEqual(
      expect.arrayContaining(["-metadata:s:v:0", "rotate=0"])
    );
    expect(args).toContain("+faststart");
    expect(args.at(-1)).toBe("/tmp/player.mp4");
  });

  it("remuxes safe landscape and portrait pixels without transcoding again", () => {
    const landscape = parseVideoProbe(normalizedProbe);
    const portrait = parseVideoProbe(portraitProbe);
    expect(canRemuxWithoutTranscoding(landscape)).toBe(true);
    expect(canRemuxWithoutTranscoding(portrait)).toBe(true);
    expect(validatePlayerVariant(portrait)).toBeUndefined();
    const args = buildNormalizationArguments(
      "/tmp/input.mp4",
      "/tmp/player.mp4",
      portrait
    );
    expect(args).toContain("copy");
    expect(args).not.toContain("libx264");
  });

  it("transcodes rotation metadata into portrait pixels for legacy players", () => {
    const rotatedPortrait = parseVideoProbe(rotatedPortraitProbe);

    expect(rotatedPortrait).toMatchObject({
      height: 1080,
      rotationDegrees: 270,
      width: 1920
    });
    expect(canRemuxWithoutTranscoding(rotatedPortrait)).toBe(false);
    expect(
      buildNormalizationArguments(
        "/tmp/rotated.mp4",
        "/tmp/player.mp4",
        rotatedPortrait
      )
    ).toContain("libx264");
    expect(() => validatePlayerVariant(rotatedPortrait)).toThrowError(
      expect.objectContaining({
        code: "normalization_failed"
      })
    );
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
      expect.objectContaining({ timeoutMs: 40_000 })
    );
  });

  it("rejects invalid probes and non-conforming generated variants", () => {
    expect(() => parseVideoProbe("not-json")).toThrowError(
      expect.objectContaining({ code: "invalid_probe" })
    );
    expect(() => validatePlayerVariant(parseVideoProbe(inputProbe))).toThrowError(VideoProcessingError);
  });
});
