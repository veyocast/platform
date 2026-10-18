import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { URL } from "node:url";
import { describe, expect, it } from "vitest";

const provenance = JSON.parse(
  readFileSync(
    new URL("../../assets/fonts/sync-font-provenance.json", import.meta.url),
    "utf8",
  ),
) as {
  sourcePath: string;
  sourceSha256: string;
  fonts: {
    path: string;
    weight: number;
    bytes: number;
    sha256: string;
    glyphCount: number;
  }[];
};

describe("pinned Sync Manrope native font provenance", () => {
  it("ships source-derived TrueType weights with unchanged glyph sets and verified bytes", () => {
    const source = readFileSync(
      new URL(`../../../../${provenance.sourcePath}`, import.meta.url),
    );
    expect(createHash("sha256").update(source).digest("hex")).toBe(
      provenance.sourceSha256,
    );
    expect(provenance.sourceSha256).toBe(
      "a30ddcd349703aff7464c34bef3fffdff405ee50c113440d7c8693c02d210972",
    );
    expect(provenance.fonts.map((f) => f.weight)).toEqual([
      400, 450, 500, 600, 650, 700, 750,
    ]);
    for (const font of provenance.fonts) {
      const bytes = readFileSync(
        new URL(`../../assets/fonts/${font.path}`, import.meta.url),
      );
      expect(bytes.length).toBe(font.bytes);
      expect(createHash("sha256").update(bytes).digest("hex")).toBe(
        font.sha256,
      );
      expect(bytes.readUInt32BE(0)).toBe(0x00010000);
      const tables = Array.from({ length: bytes.readUInt16BE(4) }, (_, i) => {
        const at = 12 + i * 16;
        return {
          tag: bytes.toString("ascii", at, at + 4),
          offset: bytes.readUInt32BE(at + 8),
        };
      });
      expect(tables.some((t) => t.tag === "fvar")).toBe(false);
      const maxp = tables.find((t) => t.tag === "maxp")!;
      expect(bytes.readUInt16BE(maxp.offset + 4)).toBe(font.glyphCount);
      expect(font.glyphCount).toBe(280);
      expect(
        bytes.readUInt16BE(tables.find((t) => t.tag === "OS/2")!.offset + 4),
      ).toBe(font.weight);
    }
  });
});
