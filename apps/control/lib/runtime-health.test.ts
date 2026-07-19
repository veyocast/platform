import { describe, expect, it } from "vitest";

import { createControlHealthResponse } from "./runtime-health";

const validEnvironment = {
  DEPLOYMENT_SHA: "a".repeat(40),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: `sb_publishable_${"a".repeat(32)}`,
  NEXT_PUBLIC_SUPABASE_URL: "https://staging-project.supabase.co",
  NEXT_SERVER_ACTIONS_ENCRYPTION_KEY: "actions-encryption-key-with-32-bytes",
  SUPABASE_SERVICE_ROLE_KEY: `sb_secret_${"b".repeat(32)}`,
  VEYOCAST_ENVIRONMENT: "staging"
};

describe("Control deployment health", () => {
  it("returns the exact safe readiness contract for valid runtime config", async () => {
    const response = createControlHealthResponse(validEnvironment);

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(await response.json()).toEqual({
      environment: "staging",
      revision: "a".repeat(40),
      service: "control",
      status: "ok"
    });
  });

  it.each([
    "DEPLOYMENT_SHA",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_SERVER_ACTIONS_ENCRYPTION_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "VEYOCAST_ENVIRONMENT"
  ])("fails closed without %s", async (missingName) => {
    const environment = { ...validEnvironment };
    delete environment[missingName as keyof typeof environment];

    const response = createControlHealthResponse(environment);

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      environment: "unknown",
      revision: "unknown",
      service: "control",
      status: "error"
    });
  });

  it("does not return configuration values when config is malformed", async () => {
    const response = createControlHealthResponse({
      ...validEnvironment,
      NEXT_PUBLIC_SUPABASE_URL: "https://secret.invalid/?token=top-secret"
    });
    const payload = JSON.stringify(await response.json());

    expect(response.status).toBe(503);
    expect(payload).not.toContain("secret.invalid");
    expect(payload).not.toContain("top-secret");
  });
});
