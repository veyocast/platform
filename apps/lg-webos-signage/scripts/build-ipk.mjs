import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import {
  mkdir,
  readFile,
  rm,
  stat,
  writeFile
} from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  inspectIpk,
  ipkFilename,
  releaseCandidateSpecifications
} from "./inspect-ipk.mjs";
import { validateApp, validateSmoketest } from "./validate-app.mjs";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(scriptDirectory, "..");
const repositoryRoot = resolve(scriptDirectory, "../../..");
const outputDirectory = join(repositoryRoot, "dist", "lg-webos");
const publicationDirectory = join(
  repositoryRoot,
  "apps",
  "marketing",
  "public",
  "ipk"
);
const canonicalDistributionBaseUrl = "https://veyocast.nl/ipk/";

export async function buildIpks() {
  await validateApp(appRoot);
  await validateSmoketest(join(appRoot, "smoketest"));
  await rm(outputDirectory, { force: true, recursive: true });
  await mkdir(outputDirectory, { recursive: true });

  const buildCommitSha = (
    await runCommand("git", ["rev-parse", "HEAD"], repositoryRoot)
  ).stdout.trim();
  await runCommand("ares-config", ["--profile", "signage"]);

  const releases = [];
  for (const specification of releaseCandidateSpecifications) {
    const sourceRoot = join(appRoot, "smoketest");
    await runCommand(
      "ares-package",
      ["-o", outputDirectory, sourceRoot],
      repositoryRoot
    );
    const filename = ipkFilename(specification.appInfo);
    const path = join(outputDirectory, filename);
    const inspection = await inspectIpk(path, specification);
    const bytes = await readFile(path);
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    const details = await stat(path);
    releases.push({
      appId: specification.appInfo.id,
      byteSize: details.size,
      downloadUrl: resolveDownloadUrl(filename),
      filename,
      inspection,
      path,
      sha256,
      title: specification.appInfo.title,
      version: specification.appInfo.version
    });
  }

  const smoketest = releases[0];
  if (!smoketest) {
    throw new Error("De 1.0.2-smoketest-IPK is niet gebouwd");
  }

  const previousLatest = JSON.parse(
    await readFile(join(publicationDirectory, "latest.json"), "utf8")
  );
  const previousReleaseNotes = JSON.parse(
    await readFile(join(publicationDirectory, "release-notes.json"), "utf8")
  );
  const buildTimestamp = new Date().toISOString();
  const latest = {
    ...previousLatest,
    buildCommitSha,
    buildTimestamp,
    smoketest: {
      appId: smoketest.appId,
      byteSize: smoketest.byteSize,
      downloadUrl: smoketest.downloadUrl,
      ipkFilename: smoketest.filename,
      sha256: smoketest.sha256,
      version: smoketest.version
    }
  };
  const releaseNotes = {
    ...previousReleaseNotes,
    buildCommitSha,
    buildTimestamp,
    hardwareValidationStatus: "NEEDS_PHYSICAL_LG_TEST",
    notes: [
      "Productie-wrapper 1.0.1 blijft bevroren en wordt in deze herstelrun niet opnieuw gebouwd of overschreven.",
      "Smoketest 1.0.2 bevat uitsluitend lokale HTML, CSS, JavaScript en locked VeyoCast-assets.",
      "Smoketest 1.0.2 is gebouwd met de ongewijzigde officiële @webos-tools/cli 3.2.5 en het signage-profiel.",
      "De pakket-envelope volgt de structuur van de fysiek door LG geaccepteerde 1.0.0.",
      "De publieke URL moet bytegelijk zijn aan het bewaarde CI-artifact.",
      "Fysieke installatie op LG 43UL3J-EP, webOS Signage 6.0, firmware 03.24.90 blijft verplicht."
    ],
    smoketest: publicReleaseDescriptor(smoketest)
  };
  await writeFile(
    join(outputDirectory, "checksums.sha256"),
    `${smoketest.sha256}  ${smoketest.filename}\n`,
    "utf8"
  );
  await writeJson(join(outputDirectory, "latest.json"), latest);
  await writeJson(join(outputDirectory, "release-notes.json"), releaseNotes);

  return { latest, releases };
}

function publicReleaseDescriptor(release) {
  return {
    appId: release.appId,
    byteSize: release.byteSize,
    downloadUrl: release.downloadUrl,
    ipkFilename: release.filename,
    sha256: release.sha256,
    title: release.title,
    version: release.version
  };
}

function resolveDownloadUrl(filename) {
  const configured =
    process.env.LG_WEBOS_DISTRIBUTION_BASE_URL?.trim() ||
    canonicalDistributionBaseUrl;
  const url = new URL(configured.endsWith("/") ? configured : `${configured}/`);
  if (url.protocol !== "https:") {
    throw new Error("LG_WEBOS_DISTRIBUTION_BASE_URL moet HTTPS gebruiken");
  }
  return new URL(filename, url).toString();
}

async function writeJson(path, value) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function runCommand(
  command,
  argumentsValue,
  cwd = repositoryRoot
) {
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
    const result = await buildIpks();
    for (const release of result.releases) {
      process.stdout.write(
        `LG webOS IPK gebouwd: ${release.path}\nSHA-256: ${release.sha256}\n`
      );
    }
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : error}\n`);
    process.exitCode = 1;
  }
}
