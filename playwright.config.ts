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
const controlOnly = process.env.PLAYWRIGHT_CONTROL_ONLY === "1";
const externalServers = process.env.PLAYWRIGHT_EXTERNAL_SERVERS === "1";

const controlWebServer = {
  command: `pnpm --filter @veyocast/control exec next dev --port ${controlPort} --hostname 127.0.0.1`,
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
  // Three Next.js applications share this bounded CI host. A single browser
  // worker keeps lazy route compilation below Next.js' restart threshold and
  // makes the cross-app release gate deterministic. Individual tests still
  // exercise concurrency explicitly with multiple pages/contexts where needed.
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
    : controlOnly
      ? [controlWebServer]
      : [
          controlWebServer,
          {
            command: `pnpm --filter @veyocast/marketing exec next dev --port ${marketingPort} --hostname 127.0.0.1`,
            env: {
              VEYOCAST_SETUP_INTENT_SIGNING_SECRET:
                process.env.VEYOCAST_SETUP_INTENT_SIGNING_SECRET ??
                "veyocast-test-only-setup-intent-secret-2026"
            },
            reuseExistingServer: !process.env.CI && !mutatingPlaywrightRun,
            timeout: 180_000,
            url: marketingURL
          },
          {
            command: `pnpm --filter @veyocast/player exec next dev --port ${playerPort} --hostname 127.0.0.1`,
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
          }
        ]
});
