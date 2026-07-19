import { describe, expect, it } from "vitest";

import { getControlRuntimeMode } from "./config";

const liveConfig = {
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "public-anon-key",
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co"
};

describe("Control runtime mode", () => {
  it("uses live auth when the public Supabase configuration is complete", () => {
    expect(getControlRuntimeMode({ NODE_ENV: "production", ...liveConfig })).toBe("live");
  });

  it("allows demo auth only on an undeployed development server", () => {
    expect(getControlRuntimeMode({ NODE_ENV: "development" })).toBe("demo");
  });

  it.each([
    { NODE_ENV: "production" },
    { NODE_ENV: "test" },
    { NODE_ENV: "development", VEYOCAST_ENVIRONMENT: "staging" }
  ])("fails closed without config for $NODE_ENV", (environment) => {
    expect(getControlRuntimeMode(environment)).toBe("unavailable");
  });
});
