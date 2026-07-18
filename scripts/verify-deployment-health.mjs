import { readFileSync } from "node:fs";

const [controlPath, playerPath] = process.argv.slice(2);
const expectedSha = process.env.DEPLOYMENT_SHA?.trim();

if (!controlPath || !playerPath || !expectedSha) {
  throw new Error("Healthbestanden en DEPLOYMENT_SHA zijn verplicht.");
}

const checks = [
  { app: "control", path: controlPath, readinessKey: "pairingAdministration" },
  { app: "player", path: playerPath, readinessKey: "pairing" }
];

for (const { app, path, readinessKey } of checks) {
  const health = JSON.parse(readFileSync(path, "utf8"));

  if (
    health.app !== app ||
    health.status !== "ready" ||
    health.deploymentSha !== expectedSha ||
    health[readinessKey] !== "ready"
  ) {
    throw new Error(`${app} healthcheck bevestigt release ${expectedSha} niet.`);
  }
}
