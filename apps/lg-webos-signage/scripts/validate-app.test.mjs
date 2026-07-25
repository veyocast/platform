import assert from "node:assert/strict";
import { test } from "node:test";

import {
  isSemanticVersion,
  parsePngDimensions,
  validateExternalUrls
} from "./validate-app.mjs";

test("semantic versions require major, minor and patch", () => {
  assert.equal(isSemanticVersion("1.0.0"), true);
  assert.equal(isSemanticVersion("1.0"), false);
  assert.equal(isSemanticVersion("01.0.0"), false);
});

test("PNG dimensions are read from the IHDR header", () => {
  const png = Buffer.alloc(24);
  Buffer.from("89504e470d0a1a0a", "hex").copy(png, 0);
  Buffer.from("IHDR").copy(png, 12);
  png.writeUInt32BE(80, 16);
  png.writeUInt32BE(130, 20);
  assert.deepEqual(parsePngDimensions(png), { height: 130, width: 80 });
});

test("external URL validation permits only the production Player origin", () => {
  assert.deepEqual(
    validateExternalUrls("https://player.veyocast.nl/lg", "bootstrap.js"),
    []
  );
  assert.match(
    validateExternalUrls("https://example.org/player", "bootstrap.js")[0],
    /buiten de allowlist/u
  );
  assert.match(
    validateExternalUrls("http://player.veyocast.nl/lg", "bootstrap.js")[0],
    /niet-HTTPS/u
  );
});
