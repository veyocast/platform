import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const scanner = fileURLToPath(
  new URL("../../../scripts/assert-control-auth-boundary.mjs", import.meta.url)
);
const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { force: true, recursive: true })
    )
  );
});

describe("generated Control auth boundary", () => {
  it("accepts a build without prerendered protected routes", async () => {
    const appDirectory = await createManifest({ "/login": {} });
    await expect(runScanner(appDirectory)).resolves.toBeUndefined();
  });

  it.each(["/auth/mfa", "/context", "/dashboard", "/dashboard/team", "/platform", "/platform/tenants"])(
    "rejects protected prerender route %s",
    async (route) => {
      const appDirectory = await createManifest({ [route]: {} });
      await expect(runScanner(appDirectory)).rejects.toThrow();
    }
  );

  it("keeps tenant and platform scopes behind server-side layouts", async () => {
    const dashboardLayout = await readRepositoryFile("app/(shell)/dashboard/layout.tsx");
    const platformLayout = await readRepositoryFile("app/(shell)/platform/layout.tsx");

    expect(dashboardLayout).toContain("requireTenantControlSession");
    expect(platformLayout).toContain('requireControlCapability("platform.system.read")');
  });

  it("does not render a localhost helper on the login page", async () => {
    const loginPage = await readRepositoryFile("app/login/page.tsx");
    expect(loginPage).not.toContain("getLocalUrl");
    expect(loginPage).not.toContain("http://localhost:3000");
  });

});

async function createManifest(routes: Record<string, object>) {
  const appDirectory = await mkdtemp(join(tmpdir(), "veyocast-control-auth-"));
  temporaryDirectories.push(appDirectory);
  const nextDirectory = join(appDirectory, ".next");
  await mkdir(nextDirectory, { recursive: true });
  await writeFile(join(nextDirectory, "prerender-manifest.json"), JSON.stringify({ routes }));
  return appDirectory;
}

async function runScanner(appDirectory: string) {
  await execFileAsync(process.execPath, [scanner, appDirectory]);
}

async function readRepositoryFile(path: string) {
  return readFile(fileURLToPath(new URL(`../${path}`, import.meta.url)), "utf8");
}
