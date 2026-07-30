import { expect, test } from "@playwright/test";

const playerURL = `http://127.0.0.1:${process.env.PLAYER_PORT ?? 3106}`;

test("een enkele OK opent herstel niet, maar de veilige toetsreeks wel", async ({
  page
}) => {
  await page.goto(`${playerURL}/lg`);
  await expect(page.getByRole("main")).toBeVisible();

  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("dialog", { name: "VeyoCast Player herstellen" })
  ).toHaveCount(0);

  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");
  await page.evaluate(() => {
    window.dispatchEvent(
      new KeyboardEvent("keydown", {
        bubbles: true,
        key: "BrowserBack",
        keyCode: 461
      })
    );
    window.dispatchEvent(
      new KeyboardEvent("keyup", {
        bubbles: true,
        key: "BrowserBack",
        keyCode: 461
      })
    );
  });
  await page.keyboard.press("Enter");

  const dialog = page.getByRole("dialog", {
    name: "VeyoCast Player herstellen"
  });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Opnieuw proberen" }))
    .toBeFocused();
  await expect(dialog).toContainText("Netwerkstatus");
  await expect(dialog).toContainText("Installatie-ID");
  await expect(dialog).toContainText("Player-versie");
  await expect(dialog).toContainText("Laatste foutcode");

  await dialog.getByRole("button", { name: "Opnieuw proberen" }).click();
  await expect(dialog).toHaveCount(0);
});

test("onverwachte clientfout toont de lokale VeyoCast-fallback", async ({
  page
}) => {
  await page.goto(`${playerURL}/lg`);
  await page.evaluate(() => {
    window.dispatchEvent(
      new ErrorEvent("error", {
        error: new Error("synthetic client crash"),
        message: "synthetic client crash"
      })
    );
  });

  const fallback = page.locator("#veyocast-client-fallback");
  await expect(fallback).toBeVisible();
  await expect(fallback).toContainText("PLAYER_CLIENT_EXCEPTION");
  await expect(fallback).toContainText("PLAYER_RUNTIME_ERROR");
  await expect(fallback).toContainText("runtime-mounted");
  await expect(
    fallback.getByRole("button", { name: "Opnieuw proberen" })
  ).toBeVisible();
  await expect(
    fallback.getByRole("link", { name: "Player herstellen" })
  ).toHaveAttribute("href", "/lg/recover");
  await expect(page.getByText("Application error")).toHaveCount(0);
  await expect
    .poll(() =>
      page.evaluate(() => {
        const entries = JSON.parse(
          localStorage.getItem(
            "veyocast.player.transportDiagnostics.v1"
          ) ?? "[]"
        ) as Array<{ code?: string; stage?: string }>;
        return entries[0];
      })
    )
    .toMatchObject({
      code: "PLAYER_RUNTIME_ERROR",
      stage: "runtime-mounted"
    });
});
