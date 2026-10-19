import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

function scalar(text, label) {
  const value = text.replace(/\s+#.*$/u, "").trim();
  if (/^"(?:[^"\\]|\\.)*"$/u.test(value)) return JSON.parse(value);
  if (/^'(?:[^']|'')*'$/u.test(value)) return value.slice(1, -1).replace(/''/gu, "'");
  assert.match(value, /^[A-Za-z0-9@./_+~^*%=-][A-Za-z0-9@./_+~^*% =-]*$/u, `${label}: unsupported patch scalar`);
  return value;
}

// Accept pnpm's canonical scalar patch maps; unsupported YAML fails closed.
// This intentionally does not implement a general-purpose YAML parser.
export function patchSelectors(source, label) {
  let active = false, seen = false, explicitEmpty = false, rootSeen = false;
  const selectors = new Set();
  const finish = () => assert.ok(!active || explicitEmpty || selectors.size > 0, `${label}: empty patch registration`);
  for (const line of source.replace(/^\uFEFF/u, "").split(/\r?\n/u)) {
    if (!line.trim() || /^\s*#/u.test(line)) continue;
    assert.ok(rootSeen || !/^\s/u.test(line), `${label}: unsupported indented document root`);
    if (!/^\s/u.test(line)) {
      rootSeen = true;
      finish(); active = false;
      const header = /^((?:"(?:[^"\\]|\\.)*"|'(?:[^']|'')*'|[A-Za-z0-9_-]+))\s*:\s*(.*?)\s*$/u.exec(line);
      assert.ok(header, `${label}: unsupported root mapping`);
      if (scalar(header[1], label) !== "patchedDependencies") continue;
      assert.ok(!seen, `${label}: duplicate patchedDependencies`); seen = true;
      const rest = header[2].replace(/\s*#.*$/u, "").trim();
      assert.ok(rest === "" || rest === "{}", `${label}: unsupported patchedDependencies mapping`);
      active = true; explicitEmpty = rest === "{}"; continue;
    }
    if (!active) continue;
    assert.ok(!explicitEmpty, `${label}: entries after empty patch map`);
    const entry = /^ {2}((?:"(?:[^"\\]|\\.)*"|'(?:[^']|'')*'|[^\s'":][^:]*?)):\s*(.*?)\s*$/u.exec(line);
    assert.ok(entry, `${label}: malformed patch entry`);
    const key = scalar(entry[1], label);
    assert.match(key, /^(?:@[a-z0-9._-]+\/)?[a-z0-9._-]+(?:@[^:\r\n]+)?$/u, `${label}: unsupported patch selector`);
    assert.ok(!selectors.has(key), `${label}: duplicate patch selector`);
    scalar(entry[2], label); selectors.add(key);
  }
  finish(); return [...selectors];
}

export function assertOfficialPackagerUnpatched(documents) {
  for (const [label, source] of Object.entries(documents)) {
    for (const selector of patchSelectors(source, label)) {
      assert.ok(selector !== "@webos-tools/cli" && !selector.startsWith("@webos-tools/cli@"), "De officiële Signage-packager mag niet lokaal gepatcht zijn.");
    }
  }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const root = resolve(import.meta.dirname, "../../..");
  const documents = Object.fromEntries(await Promise.all(["pnpm-workspace.yaml", "pnpm-lock.yaml"].map(async name => [name, await readFile(resolve(root, name), "utf8")])));
  assertOfficialPackagerUnpatched(documents);
  console.log("Officiële Signage-packager heeft geen patchregistratie.");
}
