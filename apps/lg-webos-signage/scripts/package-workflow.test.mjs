import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { assertOfficialPackagerUnpatched, patchSelectors } from "./assert-official-packager.mjs";

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

test("muteert de officiële Signage-packager niet meer met een pnpm-patch", async () => {
  const lockSource = await readFile(resolve(repositoryRoot, "pnpm-lock.yaml"), "utf8");
  assertOfficialPackagerUnpatched({ "pnpm-workspace.yaml": workspaceSource, "pnpm-lock.yaml": lockSource });
  assert.doesNotMatch(workspaceSource, /@webos-tools__cli/u);
});

test("laat Next-only patchregistraties en afwezige of lege patchmappen toe", () => {
  assertOfficialPackagerUnpatched({ workspace: "patchedDependencies:\n  next@15.5.20: patches/next@15.5.20.patch\n", lock: "patchedDependencies:\n  'next@15.5.20': 77cfedc4\n" });
  assert.deepEqual(patchSelectors("packages:\n  - apps/*\n", "workspace"), []);
  assert.deepEqual(patchSelectors("patchedDependencies: {}\n", "workspace"), []);
});

for (const filename of ["pnpm-workspace.yaml", "pnpm-lock.yaml"]) {
  test(`weigert officiële CLI-patches in ${filename}, ook gequote of geversioneerd`, () => {
    for (const selector of ["'@webos-tools/cli'", "'@webos-tools/cli@3.2.5'", '\"@webos-tools/cli@3.2.5\"', "@webos-tools/cli@3.2.5"]) {
      assert.throws(() => assertOfficialPackagerUnpatched({ [filename]: `patchedDependencies:\n  next@15.5.20: patches/next.patch\n  ${selector}: patches/webos.patch\n` }), /officiële Signage-packager/u);
    }
  });
}

test("weigert onleesbare, dubbele en niet ondersteunde patchregistraties", () => {
  for (const source of ["patchedDependencies: [invalid]\n", "patchedDependencies:\n  next@15.5.20: [unfinished\n", "patchedDependencies:\n  <<: *hidden\n", "patchedDependencies:\n", "patchedDependencies: {}\npatchedDependencies: {}\n", "patchedDependencies:\n  next@15.5.20: x\n  next@15.5.20: y\n"]) {
    assert.throws(() => assertOfficialPackagerUnpatched({ workspace: source }));
  }
});

test("normaliseert escaped rootsleutels en selectors; weigert rootmerge en explicit keys", () => {
  const escapedHeader = String.raw`"patched\u0044ependencies"`;
  const escapedSelector = String.raw`"@webos-tools\u002fcli@3.2.5"`;
  for (const filename of ["pnpm-workspace.yaml", "pnpm-lock.yaml"]) {
    for (const [header, selector] of [[escapedHeader, "'@webos-tools/cli@3.2.5'"], ["patchedDependencies", escapedSelector]]) {
      assert.throws(() => assertOfficialPackagerUnpatched({ [filename]: `${header}:\n  ${selector}: patches/webos.patch\n` }), /officiële Signage-packager/u);
    }
    for (const source of ["<<: *patches\n", "? patchedDependencies\n: {}\n", "  patchedDependencies:\n    '@webos-tools/cli@3.2.5': patches/webos.patch\n"]) assert.throws(() => assertOfficialPackagerUnpatched({ [filename]: source }));
  }
});
