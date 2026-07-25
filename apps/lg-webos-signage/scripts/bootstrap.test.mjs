import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

const source = await readFile(
  resolve(import.meta.dirname, "../bootstrap.js"),
  "utf8"
);

test("productiewrapper toont lokaal opstartbewijs voordat READY binnenkomt", () => {
  assert.match(source, /LOCAL_STARTED/u);
  assert.match(source, /HOSTED_LOADING/u);
  assert.match(source, /IFRAME_LOADED/u);
  assert.match(source, /VEYOCAST_LG_PLAYER_READY/u);
  assert.match(source, /status\.hidden = true/u);
});

test("productiewrapper onderscheidt veilige foutcategorieën", () => {
  for (const category of [
    "NO_NETWORK",
    "DNS_HOST_UNREACHABLE",
    "TLS_ERROR",
    "HOSTED_PAGE_NOT_LOADED",
    "IFRAME_BLOCKED",
    "READY_TIMEOUT",
    "UNEXPECTED_MESSAGE_ORIGIN",
    "JAVASCRIPT_ERROR"
  ]) {
    assert.match(source, new RegExp(category, "u"));
  }
  assert.match(source, /MAX_AUTOMATIC_ATTEMPTS = 8/u);
  assert.match(source, /ATTEMPT_WINDOW_MS = 15 \* 60 \* 1000/u);
});

test("diagnostiek bewaart geen querystring, token of media-URL", () => {
  assert.match(source, /parsed\.origin \+ parsed\.pathname/u);
  assert.doesNotMatch(source, /pairingToken|deviceToken|signedUrl/u);
  assert.match(source, /STATUS_STORAGE_KEY/u);
});
