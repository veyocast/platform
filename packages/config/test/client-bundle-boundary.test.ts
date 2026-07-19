import { execFile } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const scanner = fileURLToPath(
  new URL("../../../scripts/assert-client-bundle-secret-free.mjs", import.meta.url)
);
const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { force: true, recursive: true })
    )
  );
});

describe("generated client bundle boundary", () => {
  it("allows SDK documentation without treating a prefix as a credential", async () => {
    const appDirectory = await createBundle(
      "Never expose your `service_role` key. New keys start with `sb_secret_…`."
    );

    await expect(runScanner(appDirectory)).resolves.toBeUndefined();
  });

  it.each([
    "SUPABASE_SERVICE_ROLE_KEY",
    `sb_secret_${"a".repeat(32)}`,
    'role:"service_role"'
  ])("rejects recognizable server credential material: %s", async (value) => {
    const appDirectory = await createBundle(value);

    await expect(runScanner(appDirectory)).rejects.toThrow();
  });

  it("rejects the configured secret without printing it", async () => {
    const secret = `sb_secret_${"do-not-log-this-value".repeat(2)}`;
    const appDirectory = await createBundle(secret);

    try {
      await runScanner(appDirectory, secret);
      expect.unreachable("scanner should reject the configured secret");
    } catch (error) {
      expect(String(error)).not.toContain(secret);
    }
  });
});

async function createBundle(contents: string) {
  const appDirectory = await mkdtemp(join(tmpdir(), "veyocast-client-bundle-"));
  temporaryDirectories.push(appDirectory);
  const chunkDirectory = join(appDirectory, ".next", "static", "chunks");
  await mkdir(chunkDirectory, { recursive: true });
  await writeFile(join(chunkDirectory, "app.js"), contents);
  return appDirectory;
}

async function runScanner(appDirectory: string, secret?: string) {
  await execFileAsync(process.execPath, [scanner, appDirectory], {
    env: {
      ...process.env,
      SUPABASE_SERVICE_ROLE_KEY: secret
    }
  });
}
