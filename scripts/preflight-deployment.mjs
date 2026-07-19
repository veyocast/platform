import process from "node:process";

const target = process.argv[2];

if (target !== "staging" && target !== "production") {
  fail("VEYOCAST_ENVIRONMENT");
}

const contract = {
  staging: {
    controlHost: "staging-control.veyocast.nl",
    controlPort: "13000",
    playerHost: "staging-player.veyocast.nl",
    playerPort: "13001"
  },
  production: {
    controlHost: "control.veyocast.nl",
    controlPort: "23000",
    marketingHost: "veyocast.nl",
    marketingPort: "23002",
    playerHost: "player.veyocast.nl",
    playerPort: "23001"
  }
}[target];

requireEqual("VEYOCAST_ENVIRONMENT", target);
requireEqual("CONTROL_HOST", contract.controlHost);
requireEqual("CONTROL_BIND_PORT", contract.controlPort);
requireEqual("PLAYER_HOST", contract.playerHost);
requireEqual("PLAYER_BIND_PORT", contract.playerPort);

if (target === "staging") {
  if (read("MARKETING_HOST") || read("MARKETING_BIND_PORT")) fail("MARKETING_HOST");
} else {
  requireEqual("MARKETING_HOST", contract.marketingHost);
  requireEqual("MARKETING_BIND_PORT", contract.marketingPort);
}

const revision = read("RELEASE_SHA") || required("GITHUB_SHA");
if (!/^[0-9a-f]{40}$/.test(revision)) fail("GITHUB_SHA");

const projectRef = required("SUPABASE_PROJECT_REF");
if (!/^[a-z0-9]{20}$/.test(projectRef)) fail("SUPABASE_PROJECT_REF");

let publicUrl;
try {
  publicUrl = new URL(required("NEXT_PUBLIC_SUPABASE_URL"));
} catch {
  fail("NEXT_PUBLIC_SUPABASE_URL");
}
if (
  publicUrl.protocol !== "https:" ||
  publicUrl.pathname !== "/" ||
  publicUrl.hostname !== `${projectRef}.supabase.co`
) {
  fail("NEXT_PUBLIC_SUPABASE_URL");
}

let databaseUrl;
try {
  databaseUrl = new URL(required("SUPABASE_DB_URL"));
} catch {
  fail("SUPABASE_DB_URL");
}
if (
  !["postgres:", "postgresql:"].includes(databaseUrl.protocol) ||
  !(
    databaseUrl.hostname === `db.${projectRef}.supabase.co` ||
    databaseUrl.hostname.endsWith(".pooler.supabase.com")
  ) ||
  !required("SUPABASE_DB_URL").includes(projectRef)
) {
  fail("SUPABASE_DB_URL");
}

validateJwt("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
validateJwt("SUPABASE_SERVICE_ROLE_KEY", "service_role");
validateEncryptionKey();

if (required("DEVICE_LAB_ACCESS_TOKEN").length < 24) fail("DEVICE_LAB_ACCESS_TOKEN");
if (required("DEVICE_LAB_SESSION_SECRET").length < 32) fail("DEVICE_LAB_SESSION_SECRET");
if (!/^[A-Za-z0-9._~+/=-]+$/.test(required("DEVICE_LAB_ACCESS_TOKEN"))) fail("DEVICE_LAB_ACCESS_TOKEN");
if (!/^[A-Za-z0-9._~+/=-]+$/.test(required("DEVICE_LAB_SESSION_SECRET"))) fail("DEVICE_LAB_SESSION_SECRET");

process.stdout.write(`Deploymentpreflight voor ${target} is geldig.\n`);

function validateJwt(name, expectedRole) {
  const parts = required(name).split(".");
  if (parts.length !== 3 || parts.some((part) => !/^[A-Za-z0-9_-]+$/.test(part))) fail(name);

  try {
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    if (payload.role !== expectedRole || typeof payload.ref !== "string") fail(name);
    if (payload.ref !== projectRef) fail(name);
  } catch {
    fail(name);
  }
}

function validateEncryptionKey() {
  const name = "NEXT_SERVER_ACTIONS_ENCRYPTION_KEY";
  const value = required(name);
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(value)) fail(name);
  const decoded = Buffer.from(value, "base64");
  if (![16, 24, 32].includes(decoded.length)) fail(name);
}

function requireEqual(name, expected) {
  if (required(name) !== expected) fail(name);
}

function required(name) {
  const value = read(name);
  if (!value) fail(name);
  return value;
}

function read(name) {
  return process.env[name]?.trim() ?? "";
}

function fail(name) {
  process.stderr.write(`Deploymentconfiguratie is ongeldig: ${name}.\n`);
  process.exit(1);
}
