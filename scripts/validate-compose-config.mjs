import { readFileSync } from "node:fs";

const [path, environment, revision] = process.argv.slice(2);
if (!path || !["staging", "production"].includes(environment) || !/^[0-9a-f]{40}$/.test(revision ?? "")) {
  throw new Error("Composevalidatie mist geldige invoer.");
}

const config = JSON.parse(readFileSync(path, "utf8"));
const expectedServices = environment === "staging"
  ? ["control", "player"]
  : ["control", "marketing", "player"];
const actualServices = Object.keys(config.services ?? {}).sort();
const expectedProject = `veyocast-${environment}`;
const expectedPorts = environment === "staging"
  ? { control: ["13000", 3000], player: ["13001", 3001] }
  : { control: ["23000", 3000], marketing: ["23002", 3002], player: ["23001", 3001] };

if (config.name !== expectedProject) {
  throw new Error(`${environment} gebruikt niet de verwachte Compose-projectnaam.`);
}

if (JSON.stringify(actualServices) !== JSON.stringify(expectedServices)) {
  throw new Error(`${environment} bevat niet exact de verwachte services.`);
}

for (const service of expectedServices) {
  const definition = config.services[service];
  if (definition.image !== `veyocast-${service}:${revision}` || definition.build) {
    throw new Error(`${service} gebruikt geen buildvrije immutable SHA-image.`);
  }

  const ports = definition.ports ?? [];
  const [expectedPublished, expectedTarget] = expectedPorts[service];
  if (
    ports.length !== 1 ||
    ports[0].host_ip !== "127.0.0.1" ||
    ports[0].published !== expectedPublished ||
    ports[0].target !== expectedTarget ||
    ports[0].protocol !== "tcp"
  ) {
    throw new Error(`${service} gebruikt niet exact de veilige poortbinding.`);
  }

  if (definition.volumes || Object.keys(definition.networks ?? {}).join(",") !== "app") {
    throw new Error(`${service} gebruikt onverwachte volumes of netwerken.`);
  }
}

const network = config.networks?.app;
if (!network || network.external || network.driver !== "bridge" || network.name !== `${expectedProject}_app`) {
  throw new Error(`${environment} gebruikt geen eigen niet-extern bridgenetwerk.`);
}
