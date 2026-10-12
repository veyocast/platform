import { defineConfig, devices } from "@playwright/test";

import {
  assertMutatingPlaywrightUsesLocalSupabase,
  isMutatingPlaywrightRun
} from "./tests/helpers/supabase-environment-guard";

assertMutatingPlaywrightUsesLocalSupabase(process.env);
const mutatingPlaywrightRun = isMutatingPlaywrightRun(process.env);

const controlPort = Number(process.env.CONTROL_PORT ?? 3103);
const marketingPort = Number(process.env.MARKETING_PORT ?? 3108);
const playerPort = Number(process.env.PLAYER_PORT ?? 3106);
const baseURL = `http://127.0.0.1:${controlPort}`;
const marketingURL = `http://127.0.0.1:${marketingPort}`;
const playerURL = `http://127.0.0.1:${playerPort}`;
const selectedApps = process.env.PLAYWRIGHT_APPS?.split(",").filter(Boolean)
  ?? (process.env.PLAYWRIGHT_CONTROL_ONLY === "1" ? ["control"] : ["control", "marketing", "player"]);
if (!selectedApps.length || selectedApps.some(app => !["control", "marketing", "player"].includes(app))) {
  throw new Error("PLAYWRIGHT_APPS must name control, marketing or player.");
}
const externalServers = process.env.PLAYWRIGHT_EXTERNAL_SERVERS === "1";
const serverMode = process.env.PLAYWRIGHT_PRODUCTION_SERVERS === "1" ? "start" : "dev";
const controlServerMode = process.env.PLAYWRIGHT_CONTROL_PRODUCTION_SERVER === "1" ? "start" : serverMode;
const controlCompiler = controlServerMode === "dev" && process.env.PLAYWRIGHT_TURBOPACK === "1" ? " --turbopack" : "";
const playerCompiler = serverMode === "dev" && process.env.PLAYWRIGHT_TURBOPACK === "1" ? " --turbopack" : "";

const controlWebServer = {
  command: `pnpm --filter @veyocast/control exec next ${controlServerMode}${controlCompiler} --port ${controlPort} --hostname 127.0.0.1`,
  env: {
    ENGAGE_ABUSE_SIGNING_SECRET:
      process.env.ENGAGE_ABUSE_SIGNING_SECRET ??
      "veyocast-test-only-engage-abuse-signing-secret-2026",
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL ?? baseURL
  },
  reuseExistingServer: !process.env.CI && !mutatingPlaywrightRun,
  timeout: 180_000,
  url: `${baseURL}/login`
};

export default defineConfig({
  expect: {
    timeout: 5_000
  },
  fullyParallel: true,
  // CI runs application suites sequentially; only the short cross-app gate
  // starts all three servers. Tests still exercise concurrent browser contexts.
  workers: Number(process.env.PLAYWRIGHT_WORKERS ?? "1"),
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    }
  ],
  reporter: [["list"]],
  testDir: "./tests",
  testIgnore: ["**/helpers/**"],
  timeout: 30_000,
  use: {
    baseURL,
    trace: "retain-on-failure"
  },
  webServer: externalServers
    ? undefined
    : [
          ...(selectedApps.includes("control") ? [controlWebServer] : []),
          ...(selectedApps.includes("marketing") ? [{
            command: `pnpm --filter @veyocast/marketing exec next ${serverMode} --port ${marketingPort} --hostname 127.0.0.1`,
            env: {
              VEYOCAST_SETUP_INTENT_SIGNING_SECRET:
                process.env.VEYOCAST_SETUP_INTENT_SIGNING_SECRET ??
                "veyocast-test-only-setup-intent-secret-2026"
            },
            reuseExistingServer: !process.env.CI && !mutatingPlaywrightRun,
            timeout: 180_000,
            url: marketingURL
          }] : []),
          ...(selectedApps.includes("player") ? [{
            command: `pnpm --filter @veyocast/player exec next ${serverMode}${playerCompiler} --port ${playerPort} --hostname 127.0.0.1`,
            env: {
              DEVICE_LAB_ACCESS_TOKEN:
                process.env.DEVICE_LAB_ACCESS_TOKEN ??
                "veyocast-device-lab-test-token-2026",
              DEVICE_LAB_SESSION_SECRET:
                process.env.DEVICE_LAB_SESSION_SECRET ??
                "veyocast-device-lab-session-secret-for-tests-2026",
              VEYOCAST_ENVIRONMENT:
                process.env.VEYOCAST_ENVIRONMENT ?? "staging"
            },
            reuseExistingServer: !process.env.CI && !mutatingPlaywrightRun,
            timeout: 180_000,
            url: playerURL
          }] : [])
        ]
});
