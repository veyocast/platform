import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

const repositoryRoot = path.resolve(process.cwd(), "../..");
const canonicalDirectory = path.join(repositoryRoot, "assets/brand");

const officialAssetNames = [
  "veyocast-apple-touch-icon-180.png",
  "veyocast-favicon-16.png",
  "veyocast-favicon-32.png",
  "veyocast-favicon-48.png",
  "veyocast-favicon.ico",
  "veyocast-favicon.svg",
  "veyocast-icon-192.png",
  "veyocast-icon-512.png",
  "veyocast-icon-maskable-1024.png",
  "veyocast-icon-maskable-192.png",
  "veyocast-icon-maskable-256.png",
  "veyocast-icon-maskable-384.png",
  "veyocast-icon-maskable-512.png",
  "veyocast-icon-maskable.svg",
  "veyocast-icon-primary.svg",
  "veyocast-logo-inverse.svg",
  "veyocast-logo-monochrome-black.svg",
  "veyocast-logo-monochrome-white.svg",
  "veyocast-logo-primary.svg",
  "veyocast-social-avatar-1024.png"
] as const;

const lockedMasterHashes = {
  "veyocast-icon-primary.svg":
    "7da5a32e11304981b6567a8300ada116925a24f3dc5396a7546d812ad2eba9b1",
  "veyocast-logo-inverse.svg":
    "ebeba6d04108bf04fa2d85cf655d4f68689165da151c970ddb8e30c7ec3e1d1a",
  "veyocast-logo-primary.svg":
    "0b9720fd6eb70b402ff39072ce3985d1478888434065d6abfb1867b5ac11dd01"
} as const;

function sha256(bytes: Buffer) {
  return createHash("sha256").update(bytes).digest("hex");
}

describe("VeyoCast brand assets v1.0", () => {
  it("contains exactly the approved official variants", async () => {
    const actualNames = (await readdir(canonicalDirectory))
      .filter((name) => name.startsWith("veyocast-"))
      .sort();

    expect(actualNames).toEqual([...officialAssetNames].sort());
  });

  it.each(Object.entries(lockedMasterHashes))(
    "keeps locked master %s byte-identical",
    async (name, expectedHash) => {
      const bytes = await readFile(path.join(canonicalDirectory, name));

      expect(sha256(bytes)).toBe(expectedHash);
    }
  );

  it("keeps every app public copy byte-identical to the canonical set", async () => {
    for (const app of ["control", "marketing", "player"]) {
      for (const name of officialAssetNames) {
        const canonical = await readFile(path.join(canonicalDirectory, name));
        const publicCopy = await readFile(
          path.join(repositoryRoot, "apps", app, "public/brand", name)
        );

        expect(sha256(publicCopy), `${app}/${name}`).toBe(sha256(canonical));
      }
    }
  });

  it("contains no active or externally loaded content in official SVGs", async () => {
    for (const name of officialAssetNames.filter((asset) => asset.endsWith(".svg"))) {
      const source = await readFile(path.join(canonicalDirectory, name), "utf8");

      expect(source).not.toMatch(/<(?:script|foreignObject|image)\b/i);
      expect(source).not.toMatch(/\son[a-z]+\s*=/i);
      expect(source).not.toMatch(/\s(?:href|xlink:href)\s*=/i);
    }
  });
});
