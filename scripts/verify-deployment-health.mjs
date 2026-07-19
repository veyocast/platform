import { readFileSync } from "node:fs";

const [path, expectedService, expectedEnvironment, expectedRevision] = process.argv.slice(2);
if (
  !path ||
  !["control", "marketing", "player"].includes(expectedService) ||
  !["staging", "production"].includes(expectedEnvironment) ||
  !/^[0-9a-f]{40}$/.test(expectedRevision ?? "")
) {
  throw new Error("Healthvalidatie mist geldige invoer.");
}

const health = JSON.parse(readFileSync(path, "utf8"));
const expected = {
  environment: expectedEnvironment,
  revision: expectedRevision,
  service: expectedService,
  status: "ok"
};

if (JSON.stringify(sortObject(health)) !== JSON.stringify(sortObject(expected))) {
  throw new Error(`${expectedService} bevestigt release ${expectedRevision} niet veilig.`);
}

function sortObject(value) {
  return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)));
}
