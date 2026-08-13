import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const rendererFiles = [
  "../src/editorial-arena-renderer.tsx",
  "../src/editorial-arena-renderer.module.css"
];

describe("Editorial Arena kleurgrens", () => {
  it.each(rendererFiles)("gebruikt in %s uitsluitend semantische tokens", (file) => {
    const contents = readFileSync(
      fileURLToPath(new URL(file, import.meta.url)),
      "utf8"
    );
    expect(contents).not.toMatch(
      /#[0-9a-f]{3,8}\b|\b(?:rgb|hsl|oklch)a?\s*\(/i
    );
  });
});
