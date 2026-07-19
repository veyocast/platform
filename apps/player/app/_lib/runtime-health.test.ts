import { describe, expect, it } from "vitest";

import {
  createPlayerHealthResponse,
  readPlayerAppVersion
} from "./runtime-health";

const revision = "b".repeat(40);
const validEnvironment = {
  DEPLOYMENT_SHA: revision,
  DEVICE_LAB_ACCESS_TOKEN: "device-lab-access-token-with-24-bytes",
  DEVICE_LAB_SESSION_SECRET: "device-lab-session-secret-with-32-bytes",
  NEXT_PUBLIC_APP_VERSION: revision,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: `sb_publishable_${"a".repeat(32)}`,
  NEXT_PUBLIC_SUPABASE_URL: "https://production-project.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: `sb_secret_${"b".repeat(32)}`,
  VEYOCAST_ENVIRONMENT: "production"
};

describe("Player deployment health", () => {
  it("returns the exact safe readiness contract for valid runtime config", async () => {
    const response = createPlayerHealthResponse(validEnvironment);

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(await response.json()).toEqual({
      environment: "production",
      revision,
      service: "player",
      status: "ok"
    });
  });

  it.each([
    "DEPLOYMENT_SHA",
    "DEVICE_LAB_ACCESS_TOKEN",
    "DEVICE_LAB_SESSION_SECRET",
    "NEXT_PUBLIC_APP_VERSION",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "NEXT_PUBLIC_SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "VEYOCAST_ENVIRONMENT"
  ])("fails closed without %s", async (missingName) => {
    const environment = { ...validEnvironment };
    delete environment[missingName as keyof typeof environment];

    const response = createPlayerHealthResponse(environment);

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      environment: "unknown",
      revision: "unknown",
      service: "player",
      status: "error"
    });
  });

  it("rejects an app version that does not identify the deployment", async () => {
    const response = createPlayerHealthResponse({
      ...validEnvironment,
      NEXT_PUBLIC_APP_VERSION: "different"
    });

    expect(response.status).toBe(503);
  });

  it("reads the public app version dynamically with a safe fallback", () => {
    expect(readPlayerAppVersion(validEnvironment)).toBe(revision);
    expect(readPlayerAppVersion({ DEPLOYMENT_SHA: revision })).toBe(revision);
    expect(readPlayerAppVersion({})).toBe("development");
  });
});
