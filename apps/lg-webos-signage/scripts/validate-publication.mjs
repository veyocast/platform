import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { inspectIpk } from "./inspect-ipk.mjs";
import { expectedAppInfo } from "./validate-app.mjs";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, "../../..");
const publicationDirectory = join(
  repositoryRoot,
  "apps",
  "marketing",
  "public",
  "ipk"
);
const ipkFilename = `${expectedAppInfo.id}_${expectedAppInfo.version}_all.ipk`;
const ipkPath = join(publicationDirectory, ipkFilename);
const expectedDownloadUrl = `https://veyocast.nl/ipk/${ipkFilename}`;
const latest = JSON.parse(
  await readFile(join(publicationDirectory, "latest.json"), "utf8")
);
const digest = createHash("sha256")
  .update(await readFile(ipkPath))
  .digest("hex");
const checksum = await readFile(
  join(publicationDirectory, "checksums.sha256"),
  "utf8"
);

if (latest.appId !== expectedAppInfo.id) {
  throw new Error("De publieke release gebruikt een onverwachte app-ID");
}
if (latest.version !== expectedAppInfo.version) {
  throw new Error("De publieke release gebruikt een onverwachte versie");
}
if (latest.ipkFilename !== ipkFilename) {
  throw new Error("De publieke release verwijst naar een onverwachte IPK");
}
if (latest.downloadUrl !== expectedDownloadUrl) {
  throw new Error(`De publieke download-URL moet ${expectedDownloadUrl} zijn`);
}
if (latest.sha256 !== digest) {
  throw new Error("De publieke latest.json SHA-256 wijkt af van de IPK");
}
if (checksum !== `${digest}  ${ipkFilename}\n`) {
  throw new Error("De publieke checksum wijkt af van de IPK");
}

await inspectIpk(ipkPath);
process.stdout.write(
  `Publieke LG IPK is geldig: ${expectedDownloadUrl}\nSHA-256: ${digest}\n`
);
