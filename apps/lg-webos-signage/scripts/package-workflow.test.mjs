import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

const repositoryRoot = resolve(import.meta.dirname, "../../..");
const buildSource = await readFile(
  resolve(import.meta.dirname, "build-ipk.mjs"),
  "utf8"
);
const workspaceSource = await readFile(
  resolve(repositoryRoot, "pnpm-workspace.yaml"),
  "utf8"
);

test("bouwt de smoketest uitsluitend met de officiële ares-package workflow", () => {
  assert.match(buildSource, /runCommand\(\s*"ares-package"/u);
  assert.doesNotMatch(buildSource, /runCommand\("(?:ar|tar|dpkg|opkg)"/u);
  assert.match(buildSource, /releaseCandidateSpecifications/u);
  assert.doesNotMatch(buildSource, /SOURCE_DATE_EPOCH/u);
  assert.doesNotMatch(buildSource, /WEBOS_PACKAGER_MAINTAINER/u);
});

test("muteert de officiële Signage-packager niet meer met een pnpm-patch", () => {
  assert.doesNotMatch(workspaceSource, /patchedDependencies/u);
  assert.doesNotMatch(workspaceSource, /@webos-tools__cli/u);
});
