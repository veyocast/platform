import { describe, expect, it, vi } from "vitest";

import {
  buildNormalizationArguments,
  canRemuxWithoutTranscoding,
  createPlayerVideoPoster,
  getCanonicalPlayerDimensions,
  normalizePlayerVideo,
  parseVideoProbe,
  validateInputProbe,
  validatePlayerVariant,
  VideoProcessingError,
  type CommandRunner
} from "../src/video-normalization";

const inputProbe = JSON.stringify({
  format: { bit_rate: "1000000", duration: "12.400", format_name: "mov,mp4,m4a,3gp,3g2,mj2" },
  streams: [
    { codec_name: "hevc", codec_type: "video", height: 2160, pix_fmt: "yuv420p10le", r_frame_rate: "60000/1001", width: 3840 },
    { codec_name: "mp3", codec_type: "audio" }
  ]
});
const normalizedProbe = JSON.stringify({
  format: { bit_rate: "1000000", duration: "12.400", format_name: "mov,mp4,m4a,3gp,3g2,mj2" },
  streams: [
    { codec_name: "h264", profile: "Main", level: 40, codec_type: "video", height: 1080, pix_fmt: "yuv420p", r_frame_rate: "30/1", width: 1920 }
  ]
});
const portraitProbe = JSON.stringify({
  format: { bit_rate: "1000000", duration: "8.200", format_name: "mov,mp4,m4a,3gp,3g2,mj2" },
  streams: [
    { codec_name: "h264", profile: "Main", level: 40, codec_type: "video", height: 1920, pix_fmt: "yuv420p", r_frame_rate: "30/1", width: 1080 }
  ]
});
const rotatedPortraitProbe = JSON.stringify({
  format: { bit_rate: "1000000", duration: "8.200", format_name: "mov,mp4,m4a,3gp,3g2,mj2" },
  streams: [
    {
      codec_name: "h264", profile: "Main", level: 40,
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
  it("transcodes high-bitrate and unknown-bitrate H264 instead of relabeling it", () => {
    const compatible = parseVideoProbe(portraitProbe);
    for (const containerBitrate of [40_432_276, 19_381_677, undefined]) {
      const input = { ...compatible, containerBitrate };
      expect(canRemuxWithoutTranscoding(input)).toBe(false);
      expect(buildNormalizationArguments("in.mp4", "out.mp4", input)).toEqual(expect.arrayContaining(["libx264", "-maxrate", "6M", "-crf", "21"]));
    }
  });
  it("accepteert WebM als broncontainer maar houdt MP4 als playeroutput", () => {
    const webm = parseVideoProbe(JSON.stringify({
      format: { bit_rate: "1000000", duration: "4.2", format_name: "matroska,webm" },
      streams: [{
        codec_name: "vp9", codec_type: "video", height: 720,
        pix_fmt: "yuv420p", r_frame_rate: "25/1", width: 1280
      }]
    }));
    expect(validateInputProbe(webm)).toBeUndefined();
    expect(canRemuxWithoutTranscoding(webm)).toBe(false);
    expect(buildNormalizationArguments(
      "/tmp/source.webm",
      "/tmp/player.mp4",
      webm
    )).toContain("libx264");
  });

  it("parses container, codecs, dimensions, duration and fractional fps", () => {
    expect(parseVideoProbe(normalizedProbe)).toEqual({
      audioCodec: null, containerBitrate: 1000000, durationSeconds: 12.4,
      formatNames: ["mov", "mp4", "m4a", "3gp", "3g2", "mj2"],
      framesPerSecond: 30, height: 1080, pixelFormat: "yuv420p",
      rotationDegrees: 0, videoCodec: "h264", videoProfile: "main", videoLevel: 40, width: 1920
    });
  });

  it("builds a shell-free, orientation-aware and silent 1080p30 H.264 command", () => {
    const args = buildNormalizationArguments("/tmp/input with spaces.mp4", "/tmp/player.mp4");
    expect(args).toContain("/tmp/input with spaces.mp4");
    expect(args).toContain("libx264");
    expect(args).toContain(
      "scale=w='if(gte(iw,ih),min(1920,iw),min(1080,iw))':h='if(gte(iw,ih),min(1080,ih),min(1920,ih))':force_original_aspect_ratio=decrease:force_divisible_by=2:flags=lanczos,setsar=1,fps=30"
    );
    expect(args).toEqual(
      expect.arrayContaining(["-metadata:s:v:0", "rotate=0"])
    );
    expect(args).toContain("+faststart");
    expect(args).toContain("-an");
    expect(args.at(-1)).toBe("/tmp/player.mp4");
  });

  it("maakt een begrensde poster met dezelfde shell-vrije runner", async () => {
    const runner = vi.fn<CommandRunner>().mockResolvedValue({ stderr: "", stdout: "" });
    await expect(createPlayerVideoPoster({
      inputPath: "/jobs/player.mp4",
      outputPath: "/jobs/poster.png",
      runner
    })).resolves.toBe("/jobs/poster.png");
    expect(runner).toHaveBeenCalledWith(
      "ffmpeg",
      expect.arrayContaining(["-frames:v", "1", "-an", "/jobs/poster.png"]),
      expect.objectContaining({ timeoutMs: 40_000 })
    );
  });

  it("preserves 720p in both orientations without unnecessary upscaling", () => {
    expect(getCanonicalPlayerDimensions(1280, 720)).toEqual({
      height: 720,
      width: 1280
    });
    expect(getCanonicalPlayerDimensions(720, 1280)).toEqual({
      height: 1280,
      width: 720
    });

    const landscape720p = parseVideoProbe(JSON.stringify({
      format: { bit_rate: "1000000", duration: "8.200", format_name: "mov,mp4" },
      streams: [{
        codec_name: "h264", profile: "Main", level: 40, codec_type: "video", height: 720,
        pix_fmt: "yuv420p", r_frame_rate: "30/1", width: 1280
      }]
    }));
    const portrait720p = parseVideoProbe(JSON.stringify({
      format: { bit_rate: "1000000", duration: "8.200", format_name: "mov,mp4" },
      streams: [{
        codec_name: "h264", profile: "Main", level: 40, codec_type: "video", height: 1280,
        pix_fmt: "yuv420p", r_frame_rate: "30/1", width: 720
      }]
    }));

    expect(canRemuxWithoutTranscoding(landscape720p)).toBe(true);
    expect(canRemuxWithoutTranscoding(portrait720p)).toBe(true);
    expect(buildNormalizationArguments(
      "/tmp/landscape-720p.mp4",
      "/tmp/player.mp4",
      landscape720p
    )).toContain("copy");
    expect(() => validatePlayerVariant(landscape720p)).not.toThrow();
  });

  it("preserves aspect ratio while filling the largest fitting 1080p raster", () => {
    expect(getCanonicalPlayerDimensions(640, 480)).toEqual({
      height: 480,
      width: 640
    });
    expect(getCanonicalPlayerDimensions(480, 640)).toEqual({
      height: 640,
      width: 480
    });
    expect(getCanonicalPlayerDimensions(1920, 800)).toEqual({
      height: 800,
      width: 1920
    });
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

it("transcodes high-level and unknown-profile AVC into the bounded player format", () => {
  const probe = parseVideoProbe(normalizedProbe);
  expect(canRemuxWithoutTranscoding(probe)).toBe(true);
  expect(canRemuxWithoutTranscoding({ ...probe, videoLevel: 51 })).toBe(false);
  expect(canRemuxWithoutTranscoding({ ...probe, videoProfile: null })).toBe(false);
  expect(buildNormalizationArguments("input.mp4", "output.mp4", { ...probe, videoLevel: 51 })).toContain("libx264");
});
