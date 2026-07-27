import type { StudioDocument } from "@veyocast/studio";

import {
  renderStudioSvg,
  type StudioSvgAssetSources
} from "./studio-render-svg";

export type StudioRasterDimensions = {
  height: number;
  width: number;
};

export interface StudioExternalRenderer {
  renderPng(input: {
    height: number;
    signal?: AbortSignal;
    svg: string;
    width: number;
  }): Promise<Uint8Array>;
  renderRgba(input: {
    height: number;
    signal?: AbortSignal;
    svg: string;
    width: number;
  }): Promise<Uint8Array>;
  renderQrSvgDataUri?(input: {
    background: string;
    errorCorrection: "H" | "L" | "M" | "Q";
    foreground: string;
    value: string;
  }): Promise<string>;
}

export type StudioPngMetadata = {
  colorProfile: "icc" | "srgb";
  colorType: 2 | 6;
  height: number;
  width: number;
};

export class StudioImageRenderError extends Error {
  constructor(
    readonly code:
      | "png_invalid"
      | "png_profile_invalid"
      | "render_cancelled"
      | "renderer_font_unavailable"
      | "renderer_output_invalid",
    message: string
  ) {
    super(message);
    this.name = "StudioImageRenderError";
  }
}

export async function renderStudioPng({
  assetSources,
  document,
  renderer,
  signal,
  timeMs = 0
}: {
  assetSources?: StudioSvgAssetSources;
  document: StudioDocument;
  renderer: StudioExternalRenderer;
  signal?: AbortSignal;
  timeMs?: number;
}) {
  throwIfAborted(signal);
  const svg = renderStudioSvg({ assetSources, document, timeMs });
  const rendered = await renderer.renderPng({
    height: document.artboard.height,
    signal,
    svg,
    width: document.artboard.width
  });
  throwIfAborted(signal);
  const png = Buffer.from(rendered);
  validateStudioPng(png, document.artboard);
  return png;
}

export function validateStudioPng(
  png: Uint8Array,
  expected: StudioRasterDimensions
): StudioPngMetadata {
  const buffer = Buffer.from(png);
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (
    buffer.length < 45 ||
    !buffer.subarray(0, signature.length).equals(signature)
  ) {
    throw invalidPng("PNG-signatuur ontbreekt.");
  }

  let offset = signature.length;
  let ihdr: Buffer | null = null;
  let hasImageData = false;
  let hasEnd = false;
  let colorProfile: StudioPngMetadata["colorProfile"] | null = null;
  let chunkCount = 0;

  while (offset + 12 <= buffer.length && chunkCount < 10_000) {
    const length = buffer.readUInt32BE(offset);
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    const chunkEnd = dataEnd + 4;
    if (chunkEnd > buffer.length) {
      throw invalidPng("PNG-chunk valt buiten het bestand.");
    }
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    const expectedCrc = buffer.readUInt32BE(dataEnd);
    const actualCrc = pngCrc32(buffer.subarray(offset + 4, dataEnd));
    if (expectedCrc !== actualCrc) {
      throw invalidPng(`PNG-chunk ${type} heeft een ongeldige CRC.`);
    }
    if (chunkCount === 0 && type !== "IHDR") {
      throw invalidPng("IHDR is niet de eerste PNG-chunk.");
    }
    if (type === "IHDR") {
      if (length !== 13 || ihdr) {
        throw invalidPng("IHDR is ongeldig of dubbel aanwezig.");
      }
      ihdr = buffer.subarray(dataStart, dataEnd);
    } else if (type === "sRGB") {
      colorProfile = "srgb";
    } else if (type === "iCCP" && colorProfile === null) {
      colorProfile = "icc";
    } else if (type === "IDAT") {
      hasImageData = true;
    } else if (type === "IEND") {
      if (length !== 0 || chunkEnd !== buffer.length) {
        throw invalidPng("PNG bevat ongeldige data na IEND.");
      }
      hasEnd = true;
      break;
    }
    offset = chunkEnd;
    chunkCount += 1;
  }

  if (!ihdr || !hasImageData || !hasEnd) {
    throw invalidPng("PNG mist IHDR-, IDAT- of IEND-data.");
  }
  const width = ihdr.readUInt32BE(0);
  const height = ihdr.readUInt32BE(4);
  const bitDepth = ihdr[8];
  const colorType = ihdr[9];
  const compression = ihdr[10];
  const filter = ihdr[11];
  const interlace = ihdr[12];
  if (width !== expected.width || height !== expected.height) {
    throw invalidPng(
      `PNG-resolutie ${width}×${height} wijkt af van ${expected.width}×${expected.height}.`
    );
  }
  if (
    bitDepth !== 8 ||
    (colorType !== 2 && colorType !== 6) ||
    compression !== 0 ||
    filter !== 0 ||
    interlace !== 0
  ) {
    throw invalidPng(
      "PNG gebruikt geen ondersteunde 8-bit sRGB RGB/RGBA-indeling."
    );
  }
  if (!colorProfile) {
    throw new StudioImageRenderError(
      "png_profile_invalid",
      "PNG bevat geen expliciet sRGB- of ICC-kleurprofiel."
    );
  }
  return {
    colorProfile,
    colorType,
    height,
    width
  };
}

export function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) {
    throw new StudioImageRenderError(
      "render_cancelled",
      "Studio-render is geannuleerd."
    );
  }
}

function invalidPng(message: string) {
  return new StudioImageRenderError("png_invalid", message);
}

const pngCrcTable = Array.from({ length: 256 }, (_entry, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = (value >>> 1) ^ (value & 1 ? 0xedb8_8320 : 0);
  }
  return value >>> 0;
});

function pngCrc32(value: Uint8Array) {
  let crc = 0xffff_ffff;
  for (const byte of value) {
    crc = (crc >>> 8) ^ (pngCrcTable[(crc ^ byte) & 0xff] ?? 0);
  }
  return (crc ^ 0xffff_ffff) >>> 0;
}
