import { createHash } from "node:crypto";
import { readFile, readdir, stat } from "node:fs/promises";
import { dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const expectedAppInfo = Object.freeze({
  icon: "icon.png",
  id: "nl.veyocast.player.webos",
  largeIcon: "largeIcon.png",
  main: "index.html",
  title: "VeyoCast Player",
  type: "web",
  vendor: "DG Webservices",
  version: "1.0.0"
});

export const allowedHttpsOrigins = Object.freeze([
  "https://player.veyocast.nl"
]);
export const expectedAppExcludes = Object.freeze([
  "README.md",
  "package.json",
  "scripts",
  "[.]webosignore",
  "[.]map"
]);

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = resolve(appRoot, "../..");
const packagedTextFiles = [
  "appinfo.json",
  "bootstrap.js",
  "index.html",
  "offline.html",
  "platform-adapter.js",
  "veyocast-logo-inverse.svg"
];
const forbiddenTextPatterns = [
  { label: "lokale host", pattern: /\b(?:localhost|127\.0\.0\.1|0\.0\.0\.0)\b/iu },
  { label: "development URL", pattern: /\b(?:staging-player|dev-player)\.veyocast\.nl\b/iu },
  { label: "debugendpoint", pattern: /\/(?:device-lab|debug)(?:\/|\?|["'])/iu },
  { label: "source map", pattern: /sourceMappingURL|\.map(?:["'\s]|$)/iu },
  {
    label: "credential",
    pattern:
      /(?:service[_-]?role|private[_-]?key|client[_-]?secret|access[_-]?token|password)\s*[:=]/iu
  },
  {
    label: "sleutelachtig geheim",
    pattern: /\b(?:eyJ[A-Za-z0-9_-]{20,}|sk_[A-Za-z0-9_-]{20,})\b/u
  }
];

export async function validateApp(root = appRoot) {
  const errors = [];
  const appInfoPath = join(root, "appinfo.json");
  const appInfo = await readJson(appInfoPath, errors);

  if (appInfo) {
    for (const [key, expectedValue] of Object.entries(expectedAppInfo)) {
      if (appInfo[key] !== expectedValue) {
        errors.push(
          `appinfo.json.${key} moet ${JSON.stringify(expectedValue)} zijn`
        );
      }
    }

    if (
      JSON.stringify(appInfo.exclude) !== JSON.stringify(expectedAppExcludes)
    ) {
      errors.push("appinfo.json.exclude wijkt af van de runtime-only allowlist");
    }

    const allowedKeys = new Set([...Object.keys(expectedAppInfo), "exclude"]);
    for (const key of Object.keys(appInfo)) {
      if (!allowedKeys.has(key)) {
        errors.push(`appinfo.json bevat onverwacht veld ${key}`);
      }
    }

    if (!isSemanticVersion(String(appInfo.version ?? ""))) {
      errors.push("appinfo.json.version is geen volledige semantische versie");
    }
    if (!/^[a-z0-9][a-z0-9.-]+$/u.test(String(appInfo.id ?? ""))) {
      errors.push("appinfo.json.id voldoet niet aan het webOS reverse-DNS-formaat");
    }
  }

  await assertFile(join(root, expectedAppInfo.main), errors);
  await validatePng(join(root, expectedAppInfo.icon), 80, 80, errors);
  await validatePng(join(root, expectedAppInfo.largeIcon), 130, 130, errors);
  await validateLockedLogo(root, errors);

  for (const filename of packagedTextFiles) {
    const path = join(root, filename);
    let text;
    try {
      text = await readFile(path, "utf8");
    } catch {
      errors.push(`${filename} ontbreekt of is niet leesbaar`);
      continue;
    }

    for (const forbidden of forbiddenTextPatterns) {
      if (forbidden.pattern.test(text)) {
        errors.push(`${filename} bevat verboden ${forbidden.label}`);
      }
    }

    errors.push(...validateExternalUrls(text, filename));
  }

  const indexHtml = await readText(join(root, "index.html"), errors);
  if (indexHtml) {
    if (!indexHtml.includes('src="platform-adapter.js"')) {
      errors.push("index.html laadt de platformadapter niet");
    }
    if (!indexHtml.includes('src="bootstrap.js"')) {
      errors.push("index.html laadt bootstrap.js niet");
    }
    if (!indexHtml.includes("sandbox=")) {
      errors.push("index.html begrenst de hosted Player niet met een iframe-sandbox");
    }
    if (/https?:\/\/[^"']+\.js/iu.test(indexHtml)) {
      errors.push("index.html mag geen extern script laden");
    }
  }

  const bootstrap = await readText(join(root, "bootstrap.js"), errors);
  if (bootstrap && !bootstrap.includes('PLAYER_URL = PLAYER_ORIGIN + "/lg"')) {
    errors.push("bootstrap.js gebruikt niet de canonieke /lg-route");
  }

  const packageManifest = await readJson(
    join(repositoryRoot, "package.json"),
    errors
  );
  if (
    packageManifest?.devDependencies?.["@webos-tools/cli"] !== "3.2.5"
  ) {
    errors.push("@webos-tools/cli moet exact op 3.2.5 zijn vastgezet");
  }

  const payloadFiles = await listFiles(root);
  for (const file of payloadFiles) {
    if (extname(file) === ".map") {
      errors.push(`source map mag niet in de app staan: ${relative(root, file)}`);
    }
  }

  if (errors.length > 0) {
    throw new Error(
      `LG webOS Signage-validatie is mislukt:\n- ${errors.join("\n- ")}`
    );
  }

  return {
    appInfo,
    files: payloadFiles.map((file) => relative(root, file)).sort()
  };
}

export function isSemanticVersion(value) {
  return /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?$/u.test(
    value
  );
}

export function parsePngDimensions(buffer) {
  if (
    buffer.length < 24 ||
    buffer.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a" ||
    buffer.subarray(12, 16).toString("ascii") !== "IHDR"
  ) {
    throw new Error("Bestand is geen geldige PNG met IHDR-header");
  }
  return {
    height: buffer.readUInt32BE(20),
    width: buffer.readUInt32BE(16)
  };
}

export function validateExternalUrls(text, filename = "bestand") {
  const errors = [];
  const urlPattern = /\bhttps?:\/\/[^\s"'<>),]+/giu;
  for (const match of text.matchAll(urlPattern)) {
    if (
      match[0] === "http://www.w3.org/2000/svg" ||
      match[0] === "http://www.w3.org/1999/xlink"
    ) {
      continue;
    }
    let url;
    try {
      url = new URL(match[0]);
    } catch {
      errors.push(`${filename} bevat een ongeldige externe URL`);
      continue;
    }
    if (url.protocol !== "https:") {
      errors.push(`${filename} bevat een niet-HTTPS URL: ${url.href}`);
      continue;
    }
    if (!allowedHttpsOrigins.includes(url.origin)) {
      errors.push(`${filename} bevat een domein buiten de allowlist: ${url.origin}`);
    }
  }
  return errors;
}

async function validatePng(path, expectedWidth, expectedHeight, errors) {
  try {
    const dimensions = parsePngDimensions(await readFile(path));
    if (
      dimensions.width !== expectedWidth ||
      dimensions.height !== expectedHeight
    ) {
      errors.push(
        `${relative(appRoot, path)} moet ${expectedWidth}x${expectedHeight}px zijn`
      );
    }
  } catch (error) {
    errors.push(
      `${relative(appRoot, path)} is ongeldig: ${
        error instanceof Error ? error.message : "onbekende fout"
      }`
    );
  }
}

async function validateLockedLogo(root, errors) {
  const logoPath = join(root, "veyocast-logo-inverse.svg");
  try {
    const digest = createHash("sha256")
      .update(await readFile(logoPath))
      .digest("hex");
    if (
      digest !==
      "ebeba6d04108bf04fa2d85cf655d4f68689165da151c970ddb8e30c7ec3e1d1a"
    ) {
      errors.push("veyocast-logo-inverse.svg wijkt af van de locked brandmaster");
    }
  } catch {
    errors.push("veyocast-logo-inverse.svg ontbreekt");
  }
}

async function assertFile(path, errors) {
  try {
    if (!(await stat(path)).isFile()) errors.push(`${path} is geen bestand`);
  } catch {
    errors.push(`${path} ontbreekt`);
  }
}

async function readJson(path, errors) {
  const text = await readText(path, errors);
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    errors.push(`${path} bevat ongeldige JSON`);
    return null;
  }
}

async function readText(path, errors) {
  try {
    return await readFile(path, "utf8");
  } catch {
    errors.push(`${path} ontbreekt of is niet leesbaar`);
    return "";
  }
}

async function listFiles(root) {
  const entries = await readdir(root, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name === "node_modules") continue;
    const path = join(root, entry.name);
    if (entry.isDirectory()) files.push(...(await listFiles(path)));
    else if (entry.isFile()) files.push(path);
  }
  return files;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = await validateApp();
    process.stdout.write(
      `LG webOS Signage-bronpakket is geldig (${result.files.length} bestanden).\n`
    );
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : error}\n`);
    process.exitCode = 1;
  }
}
