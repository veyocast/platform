import { devices, expect, test } from "@playwright/test";

const playerURL = `http://127.0.0.1:${process.env.PLAYER_PORT ?? 3106}`;

test("offers the native PWA install flow in an Android browser", async ({ browser }) => {
  const context = await browser.newContext({ ...devices["Pixel 7"] });
  const page = await context.newPage();

  try {
    await page.goto(playerURL);
    await expect(page.getByText("Installeer de Player", { exact: true })).toBeVisible();
    await expect(page.getByText("Toevoegen aan startscherm", { exact: false })).toBeVisible();

    await page.evaluate(() => {
      const event = new Event("beforeinstallprompt", { cancelable: true });
      Object.defineProperties(event, {
        prompt: {
          value: async () => {
            (window as typeof window & { playerInstallPromptCalled?: boolean })
              .playerInstallPromptCalled = true;
          }
        },
        userChoice: {
          value: Promise.resolve({ outcome: "accepted", platform: "web" })
        }
      });
      window.dispatchEvent(event);
    });

    const installButton = page.getByRole("button", { name: "Player installeren" });
    await expect(installButton).toBeVisible();
    await installButton.click();

    await expect
      .poll(() =>
        page.evaluate(
          () =>
            Boolean(
              (window as typeof window & { playerInstallPromptCalled?: boolean })
                .playerInstallPromptCalled
            )
        )
      )
      .toBe(true);
    await expect(page.getByText("Installeer de Player", { exact: true })).toHaveCount(0);
    await page.reload();
    await expect(page.getByText("Installeer de Player", { exact: true })).toHaveCount(0);
  } finally {
    await context.close();
  }
});

test("does not offer Android installation in a desktop browser", async ({ page }) => {
  await page.goto(playerURL);
  await expect(page.getByText("Installeer de Player", { exact: true })).toHaveCount(0);
});
