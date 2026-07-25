import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  inspectIpk,
  ipkFilename,
  packageSpecifications
} from "./inspect-ipk.mjs";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, "../../..");
const publicationDirectory = join(
  repositoryRoot,
  "apps",
  "marketing",
  "public",
  "ipk"
);
const latest = JSON.parse(
  await readFile(join(publicationDirectory, "latest.json"), "utf8")
);
const checksum = await readFile(
  join(publicationDirectory, "checksums.sha256"),
  "utf8"
);
const descriptors = [
  {
    appId: latest.appId,
    downloadUrl: latest.downloadUrl,
    filename: latest.ipkFilename,
    sha256: latest.sha256,
    version: latest.version
  },
  {
    appId: latest.smoketest?.appId,
    downloadUrl: latest.smoketest?.downloadUrl,
    filename: latest.smoketest?.ipkFilename,
    sha256: latest.smoketest?.sha256,
    version: latest.smoketest?.version
  }
];

for (let index = 0; index < packageSpecifications.length; index += 1) {
  const specification = packageSpecifications[index];
  const expected = specification.appInfo;
  const filename = ipkFilename(expected);
  const path = join(publicationDirectory, filename);
  const descriptor = descriptors[index];
  const expectedDownloadUrl = `https://veyocast.nl/ipk/${filename}`;
  const digest = createHash("sha256")
    .update(await readFile(path))
    .digest("hex");

  if (
    descriptor.appId !== expected.id ||
    descriptor.version !== expected.version ||
    descriptor.filename !== filename ||
    descriptor.downloadUrl !== expectedDownloadUrl ||
    descriptor.sha256 !== digest
  ) {
    throw new Error(`Publieke metadata is ongeldig voor ${expected.id}`);
  }
  if (!checksum.includes(`${digest}  ${filename}\n`)) {
    throw new Error(`Publieke checksum ontbreekt voor ${filename}`);
  }
  await inspectIpk(path, specification);
  process.stdout.write(
    `Publieke LG IPK is lokaal geldig: ${expectedDownloadUrl}\nSHA-256: ${digest}\n`
  );
}
