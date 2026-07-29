import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterEach, test } from "node:test";
import { fileURLToPath } from "node:url";

const script = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "assert-client-bundle-secret-free.mjs"
);
const fixtures = [];

afterEach(() => {
  for (const fixture of fixtures.splice(0)) {
    rmSync(fixture, { force: true, recursive: true });
  }
});

test("scant een schone Next.js-clientbundle", () => {
  const fixture = createFixture(".next/static/chunks/app.js", "console.log('ok')");
  assert.equal(runScanner(fixture).status, 0);
});

test("scant een schone Expo-export", () => {
  const fixture = createFixture(
    "dist/_expo/static/js/android/entry.hbc",
    "veyocast-mobile-bundle"
  );
  createFile(
    fixture,
    "dist/_expo/static/js/android/entry.hbc.map",
    JSON.stringify({ sourcesContent: ["console.log('ok')"] })
  );
  assert.equal(runScanner(fixture).status, 0);
});

test("blokkeert serversecrets in een Expo-export", () => {
  const fixture = createFixture(
    "dist/_expo/static/js/android/entry.hbc",
    "veyocast-mobile-bundle"
  );
  createFile(
    fixture,
    "dist/_expo/static/js/android/entry.hbc.map",
    JSON.stringify({ sourcesContent: ["SUPABASE_SERVICE_ROLE_KEY"] })
  );
  const result = runScanner(fixture);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /gevoelige serverconfiguratie/);
});

test("faalt gesloten wanneer een Hermes-source map ontbreekt", () => {
  const fixture = createFixture(
    "dist/_expo/static/js/android/entry.hbc",
    "veyocast-mobile-bundle"
  );
  const result = runScanner(fixture);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /mist een source map/);
});

test("faalt gesloten wanneer geen clientbundle bestaat", () => {
  const fixture = createFixture("README.txt", "geen build");
  const result = runScanner(fixture);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Geen clientbundle gevonden/);
});

function createFixture(relativePath, contents) {
  const directory = mkdtempSync(join(tmpdir(), "veyocast-client-bundle-"));
  fixtures.push(directory);
  createFile(directory, relativePath, contents);
  return directory;
}

function createFile(directory, relativePath, contents) {
  const file = join(directory, relativePath);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, contents);
}

function runScanner(directory) {
  return spawnSync(process.execPath, [script, directory], {
    encoding: "utf8"
  });
}
