import { expect, test } from "@playwright/test";

import type { PlayerManifestEnvelope } from "../../apps/player/app/_lib/player-manifest";

const playerURL = `http://127.0.0.1:${process.env.PLAYER_PORT ?? 3106}`;

test("starts from last-known-good when manifest and media are unavailable", async ({
  page
}) => {
  await page.goto(`${playerURL}/?deviceToken=demo-online&durationMs=5000`);

  await expect(page.getByLabel("Release playback")).toBeVisible();
  await expect(page.getByLabel("Player diagnostics")).toContainText("PLAYING");
  await page.evaluate(async () => {
    if ("serviceWorker" in navigator) {
      await navigator.serviceWorker.ready;
    }
  });

  await page.evaluate(async () => {
    const previousBrand = String.fromCharCode(99, 97, 115, 116, 105, 118, 111);
    const currentDatabaseName = "veyocast-player-cache-v1";
    const previousDatabaseName = `${previousBrand}-player-cache-v1`;
    const currentCacheName = "veyocast-player-assets-v1";
    const previousCacheName = `${previousBrand}-player-assets-v1`;
    const currentPathPrefix = "/__veyocast-player-cache/";
    const previousPathPrefix = `/__${previousBrand}-player-cache/`;

    const openDatabase = (name: string, createStores = false) =>
      new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(name, 2);
        request.onupgradeneeded = () => {
          if (!createStores) return;
          for (const storeName of ["activeReleases", "previousReleases"]) {
            if (!request.result.objectStoreNames.contains(storeName)) {
              request.result.createObjectStore(storeName, { keyPath: "deviceToken" });
            }
          }
        };
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
      });
    const requestResult = <T>(request: IDBRequest<T>) =>
      new Promise<T>((resolve, reject) => {
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
      });
    const transactionDone = (transaction: IDBTransaction) =>
      new Promise<void>((resolve, reject) => {
        transaction.onerror = () => reject(transaction.error);
        transaction.oncomplete = () => resolve();
      });

    const currentDatabase = await openDatabase(currentDatabaseName);
    const currentTransaction = currentDatabase.transaction(
      "activeReleases",
      "readonly"
    );
    const release = await requestResult<Record<string, unknown> & {
      assets: Array<Record<string, unknown> & { cacheKey: string }>;
    }>(currentTransaction.objectStore("activeReleases").get("demo-online"));
    currentDatabase.close();

    const currentCache = await caches.open(currentCacheName);
    const previousCache = await caches.open(previousCacheName);
    const previousRelease = {
      ...release,
      assets: release.assets.map((asset) => ({
        ...asset,
        cacheKey: asset.cacheKey.replace(currentPathPrefix, previousPathPrefix)
      }))
    };
    for (let index = 0; index < release.assets.length; index += 1) {
      const response = await currentCache.match(release.assets[index]?.cacheKey ?? "");
      const previousKey = previousRelease.assets[index]?.cacheKey;
      if (!response || !previousKey) throw new Error("expected cached player asset");
      await previousCache.put(previousKey, response);
    }

    const previousDatabase = await openDatabase(previousDatabaseName, true);
    const previousTransaction = previousDatabase.transaction(
      "activeReleases",
      "readwrite"
    );
    previousTransaction.objectStore("activeReleases").put(previousRelease);
    await transactionDone(previousTransaction);
    previousDatabase.close();

    window.localStorage.setItem(
      `${previousBrand}.player.deviceToken`,
      "demo-online"
    );
    window.localStorage.removeItem("veyocast.player.deviceToken");
    await caches.delete(currentCacheName);
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase(currentDatabaseName);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  });

  await page.route("**/api/player/manifest**", (route) => route.abort());
  await page.route("**/player-demo/**", (route) => route.abort());
  await page.goto(`${playerURL}/?durationMs=5000`);

  await expect(page.getByLabel("Release playback")).toBeVisible();
  await expect(page.getByRole("img", { name: "Clubhuis entree" })).toBeVisible();
  await expect(page.getByLabel("Player diagnostics")).toContainText(
    "OFFLINE_PLAYING"
  );
  await expect(page.getByLabel("Player diagnostics")).toContainText("offline");
});

test("rejects corrupt pending assets without replacing active playback", async ({
  page
}) => {
  const manifestResponse = await page.request.get(
    `${playerURL}/api/player/manifest?deviceToken=demo-online`
  );
  const onlineManifest = (await manifestResponse.json()) as PlayerManifestEnvelope;

  await page.goto(`${playerURL}/?deviceToken=demo-online&durationMs=5000`);
  await expect(page.getByLabel("Player diagnostics")).toContainText("PLAYING");

  await page.route("**/api/player/manifest**", (route) => {
    const corruptManifest = {
      ...onlineManifest,
      manifest: {
        ...onlineManifest.manifest,
        label: "Corrupt pending release",
        manifestHash: "c".repeat(64),
        releaseId: "99999999-9999-4999-8999-999999999999",
        version: 4,
        items: onlineManifest.manifest.items.map((item, index) =>
          index === 0
            ? {
                ...item,
                source: {
                  ...item.source,
                  checksumSha256: "f".repeat(64)
                }
              }
            : item
        )
      }
    };

    return route.fulfill({
      body: JSON.stringify(corruptManifest),
      contentType: "application/json",
      status: 200
    });
  });

  await page.goto(`${playerURL}/?durationMs=5000`);

  await expect(page.getByRole("img", { name: "Clubhuis entree" })).toBeVisible();
  await expect(page.getByLabel("Player diagnostics")).toContainText(
    "Nieuwe inhoud kon niet worden voorbereid"
  );
  await expect(page.getByLabel("Player diagnostics")).toContainText("Zomerroute v3");
  await expect(page.getByLabel("Player diagnostics")).not.toContainText(
    "Corrupt pending release"
  );
});
