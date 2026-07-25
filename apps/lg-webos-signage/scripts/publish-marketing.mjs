import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { inspectIpk } from "./inspect-ipk.mjs";
import { expectedAppInfo } from "./validate-app.mjs";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, "../../..");
const sourceDirectory = join(repositoryRoot, "dist", "lg-webos");
const publicationDirectory = join(
  repositoryRoot,
  "apps",
  "marketing",
  "public",
  "ipk"
);
const ipkFilename = `${expectedAppInfo.id}_${expectedAppInfo.version}_all.ipk`;
const expectedDownloadUrl = `https://veyocast.nl/ipk/${ipkFilename}`;
const publicationFiles = [
  ipkFilename,
  "checksums.sha256",
  "latest.json",
  "release-notes.json"
];

await validateSourceRelease();
await mkdir(publicationDirectory, { recursive: true });
for (const filename of publicationFiles) {
  await copyFile(
    join(sourceDirectory, filename),
    join(publicationDirectory, filename)
  );
}
await validatePublishedRelease();

process.stdout.write(
  `LG webOS Signage-release gepubliceerd naar ${publicationDirectory}\n` +
    `Productie-URL: ${expectedDownloadUrl}\n`
);

async function validateSourceRelease() {
  const latest = JSON.parse(
    await readFile(join(sourceDirectory, "latest.json"), "utf8")
  );
  if (latest.downloadUrl !== expectedDownloadUrl) {
    throw new Error(
      `latest.json.downloadUrl moet exact ${expectedDownloadUrl} zijn`
    );
  }
  if (latest.ipkFilename !== ipkFilename) {
    throw new Error("latest.json verwijst niet naar de verwachte IPK");
  }

  const ipkPath = join(sourceDirectory, ipkFilename);
  const digest = await sha256(ipkPath);
  if (latest.sha256 !== digest) {
    throw new Error("latest.json SHA-256 wijkt af van de gebouwde IPK");
  }
  const checksum = await readFile(
    join(sourceDirectory, "checksums.sha256"),
    "utf8"
  );
  if (checksum !== `${digest}  ${ipkFilename}\n`) {
    throw new Error("checksums.sha256 wijkt af van de gebouwde IPK");
  }
  await inspectIpk(ipkPath);
}

async function validatePublishedRelease() {
  const sourceDigest = await sha256(join(sourceDirectory, ipkFilename));
  const publishedDigest = await sha256(
    join(publicationDirectory, ipkFilename)
  );
  if (sourceDigest !== publishedDigest) {
    throw new Error("De gepubliceerde IPK is niet bytegelijk aan de build");
  }
  await inspectIpk(join(publicationDirectory, ipkFilename));
}

async function sha256(path) {
  return createHash("sha256")
    .update(await readFile(path))
    .digest("hex");
}
