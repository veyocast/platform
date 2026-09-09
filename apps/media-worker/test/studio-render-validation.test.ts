import { mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  createEmptyStudioDocument,
  parseStudioDocument,
  type StudioFontFamily
} from "@veyocast/studio";
import sharp from "sharp";
import { afterEach, describe, expect, it } from "vitest";

import {
  renderStudioPng,
  validateStudioPng
} from "../src/studio-render-image";
import { ResvgSharpStudioRenderer } from "../src/studio-render-resvg";
import { renderStudioSvg } from "../src/studio-render-svg";
import {
  studioRenderRetryDelaySeconds,
  withStudioRenderTempDirectory
} from "../src/studio-render-runner";
import {
  buildStudioMp4Arguments,
  buildStudioPosterArguments,
  inspectMp4FastStart,
  parseStudioVideoProbe,
  validateStudioVideoProbe
} from "../src/studio-render-video";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((path) =>
      rm(path, { force: true, recursive: true })
    )
  );
});

describe("Studio render validators and safety bounds", () => {
  it("uses deterministic, shell-safe 1080p30 H.264 arguments", () => {
    const args = buildStudioMp4Arguments({
      frameCount: 300,
      height: 1080,
      outputPath: "/tmp/output with spaces.mp4",
      width: 1920
    });

    expect(args).toEqual(expect.arrayContaining([
      "-f", "rawvideo",
      "-framerate", "30",
      "-frames:v", "300",
      "-an",
      "libx264",
      "yuv420p",
      "+faststart",
      "/tmp/output with spaces.mp4"
    ]));
    expect(args).not.toContain("-nostdin");
  });

  it("composes a local muted source video beneath the RGBA overlay", () => {
    const backgroundVideo = {
      focusX: 0.25,
      focusY: 0.75,
      objectFit: "cover" as const,
      path: "/tmp/source with spaces.mp4",
      startOffsetMs: 1_500
    };
    const args = buildStudioMp4Arguments({
      backgroundVideo,
      frameCount: 300,
      height: 1080,
      outputPath: "/tmp/output.mp4",
      width: 1920
    });
    expect(args).toEqual(expect.arrayContaining([
      "-stream_loop", "-1",
      "-ss", "1.500",
      "-i", backgroundVideo.path,
      "-filter_complex",
      expect.stringContaining("[studio_bg][1:v]overlay"),
      "-map", "[studio_out]",
      "-an"
    ]));
    expect(args.join(" ")).not.toContain("http");
    expect(buildStudioPosterArguments({
      backgroundVideo,
      height: 1080,
      outputPath: "/tmp/poster.png",
      width: 1920
    })).toEqual(expect.arrayContaining([
      "-frames:v", "1",
      "-f", "image2",
      "/tmp/poster.png"
    ]));
  });

  it("validates exact codec, dimensions, fps, duration and frame count", () => {
    const probe = parseStudioVideoProbe(JSON.stringify({
      format: {
        duration: "10.000",
        format_name: "mov,mp4,m4a,3gp,3g2,mj2"
      },
      streams: [{
        avg_frame_rate: "30/1",
        codec_name: "h264",
        codec_type: "video",
        height: 1080,
        nb_read_frames: "300",
        pix_fmt: "yuv420p",
        width: 1920
      }]
    }));

    expect(() => validateStudioVideoProbe(probe, {
      durationMs: 10_000,
      height: 1080,
      width: 1920
    })).not.toThrow();
    expect(() => validateStudioVideoProbe({
      ...probe,
      audioStreamCount: 1
    }, {
      durationMs: 10_000,
      height: 1080,
      width: 1920
    })).toThrowError(expect.objectContaining({ code: "mp4_invalid" }));
  });

  it("requires explicit sRGB PNG metadata and exact dimensions", () => {
    const png = fakePng(1920, 1080, true);
    expect(validateStudioPng(png, { height: 1080, width: 1920 }))
      .toMatchObject({
        colorProfile: "srgb",
        colorType: 6,
        height: 1080,
        width: 1920
      });
    expect(() => validateStudioPng(
      fakePng(1920, 1080, false),
      { height: 1080, width: 1920 }
    )).toThrowError(expect.objectContaining({
      code: "png_profile_invalid"
    }));
  });

  it("rasterizes deterministic sRGB PNG and local QR data without network", async () => {
    const document = studioTextDocument("Inter Variable", 700);
    const renderer = new ResvgSharpStudioRenderer();
    const first = await renderStudioPng({ document, renderer });
    const second = await renderStudioPng({ document, renderer });

    expect(first.equals(second)).toBe(true);
    expect(validateStudioPng(first, document.artboard)).toMatchObject({
      colorProfile: "icc",
      height: 1080,
      width: 1920
    });
    await expect(renderer.renderQrSvgDataUri({
      background: "#FAFAF7",
      errorCorrection: "M",
      foreground: "#0A0A0A",
      value: "https://veyocast.nl"
    })).resolves.toMatch(/^data:image\/svg\+xml;base64,/);

    const redPng = await sharp({
      create: {
        background: "#FF0000",
        channels: 4,
        height: 2,
        width: 2
      }
    }).png().toBuffer();
    const rgba = await renderer.renderRgba({
      height: 2,
      svg:
        '<svg xmlns="http://www.w3.org/2000/svg" width="2" height="2">' +
        `<image width="2" height="2" href="data:image/png;base64,${redPng.toString("base64")}"/>` +
        "</svg>",
      width: 2
    });
    expect([...rgba.subarray(0, 4)]).toEqual([255, 0, 0, 255]);
  });

  it.each([
    ["Inter Variable", 400],
    ["Inter Variable", 500],
    ["Inter Variable", 600],
    ["Inter Variable", 700],
    ["Inter Variable", 800],
    ["Inter Tight Variable", 400],
    ["Inter Tight Variable", 500],
    ["Inter Tight Variable", 600],
    ["Inter Tight Variable", 700],
    ["Inter Tight Variable", 800],
    ["Roboto", 400],
    ["Roboto", 500],
    ["Roboto", 700],
    ["Roboto", 900]
  ] satisfies [StudioFontFamily, 400 | 500 | 600 | 700 | 800 | 900][])(
    "rasterizes visible %s glyphs at weight %i",
    async (fontFamily, fontWeight) => {
      const document = studioTextDocument(fontFamily, fontWeight);
      const renderer = new ResvgSharpStudioRenderer();
      const rgba = await renderer.renderRgba({
        height: document.artboard.height,
        svg: renderStudioSvg({ document, timeMs: 0 }),
        width: document.artboard.width
      });
      let brightPixels = 0;
      for (let index = 0; index < rgba.length; index += 4) {
        if (
          (rgba[index] ?? 0) > 220 &&
          (rgba[index + 1] ?? 0) > 220 &&
          (rgba[index + 2] ?? 0) > 220 &&
          (rgba[index + 3] ?? 0) > 0
        ) {
          brightPixels += 1;
        }
      }

      expect(brightPixels).toBeGreaterThan(1_000);
    }
  );

  it("detects whether moov precedes mdat without loading media payloads", async () => {
    const directory = await temporaryDirectory();
    const fast = join(directory, "fast.mp4");
    const slow = join(directory, "slow.mp4");
    await writeFile(fast, Buffer.concat([
      atom("ftyp", Buffer.alloc(8)),
      atom("moov", Buffer.alloc(8)),
      atom("mdat", Buffer.alloc(16))
    ]));
    await writeFile(slow, Buffer.concat([
      atom("ftyp", Buffer.alloc(8)),
      atom("mdat", Buffer.alloc(16)),
      atom("moov", Buffer.alloc(8))
    ]));

    await expect(inspectMp4FastStart(fast)).resolves.toBe(true);
    await expect(inspectMp4FastStart(slow)).resolves.toBe(false);
  });

  it("cleans temporary render data and matches bounded SQL backoff", async () => {
    let renderPath = "";
    await expect(withStudioRenderTempDirectory(async (path) => {
      renderPath = path;
      await writeFile(join(path, "frame.rgba"), "temporary");
      return "done";
    })).resolves.toBe("done");
    await expect(stat(renderPath)).rejects.toMatchObject({ code: "ENOENT" });

    expect([1, 2, 3, 7, 99].map(studioRenderRetryDelaySeconds))
      .toEqual([5, 10, 20, 300, 300]);
  });
});

function fakePng(width: number, height: number, includeSrgb: boolean) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    ...(includeSrgb ? [chunk("sRGB", Buffer.from([0]))] : []),
    chunk("IDAT", Buffer.from([0])),
    chunk("IEND", Buffer.alloc(0))
  ]);
}

function atom(type: string, data: Buffer) {
  const header = Buffer.alloc(8);
  header.writeUInt32BE(header.length + data.length, 0);
  header.write(type, 4, "ascii");
  return Buffer.concat([header, data]);
}

function chunk(type: string, data: Buffer) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const payload = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(payload));
  return Buffer.concat([
    length,
    payload,
    crc
  ]);
}

function crc32(value: Uint8Array) {
  let crc = 0xffff_ffff;
  for (const byte of value) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb8_8320 : 0);
    }
  }
  return (crc ^ 0xffff_ffff) >>> 0;
}

async function temporaryDirectory() {
  const path = await mkdtemp(join(tmpdir(), "veyocast-studio-test-"));
  temporaryDirectories.push(path);
  return path;
}

function studioTextDocument(
  fontFamily: StudioFontFamily,
  fontWeight: 400 | 500 | 600 | 700 | 800 | 900
) {
  const document = createEmptyStudioDocument("landscape-hd", {
    background: "#141414"
  });
  return parseStudioDocument({
    ...document,
    elements: [{
      align: "left",
      autoFit: false,
      cornerRadius: 0,
      fill: "#FAFAF7",
      fontFamily,
      fontSize: 144,
      fontWeight,
      height: 220,
      id: "rendered-text",
      letterSpacing: 0,
      lineHeight: 1,
      locked: false,
      name: "Gerenderde tekst",
      opacity: 1,
      padding: 0,
      rotation: 0,
      text: "VeyoCast tekst",
      type: "text",
      verticalAlign: "top",
      visible: true,
      width: 1_500,
      x: 120,
      y: 120,
      zIndex: 0
    }]
  });
}
