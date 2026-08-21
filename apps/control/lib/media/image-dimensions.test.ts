import { describe, expect, it } from "vitest";

import { readImageDimensions } from "./image-dimensions";

describe("afbeeldingsafmetingen", () => {
  it("leest een staande PNG zonder het formaat om te draaien", () => {
    const png = new Uint8Array(24);
    png.set([137, 80, 78, 71, 13, 10, 26, 10], 0);
    png.set([0, 0, 0, 13], 8);
    png.set([73, 72, 68, 82], 12);
    writeUint32(png, 16, 1080, false);
    writeUint32(png, 20, 1920, false);

    expect(readImageDimensions(png, "image/png")).toEqual({
      height: 1920,
      width: 1080
    });
  });

  it("leest de intrinsieke afmetingen van een staande JPEG", () => {
    const jpeg = jpegWithDimensions(1080, 1920);

    expect(readImageDimensions(jpeg, "image/jpeg")).toEqual({
      height: 1920,
      width: 1080
    });
  });

  it("past EXIF-rotatie toe op een portraitfoto met liggende pixelmatrix", () => {
    const jpeg = jpegWithDimensions(1920, 1080, 6);

    expect(readImageDimensions(jpeg, "image/jpeg")).toEqual({
      height: 1920,
      width: 1080
    });
  });

  it("leest een staande WebP-canvas", () => {
    const webp = new Uint8Array(30);
    webp.set(textBytes("RIFF"), 0);
    writeUint32(webp, 4, 22, true);
    webp.set(textBytes("WEBPVP8X"), 8);
    writeUint32(webp, 16, 10, true);
    writeUint24(webp, 24, 1079);
    writeUint24(webp, 27, 1919);

    expect(readImageDimensions(webp, "image/webp")).toEqual({
      height: 1920,
      width: 1080
    });
  });

  it("leest GIF- en SVG-afmetingen zonder een browserdecoder", () => {
    const gif = new Uint8Array(10);
    gif.set(textBytes("GIF89a"), 0);
    gif.set([0x38, 0x04, 0x80, 0x07], 6);
    expect(readImageDimensions(gif, "image/gif")).toEqual({ height: 1920, width: 1080 });

    expect(readImageDimensions(
      new TextEncoder().encode('<svg viewBox="0 0 1080 1920" xmlns="http://www.w3.org/2000/svg"></svg>'),
      "image/svg+xml"
    )).toEqual({ height: 1920, width: 1080 });
  });

  it("weigert corrupte inhoud zonder bruikbare afmetingen", () => {
    expect(
      readImageDimensions(new Uint8Array([137, 80, 78, 71]), "image/png")
    ).toBeNull();
  });

  it("weigert onrealistische headers voordat een decoder geheugen reserveert", () => {
    const png = new Uint8Array(24);
    png.set([137, 80, 78, 71, 13, 10, 26, 10], 0);
    png.set([0, 0, 0, 13], 8);
    png.set([73, 72, 68, 82], 12);
    writeUint32(png, 16, 40_000, false);
    writeUint32(png, 20, 40_000, false);

    expect(readImageDimensions(png, "image/png")).toBeNull();
  });
});

function jpegWithDimensions(
  width: number,
  height: number,
  orientation?: number
) {
  const bytes = [
    0xff,
    0xd8,
    ...(orientation ? exifOrientationSegment(orientation) : []),
    0xff,
    0xc0,
    0x00,
    0x11,
    0x08,
    (height >> 8) & 0xff,
    height & 0xff,
    (width >> 8) & 0xff,
    width & 0xff,
    0x03,
    0x01,
    0x11,
    0x00,
    0x02,
    0x11,
    0x00,
    0x03,
    0x11,
    0x00,
    0xff,
    0xd9
  ];
  return Uint8Array.from(bytes);
}

function exifOrientationSegment(orientation: number) {
  return [
    0xff,
    0xe1,
    0x00,
    0x22,
    ...textBytes("Exif"),
    0x00,
    0x00,
    0x49,
    0x49,
    0x2a,
    0x00,
    0x08,
    0x00,
    0x00,
    0x00,
    0x01,
    0x00,
    0x12,
    0x01,
    0x03,
    0x00,
    0x01,
    0x00,
    0x00,
    0x00,
    orientation,
    0x00,
    0x00,
    0x00,
    0x00,
    0x00,
    0x00,
    0x00
  ];
}

function textBytes(value: string) {
  return [...value].map((character) => character.charCodeAt(0));
}

function writeUint24(bytes: Uint8Array, offset: number, value: number) {
  bytes[offset] = value & 0xff;
  bytes[offset + 1] = (value >> 8) & 0xff;
  bytes[offset + 2] = (value >> 16) & 0xff;
}

function writeUint32(
  bytes: Uint8Array,
  offset: number,
  value: number,
  littleEndian: boolean
) {
  new DataView(bytes.buffer).setUint32(offset, value, littleEndian);
}
