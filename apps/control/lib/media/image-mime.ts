export type DetectedImageMimeType =
  | "image/avif"
  | "image/gif"
  | "image/jpeg"
  | "image/png"
  | "image/svg+xml"
  | "image/webp";

export function detectImageMime(bytes: Uint8Array): DetectedImageMimeType | null {
  // The AVIF FileTypeBox is first. Inspect only its bounded brand list;
  // decoding still verifies AV1 and dimensions before anything is stored.
  if (bytes.length >= 20 && ascii(bytes, 4, 8) === "ftyp") {
    const size = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(0);
    if (size >= 20 && size <= Math.min(bytes.length, 4_096) && size % 4 === 0) {
      const brands = [ascii(bytes, 8, 12)];
      for (let offset = 16; offset < size; offset += 4) {
        brands.push(ascii(bytes, offset, offset + 4));
      }
      if (brands.includes("avif") && !brands.includes("avis")) return "image/avif";
    }
  }
  if (
    bytes.length >= 8 &&
    equal(bytes.subarray(0, 8), [137, 80, 78, 71, 13, 10, 26, 10])
  ) return "image/png";

  if (bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) {
    return "image/jpeg";
  }

  if (
    bytes.length >= 12 &&
    ascii(bytes, 0, 4) === "RIFF" &&
    ascii(bytes, 8, 12) === "WEBP"
  ) return "image/webp";

  if (
    bytes.length >= 10 &&
    (ascii(bytes, 0, 6) === "GIF87a" || ascii(bytes, 0, 6) === "GIF89a")
  ) return "image/gif";

  if (!bytes.includes(0)) {
    const prefix = new TextDecoder().decode(bytes.subarray(0, Math.min(bytes.length, 4_096)));
    if (!prefix.includes("\uFFFD") && /^\s*(?:<\?xml[^>]*>\s*)?<svg\b/i.test(prefix)) {
      return "image/svg+xml";
    }
  }
  return null;
}

function ascii(bytes: Uint8Array, start: number, end: number) {
  return String.fromCharCode(...bytes.subarray(start, end));
}

function equal(bytes: Uint8Array, expected: number[]) {
  return bytes.length === expected.length && expected.every((value, index) => bytes[index] === value);
}
