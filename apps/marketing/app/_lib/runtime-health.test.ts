import { describe, expect, it } from "vitest";

import { createMarketingHealthResponse } from "./runtime-health";

describe("Marketing deployment health", () => {
  it("returns the exact safe readiness contract for valid runtime config", async () => {
    const response = createMarketingHealthResponse({
      DEPLOYMENT_SHA: "c".repeat(40),
      VEYOCAST_ENVIRONMENT: "production"
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(await response.json()).toEqual({
      environment: "production",
      revision: "c".repeat(40),
      service: "marketing",
      status: "ok"
    });
  });

  it.each([
    ["missing environment", { DEPLOYMENT_SHA: "c".repeat(40) }],
    [
      "invalid revision",
      { DEPLOYMENT_SHA: "short", VEYOCAST_ENVIRONMENT: "staging" }
    ],
    [
      "invalid environment",
      {
        DEPLOYMENT_SHA: "c".repeat(40),
        VEYOCAST_ENVIRONMENT: "development"
      }
    ]
  ])("fails closed for %s", async (_reason, environment) => {
    const response = createMarketingHealthResponse(environment);

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      environment: "unknown",
      revision: "unknown",
      service: "marketing",
      status: "error"
    });
  });
});
