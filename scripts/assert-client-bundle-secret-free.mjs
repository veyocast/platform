import { readdir, readFile, stat } from "node:fs/promises";
import { extname, resolve } from "node:path";

const appDirectory = resolve(process.argv[2] ?? ".");
const outputDirectories = await findOutputDirectories(appDirectory);
const configuredSecret = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const forbiddenPatterns = [
  /SUPABASE_SERVICE_ROLE_KEY/,
  /NEXT_PUBLIC_[A-Z0-9_]*(?:SECRET|SERVICE[A-Z0-9_]*ROLE)[A-Z0-9_]*/,
  /sb_secret_[A-Za-z0-9_-]{16,}/,
  /role["']?\s*:\s*["']service_role["']/
];

if (outputDirectories.length === 0) {
  console.error(
    `Geen clientbundle gevonden in ${appDirectory} (.next/static of dist).`
  );
  process.exit(1);
}

const files = (
  await Promise.all(outputDirectories.map((directory) => collectFiles(directory)))
).flat();
const containsHermesBundle = files.some((file) => extname(file) === ".hbc");
const containsSourceMap = files.some((file) => extname(file) === ".map");
const violations = [];

if (containsHermesBundle && !containsSourceMap) {
  console.error(
    "Hermes-clientbundle mist een source map; een betrouwbare secretscan is niet mogelijk."
  );
  process.exit(1);
}

for (const file of files) {
  const contents = await readFile(file);
  const containsConfiguredSecret = Boolean(
    configuredSecret &&
      configuredSecret.length >= 16 &&
      contents.includes(Buffer.from(configuredSecret))
  );
  const containsForbiddenPattern =
    isInspectableTextFile(file) &&
    forbiddenPatterns.some((pattern) => pattern.test(contents.toString("utf8")));

  if (containsConfiguredSecret || containsForbiddenPattern) {
    violations.push(file.slice(appDirectory.length + 1));
  }
}

if (violations.length > 0) {
  console.error(
    `Clientbundle bevat gevoelige serverconfiguratie (${violations.join(", ")}).`
  );
  process.exitCode = 1;
}

async function findOutputDirectories(directory) {
  const candidates = [resolve(directory, ".next/static"), resolve(directory, "dist")];
  const output = [];

  for (const candidate of candidates) {
    try {
      if ((await stat(candidate)).isDirectory()) output.push(candidate);
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }

  return output;
}

async function collectFiles(directory) {
  const files = [];
  const entries = await readdir(directory, { withFileTypes: true });

  for (const entry of entries) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(path)));
    } else if (entry.isFile()) {
      files.push(path);
    }
  }

  return files;
}

function isInspectableTextFile(file) {
  return new Set([
    ".cjs",
    ".css",
    ".html",
    ".js",
    ".json",
    ".map",
    ".mjs",
    ".txt"
  ]).has(extname(file));
}
