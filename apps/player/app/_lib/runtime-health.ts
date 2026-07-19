import "server-only";

import { validateSupabaseAdminSecret } from "@veyocast/config/server";
import { NextResponse } from "next/server";

const service = "player" as const;
const revisionPattern = /^[0-9a-f]{40}$/;

type DeploymentEnvironment = "production" | "staging";
type RuntimeEnvironment = Readonly<Record<string, string | undefined>>;

type HealthPayload =
  | {
      environment: DeploymentEnvironment;
      revision: string;
      service: typeof service;
      status: "ok";
    }
  | {
      environment: "unknown";
      revision: "unknown";
      service: typeof service;
      status: "error";
    };

export function createPlayerHealthResponse(
  environment: RuntimeEnvironment = process.env
) {
  const runtime = readPlayerRuntime(environment);
  const payload: HealthPayload = runtime
    ? { ...runtime, service, status: "ok" }
    : {
        environment: "unknown",
        revision: "unknown",
        service,
        status: "error"
      };

  return NextResponse.json(payload, {
    headers: { "Cache-Control": "no-store" },
    status: runtime ? 200 : 503
  });
}

export function readPlayerAppVersion(
  environment: RuntimeEnvironment = process.env
) {
  return (
    readPlayerRuntimeValue("NEXT_PUBLIC_APP_VERSION", environment) ||
    readPlayerRuntimeValue("DEPLOYMENT_SHA", environment) ||
    "development"
  );
}

function readPlayerRuntime(environment: RuntimeEnvironment) {
  const deploymentEnvironment = readDeploymentEnvironment(environment);
  const revision = readPlayerRuntimeValue("DEPLOYMENT_SHA", environment);
  const appVersion = readPlayerRuntimeValue(
    "NEXT_PUBLIC_APP_VERSION",
    environment
  );
  const publicConfig = getRuntimeSupabaseConfig(environment);
  const adminSecret = validateSupabaseAdminSecret(environment);
  const deviceLabAccessToken = readPlayerRuntimeValue(
    "DEVICE_LAB_ACCESS_TOKEN",
    environment
  );
  const deviceLabSessionSecret = readPlayerRuntimeValue(
    "DEVICE_LAB_SESSION_SECRET",
    environment
  );

  if (
    !deploymentEnvironment ||
    !revision ||
    !revisionPattern.test(revision) ||
    appVersion !== revision ||
    !publicConfig ||
    !isHostedSupabaseUrl(publicConfig.url) ||
    !isAnonKey(publicConfig.anonKey) ||
    !adminSecret.valid ||
    !deviceLabAccessToken ||
    deviceLabAccessToken.length < 24 ||
    !deviceLabSessionSecret ||
    deviceLabSessionSecret.length < 32
  ) {
    return null;
  }

  return { environment: deploymentEnvironment, revision };
}

function getRuntimeSupabaseConfig(environment: RuntimeEnvironment) {
  const url = readPlayerRuntimeValue("NEXT_PUBLIC_SUPABASE_URL", environment);
  const anonKey = readPlayerRuntimeValue(
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    environment
  );
  return url && anonKey ? { anonKey, url } : null;
}

function readPlayerRuntimeValue(
  name: string,
  environment: RuntimeEnvironment = process.env
) {
  return environment[name]?.trim();
}

function readDeploymentEnvironment(
  environment: RuntimeEnvironment
): DeploymentEnvironment | null {
  const value = readPlayerRuntimeValue("VEYOCAST_ENVIRONMENT", environment);
  return value === "staging" || value === "production" ? value : null;
}

function isHostedSupabaseUrl(value: string) {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      url.hostname.endsWith(".supabase.co") &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash
    );
  } catch {
    return false;
  }
}

function isAnonKey(value: string) {
  return (
    (value.startsWith("sb_publishable_") && value.length >= 32) ||
    getJwtRole(value) === "anon"
  );
}

function getJwtRole(value: string) {
  const parts = value.split(".");
  if (parts.length !== 3) return null;
  try {
    const payload = JSON.parse(
      Buffer.from(parts[1] ?? "", "base64url").toString("utf8")
    ) as { role?: unknown };
    return typeof payload.role === "string" ? payload.role : null;
  } catch {
    return null;
  }
}
