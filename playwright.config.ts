import { defineConfig, devices } from "@playwright/test";

const controlPort = Number(process.env.CONTROL_PORT ?? 3103);
const playerPort = Number(process.env.PLAYER_PORT ?? 3106);
const baseURL = `http://127.0.0.1:${controlPort}`;
const playerURL = `http://127.0.0.1:${playerPort}`;

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
  webServer: [
    {
      command: `pnpm --filter @castivo/control exec next dev --port ${controlPort} --hostname 127.0.0.1`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      url: `${baseURL}/login`
    },
    {
      command: `pnpm --filter @castivo/player exec next dev --port ${playerPort} --hostname 127.0.0.1`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      url: playerURL
    }
  ]
});
