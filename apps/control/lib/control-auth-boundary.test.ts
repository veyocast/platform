import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import * as React from "react";
import type * as ReactDOM from "react-dom";
import { renderToStaticMarkup } from "react-dom/server";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LoginSubmit } from "../app/login/login-submit";
import ControlError from "../app/error";

const formState = vi.hoisted(() => ({ pending: false }));
vi.mock("react-dom", async (importOriginal) => ({
  ...await importOriginal<typeof ReactDOM>(),
  useFormStatus: () => ({ pending: formState.pending })
}));

const execFileAsync = promisify(execFile);
const scanner = fileURLToPath(
  new URL("../../../scripts/assert-control-auth-boundary.mjs", import.meta.url)
);
const temporaryDirectories: string[] = [];

beforeEach(() => vi.stubGlobal("React", React));

afterEach(async () => {
  formState.pending = false;
  vi.unstubAllGlobals();
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

  it("disables the actual login submit during pending and exposes an accessible status", () => {
    const idle = renderToStaticMarkup(React.createElement(LoginSubmit));
    expect(idle).toContain("Doorgaan");
    expect(idle).not.toContain('disabled=""');
    formState.pending = true;
    const pending = renderToStaticMarkup(React.createElement(LoginSubmit));
    expect(pending).toContain('disabled=""');
    expect(pending).toContain('aria-busy="true"');
    expect(pending).toContain('role="status"');
    expect(pending).toContain("Aanmelden");
  });

  it("renders a safe manual recovery boundary without displaying the caught error", () => {
    const html = renderToStaticMarkup(React.createElement(ControlError, {
      error: new Error("PRIVATE_BACKEND_TOKEN"), reset: () => undefined
    }));
    expect(html).toContain("Je toegang kon niet worden gecontroleerd");
    expect(html).toContain("Opnieuw proberen");
    expect(html).not.toContain("PRIVATE_BACKEND_TOKEN");
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
