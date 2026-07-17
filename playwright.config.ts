import { defineConfig, devices } from "@playwright/test";

const controlPort = Number(process.env.CONTROL_PORT ?? 3103);
const marketingPort = Number(process.env.MARKETING_PORT ?? 3108);
const playerPort = Number(process.env.PLAYER_PORT ?? 3106);
const baseURL = `http://127.0.0.1:${controlPort}`;
const marketingURL = `http://127.0.0.1:${marketingPort}`;
const playerURL = `http://127.0.0.1:${playerPort}`;
const controlOnly = process.env.PLAYWRIGHT_CONTROL_ONLY === "1";

const controlWebServer = {
  command: `pnpm --filter @castivo/control exec next dev --port ${controlPort} --hostname 127.0.0.1`,
  reuseExistingServer: !process.env.CI,
  timeout: 180_000,
  url: `${baseURL}/login`
};

export default defineConfig({
  expect: {
    timeout: 5_000
  },
  fullyParallel: true,
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    }
  ],
  reporter: [["list"]],
  testDir: "./tests",
  timeout: 30_000,
  use: {
    baseURL,
    trace: "retain-on-failure"
  },
  webServer: controlOnly
    ? [controlWebServer]
    : [
        controlWebServer,
        {
          command: `pnpm --filter @castivo/marketing exec next dev --port ${marketingPort} --hostname 127.0.0.1`,
          reuseExistingServer: !process.env.CI,
          timeout: 180_000,
          url: marketingURL
        },
        {
          command: `pnpm --filter @castivo/player exec next dev --port ${playerPort} --hostname 127.0.0.1`,
          reuseExistingServer: !process.env.CI,
          timeout: 180_000,
          url: playerURL
        }
      ]
});
