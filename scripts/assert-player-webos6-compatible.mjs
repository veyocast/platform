import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const playerRoot = path.resolve(process.argv[2] ?? "apps/player");
const chunksRoot = path.join(playerRoot, ".next", "static", "chunks");
const standaloneBrowserFiles = [path.join(playerRoot, "public", "sw.js")];
const excludedFrameworkFiles = /^(?:main|polyfills)-.*\.js$/;
const unsupportedSyntax = [
  {
    label: "optional chaining",
    pattern: /\?\.(?=[A-Za-z_$[(])/u
  },
  {
    label: "nullish coalescing",
    pattern: /\?\?(?![?])/u
  },
  {
    label: "logical assignment",
    pattern: /(?:&&=|\|\|=|\?\?=)/u
  }
];
const failures = [];

for (const file of await listFiles(chunksRoot)) {
  if (!file.endsWith(".js") || excludedFrameworkFiles.test(path.basename(file))) {
    continue;
  }
  const source = await readFile(file, "utf8");
  for (const check of unsupportedSyntax) {
    if (check.pattern.test(source)) {
      failures.push(
        `${path.relative(playerRoot, file)} bevat ${check.label}.`
      );
    }
  }
}

for (const file of standaloneBrowserFiles) {
  const source = await readFile(file, "utf8");
  for (const check of unsupportedSyntax) {
    if (check.pattern.test(source)) {
      failures.push(
        `${path.relative(playerRoot, file)} bevat ${check.label}.`
      );
    }
  }
}

if (failures.length > 0) {
  console.error(
    [
      "Playerbundle is niet veilig parseerbaar door Chromium 79 (webOS 6).",
      ...failures
    ].join("\n")
  );
  process.exit(1);
}

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFiles(entryPath)));
    } else {
      files.push(entryPath);
    }
  }
  return files;
}
