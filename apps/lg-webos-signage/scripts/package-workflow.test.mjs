import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

const repositoryRoot = resolve(import.meta.dirname, "../../..");
const buildSource = await readFile(
  resolve(import.meta.dirname, "build-ipk.mjs"),
  "utf8"
);
const cliPatch = await readFile(
  resolve(repositoryRoot, "patches/@webos-tools__cli@3.2.5.patch"),
  "utf8"
);

test("bouwt beide IPKs uitsluitend met de officiële ares-package workflow", () => {
  assert.match(buildSource, /runCommand\("ares-package"/u);
  assert.doesNotMatch(buildSource, /runCommand\("(?:ar|tar|dpkg|opkg)"/u);
  assert.match(buildSource, /packageSpecifications/u);
  assert.match(buildSource, /SOURCE_DATE_EPOCH/u);
});

test("corrigeert alleen de bekende officiële CLI-placeholder en hostmetadata", () => {
  assert.match(cliPatch, /webOS-Packager-Version: " \+ cliPackage\.version/u);
  assert.match(cliPatch, /entry\.uid = 0/u);
  assert.match(cliPatch, /entry\.gid = 0/u);
  assert.match(cliPatch, /entry\.mode/u);
  assert.match(cliPatch, /SOURCE_DATE_EPOCH/u);
  assert.doesNotMatch(cliPatch, /nl\.veyocast\.player/u);
});
