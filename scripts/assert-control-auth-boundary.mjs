import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const appDirectory = resolve(process.argv[2] ?? "apps/control");
const manifestPath = resolve(appDirectory, ".next/prerender-manifest.json");

let manifest;
try {
  manifest = JSON.parse(await readFile(manifestPath, "utf8"));
} catch {
  console.error("Control authcontrole kon de Next.js prerender-manifest niet lezen.");
  process.exit(1);
}

const protectedPrefixes = ["/auth/mfa", "/context", "/dashboard", "/platform"];
const prerenderedRoutes = Object.keys(manifest.routes ?? {});
const violations = prerenderedRoutes.filter((route) =>
  protectedPrefixes.some(
    (prefix) => route === prefix || route.startsWith(`${prefix}/`)
  )
);

if (violations.length) {
  console.error(
    `Control authcontrole weigert ${violations.length} geprerenderde beveiligde route(s).`
  );
  process.exit(1);
}

console.log("Control authcontrole: beveiligde routes zijn dynamisch.");
