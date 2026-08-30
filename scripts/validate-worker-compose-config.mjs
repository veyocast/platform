import { readFileSync } from "node:fs";

const [path, environment, revision] = process.argv.slice(2);
if (!path || !["staging", "production"].includes(environment) || !/^[0-9a-f]{40}$/.test(revision ?? "")) {
  throw new Error("Worker-Composevalidatie mist geldige invoer.");
}

const config = JSON.parse(readFileSync(path, "utf8"));
const project = `veyocast-${environment}-worker`;
const service = config.services?.["media-worker"];

if (config.name !== project || Object.keys(config.services ?? {}).join(",") !== "media-worker") {
  throw new Error(`${environment} bevat geen afzonderlijk exact workerproject.`);
}
if (service.image !== `veyocast-media-worker:${revision}` || service.build || service.ports) {
  throw new Error("De mediaworker gebruikt geen buildvrije, niet-publieke SHA-image.");
}
if (
  service.read_only !== true ||
  service.restart !== "unless-stopped" ||
  !service.cap_drop?.includes("ALL") ||
  !service.security_opt?.includes("no-new-privileges:true") ||
  service.pids_limit > 256 ||
  Number(service.mem_limit) > 1_610_612_736 ||
  Number(service.cpus) > 1.5
) {
  throw new Error("De mediaworker mist least-privilege- of resourcegrenzen.");
}
const environmentNames = Object.keys(service.environment ?? {}).sort();
const expectedEnvironmentNames = [
  "DEPLOYMENT_SHA",
  "LEDSCORES_CLAIM_INTERVAL_MS",
  "LEDSCORES_LEASE_SECONDS",
  "LEDSCORES_MAX_CONNECTIONS",
  "MEDIA_WORKER_LOCK_TIMEOUT_SECONDS",
  "MEDIA_WORKER_MAX_ATTEMPTS",
  "MEDIA_WORKER_POLL_INTERVAL_MS",
  "MONITOR_CONTROL_URL",
  "MONITOR_MARKETING_URL",
  "MONITOR_PLAYER_URL",
  "PUBLISHER_SCHEDULE_POLL_INTERVAL_MS",
  "SLACK_ALERT_WEBHOOK_URL",
  "SPORTLINK_CONFIG_ENCRYPTION_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_URL",
  "VEYOCAST_ENVIRONMENT"
].sort();
if (JSON.stringify(environmentNames) !== JSON.stringify(expectedEnvironmentNames)) {
  throw new Error("De mediaworker krijgt onverwachte runtimevariabelen.");
}
if (
  service.environment.DEPLOYMENT_SHA !== revision ||
  service.environment.VEYOCAST_ENVIRONMENT !== environment ||
  service.environment.LEDSCORES_CLAIM_INTERVAL_MS !== "5000" ||
  service.environment.LEDSCORES_LEASE_SECONDS !== "45" ||
  service.environment.LEDSCORES_MAX_CONNECTIONS !== "25" ||
  service.environment.MEDIA_WORKER_POLL_INTERVAL_MS !== "500" ||
  service.environment.PUBLISHER_SCHEDULE_POLL_INTERVAL_MS !== "15000" ||
  service.environment.MONITOR_CONTROL_URL !==
    `https://${environment === "staging" ? "staging-control" : "control"}.veyocast.nl/api/health` ||
  service.environment.MONITOR_PLAYER_URL !==
    `https://${environment === "staging" ? "staging-player" : "player"}.veyocast.nl/healthz` ||
  service.environment.MONITOR_MARKETING_URL !==
    (environment === "production" ? "https://veyocast.nl/api/health" : "")
) {
  throw new Error("De mediaworker gebruikt een ongeldige revision- of pollconfiguratie.");
}
if (
  service.volumes?.length !== 1 ||
  service.volumes[0].type !== "volume" ||
  service.volumes[0].target !== "/tmp" ||
  Object.keys(service.networks ?? {}).join(",") !== "worker"
) {
  throw new Error("De mediaworker gebruikt geen afgeschermde tijdelijke opslag of netwerk.");
}
const healthcheck = service.healthcheck?.test?.join(" ") ?? "";
if (
  !healthcheck.includes("/tmp/veyocast-media-worker-ready.json") ||
  !healthcheck.includes("VEYOCAST_ENVIRONMENT") ||
  !healthcheck.includes("DEPLOYMENT_SHA") ||
  !healthcheck.includes("Number.isFinite") ||
  !healthcheck.includes("age>=-5000") ||
  !healthcheck.includes("age<=75000")
) {
  throw new Error("De mediaworker heeft geen strikt releasegebonden queueheartbeat.");
}

const network = config.networks?.worker;
if (!network || network.external || network.driver !== "bridge" || network.name !== `${project}_worker`) {
  throw new Error("De mediaworker gebruikt geen afzonderlijk bridgenetwerk.");
}
