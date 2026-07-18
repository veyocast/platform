import { expect, test } from "@playwright/test";

const playerURL = `http://127.0.0.1:${process.env.PLAYER_PORT ?? 3106}`;
const accessToken = process.env.DEVICE_LAB_ACCESS_TOKEN ?? "castivo-device-lab-test-token-2026";

test("keeps the Device Lab hidden without a diagnostic session", async ({ page }) => {
  const response = await page.goto(`${playerURL}/device-lab`);
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "This page could not be found" })).toBeVisible();
});

test("exchanges a temporary token and removes it from the visible URL", async ({ page }) => {
  await page.goto(`${playerURL}/device-lab?token=${encodeURIComponent(accessToken)}`);

  await expect(page).toHaveURL(/\/device-lab$/);
  await expect(page.getByRole("heading", { name: "Device Capability Lab" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Browser-API feature detection" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Codecdetectie" })).toBeVisible();
  await expect(page.getByText("geen LG-certificatie")).toBeVisible();

  await page.getByLabel("LG-model (handmatig)").fill("Desktop Chromium test");
  await page.getByLabel("Firmware (handmatig)").fill("Playwright");
  await page.getByRole("button", { name: "Testrun opslaan" }).click();
  await expect(page.getByText(/Testrun lokaal(?: én centraal)? opgeslagen/)).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exporteer Markdown" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.md$/);
});

test("rejects result writes without the HttpOnly diagnostic session", async ({ request }) => {
  const response = await request.post(`${playerURL}/api/device-lab/runs`, {
    data: { capturedAt: new Date().toISOString(), runId: "forbidden-run" }
  });
  expect(response.status()).toBe(401);
});
