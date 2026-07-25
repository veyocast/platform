import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  inspectIpk,
  ipkFilename,
  packageSpecifications
} from "./inspect-ipk.mjs";

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
const releaseFiles = packageSpecifications.map((specification) =>
  ipkFilename(specification.appInfo)
);
const publicationFiles = [
  ...releaseFiles,
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
  `LG webOS Signage-releases gepubliceerd naar ${publicationDirectory}\n` +
    releaseFiles
      .map((filename) => `URL: https://veyocast.nl/ipk/${filename}`)
      .join("\n") +
    "\n"
);

async function validateSourceRelease() {
  const latest = JSON.parse(
    await readFile(join(sourceDirectory, "latest.json"), "utf8")
  );
  const descriptors = [
    {
      downloadUrl: latest.downloadUrl,
      filename: latest.ipkFilename,
      sha256: latest.sha256
    },
    {
      downloadUrl: latest.smoketest?.downloadUrl,
      filename: latest.smoketest?.ipkFilename,
      sha256: latest.smoketest?.sha256
    }
  ];

  for (let index = 0; index < packageSpecifications.length; index += 1) {
    const specification = packageSpecifications[index];
    const expectedFilename = ipkFilename(specification.appInfo);
    const expectedDownloadUrl = `https://veyocast.nl/ipk/${expectedFilename}`;
    const descriptor = descriptors[index];
    if (
      descriptor.filename !== expectedFilename ||
      descriptor.downloadUrl !== expectedDownloadUrl
    ) {
      throw new Error(`latest.json verwijst niet correct naar ${expectedFilename}`);
    }
    const path = join(sourceDirectory, expectedFilename);
    const digest = await sha256(path);
    if (descriptor.sha256 !== digest) {
      throw new Error(`latest.json SHA-256 wijkt af voor ${expectedFilename}`);
    }
    await inspectIpk(path, specification);
  }

  const checksum = await readFile(
    join(sourceDirectory, "checksums.sha256"),
    "utf8"
  );
  for (const filename of releaseFiles) {
    const digest = await sha256(join(sourceDirectory, filename));
    if (!checksum.includes(`${digest}  ${filename}\n`)) {
      throw new Error(`checksums.sha256 mist ${filename}`);
    }
  }
}

async function validatePublishedRelease() {
  for (let index = 0; index < packageSpecifications.length; index += 1) {
    const specification = packageSpecifications[index];
    const filename = ipkFilename(specification.appInfo);
    const sourceDigest = await sha256(join(sourceDirectory, filename));
    const publishedDigest = await sha256(join(publicationDirectory, filename));
    if (sourceDigest !== publishedDigest) {
      throw new Error(`${filename} is niet bytegelijk gepubliceerd`);
    }
    await inspectIpk(join(publicationDirectory, filename), specification);
  }
}

async function sha256(path) {
  return createHash("sha256")
    .update(await readFile(path))
    .digest("hex");
}
