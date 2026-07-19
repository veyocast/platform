import { NextResponse } from "next/server";

const service = "marketing" as const;
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

export function createMarketingHealthResponse(
  environment: RuntimeEnvironment = process.env
) {
  const runtime = readMarketingRuntime(environment);
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

function readMarketingRuntime(environment: RuntimeEnvironment) {
  const deploymentEnvironment = readEnvironmentValue(
    environment,
    "VEYOCAST_ENVIRONMENT"
  );
  const revision = readEnvironmentValue(environment, "DEPLOYMENT_SHA");

  if (
    (deploymentEnvironment !== "staging" &&
      deploymentEnvironment !== "production") ||
    !revision ||
    !revisionPattern.test(revision)
  ) {
    return null;
  }

  return {
    environment: deploymentEnvironment as DeploymentEnvironment,
    revision
  };
}

function readEnvironmentValue(environment: RuntimeEnvironment, name: string) {
  return environment[name]?.trim();
}
