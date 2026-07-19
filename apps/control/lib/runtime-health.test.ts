import { afterEach, describe, expect, it, vi } from "vitest";

import { createControlHealthResponse } from "./runtime-health";

const secret = `sb_secret_control_DO_NOT_SERIALIZE_${"b".repeat(32)}`;
const validEnvironment = {
  DEPLOYMENT_SHA: "a".repeat(40),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: `sb_publishable_${"a".repeat(32)}`,
  NEXT_PUBLIC_SUPABASE_URL: "https://staging-project.supabase.co",
  NEXT_SERVER_ACTIONS_ENCRYPTION_KEY: "actions-encryption-key-with-32-bytes",
  SUPABASE_SERVICE_ROLE_KEY: secret,
  VEYOCAST_ENVIRONMENT: "staging"
};

describe("Control deployment health", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

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

  it("returns the same generic 503 for an invalid admin credential", async () => {
    const response = createControlHealthResponse({
      ...validEnvironment,
      SUPABASE_SERVICE_ROLE_KEY: `sb_publishable_${"c".repeat(32)}`
    });

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      environment: "unknown",
      revision: "unknown",
      service: "control",
      status: "error"
    });
  });

  it("never serializes or logs secrets, key fragments or database URLs", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const response = createControlHealthResponse(validEnvironment);
    const payload = JSON.stringify(await response.json());
    const logged = JSON.stringify([
      ...error.mock.calls,
      ...log.mock.calls,
      ...warn.mock.calls
    ]);

    expect(payload).not.toContain(secret);
    expect(payload).not.toContain("DO_NOT_SERIALIZE");
    expect(payload).not.toContain("staging-project.supabase.co");
    expect(logged).not.toContain(secret);
    expect(error).not.toHaveBeenCalled();
    expect(log).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
  });
});
