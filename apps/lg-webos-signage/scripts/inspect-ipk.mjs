import { spawn } from "node:child_process";
import { access } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  expectedAppInfo,
  expectedSmoketestAppInfo
} from "./validate-app.mjs";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, "../../..");
const outputDirectory = join(repositoryRoot, "dist", "lg-webos");
const cliVersion = "3.2.5";

export const packageSpecifications = Object.freeze([
  Object.freeze({
    appInfo: expectedAppInfo,
    expectedApplicationFiles: [
      "appinfo.json",
      "bootstrap.js",
      "icon.png",
      "index.html",
      "largeIcon.png",
      "offline.html",
      "platform-adapter.js",
      "veyocast-logo-inverse.svg"
    ].sort()
  }),
  Object.freeze({
    appInfo: expectedSmoketestAppInfo,
    expectedApplicationFiles: [
      "appinfo.json",
      "icon.png",
      "index.html",
      "largeIcon.png",
      "veyocast-logo-inverse.svg"
    ].sort()
  })
]);

export function ipkFilename(appInfo) {
  return `${appInfo.id}_${appInfo.version}_all.ipk`;
}

export async function inspectIpk(
  ipkPath = join(outputDirectory, ipkFilename(expectedAppInfo)),
  specification = packageSpecifications[0]
) {
  const resolvedPath = resolve(ipkPath);
  await access(resolvedPath);

  const info = await runCommand("ares-package", ["--info", resolvedPath]);
  const detail = await runCommand("ares-package", [
    "--info-detail",
    resolvedPath
  ]);
  const combined = `${info.stdout}\n${info.stderr}\n${detail.stdout}\n${detail.stderr}`;
  const expected = specification.appInfo;

  for (const value of [
    expected.id,
    expected.version,
    expected.title,
    expected.vendor
  ]) {
    if (!combined.includes(String(value))) {
      throw new Error(`IPK-inspectie mist verwachte metadata: ${value}`);
    }
  }
  if (combined.includes("webOS-Packager-Version: x.y.x")) {
    throw new Error("IPK bevat de verboden packagerversie-placeholder x.y.x");
  }
  if (!combined.includes(`webOS-Packager-Version: ${cliVersion}`)) {
    throw new Error(
      `IPK moet webOS-Packager-Version: ${cliVersion} rapporteren`
    );
  }

  const packageEntries = await listPackageEntries(resolvedPath);
  const applicationPrefix = `usr/palm/applications/${expected.id}/`;
  const applicationFiles = packageEntries
    .filter(
      (entry) => entry.startsWith(applicationPrefix) && !entry.endsWith("/")
    )
    .map((entry) => entry.slice(applicationPrefix.length))
    .sort();
  if (
    JSON.stringify(applicationFiles) !==
    JSON.stringify(specification.expectedApplicationFiles)
  ) {
    throw new Error(
      `IPK-runtimebestanden wijken af voor ${expected.id}: ${applicationFiles.join(", ")}`
    );
  }

  const archiveMetadata = [];
  for (const member of ["control.tar.gz", "data.tar.gz"]) {
    const metadata = await listArchiveMetadata(resolvedPath, member);
    assertNormalizedMetadata(metadata, member);
    archiveMetadata.push(...metadata);
  }

  return {
    archiveMetadata,
    detail: detail.stdout.trim(),
    info: info.stdout.trim(),
    ipkPath: resolvedPath,
    packageEntries
  };
}

export async function inspectAllIpks() {
  const results = [];
  for (const specification of packageSpecifications) {
    const path = join(
      outputDirectory,
      ipkFilename(specification.appInfo)
    );
    results.push(await inspectIpk(path, specification));
  }
  return results;
}

async function listPackageEntries(ipkPath) {
  const dataArchive = await runBinaryCommand("ar", [
    "p",
    ipkPath,
    "data.tar.gz"
  ]);
  const result = await runCommandWithInput("tar", ["-tzf", "-"], dataArchive);
  return result.stdout
    .split(/\r?\n/u)
    .map((entry) => entry.replace(/^\.\//u, ""))
    .filter(Boolean);
}

async function listArchiveMetadata(ipkPath, member) {
  const archive = await runBinaryCommand("ar", ["p", ipkPath, member]);
  const result = await runCommandWithInput(
    "tar",
    ["--list", "--verbose", "--numeric-owner", "--gzip", "--file", "-"],
    archive
  );
  return result.stdout
    .split(/\r?\n/u)
    .filter(Boolean)
    .map((line) => {
      const match = line.match(
        /^([dl-][rwx-]{9})\s+([0-9]+)\/([0-9]+)\s+\d+\s+\S+\s+\S+\s+(.+)$/u
      );
      if (!match) {
        throw new Error(`Onleesbare tar-metadata in ${member}: ${line}`);
      }
      return {
        gid: Number(match[3]),
        mode: match[1],
        path: match[4],
        uid: Number(match[2])
      };
    });
}

function assertNormalizedMetadata(entries, member) {
  for (const entry of entries) {
    if (entry.uid !== 0 || entry.gid !== 0) {
      throw new Error(
        `${member}:${entry.path} gebruikt host-eigenaar ${entry.uid}/${entry.gid}`
      );
    }
    if (entry.mode.startsWith("d") && entry.mode !== "drwxr-xr-x") {
      throw new Error(
        `${member}:${entry.path} heeft directorymodus ${entry.mode}, verwacht drwxr-xr-x`
      );
    }
    if (entry.mode.startsWith("-") && entry.mode !== "-rw-r--r--") {
      throw new Error(
        `${member}:${entry.path} heeft bestandsmodus ${entry.mode}, verwacht -rw-r--r--`
      );
    }
  }
}

async function runCommand(command, argumentsValue) {
  return runCommandWithInput(command, argumentsValue, null);
}

async function runCommandWithInput(command, argumentsValue, input) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, argumentsValue, {
      env: process.env,
      shell: false
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", rejectPromise);
    child.on("close", (code) => {
      if (code !== 0) {
        rejectPromise(
          new Error(
            `${command} ${argumentsValue.join(" ")} mislukte (${code}): ${stderr || stdout}`
          )
        );
        return;
      }
      resolvePromise({ stderr, stdout });
    });
    if (input) child.stdin.end(input);
    else child.stdin.end();
  });
}

async function runBinaryCommand(command, argumentsValue) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, argumentsValue, {
      env: process.env,
      shell: false
    });
    const stdout = [];
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout.push(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", rejectPromise);
    child.on("close", (code) => {
      if (code !== 0) {
        rejectPromise(
          new Error(
            `${command} ${argumentsValue.join(" ")} mislukte (${code}): ${stderr}`
          )
        );
        return;
      }
      resolvePromise(Buffer.concat(stdout));
    });
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const results = await inspectAllIpks();
    for (const result of results) {
      process.stdout.write(`ares-package --info\n${result.info}\n\n`);
      process.stdout.write(`ares-package --info-detail\n${result.detail}\n`);
    }
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : error}\n`);
    process.exitCode = 1;
  }
}
