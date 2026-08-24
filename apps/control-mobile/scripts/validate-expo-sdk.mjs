import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const appRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const appManifest = JSON.parse(
  await readFile(join(appRoot, "package.json"), "utf8")
);
const expoManifestPath = require.resolve("expo/package.json", {
  paths: [appRoot]
});
const expoRoot = dirname(expoManifestPath);
const expoManifest = JSON.parse(await readFile(expoManifestPath, "utf8"));
const bundledModules = JSON.parse(
  await readFile(join(expoRoot, "bundledNativeModules.json"), "utf8")
);
const dependencies = appManifest.dependencies ?? {};
const failures = [];

if (dependencies.expo !== `~${expoManifest.version}`) {
  failures.push(
    `expo: manifest ${dependencies.expo ?? "ontbreekt"}, geïnstalleerd ~${expoManifest.version}`
  );
}

for (const [name, declared] of Object.entries(dependencies)) {
  if (
    name === "expo" ||
    name.startsWith("@expo-google-fonts/") ||
    !(name.startsWith("expo-") || name.startsWith("@expo/"))
  ) {
    continue;
  }
  const expected = bundledModules[name];
  if (!expected) {
    failures.push(`${name}: ontbreekt in Expo ${expoManifest.version} bundledNativeModules`);
  } else if (declared !== expected) {
    failures.push(`${name}: manifest ${declared}, SDK verwacht ${expected}`);
  }
}

if (failures.length) {
  console.error("Expo SDK-lockset wijkt af:\n- " + failures.join("\n- "));
  process.exit(1);
}

console.log(
  `Expo SDK-lockset gevalideerd: expo ${expoManifest.version}, ${Object.keys(bundledModules).length} canonieke moduleversies.`
);
