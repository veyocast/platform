import { readFile, readdir } from "node:fs/promises";
import { dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { explicitServerImports, findReachableServerFile, moduleReferences, resolveLocalSourceFile } from "./package-boundary-scanner";

const repositoryRoot = fileURLToPath(new URL("../../../", import.meta.url));

// This suite reads other workspaces; its package-local Turbo input hash cannot
// represent those inputs. @veyocast/testkit#test is therefore uncached in turbo.json.

const packageRules = {
  auth: new Set(["@veyocast/domain"]),
  contracts: new Set(["zod"]),
  domain: new Set(["@veyocast/contracts"]),
  studio: new Set(["@veyocast/contracts", "zod"])
} as const;

const forbiddenRuntimeImports = ["next", "react", "@supabase/"] as const;

describe("application package boundaries", () => {
  for (const [packageName, allowedImports] of Object.entries(packageRules)) {
    it(`keeps @veyocast/${packageName} framework-independent`, async () => {
      const packageRoot = join(repositoryRoot, "packages", packageName);
      const sourceFiles = await sourceFilesBelow(join(packageRoot, "src"));
      const violations: string[] = [];

      for (const file of sourceFiles) {
        const source = await readFile(file, "utf8");
        const fileLabel = relative(repositoryRoot, file);

        if (source.includes("process.env")) {
          violations.push(`${fileLabel}: environment access is not allowed`);
        }

        if (source.includes('"use client"') || source.includes("'use client'")) {
          violations.push(`${fileLabel}: framework directives are not allowed`);
        }

        for (const specifier of moduleReferences(source).imports) {
          if (specifier.startsWith(".")) continue;

          if (forbiddenRuntimeImports.some((prefix) => specifier.startsWith(prefix))) {
            violations.push(`${fileLabel}: forbidden runtime import ${specifier}`);
            continue;
          }

          if (![...allowedImports].some((allowed) =>
            specifier === allowed || specifier.startsWith(`${allowed}/`)
          )) {
            violations.push(`${fileLabel}: undeclared dependency ${specifier}`);
          }
        }
      }

      const manifest = JSON.parse(
        await readFile(join(packageRoot, "package.json"), "utf8")
      ) as { dependencies?: Record<string, string> };
      const declaredDependencies = Object.keys(manifest.dependencies ?? {}).sort();
      const allowedDependencies = [...allowedImports].sort();

      expect(violations).toEqual([]);
      expect(declaredDependencies).toEqual(allowedDependencies);
    });
  }

  it("prevents client modules from importing explicit server entries", async () => {
    const roots = [join(repositoryRoot, "apps"), join(repositoryRoot, "packages")];
    const allSourceFiles = (await Promise.all(roots.map(sourceFilesBelow))).flat();
    const knownSourceFiles = new Set(allSourceFiles);
    const references = new Map(
      await Promise.all(
        allSourceFiles.map(async (file) => [file, moduleReferences(await readFile(file, "utf8"))] as const)
      )
    );
    const serverOnlyFiles = new Set(
      allSourceFiles.filter((file) =>
        references.get(file)?.runtimeImports.includes("server-only")
      )
    );
    const serverActionFiles = new Set(
      allSourceFiles.filter((file) =>
        references.get(file)?.directives.has("use server")
      )
    );
    const localImports = new Map(
      allSourceFiles.map((file) => [
        file,
        (references.get(file)?.runtimeImports ?? [])
          .map((specifier) => resolveLocalSourceFile(file, specifier, knownSourceFiles))
          .filter((target): target is string => target !== null)
      ])
    );
    const violations: string[] = [];

    for (const file of allSourceFiles) {
      const module = references.get(file);
      if (!module?.directives.has("use client")) {
        continue;
      }

      for (const specifier of explicitServerImports(module)) {
        violations.push(`${relative(repositoryRoot, file)} -> ${specifier}`);
      }

      const reachableServerFile = findReachableServerFile(
        file,
        localImports,
        serverOnlyFiles,
        serverActionFiles
      );
      if (reachableServerFile) {
        violations.push(
          `${relative(repositoryRoot, file)} -> ${relative(repositoryRoot, reachableServerFile)}`
        );
      }
    }

    expect(violations).toEqual([]);
  });

  it("prevents applications from importing each other", async () => {
    const appsRoot = join(repositoryRoot, "apps");
    const appDirectories = (await readdir(appsRoot, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
    const appEntries = (
      await Promise.all(
        appDirectories.map(async (app) => {
          try {
            await readFile(join(appsRoot, app, "package.json"), "utf8");
            return app;
          } catch (error) {
            if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
            throw error;
          }
        })
      )
    ).filter((app): app is string => app !== null);
    const appPackageNames = new Set(appEntries.map((app) => `@veyocast/${app}`));
    const violations: string[] = [];

    for (const app of appEntries) {
      const appRoot = join(appsRoot, app);
      const manifest = JSON.parse(await readFile(join(appRoot, "package.json"), "utf8")) as {
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
      };
      const dependencies = {
        ...manifest.dependencies,
        ...manifest.devDependencies
      };

      for (const dependency of Object.keys(dependencies)) {
        if (appPackageNames.has(dependency) && dependency !== `@veyocast/${app}`) {
          violations.push(`${app}/package.json -> ${dependency}`);
        }
      }

      for (const file of await sourceFilesBelow(appRoot)) {
        for (const specifier of moduleReferences(await readFile(file, "utf8")).imports) {
          const importedApp = appEntries.find((candidate) =>
            specifier === `@veyocast/${candidate}` ||
            specifier.startsWith(`@veyocast/${candidate}/`)
          );
          if (importedApp && importedApp !== app) {
            violations.push(`${relative(repositoryRoot, file)} -> ${specifier}`);
          }

          if (specifier.startsWith(".")) {
            const targetFromApps = relative(appsRoot, resolve(dirname(file), specifier));
            const targetApp = targetFromApps.split("/")[0];
            if (!targetFromApps.startsWith("..") && targetApp && targetApp !== app) {
              violations.push(`${relative(repositoryRoot, file)} -> ${specifier}`);
            }
          }
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it("keeps the Studio canvas runtime route-local and outside Player", async () => {
    const controlRoot = join(repositoryRoot, "apps", "control");
    const playerRoot = join(repositoryRoot, "apps", "player");
    const violations: string[] = [];

    for (const file of await sourceFilesBelow(controlRoot)) {
      for (const specifier of moduleReferences(await readFile(file, "utf8")).imports) {
        if (
          (specifier === "konva" || specifier === "react-konva") &&
          !relative(controlRoot, file).startsWith(
            join("app", "(shell)", "dashboard", "studio")
          )
        ) {
          violations.push(`${relative(repositoryRoot, file)} -> ${specifier}`);
        }
      }
    }

    for (const file of await sourceFilesBelow(playerRoot)) {
      for (const specifier of moduleReferences(await readFile(file, "utf8")).imports) {
        if (specifier === "@veyocast/studio" || specifier.startsWith("@veyocast/studio/")) {
          violations.push(`${relative(repositoryRoot, file)} -> ${specifier}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });
});

async function sourceFilesBelow(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    if ([".next", ".turbo", "dist", "node_modules"].includes(entry.name)) continue;
    const path = join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...await sourceFilesBelow(path));
    } else if ([".ts", ".tsx", ".mts", ".mjs"].includes(extname(entry.name))) {
      files.push(path);
    }
  }

  return files;
}
