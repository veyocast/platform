export type ImageDimensions = {
  height: number;
  width: number;
};

const jpegStartOfFrameMarkers = new Set([
  0xc0,
  0xc1,
  0xc2,
  0xc3,
  0xc5,
  0xc6,
  0xc7,
  0xc9,
  0xca,
  0xcb,
  0xcd,
  0xce,
  0xcf
]);
const maximumDimensionPixels = 32_768;
const maximumTotalPixels = 268_435_456;

export function readImageDimensions(
  bytes: Uint8Array,
  mimeType: string
): ImageDimensions | null {
  if (mimeType === "image/png") return readPngDimensions(bytes);
  if (mimeType === "image/jpeg") return readJpegDimensions(bytes);
  if (mimeType === "image/webp") return readWebpDimensions(bytes);
  return null;
}

function readPngDimensions(bytes: Uint8Array) {
  if (
    bytes.length < 24 ||
    ascii(bytes, 12, 16) !== "IHDR"
  ) {
    return null;
  }

  return validDimensions(readUint32(bytes, 16, false), readUint32(bytes, 20, false));
}

function readJpegDimensions(bytes: Uint8Array) {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;

  let height: number | null = null;
  let orientation = 1;
  let offset = 2;
  let width: number | null = null;

  while (offset + 1 < bytes.length) {
    while (offset < bytes.length && bytes[offset] !== 0xff) offset += 1;
    while (offset < bytes.length && bytes[offset] === 0xff) offset += 1;
    if (offset >= bytes.length) break;

    const marker = bytes[offset]!;
    offset += 1;

    if (marker === 0xd9 || marker === 0xda) break;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (offset + 2 > bytes.length) break;

    const segmentLength = readUint16(bytes, offset, false);
    if (
      segmentLength === null ||
      segmentLength < 2 ||
      offset + segmentLength > bytes.length
    ) {
      break;
    }

    const payloadOffset = offset + 2;
    const payloadLength = segmentLength - 2;

    if (marker === 0xe1) {
      orientation =
        readExifOrientation(bytes, payloadOffset, payloadLength) ?? orientation;
    }

    if (
      jpegStartOfFrameMarkers.has(marker) &&
      payloadLength >= 5
    ) {
      height = readUint16(bytes, payloadOffset + 1, false);
      width = readUint16(bytes, payloadOffset + 3, false);
    }

    offset += segmentLength;
  }

  if (width === null || height === null) return null;
  return orientation >= 5 && orientation <= 8
    ? validDimensions(height, width)
    : validDimensions(width, height);
}

function readExifOrientation(
  bytes: Uint8Array,
  payloadOffset: number,
  payloadLength: number
) {
  if (
    payloadLength < 14 ||
    ascii(bytes, payloadOffset, payloadOffset + 6) !== "Exif\u0000\u0000"
  ) {
    return null;
  }

  const tiffOffset = payloadOffset + 6;
  const byteOrder = ascii(bytes, tiffOffset, tiffOffset + 2);
  const littleEndian =
    byteOrder === "II" ? true : byteOrder === "MM" ? false : null;
  if (littleEndian === null) return null;

  const marker = readUint16(bytes, tiffOffset + 2, littleEndian);
  const firstIfdOffset = readUint32(bytes, tiffOffset + 4, littleEndian);
  if (marker !== 42 || firstIfdOffset === null) return null;

  const ifdOffset = tiffOffset + firstIfdOffset;
  const entryCount = readUint16(bytes, ifdOffset, littleEndian);
  if (entryCount === null) return null;

  const payloadEnd = payloadOffset + payloadLength;
  for (let index = 0; index < entryCount; index += 1) {
    const entryOffset = ifdOffset + 2 + index * 12;
    if (entryOffset + 12 > payloadEnd) return null;

    const tag = readUint16(bytes, entryOffset, littleEndian);
    if (tag !== 0x0112) continue;

    const type = readUint16(bytes, entryOffset + 2, littleEndian);
    const count = readUint32(bytes, entryOffset + 4, littleEndian);
    const value = readUint16(bytes, entryOffset + 8, littleEndian);
    return type === 3 && count === 1 && value !== null && value >= 1 && value <= 8
      ? value
      : null;
  }

  return null;
}

function readWebpDimensions(bytes: Uint8Array) {
  if (
    bytes.length < 20 ||
    ascii(bytes, 0, 4) !== "RIFF" ||
    ascii(bytes, 8, 12) !== "WEBP"
  ) {
    return null;
  }

  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const chunkType = ascii(bytes, offset, offset + 4);
    const chunkLength = readUint32(bytes, offset + 4, true);
    if (chunkLength === null) return null;

    const payloadOffset = offset + 8;
    if (payloadOffset + chunkLength > bytes.length) return null;

    if (chunkType === "VP8X" && chunkLength >= 10) {
      return validDimensions(
        1 + readUint24LittleEndian(bytes, payloadOffset + 4),
        1 + readUint24LittleEndian(bytes, payloadOffset + 7)
      );
    }

    if (
      chunkType === "VP8L" &&
      chunkLength >= 5 &&
      bytes[payloadOffset] === 0x2f
    ) {
      const byte1 = bytes[payloadOffset + 1] ?? 0;
      const byte2 = bytes[payloadOffset + 2] ?? 0;
      const byte3 = bytes[payloadOffset + 3] ?? 0;
      const byte4 = bytes[payloadOffset + 4] ?? 0;
      return validDimensions(
        1 + byte1 + ((byte2 & 0x3f) << 8),
        1 + (byte2 >> 6) + (byte3 << 2) + ((byte4 & 0x0f) << 10)
      );
    }

    if (
      chunkType === "VP8 " &&
      chunkLength >= 10 &&
      bytes[payloadOffset + 3] === 0x9d &&
      bytes[payloadOffset + 4] === 0x01 &&
      bytes[payloadOffset + 5] === 0x2a
    ) {
      const width = readUint16(bytes, payloadOffset + 6, true);
      const height = readUint16(bytes, payloadOffset + 8, true);
      return width === null || height === null
        ? null
        : validDimensions(width & 0x3fff, height & 0x3fff);
    }

    offset = payloadOffset + chunkLength + (chunkLength % 2);
  }

  return null;
}

function ascii(bytes: Uint8Array, start: number, end: number) {
  if (start < 0 || end > bytes.length || start > end) return "";
  return String.fromCharCode(...bytes.subarray(start, end));
}

function readUint16(bytes: Uint8Array, offset: number, littleEndian: boolean) {
  if (offset < 0 || offset + 2 > bytes.length) return null;
  return new DataView(
    bytes.buffer,
    bytes.byteOffset + offset,
    2
  ).getUint16(0, littleEndian);
}

function readUint24LittleEndian(bytes: Uint8Array, offset: number) {
  return (
    (bytes[offset] ?? 0) |
    ((bytes[offset + 1] ?? 0) << 8) |
    ((bytes[offset + 2] ?? 0) << 16)
  );
}

function readUint32(bytes: Uint8Array, offset: number, littleEndian: boolean) {
  if (offset < 0 || offset + 4 > bytes.length) return null;
  return new DataView(
    bytes.buffer,
    bytes.byteOffset + offset,
    4
  ).getUint32(0, littleEndian);
}

function validDimensions(
  width: number | null,
  height: number | null
): ImageDimensions | null {
  return width !== null &&
    height !== null &&
    Number.isSafeInteger(width) &&
    Number.isSafeInteger(height) &&
    width > 0 &&
    height > 0 &&
    width <= maximumDimensionPixels &&
    height <= maximumDimensionPixels &&
    width * height <= maximumTotalPixels
    ? { height, width }
    : null;
}
