import { readdir, readFile } from "node:fs/promises";
import { extname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));
const runtimeRoots = ["apps", "packages"];
const sourceExtensions = new Set([".cjs", ".js", ".jsx", ".mjs", ".ts", ".tsx"]);
const ignoredDirectoryNames = new Set([
  ".next",
  ".turbo",
  "coverage",
  "dist",
  "node_modules",
  "out",
  "test"
]);
const publicServiceRolePatterns = [
  /NEXT_PUBLIC_[A-Z0-9_]*SERVICE[A-Z0-9_]*ROLE[A-Z0-9_]*/
];
const serverServiceRolePatterns = [
  /SUPABASE_SERVICE_ROLE_KEY/,
  /serviceRoleKey/,
  /service_role_key/i
];
const allowedServerOnlyFiles = new Set([
  "apps/control/lib/supabase/admin.ts",
  "apps/player/app/_lib/player-supabase.ts"
]);
const allowedServerOnlyPrefixes = ["apps/media-worker/src/"];

describe("service-role boundary", () => {
  it("keeps service-role secrets out of app and package runtime source", async () => {
    const files = await collectRuntimeSourceFiles();
    const violations: string[] = [];

    for (const file of files) {
      const source = await readFile(file, "utf8");
      const normalizedPath = relative(repoRoot, file).split(sep).join("/");

      if (publicServiceRolePatterns.some((pattern) => pattern.test(source))) {
        violations.push(normalizedPath);
        continue;
      }

      const usesServerServiceRole = serverServiceRolePatterns.some((pattern) => pattern.test(source));
      const isAllowedServerOnly = allowedServerOnlyFiles.has(normalizedPath)
        || allowedServerOnlyPrefixes.some((prefix) => normalizedPath.startsWith(prefix));
      if (usesServerServiceRole && !isAllowedServerOnly) {
        violations.push(normalizedPath);
      }
    }

    expect(violations).toEqual([]);
  });
});

async function collectRuntimeSourceFiles() {
  const files: string[] = [];

  for (const root of runtimeRoots) {
    await collectFiles(join(repoRoot, root), files);
  }

  return files.filter((file) => {
    const normalized = relative(repoRoot, file).split(sep);

    return (
      sourceExtensions.has(extname(file))
      && !normalized.some((segment) => ignoredDirectoryNames.has(segment))
      && !file.includes(".test.")
      && !file.includes(".spec.")
    );
  });
}

async function collectFiles(directory: string, files: string[]) {
  const entries = await readdir(directory, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(directory, entry.name);

    if (entry.isDirectory()) {
      if (!ignoredDirectoryNames.has(entry.name)) {
        await collectFiles(fullPath, files);
      }

      continue;
    }

    if (entry.isFile()) {
      files.push(fullPath);
    }
  }
}
