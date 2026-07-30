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
    document.documentElement.setAttribute(
      "data-veyocast-player-runtime-state",
      "RECOVERY_TEST"
    );
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
  await expect(fallback).toContainText("RECOVERY_TEST");
  await expect(
    fallback.getByRole("button", { name: "Opnieuw proberen" })
  ).toBeVisible();
  await expect(
    fallback.getByRole("link", { name: "Player herstellen" })
  ).toHaveAttribute("href", "/lg/recover");
  await expect(page.getByText("Application error")).toHaveCount(0);
  await expect(page.locator("#veyocast-client-fallback-guard")).toHaveCount(1);
  await expect(page.getByText("Klaar om te koppelen")).toHaveCount(1);
  await expect
    .poll(() =>
      page.evaluate(() => {
        const entries = JSON.parse(
          localStorage.getItem(
            "veyocast.player.transportDiagnostics.v1"
          ) ?? "[]"
        ) as Array<{
          code?: string;
          playerState?: string;
          stage?: string;
        }>;
        return entries.find(
          (entry) => entry.code === "PLAYER_RUNTIME_ERROR"
        );
      })
    )
    .toMatchObject({
      code: "PLAYER_RUNTIME_ERROR",
      playerState: "RECOVERY_TEST",
      stage: "runtime-mounted"
    });
});

test("een lokale mediafout blijft in de playback-recovery en vernietigt de app niet", async ({
  page
}) => {
  await page.goto(`${playerURL}/lg`);

  await page.evaluate(() => {
    const video = document.createElement("video");
    document.body.appendChild(video);
    video.dispatchEvent(
      new ErrorEvent("error", {
        bubbles: true,
        error: new Error("synthetic media decode failure"),
        message: "synthetic media decode failure"
      })
    );
    video.remove();
  });

  await expect(page.locator("#veyocast-client-fallback")).toHaveCount(0);
  await expect(page.getByText("Klaar om te koppelen")).toBeVisible();
});
