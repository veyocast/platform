import { describe, expect, it } from "vitest";

import {
  readMediaWorkerConfig,
  WorkerConfigurationError
} from "../src/worker-config";

const serviceRoleJwt = createJwt("service_role");

describe("media worker configuration", () => {
  it("accepts a service-role JWT and applies bounded defaults", () => {
    expect(readMediaWorkerConfig({
      SUPABASE_SERVICE_ROLE_KEY: serviceRoleJwt,
      SUPABASE_URL: "http://127.0.0.1:54321/",
      MEDIA_WORKER_ID: "worker:test-1"
    })).toEqual({
      lockTimeoutSeconds: 900,
      maxAttempts: 3,
      pollIntervalMs: 2_000,
      schedulePollIntervalMs: 15_000,
      serviceRoleKey: serviceRoleJwt,
      sportlinkEncryptionKey: null,
      supabaseUrl: "http://127.0.0.1:54321",
      workerId: "worker:test-1"
    });
  });

  it("accepts modern opaque secret keys but rejects browser and anon keys", () => {
    expect(readMediaWorkerConfig({
      SUPABASE_SERVICE_ROLE_KEY: "sb_secret_example",
      SUPABASE_URL: "https://project.supabase.co"
    }).serviceRoleKey).toBe("sb_secret_example");

    for (const key of ["sb_publishable_example", createJwt("anon"), "placeholder"]) {
      expect(() => readMediaWorkerConfig({
        SUPABASE_SERVICE_ROLE_KEY: key,
        SUPABASE_URL: "https://project.supabase.co"
      })).toThrowError(WorkerConfigurationError);
    }
  });

  it("rejects unsafe worker ids and out-of-range poll settings", () => {
    expect(() => readMediaWorkerConfig({
      MEDIA_WORKER_ID: "worker id with spaces",
      SUPABASE_SERVICE_ROLE_KEY: serviceRoleJwt,
      SUPABASE_URL: "http://localhost:54321"
    })).toThrowError(/MEDIA_WORKER_ID/);
    expect(() => readMediaWorkerConfig({
      MEDIA_WORKER_POLL_INTERVAL_MS: "100",
      SUPABASE_SERVICE_ROLE_KEY: serviceRoleJwt,
      SUPABASE_URL: "http://localhost:54321"
    })).toThrowError(/MEDIA_WORKER_POLL_INTERVAL_MS/);
    expect(() => readMediaWorkerConfig({
      PUBLISHER_SCHEDULE_POLL_INTERVAL_MS: "1000",
      SUPABASE_SERVICE_ROLE_KEY: serviceRoleJwt,
      SUPABASE_URL: "http://localhost:54321"
    })).toThrowError(/PUBLISHER_SCHEDULE_POLL_INTERVAL_MS/);
    expect(() => readMediaWorkerConfig({
      SPORTLINK_CONFIG_ENCRYPTION_KEY: "te-kort",
      SUPABASE_SERVICE_ROLE_KEY: serviceRoleJwt,
      SUPABASE_URL: "http://localhost:54321"
    })).toThrowError(/SPORTLINK_CONFIG_ENCRYPTION_KEY/);
  });
});

function createJwt(role: string) {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ role })}.signature`;
}
