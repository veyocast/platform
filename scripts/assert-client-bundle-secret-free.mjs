import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const appDirectory = resolve(process.argv[2] ?? ".");
const staticDirectory = resolve(appDirectory, ".next/static");
const configuredSecret = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const forbiddenPatterns = [
  /SUPABASE_SERVICE_ROLE_KEY/,
  /NEXT_PUBLIC_[A-Z0-9_]*(?:SECRET|SERVICE[A-Z0-9_]*ROLE)[A-Z0-9_]*/,
  /sb_secret_[A-Za-z0-9_-]{16,}/,
  /role["']?\s*:\s*["']service_role["']/
];

const files = await collectFiles(staticDirectory);
const violations = [];

for (const file of files) {
  const contents = await readFile(file, "utf8");
  const containsConfiguredSecret = Boolean(
    configuredSecret &&
      configuredSecret.length >= 16 &&
      contents.includes(configuredSecret)
  );

  if (
    containsConfiguredSecret ||
    forbiddenPatterns.some((pattern) => pattern.test(contents))
  ) {
    violations.push(file.slice(staticDirectory.length + 1));
  }
}

if (violations.length > 0) {
  console.error(
    `Clientbundle bevat gevoelige serverconfiguratie (${violations.join(", ")}).`
  );
  process.exitCode = 1;
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
