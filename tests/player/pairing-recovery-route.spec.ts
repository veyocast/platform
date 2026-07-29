import { expect, test, type Page } from "@playwright/test";

const installationKey = "veyocast.player.instanceId";
const installationCredentialKey =
  "veyocast.player.installationCredential";
const tokenKey = "veyocast.player.deviceToken";
const markerKey = "veyocast.player.recovery.v1";
const playerURL = `http://127.0.0.1:${process.env.PLAYER_PORT ?? 3106}`;
const recoveredInstallationCredential = "n".repeat(43);
const recoveredPendingToken = "z".repeat(43);

test.beforeEach(async ({ page }) => {
  await page.route("**/api/player/pairing/recover", async (route) => {
    await route.fulfill({
      body: JSON.stringify({
        cancelledPendingPairing: true,
        code: "RECOVERY_ACCEPTED",
        ok: true
      }),
      contentType: "application/json",
      status: 200
    });
  });
  await page.route("**/api/player/installation", async (route) => {
    await route.fulfill({
      body: JSON.stringify({
        bound: false,
        installationCredential: recoveredInstallationCredential,
        installationId: "52000000-0000-4000-8000-000000000153",
        live: true,
        ok: true
      }),
      contentType: "application/json",
      status: 200
    });
  });
  await page.route("**/api/player/pairing", async (route) => {
    await route.fulfill({
      body: JSON.stringify({
        deviceToken: recoveredPendingToken,
        expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
        live: true,
        pairingCode: "RCV 234"
      }),
      contentType: "application/json",
      status: 200
    });
  });
  await page.route("**/lg", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname !== "/lg") {
      await route.continue();
      return;
    }
    await route.fulfill({
      body: "<!doctype html><title>Player opnieuw geopend</title>",
      contentType: "text/html",
      status: 200
    });
  });
});

test("soft recovery behoudt installatie-ID en verwijdert een ongeldige pending pairing", async ({
  page
}) => {
  await page.route("**/api/player/manifest", async (route) => {
    await route.fulfill({
      body: JSON.stringify({
        error: {
          cause: "Credential ingetrokken",
          effect: "Pairing vereist",
          recovery: "Vraag een nieuwe code aan."
        },
        state: "UNPAIRED"
      }),
      contentType: "application/json",
      status: 401
    });
  });
  await page.goto(`${playerURL}/lg/recover`);
  const originalInstallationId = "12345678-1234-4123-8123-123456789abc";
  await seedRecoveryStorage(page, originalInstallationId);

  await page.getByRole("button", { name: "Nu herstellen" }).click();
  await page.waitForURL("**/lg");

  const result = await page.evaluate(
    ({ installationKey, markerKey, tokenKey }) => ({
      installationId: localStorage.getItem(installationKey),
      marker: JSON.parse(localStorage.getItem(markerKey) ?? "null") as {
        expiresAt?: number;
        mode?: string;
        pairingPrepared?: boolean;
      } | null,
      pairingCode: localStorage.getItem("veyocast.player.pairingCode"),
      token: localStorage.getItem(tokenKey)
    }),
    { installationKey, markerKey, tokenKey }
  );
  expect(result.installationId).toBe(originalInstallationId);
  expect(
    await page.evaluate(
      (key) => localStorage.getItem(key),
      installationCredentialKey
    )
  ).toBe(recoveredInstallationCredential);
  expect(result.token).toBe(recoveredPendingToken);
  expect(result.pairingCode).toBe("RCV 234");
  expect(result.marker?.mode).toBe("soft");
  expect(result.marker?.pairingPrepared).toBe(true);
  expect(result.marker?.expiresAt).toBeGreaterThan(Date.now());
});

test("soft recovery bewaart een geldige schermcredential", async ({ page }) => {
  await page.route("**/api/player/manifest", async (route) => {
    await route.fulfill({
      body: JSON.stringify({
        device: {
          activeReleaseId: null,
          desiredReleaseId: null,
          id: "device",
          screenId: "screen",
          screenName: "Kantine"
        },
        diagnostics: {
          lastSuccessfulSyncAt: new Date().toISOString(),
          nextSyncReason: "waiting for first release",
          syncStatus: "online"
        },
        fetchedAt: new Date().toISOString(),
        state: "READY"
      }),
      contentType: "application/json",
      status: 200
    });
  });
  await page.goto(`${playerURL}/lg/recover`);
  const originalInstallationId = "22345678-1234-4123-8123-123456789abc";
  const validToken = "a".repeat(43);
  await page.evaluate(
    ({ installationKey, originalInstallationId, tokenKey, validToken }) => {
      localStorage.setItem(installationKey, originalInstallationId);
      localStorage.setItem(tokenKey, validToken);
      localStorage.setItem("veyocast.player.pairingCode", "ABC 234");
      localStorage.setItem(
        "veyocast.player.pairingExpiresAt",
        new Date(Date.now() + 60_000).toISOString()
      );
    },
    {
      installationKey,
      originalInstallationId,
      tokenKey,
      validToken
    }
  );

  await page.getByRole("button", { name: "Nu herstellen" }).click();
  await page.waitForURL("**/lg");

  await expect
    .poll(() => page.evaluate((key) => localStorage.getItem(key), tokenKey))
    .toBe(validToken);
  expect(await page.evaluate(() => localStorage.getItem("veyocast.player.pairingCode"))).toBeNull();
});

test("volledige playerreset vernieuwt de installatie-ID", async ({ page }) => {
  await page.goto(`${playerURL}/lg/recover`);
  const originalInstallationId = "32345678-1234-4123-8123-123456789abc";
  await page.evaluate(
    ({
      installationCredentialKey,
      installationKey,
      originalInstallationId
    }) => {
      localStorage.setItem(installationKey, originalInstallationId);
      localStorage.setItem(installationCredentialKey, "d".repeat(43));
    },
    {
      installationCredentialKey,
      installationKey,
      originalInstallationId
    }
  );
  page.once("dialog", (dialog) => dialog.accept());

  await page.getByRole("button", { name: "Volledige playerreset" }).click();
  await page.waitForURL("**/lg");

  const result = await page.evaluate(
    ({ installationKey, markerKey }) => ({
      installationId: localStorage.getItem(installationKey),
      marker: JSON.parse(localStorage.getItem(markerKey) ?? "null") as {
        mode?: string;
      } | null
    }),
    { installationKey, markerKey }
  );
  expect(result.installationId).not.toBe(originalInstallationId);
  expect(
    await page.evaluate(
      (key) => localStorage.getItem(key),
      installationCredentialKey
    )
  ).toBe(recoveredInstallationCredential);
  expect(
    await page.evaluate((key) => localStorage.getItem(key), tokenKey)
  ).toBe(recoveredPendingToken);
  expect(result.installationId).toMatch(/^[a-f0-9-]{20,80}$/);
  expect(result.marker?.mode).toBe("hard");
});

test("Cache API- en IndexedDB-fouten blokkeren de recoveryredirect niet", async ({
  page
}) => {
  await page.goto(`${playerURL}/lg/recover`);
  await page.evaluate(
    ({ installationKey }) => {
      localStorage.setItem(
        installationKey,
        "42345678-1234-4123-8123-123456789abc"
      );
      Object.defineProperty(window, "caches", {
        configurable: true,
        value: {
          keys: () => Promise.reject(new Error("cache unavailable"))
        }
      });
      Object.defineProperty(window, "indexedDB", {
        configurable: true,
        value: {
          deleteDatabase: () => {
            throw new Error("indexeddb unavailable");
          }
        }
      });
    },
    { installationKey }
  );

  await page.getByRole("button", { name: "Nu herstellen" }).click();
  await page.waitForURL("**/lg");

  const marker = await page.evaluate((key) => localStorage.getItem(key), markerKey);
  expect(JSON.parse(marker ?? "null")).toMatchObject({ mode: "soft", version: 1 });
});

test("tijdelijke pairing-503 toont herstelactie en doet geen valse redirect", async ({
  page
}) => {
  await page.unroute("**/api/player/pairing");
  let pairingAttempts = 0;
  await page.route("**/api/player/pairing", async (route) => {
    pairingAttempts += 1;
    await route.fulfill({
      body: JSON.stringify({
        error: {
          cause: "Pairingservice tijdelijk niet beschikbaar",
          code: "PAIRING_API_UNAVAILABLE"
        }
      }),
      contentType: "application/json",
      status: 503
    });
  });
  await page.goto(`${playerURL}/lg/recover`);
  await page.evaluate(
    ({ installationCredentialKey, installationKey }) => {
      localStorage.setItem(
        installationKey,
        "52345678-1234-4123-8123-123456789abc"
      );
      localStorage.setItem(installationCredentialKey, "c".repeat(43));
    },
    { installationCredentialKey, installationKey }
  );

  await page.getByRole("button", { name: "Nu herstellen" }).click();
  await expect(page.locator("#step-4")).toHaveAttribute(
    "data-status",
    "warning",
    { timeout: 20_000 }
  );

  expect(pairingAttempts).toBe(4);
  expect(new URL(page.url()).pathname).toBe("/lg/recover");
  await expect(page.getByRole("button", { name: "Nu herstellen" })).toBeEnabled();
  await expect(page.locator("#summary")).toContainText(
    "PAIRING_API_UNAVAILABLE"
  );
  await expect(page.locator("#diagnostic-panel")).toHaveAttribute("open", "");
  await expect(page.locator("#diagnostic-log")).toContainText(
    "XHR | POST /api/player/pairing | HTTP 503"
  );
  expect(
    await page.evaluate((key) => localStorage.getItem(key), markerKey)
  ).toBeNull();
});

async function seedRecoveryStorage(page: Page, installationId: string) {
  await page.evaluate(
    async ({
      installationCredentialKey,
      installationId,
      installationKey,
      tokenKey
    }) => {
      localStorage.setItem(installationKey, installationId);
      localStorage.setItem(installationCredentialKey, "c".repeat(43));
      localStorage.setItem(tokenKey, "b".repeat(43));
      localStorage.setItem("veyocast.player.pairingCode", "ABC 234");
      localStorage.setItem(
        "veyocast.player.pairingExpiresAt",
        new Date(Date.now() + 60_000).toISOString()
      );
      localStorage.setItem(
        "veyocast.player.pairingProvisionAfter",
        String(Date.now() + 60_000)
      );
      const cache = await caches.open("veyocast-player-assets-v1");
      await cache.put(
        "/__veyocast-player-cache/test",
        new Response("cached media")
      );
      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.open("veyocast-player-cache-v1", 2);
        request.onupgradeneeded = () => {
          if (!request.result.objectStoreNames.contains("activeReleases")) {
            request.result.createObjectStore("activeReleases", {
              keyPath: "deviceToken"
            });
          }
          if (!request.result.objectStoreNames.contains("previousReleases")) {
            request.result.createObjectStore("previousReleases", {
              keyPath: "deviceToken"
            });
          }
        };
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          request.result.close();
          resolve();
        };
      });
    },
    {
      installationCredentialKey,
      installationId,
      installationKey,
      tokenKey
    }
  );
}
