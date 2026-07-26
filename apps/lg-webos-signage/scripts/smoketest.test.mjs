import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

const source = await readFile(
  resolve(import.meta.dirname, "../smoketest/index.html"),
  "utf8"
);

test("smoketest is volledig lokaal en toont levende runtime-informatie", () => {
  assert.doesNotMatch(source, /\bhttps?:\/\//u);
  assert.doesNotMatch(source, /<iframe\b/iu);
  assert.doesNotMatch(source, /<script[^>]+src=/iu);
  assert.match(source, /VeyoCast LG smoketest 1\.0\.2/u);
  assert.match(source, /setInterval/u);
  assert.match(source, /navigator\.userAgent/u);
  assert.match(source, /documentValue\.visibilityState/u);
});

test("smoketest registreert alle vereiste afstandsbedieningstoetsen", () => {
  for (const key of [
    "ArrowLeft",
    "ArrowUp",
    "ArrowRight",
    "ArrowDown",
    "Enter",
    "461",
    "MediaPlayPause",
    "MediaPlay",
    "MediaPause"
  ]) {
    assert.match(source, new RegExp(key, "u"));
  }
});
