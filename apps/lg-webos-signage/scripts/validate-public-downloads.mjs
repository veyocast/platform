import { createHash } from "node:crypto";

import { ipkFilename, packageSpecifications } from "./inspect-ipk.mjs";

const baseUrl = "https://veyocast.nl/ipk/";
const checksumResponse = await fetch(new URL("checksums.sha256", baseUrl), {
  redirect: "error",
  signal: AbortSignal.timeout(20000)
});
if (!checksumResponse.ok) {
  throw new Error(`Publieke checksums geven HTTP ${checksumResponse.status}`);
}
const checksums = await checksumResponse.text();

for (const specification of packageSpecifications) {
  const filename = ipkFilename(specification.appInfo);
  const url = new URL(filename, baseUrl);
  const response = await fetch(url, {
    redirect: "manual",
    signal: AbortSignal.timeout(30000)
  });
  if (response.status !== 200) {
    throw new Error(`${url} geeft HTTP ${response.status}`);
  }
  if (response.url !== url.toString()) {
    throw new Error(`${url} redirect naar ${response.url}`);
  }
  const contentType = response.headers.get("content-type") || "";
  if (
    contentType !== "application/vnd.webos.ipk" &&
    contentType !== "application/vnd.shana.informed.package" &&
    contentType !== "application/octet-stream"
  ) {
    throw new Error(`${url} geeft onbruikbaar Content-Type ${contentType}`);
  }
  const contentLength = Number(response.headers.get("content-length") || 0);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!contentLength || contentLength !== bytes.byteLength) {
    throw new Error(`${url} heeft geen stabiele correcte Content-Length`);
  }
  const digest = createHash("sha256").update(bytes).digest("hex");
  if (!checksums.includes(`${digest}  ${filename}\n`)) {
    throw new Error(`${url} wijkt af van de gepubliceerde SHA-256`);
  }
  process.stdout.write(
    `${url} status=200 redirects=0 type=${contentType} bytes=${bytes.byteLength} sha256=${digest}\n`
  );
}
