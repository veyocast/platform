import { readdir, readFile } from "node:fs/promises";
import { dirname, extname, join, relative, resolve, sep } from "node:path";
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
  /service[-_]role/i,
  /service_role_key/i
];
const allowedServerOnlyFiles = new Set([
  "apps/media-worker/src/dynamic-render-backend.ts",
  "apps/media-worker/src/index.ts",
  "apps/media-worker/src/rss-sync-runner.ts",
  "apps/media-worker/src/studio-render-backend.ts",
  "apps/media-worker/src/worker-backend.ts",
  "apps/media-worker/src/worker-config.ts",
  "packages/config/src/server.ts"
]);
const protectedNextModules = new Set([
  "apps/control/lib/control-overview.ts",
  "apps/control/lib/control-session.ts",
  "apps/control/lib/runtime-health.ts",
  "apps/control/lib/supabase/admin.ts",
  "apps/player/app/_lib/player-supabase.ts",
  "apps/player/app/_lib/runtime-health.ts",
  "packages/config/src/server.ts"
]);
const packageImports = new Map([
  ["@veyocast/config/server", "packages/config/src/server.ts"]
]);

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
      const isAllowedServerOnly = allowedServerOnlyFiles.has(normalizedPath);
      if (usesServerServiceRole && !isAllowedServerOnly) {
        violations.push(normalizedPath);
      }
    }

    expect(violations).toEqual([]);
  });

  it("marks every sensitive Next module as server-only", async () => {
    const violations: string[] = [];

    for (const modulePath of protectedNextModules) {
      const source = await readFile(join(repoRoot, modulePath), "utf8");
      if (!/^import ["']server-only["'];/u.test(source)) {
        violations.push(modulePath);
      }
    }

    expect(violations).toEqual([]);
  });

  it("keeps sensitive Next modules outside every client import graph", async () => {
    const files = await collectRuntimeSourceFiles();
    const sources = new Map<string, string>();

    for (const file of files) {
      sources.set(normalizePath(file), await readFile(file, "utf8"));
    }

    const violations = new Set<string>();
    for (const [file, source] of sources) {
      if (!/^\s*["']use client["'];/u.test(source)) continue;
      walkImports(file, file, sources, new Set(), violations);
    }

    expect([...violations].sort()).toEqual([]);
  });
});

function walkImports(
  clientEntry: string,
  currentFile: string,
  sources: Map<string, string>,
  visited: Set<string>,
  violations: Set<string>
) {
  if (visited.has(currentFile)) return;
  visited.add(currentFile);

  const source = sources.get(currentFile);
  if (!source) return;
  if (currentFile !== clientEntry && /^\s*["']use server["'];/u.test(source)) {
    return;
  }

  for (const specifier of readImportSpecifiers(source)) {
    const importedFile = resolveImport(currentFile, specifier, sources);
    if (!importedFile) continue;

    if (protectedNextModules.has(importedFile)) {
      violations.add(`${clientEntry} -> ${importedFile}`);
      continue;
    }

    walkImports(clientEntry, importedFile, sources, visited, violations);
  }
}

function readImportSpecifiers(source: string) {
  const specifiers: string[] = [];
  const pattern = /(?:import|export)\s+(?:[^"']*?\s+from\s+)?["']([^"']+)["']/gu;

  for (const match of source.matchAll(pattern)) {
    if (match[1]) specifiers.push(match[1]);
  }

  return specifiers;
}

function resolveImport(
  importer: string,
  specifier: string,
  sources: Map<string, string>
) {
  const packageImport = packageImports.get(specifier);
  if (packageImport) return packageImport;
  if (!specifier.startsWith(".")) return null;

  const candidate = relative(
    repoRoot,
    resolve(repoRoot, dirname(importer), specifier)
  ).split(sep).join("/");
  const candidates = [
    candidate,
    `${candidate}.ts`,
    `${candidate}.tsx`,
    `${candidate}.js`,
    `${candidate}.jsx`,
    `${candidate}/index.ts`,
    `${candidate}/index.tsx`
  ];

  return candidates.find((path) => sources.has(path)) ?? null;
}

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

function normalizePath(file: string) {
  return relative(repoRoot, file).split(sep).join("/");
}
