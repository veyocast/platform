import { spawn } from "node:child_process";
import { access } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { expectedAppInfo } from "./validate-app.mjs";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, "../../..");
const defaultIpkPath = join(
  repositoryRoot,
  "dist",
  "lg-webos",
  `${expectedAppInfo.id}_${expectedAppInfo.version}_all.ipk`
);

export async function inspectIpk(ipkPath = defaultIpkPath) {
  const resolvedPath = resolve(ipkPath);
  await access(resolvedPath);

  const info = await runCommand("ares-package", ["--info", resolvedPath]);
  const detail = await runCommand("ares-package", [
    "--info-detail",
    resolvedPath
  ]);
  const combined = `${info.stdout}\n${info.stderr}\n${detail.stdout}\n${detail.stderr}`;

  const requiredValues = [
    expectedAppInfo.id,
    expectedAppInfo.version,
    expectedAppInfo.title,
    expectedAppInfo.vendor
  ];
  const missingValues = requiredValues.filter(
    (value) => !combined.includes(String(value))
  );
  if (missingValues.length > 0) {
    throw new Error(
      `IPK-inspectie bevat niet alle verwachte metadata: ${missingValues.join(", ")}`
    );
  }

  const packageEntries = await listPackageEntries(resolvedPath);
  const applicationPrefix = `usr/palm/applications/${expectedAppInfo.id}/`;
  const applicationFiles = packageEntries
    .filter(
      (entry) =>
        entry.startsWith(applicationPrefix) &&
        !entry.endsWith("/")
    )
    .map((entry) => entry.slice(applicationPrefix.length))
    .sort();
  const expectedApplicationFiles = [
    "appinfo.json",
    "bootstrap.js",
    "icon.png",
    "index.html",
    "largeIcon.png",
    "offline.html",
    "platform-adapter.js",
    "veyocast-logo-inverse.svg"
  ].sort();
  if (
    JSON.stringify(applicationFiles) !==
    JSON.stringify(expectedApplicationFiles)
  ) {
    throw new Error(
      `IPK-runtimebestanden wijken af: ${applicationFiles.join(", ")}`
    );
  }

  return {
    detail: detail.stdout.trim(),
    info: info.stdout.trim(),
    ipkPath: resolvedPath,
    packageEntries
  };
}

async function listPackageEntries(ipkPath) {
  const dataArchive = await runBinaryCommand("ar", [
    "p",
    ipkPath,
    "data.tar.gz"
  ]);
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn("tar", ["-tzf", "-"], {
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
          new Error(`tar kon IPK-inhoud niet lezen (${code}): ${stderr}`)
        );
        return;
      }
      resolvePromise(
        stdout
          .split(/\r?\n/u)
          .map((entry) => entry.replace(/^\.\//u, ""))
          .filter(Boolean)
      );
    });
    child.stdin.end(dataArchive);
  });
}

async function runCommand(command, argumentsValue) {
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
    const result = await inspectIpk(process.argv[2] ?? defaultIpkPath);
    process.stdout.write(`ares-package --info\n${result.info}\n\n`);
    process.stdout.write(`ares-package --info-detail\n${result.detail}\n`);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : error}\n`);
    process.exitCode = 1;
  }
}
