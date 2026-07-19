import "server-only";

import { validateSupabaseAdminSecret } from "@veyocast/config/server";
import { NextResponse } from "next/server";

import {
  getSupabasePublicConfig,
  readEnvironmentValue,
  type RuntimeEnvironment
} from "./supabase/config";

const service = "control" as const;
const revisionPattern = /^[0-9a-f]{40}$/;

type DeploymentEnvironment = "production" | "staging";

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

export function createControlHealthResponse(
  environment: RuntimeEnvironment = process.env
) {
  const runtime = readControlRuntime(environment);
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

function readControlRuntime(environment: RuntimeEnvironment) {
  const deploymentEnvironment = readDeploymentEnvironment(environment);
  const revision = readEnvironmentValue(environment, "DEPLOYMENT_SHA");
  const publicConfig = getSupabasePublicConfig(environment);
  const adminSecret = validateSupabaseAdminSecret(environment);
  const actionsEncryptionKey = readEnvironmentValue(
    environment,
    "NEXT_SERVER_ACTIONS_ENCRYPTION_KEY"
  );

  if (
    !deploymentEnvironment ||
    !revision ||
    !revisionPattern.test(revision) ||
    !publicConfig ||
    !isHostedSupabaseUrl(publicConfig.url) ||
    !isAnonKey(publicConfig.anonKey) ||
    !adminSecret.valid ||
    !actionsEncryptionKey ||
    actionsEncryptionKey.length < 32
  ) {
    return null;
  }

  return { environment: deploymentEnvironment, revision };
}

function readDeploymentEnvironment(
  environment: RuntimeEnvironment
): DeploymentEnvironment | null {
  const value = readEnvironmentValue(environment, "VEYOCAST_ENVIRONMENT");
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
