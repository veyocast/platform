import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { resolve, relative, sep } from "node:path";
import process from "node:process";
import { validateCaseInventory } from "./sites-case-inventory.mjs";

const root = resolve("docs/sites-v11-overname/reference/sites");
const handoff = JSON.parse(await readFile("docs/sites-v11-overname/handoff/MANIFEST-SHA256.json", "utf8"));
const records = handoff.files.filter(record => record.path.startsWith("source/sites/"));
if (records.length !== 253) throw new Error("The original Sites reference inventory changed.");
const caseRecord = handoff.files.find(record => record.path === "inventory/VISUAL-CASES.csv");
const originalCases = await readFile("docs/sites-v11-overname/handoff/VISUAL-CASES.original.csv");
if (!caseRecord || originalCases.byteLength !== caseRecord.size || createHash("sha256").update(originalCases).digest("hex") !== caseRecord.sha256) {
  throw new Error("Immutable original visual-case inventory differs from the handoff.");
}
const cohorts = validateCaseInventory(await readFile("docs/sites-v11-overname/inventory/VISUAL-CASES.csv", "utf8"), originalCases.toString("utf8"));
const expected = new Set();
for (const record of records) {
  const name = record.path.slice("source/sites/".length);
  const path = resolve(root, name);
  if (!relative(root, path) || relative(root, path).startsWith(`..${sep}`) || path === root) throw new Error("Invalid reference path.");
  const bytes = await readFile(path);
  if (bytes.byteLength !== record.size || createHash("sha256").update(bytes).digest("hex") !== record.sha256) {
    throw new Error(`Immutable source reference differs: ${name}`);
  }
  expected.add(name);
}
async function check(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) await check(path);
    else if (!entry.isFile() || !expected.delete(relative(root, path).split(sep).join("/"))) throw new Error("Unexpected reference file.");
  }
}
await check(root);
if (expected.size) throw new Error("Source reference is incomplete.");
process.stdout.write(`Verified all 253 original Sites source files and ${cohorts.originalCases} original visual cases (${cohorts.broadcastCases} broadcast, ${cohorts.responsiveCases} responsive) against the unchanged handoff.\n`);
