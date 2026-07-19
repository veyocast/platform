import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createPlayerHealthResponse,
  readPlayerAppVersion
} from "./runtime-health";

const revision = "b".repeat(40);
const secret = `sb_secret_player_DO_NOT_SERIALIZE_${"b".repeat(32)}`;
const validEnvironment = {
  DEPLOYMENT_SHA: revision,
  DEVICE_LAB_ACCESS_TOKEN: "device-lab-access-token-with-24-bytes",
  DEVICE_LAB_SESSION_SECRET: "device-lab-session-secret-with-32-bytes",
  NEXT_PUBLIC_APP_VERSION: revision,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: `sb_publishable_${"a".repeat(32)}`,
  NEXT_PUBLIC_SUPABASE_URL: "https://production-project.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: secret,
  VEYOCAST_ENVIRONMENT: "production"
};

describe("Player deployment health", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

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

  it("returns the same generic 503 for an invalid admin credential", async () => {
    const response = createPlayerHealthResponse({
      ...validEnvironment,
      SUPABASE_SERVICE_ROLE_KEY: `sb_publishable_${"c".repeat(32)}`
    });

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      environment: "unknown",
      revision: "unknown",
      service: "player",
      status: "error"
    });
  });

  it("reads the public app version dynamically with a safe fallback", () => {
    expect(readPlayerAppVersion(validEnvironment)).toBe(revision);
    expect(readPlayerAppVersion({ DEPLOYMENT_SHA: revision })).toBe(revision);
    expect(readPlayerAppVersion({})).toBe("development");
  });

  it("never serializes or logs secrets, key fragments or database URLs", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const response = createPlayerHealthResponse(validEnvironment);
    const payload = JSON.stringify(await response.json());
    const logged = JSON.stringify([
      ...error.mock.calls,
      ...log.mock.calls,
      ...warn.mock.calls
    ]);

    expect(payload).not.toContain(secret);
    expect(payload).not.toContain("DO_NOT_SERIALIZE");
    expect(payload).not.toContain("production-project.supabase.co");
    expect(logged).not.toContain(secret);
    expect(error).not.toHaveBeenCalled();
    expect(log).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
  });
});
