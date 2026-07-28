import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";

const output = process.argv[2];
if (!output) throw new Error("Geef een uitvoerpad voor de CycloneDX-SBOM.");

const projectRoot = resolve(import.meta.dirname, "..");
const workspaceRoot = resolve(projectRoot, "../..");
const raw = execFileSync(
  "pnpm",
  ["--filter", "@veyocast/control-mobile", "list", "--json", "--depth", "Infinity"],
  { cwd: workspaceRoot, encoding: "utf8" }
);
const roots = JSON.parse(raw);
const components = new Map();

function visit(dependencies = {}) {
  for (const [name, dependency] of Object.entries(dependencies)) {
    const version = dependency.version ?? "workspace";
    const key = `${name}@${version}`;
    components.set(key, {
      bomRef: `pkg:npm/${encodeURIComponent(name)}@${encodeURIComponent(version)}`,
      name,
      purl: `pkg:npm/${encodeURIComponent(name)}@${encodeURIComponent(version)}`,
      type: "library",
      version
    });
    visit(dependency.dependencies);
  }
}

for (const root of roots) visit(root.dependencies);

writeFileSync(
  output,
  `${JSON.stringify(
    {
      bomFormat: "CycloneDX",
      components: [...components.values()].sort((a, b) =>
        a.bomRef.localeCompare(b.bomRef)
      ),
      metadata: {
        component: {
          name: "nl.veyocast.control",
          type: "application",
          version: process.env.VEYOCAST_CONTROL_VERSION_NAME ?? "development"
        },
        timestamp: new Date().toISOString()
      },
      serialNumber: `urn:uuid:${randomUUID()}`,
      specVersion: "1.6",
      version: 1
    },
    null,
    2
  )}\n`
);
