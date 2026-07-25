import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { readFile, rm, stat, writeFile, mkdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { inspectIpk } from "./inspect-ipk.mjs";
import { expectedAppInfo, validateApp } from "./validate-app.mjs";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(scriptDirectory, "..");
const repositoryRoot = resolve(scriptDirectory, "../../..");
const outputDirectory = join(repositoryRoot, "dist", "lg-webos");
const ipkFilename = `${expectedAppInfo.id}_${expectedAppInfo.version}_all.ipk`;
const ipkPath = join(outputDirectory, ipkFilename);

export async function buildIpk() {
  await validateApp(appRoot);
  await rm(outputDirectory, { force: true, recursive: true });
  await mkdir(outputDirectory, { recursive: true });

  await runCommand("ares-config", ["--profile", "signage"]);
  await runCommand("ares-package", [
    "-o",
    outputDirectory,
    appRoot
  ]);

  const inspection = await inspectIpk(ipkPath);
  const bytes = await readFile(ipkPath);
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const details = await stat(ipkPath);
  const buildCommitSha = (
    await runCommand("git", ["rev-parse", "HEAD"], repositoryRoot)
  ).stdout.trim();
  const buildTimestamp = new Date().toISOString();
  const downloadUrl = resolveDownloadUrl(ipkFilename);

  const latest = {
    appId: expectedAppInfo.id,
    buildCommitSha,
    buildTimestamp,
    byteSize: details.size,
    downloadUrl,
    ipkFilename,
    minimumValidatedWebOsSignageVersion: null,
    sha256,
    supportedModels: [],
    version: expectedAppInfo.version
  };
  const releaseNotes = {
    appId: expectedAppInfo.id,
    buildCommitSha,
    buildTimestamp,
    hardwareValidationStatus: "NEEDS_PHYSICAL_LG_TEST",
    notes: [
      "Eerste VeyoCast LG webOS Signage thin-wrapperrelease.",
      "Laadt uitsluitend https://player.veyocast.nl/lg.",
      "Pairing, offline media, releases, playback en telemetry blijven in de hosted Player.",
      "SCAP en IDCAP worden niet aangeroepen zonder officiële modeldocumentatie en fysieke validatie."
    ],
    version: expectedAppInfo.version
  };

  await writeFile(
    join(outputDirectory, "checksums.sha256"),
    `${sha256}  ${ipkFilename}\n`,
    "utf8"
  );
  await writeJson(join(outputDirectory, "latest.json"), latest);
  await writeJson(join(outputDirectory, "release-notes.json"), releaseNotes);

  return {
    inspection,
    ipkPath,
    latest
  };
}

function resolveDownloadUrl(filename) {
  const configured = process.env.LG_WEBOS_DISTRIBUTION_BASE_URL?.trim();
  if (!configured) return null;
  const url = new URL(configured.endsWith("/") ? configured : `${configured}/`);
  if (url.protocol !== "https:") {
    throw new Error("LG_WEBOS_DISTRIBUTION_BASE_URL moet HTTPS gebruiken");
  }
  return new URL(filename, url).toString();
}

async function writeJson(path, value) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function runCommand(command, argumentsValue, cwd = repositoryRoot) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, argumentsValue, {
      cwd,
      env: process.env,
      shell: false
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
      process.stdout.write(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
      process.stderr.write(chunk);
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

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = await buildIpk();
    process.stdout.write(
      `LG webOS Signage IPK gebouwd: ${result.ipkPath}\nSHA-256: ${result.latest.sha256}\n`
    );
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : error}\n`);
    process.exitCode = 1;
  }
}
