import { expect, test, type Page } from "@playwright/test";

const playerURL = `http://127.0.0.1:${process.env.PLAYER_PORT ?? 3106}`;
const deviceToken = "d".repeat(48);
const installationCredential = "i".repeat(48);

async function mockLegacyApis(page: Page) {
  await page.route("**/api/player/installation", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        bound: true,
        installationCredential,
        ok: true
      })
    });
  });
  await page.route("**/api/player/manifest?legacy=*", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        state: "PLAYING",
        fetchedAt: new Date().toISOString(),
        device: {
          id: "device-legacy",
          screenId: "screen-legacy",
          screenName: "LG Legacy",
          activeReleaseId: "release-legacy",
          desiredReleaseId: "release-legacy"
        },
        manifest: {
          schemaVersion: 1,
          tenantId: "tenant-legacy",
          playlistId: "playlist-legacy",
          releaseId: "release-legacy",
          version: 1,
          label: "Legacy bewijs",
          manifestHash: "a".repeat(64),
          publishedAt: new Date().toISOString(),
          totalDurationSeconds: 5,
          totalBytes: 1,
          items: [
            {
              id: "legacy-image",
              kind: "image",
              title: "Legacy testbeeld",
              durationSeconds: 5,
              fitMode: "contain",
              muted: true,
              source: {
                url: "/player-demo/clubhuis-entree.svg",
                mimeType: "image/svg+xml",
                bytes: 1,
                checksumSha256: "b".repeat(64)
              }
            }
          ]
        },
        diagnostics: {
          syncStatus: "online",
          lastSuccessfulSyncAt: new Date().toISOString(),
          nextSyncReason: "test"
        }
      })
    });
  });
  await page.route("**/api/player/heartbeat", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ automation: null, ok: true })
    });
  });
  await page.route("**/api/player/commands", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ commands: [], ok: true })
    });
  });
}

test("LG Legacy Player gebruikt statische shell en precies één media-element", async ({
  page
}) => {
  const requestedUrls: string[] = [];
  page.on("request", (request) => requestedUrls.push(request.url()));
  await mockLegacyApis(page);
  await page.addInitScript(
    ({ credential, token }) => {
      localStorage.setItem("veyocast.player.deviceToken", token);
      localStorage.setItem(
        "veyocast.player.installationCredential",
        credential
      );
      localStorage.setItem(
        "veyocast.player.instanceId",
        "12345678-1234-4123-8123-123456789abc"
      );
    },
    { credential: installationCredential, token: deviceToken }
  );

  await page.goto(`${playerURL}/lg/legacy`);

  const image = page.locator("#media-root > img");
  await expect(image).toBeVisible();
  await expect(image).toHaveAttribute(
    "src",
    "/player-demo/clubhuis-entree.svg"
  );
  await expect(page.locator("#status")).toBeHidden();
  await expect(page.locator("#watermark")).toHaveClass("visible");
  await expect(page.locator("#media-root > *")).toHaveCount(1);
  expect(requestedUrls.some((url) => url.includes("/_next/"))).toBe(false);
});

test("LG Legacy Player toont pairing zonder witte of horizontaal overlopende pagina", async ({
  page
}) => {
  await page.route("**/api/player/installation", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        bound: false,
        installationCredential,
        ok: true
      })
    });
  });
  await page.route("**/api/player/pairing", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        deviceToken,
        expiresAt: new Date(Date.now() + 600_000).toISOString(),
        pairingCode: "LGX 691"
      })
    });
  });
  await page.route("**/api/player/manifest?legacy=*", async (route) => {
    await route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({
        state: "UNPAIRED",
        error: {
          cause: "Koppelcode is nog niet geclaimd.",
          code: "PAIRING_PENDING",
          effect: "Wachten",
          recovery: "Claim de code."
        }
      })
    });
  });
  await page.setViewportSize({ width: 960, height: 540 });

  await page.goto(`${playerURL}/lg/legacy`);

  await expect(page.locator("#pairing-code")).toHaveText("LGX 691");
  await expect(page.getByRole("heading", { name: "Koppel dit scherm aan VeyoCast" })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth
    )
  ).toBe(false);
  await expect(page.locator("body")).toHaveCSS(
    "background-color",
    "rgb(5, 5, 5)"
  );
});

test("LG Legacy Player herstelt een reeds geverifieerde last-known-good release", async ({
  page
}) => {
  const checksum = "c".repeat(64);
  await page.route("**/api/player/installation", async (route) => {
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        error: { code: "INSTALLATION_API_UNAVAILABLE" },
        ok: false
      })
    });
  });
  await page.route("**/api/player/manifest?legacy=*", async (route) => {
    await route.abort("failed");
  });
  await page.route("**/api/player/heartbeat", async (route) => {
    await route.abort("failed");
  });
  await page.goto(`${playerURL}/healthz`);
  await page.evaluate(
    async ({ cacheChecksum, credential, token }) => {
      localStorage.setItem("veyocast.player.deviceToken", token);
      localStorage.setItem(
        "veyocast.player.installationCredential",
        credential
      );
      localStorage.setItem(
        "veyocast.player.instanceId",
        "12345678-1234-4123-8123-123456789abc"
      );
      const envelope = {
        state: "PLAYING",
        fetchedAt: new Date().toISOString(),
        device: {
          id: "device-offline",
          screenId: "screen-offline",
          screenName: "LG Offline",
          activeReleaseId: "release-offline",
          desiredReleaseId: "release-offline"
        },
        manifest: {
          schemaVersion: 1,
          tenantId: "tenant-offline",
          playlistId: "playlist-offline",
          releaseId: "release-offline",
          version: 1,
          label: "Last-known-good",
          manifestHash: "d".repeat(64),
          publishedAt: new Date().toISOString(),
          totalDurationSeconds: 5,
          totalBytes: 100,
          items: [
            {
              id: "offline-image",
              kind: "image",
              title: "Offline bewijs",
              durationSeconds: 5,
              fitMode: "contain",
              muted: true,
              source: {
                url: "https://expired.invalid/offline.svg",
                mimeType: "image/svg+xml",
                bytes: 100,
                checksumSha256: cacheChecksum
              }
            }
          ]
        },
        diagnostics: {
          syncStatus: "online",
          lastSuccessfulSyncAt: new Date().toISOString(),
          nextSyncReason: "cached"
        }
      };
      const database = await new Promise<IDBDatabase>((resolve, reject) => {
        const open = indexedDB.open("veyocast-player-cache-v1", 2);
        open.onupgradeneeded = () => {
          if (!open.result.objectStoreNames.contains("activeReleases")) {
            open.result.createObjectStore("activeReleases", {
              keyPath: "deviceToken"
            });
          }
          if (!open.result.objectStoreNames.contains("previousReleases")) {
            open.result.createObjectStore("previousReleases", {
              keyPath: "deviceToken"
            });
          }
        };
        open.onerror = () => reject(open.error);
        open.onsuccess = () => resolve(open.result);
      });
      await new Promise<void>((resolve, reject) => {
        const transaction = database.transaction("activeReleases", "readwrite");
        transaction.objectStore("activeReleases").put({
          activatedAt: new Date().toISOString(),
          assets: [],
          deviceToken: token,
          envelope
        });
        transaction.onerror = () => reject(transaction.error);
        transaction.oncomplete = () => resolve();
      });
      database.close();
      const cache = await caches.open("veyocast-player-assets-v1");
      await cache.put(
        `/__veyocast-player-cache/${cacheChecksum}`,
        new Response(
          '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"><rect width="320" height="180" fill="#ff5a1f"/></svg>',
          { headers: { "Content-Type": "image/svg+xml" } }
        )
      );
    },
    {
      cacheChecksum: checksum,
      credential: installationCredential,
      token: deviceToken
    }
  );

  await page.goto(`${playerURL}/lg/legacy`);

  await expect(page.locator("#media-root > img")).toBeVisible();
  await expect(page.locator("#offline")).toHaveClass("visible");
  await expect(page.locator("#status")).toBeHidden();
  await expect(page.locator("#media-root > *")).toHaveCount(1);
});
