import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import { expect, test, type Page } from "@playwright/test";

const playerURL = `http://127.0.0.1:${process.env.PLAYER_PORT ?? 3106}`;
const deviceToken = "d".repeat(48);
const installationCredential = "i".repeat(48);
const legacyImagePath = "/__legacy-test/image.svg";
const legacyImageSvg =
  '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"><rect width="320" height="180" fill="#ff5a1f"/></svg>';
const legacyImageBytes = Buffer.byteLength(legacyImageSvg);
const legacyImageChecksum = createHash("sha256")
  .update(legacyImageSvg)
  .digest("hex");
const legacySecondImagePath = "/__legacy-test/image-second.svg";
const legacySecondImageSvg =
  '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"><rect width="320" height="180" fill="#175cd3"/></svg>';
const legacySecondImageBytes = Buffer.byteLength(legacySecondImageSvg);
const legacySecondImageChecksum = createHash("sha256")
  .update(legacySecondImageSvg)
  .digest("hex");
const legacyVideoPath = "/lg-probe/h264-baseline-aac.mp4";
const legacyVideoBytes = readFileSync(
  "apps/player/public/lg-probe/h264-baseline-aac.mp4"
);
const legacyVideoChecksum = createHash("sha256")
  .update(legacyVideoBytes)
  .digest("hex");

async function mockLegacyApis(
  page: Page,
  heartbeatBodies: Array<Record<string, unknown>> = [],
  manifestEtags: Array<string | undefined> = []
) {
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
  await page.route(`**${legacyImagePath}`, async (route) => {
    await route.fulfill({
      contentType: "image/svg+xml",
      body: legacyImageSvg
    });
  });
  await page.route("**/api/player/manifest?legacy=*", async (route) => {
    const etag = route.request().headers()["if-none-match"];
    manifestEtags.push(etag);
    if (etag === '"release-release-legacy"') {
      await route.fulfill({
        headers: { ETag: etag },
        status: 304
      });
      return;
    }
    await route.fulfill({
      contentType: "application/json",
      headers: { ETag: '"release-release-legacy"' },
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
          totalBytes: legacyImageBytes,
          items: [
            {
              id: "legacy-image",
              kind: "image",
              title: "Legacy testbeeld",
              durationSeconds: 5,
              fitMode: "contain",
              muted: true,
              source: {
                url: legacyImagePath,
                mimeType: "image/svg+xml",
                bytes: legacyImageBytes,
                checksumSha256: legacyImageChecksum
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
    heartbeatBodies.push(
      (route.request().postDataJSON() ?? {}) as Record<string, unknown>
    );
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ automation: null, ok: true })
    });
  });
  await page.route("**/api/player/commands", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        commands: [],
        ok: true,
        serverTime: new Date().toISOString()
      })
    });
  });
}

async function mockEditorialArenaLegacyApis(
  page: Page,
  orientation: "landscape" | "portrait" = "landscape"
) {
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
  await page.route(`**${legacyImagePath}`, async (route) => {
    await route.fulfill({
      contentType: "image/svg+xml",
      body: legacyImageSvg
    });
  });
  await page.route("**/api/player/manifest?legacy=*", async (route) => {
    const envelope = legacyEnvelope({
      bytes: legacyImageBytes,
      checksumSha256: legacyImageChecksum,
      id: "editorial-news",
      kind: "image",
      mimeType: "image/svg+xml",
      title: "Editorial Arena nieuws",
      url: legacyImagePath
    });
    Object.assign(envelope.manifest.items[0]!, {
      dynamicTemplate: {
        data: {
          data: {
            articles: [{
              author: "VeyoCast redactie",
              intro: "De volledige HTML/CSS-renderketen werkt ook op de legacy Player.",
              publishedAt: "2026-08-03T18:00:00.000Z",
              title: "Editorial Arena staat zichtbaar op LG"
            }],
            generatedAt: "2026-08-03T18:00:00.000Z",
            secondsPerSlide: 5,
            sourceName: "VeyoCast"
          },
          type: "news"
        },
        orientation,
        schemaVersion: 1,
        slideType: "news",
        snapshotHash: "b".repeat(64),
        snapshotId: "11111111-1111-4111-8111-111111111111",
        templateSlug: `editorial-arena-nieuws-dark-${orientation}`,
        templateVersionId: "22222222-2222-4222-8222-222222222222"
      }
    });
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(envelope)
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
      body: JSON.stringify({
        commands: [],
        ok: true,
        serverTime: new Date().toISOString()
      })
    });
  });
}

test("LG Legacy Player gebruikt een statische shell en lokale afbeelding", async ({
  page
}) => {
  const heartbeatBodies: Array<Record<string, unknown>> = [];
  const manifestEtags: Array<string | undefined> = [];
  const requestedUrls: string[] = [];
  page.on("request", (request) => requestedUrls.push(request.url()));
  await mockLegacyApis(page, heartbeatBodies, manifestEtags);
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
  await expect(image).toHaveAttribute("src", /^blob:/);
  await expect(page.locator("#status")).toBeHidden();
  await expect(page.locator("#watermark")).toHaveClass("visible");
  await expect(page.locator("#media-root > *")).toHaveCount(1);
  await expect.poll(() => heartbeatBodies.length).toBeGreaterThan(0);
  expect(heartbeatBodies.at(-1)).toMatchObject({
    runtimeState: "PLAYING",
    syncPhase: "active"
  });
  await expect
    .poll(() =>
      page.evaluate(
        async (cacheKey) =>
          Boolean(
            await (
              await caches.open("veyocast-player-assets-v1")
            ).match(cacheKey)
          ),
        `/__veyocast-player-cache/${legacyImageChecksum}`
      )
    )
    .toBe(true);
  await image.evaluate((element) => {
    element.setAttribute("data-playback-instance", "unchanged");
    window.dispatchEvent(new Event("online"));
  });
  await expect.poll(() => manifestEtags.at(-1)).toBe(
    '"release-release-legacy"'
  );
  await expect(image).toHaveAttribute("data-playback-instance", "unchanged");
  manifestEtags.length = 0;
  await page.reload();
  await expect(page.locator("#media-root > img")).toBeVisible();
  await expect.poll(() => manifestEtags[0]).toBe(
    '"release-release-legacy"'
  );
  expect(
    requestedUrls.filter((url) => url.endsWith(legacyImagePath))
  ).toHaveLength(1);
  expect(requestedUrls.some((url) => url.includes("/_next/"))).toBe(false);
});

test("LG webOS wordt zonder Next.js-chunks naar zichtbare Editorial Arena HTML/CSS geleid", async ({
  browser
}) => {
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Web0S; Linux/SmartTV) AppleWebKit/537.36 Chrome/79.0.3945.79 Safari/537.36"
  });
  const page = await context.newPage();
  const requestedUrls: string[] = [];
  page.on("request", (request) => requestedUrls.push(request.url()));
  await mockEditorialArenaLegacyApis(page);
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

  await page.goto(`${playerURL}/lg`);

  await expect(page).toHaveURL(/\/lg\/legacy$/);
  await expect(page.locator(".dynamic-template.editorial-arena")).toBeVisible();
  await expect(page.locator(".editorial-news")).toBeVisible();
  await expect(page.getByRole("heading", {
    name: "Editorial Arena staat zichtbaar op LG"
  })).toBeVisible();
  await expect(page.locator("#status")).toBeHidden();
  await expect(page.locator("#watermark")).toHaveClass("visible");
  expect(requestedUrls.some((url) => url.includes("/_next/"))).toBe(false);
  const diagnostics = await page.evaluate(() =>
    localStorage.getItem("veyocast.player.lgLegacyDiagnostics.v1")
  );
  expect(diagnostics).toContain("LEGACY_TEMPLATE_READY");
  expect(diagnostics).not.toContain("LEGACY_CLIENT_EXCEPTION");
  if (process.env.CAPTURE_EDITORIAL_ARENA === "1") {
    await page.waitForTimeout(1_400);
    await page.screenshot({
      path: "docs/screenshots/s91-editorial-arena-lg-legacy.png"
    });
  }

  await context.close();
});

test("LG Legacy schaalt ieder logisch portraitcanvas binnen een landscapeviewport", async ({
  browser
}) => {
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Web0S; Linux/SmartTV) AppleWebKit/537.36 Chrome/79.0.3945.79 Safari/537.36",
    viewport: { height: 1080, width: 1920 }
  });
  const page = await context.newPage();
  await mockEditorialArenaLegacyApis(page, "portrait");
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

  const slide = page.locator(".dynamic-template.editorial-arena");
  await expect(slide).toBeVisible();
  await expect(slide).toHaveAttribute("data-canvas-width", "1080");
  await expect(slide).toHaveAttribute("data-canvas-height", "1920");
  const slideBox = await slide.boundingBox();
  expect(slideBox).not.toBeNull();
  expect(slideBox!.x).toBeCloseTo(656.25, 1);
  expect(slideBox!.y).toBeCloseTo(0, 1);
  expect(slideBox!.width).toBeCloseTo(607.5, 1);
  expect(slideBox!.height).toBeCloseTo(1080, 1);
  const photoBox = await slide.locator(".editorial-news-art").boundingBox();
  expect(photoBox).not.toBeNull();
  expect(photoBox!.width / photoBox!.height).toBeCloseTo(16 / 9, 2);
  await expect(page.getByRole("heading", {
    name: "Editorial Arena staat zichtbaar op LG"
  })).toBeVisible();

  await context.close();
});

test("LG Legacy Player downloadt en speelt video vanuit één lokale Blob", async ({
  page
}) => {
  const requestedUrls: string[] = [];
  page.on("request", (request) => requestedUrls.push(request.url()));
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
      body: JSON.stringify(
        legacyEnvelope({
          bytes: legacyVideoBytes.byteLength,
          checksumSha256: legacyVideoChecksum,
          id: "legacy-video",
          kind: "video",
          mimeType: "video/mp4",
          title: "Lokale Legacy-video",
          url: legacyVideoPath
        })
      )
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
      body: JSON.stringify({
        commands: [],
        ok: true,
        serverTime: new Date().toISOString()
      })
    });
  });
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

  const video = page.locator("#media-root > video");
  await expect(video).toBeVisible();
  await expect(video).toHaveAttribute("src", /^blob:/);
  await expect
    .poll(() => video.evaluate((element) => !element.paused))
    .toBe(true);
  await expect
    .poll(() =>
      page.evaluate(
        async (cacheKey) =>
          Boolean(
            await (
              await caches.open("veyocast-player-assets-v1")
            ).match(cacheKey)
          ),
        `/__veyocast-player-cache/${legacyVideoChecksum}`
      )
    )
    .toBe(true);
  expect(
    requestedUrls.filter((url) => url.endsWith(legacyVideoPath))
  ).toHaveLength(1);
});

test("LG Legacy Player houdt het oude beeld zichtbaar tot de nieuwe lokale release klaar is", async ({
  page
}) => {
  let desiredRelease = "release-first";
  const requestedUrls: string[] = [];
  page.on("request", (request) => requestedUrls.push(request.url()));
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
  await page.route(`**${legacyImagePath}`, async (route) => {
    await route.fulfill({
      contentType: "image/svg+xml",
      body: legacyImageSvg
    });
  });
  await page.route(`**${legacySecondImagePath}`, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 350));
    await route.fulfill({
      contentType: "image/svg+xml",
      body: legacySecondImageSvg
    });
  });
  await page.route("**/api/player/manifest?legacy=*", async (route) => {
    const etag = `"release-${desiredRelease}"`;
    if (route.request().headers()["if-none-match"] === etag) {
      await route.fulfill({ headers: { ETag: etag }, status: 304 });
      return;
    }
    const second = desiredRelease === "release-second";
    await route.fulfill({
      contentType: "application/json",
      headers: { ETag: etag },
      body: JSON.stringify(
        imageReleaseEnvelope({
          activeReleaseId: second ? "release-first" : desiredRelease,
          bytes: second ? legacySecondImageBytes : legacyImageBytes,
          checksumSha256: second
            ? legacySecondImageChecksum
            : legacyImageChecksum,
          path: second ? legacySecondImagePath : legacyImagePath,
          releaseId: desiredRelease
        })
      )
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
      body: JSON.stringify({
        commands: [],
        ok: true,
        serverTime: new Date().toISOString()
      })
    });
  });
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
  const firstImage = page.locator("#media-root > img");
  await expect(firstImage).toBeVisible();
  await firstImage.evaluate((element) => {
    element.setAttribute("data-release", "first");
  });
  desiredRelease = "release-second";

  const uninterrupted = await page.evaluate(async () => {
    let visibleAtEverySample = true;
    const endAt = Date.now() + 2_500;
    window.dispatchEvent(new Event("online"));
    while (Date.now() < endAt) {
      const hasVisibleMedia = Array.from(
        document.querySelectorAll("#media-root > .legacy-media-layer")
      ).some((element) => {
        const style = window.getComputedStyle(element);
        return (
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          Number(style.opacity) > 0.01
        );
      });
      if (!hasVisibleMedia) visibleAtEverySample = false;
      await new Promise((resolve) => window.setTimeout(resolve, 16));
    }
    return visibleAtEverySample;
  });

  expect(uninterrupted).toBe(true);
  await expect(page.locator('[data-release="first"]')).toHaveCount(0);
  await expect(page.locator("#media-root > img")).toBeVisible();
  expect(
    requestedUrls.filter((url) => url.endsWith(legacySecondImagePath))
  ).toHaveLength(1);
});

test("LG Legacy Player herstelt een lokaal verwijderde schermcredential uit de actieve release", async ({
  page
}) => {
  const installationAuthorizations: Array<string | undefined> = [];
  let pairingRequests = 0;
  const envelope = cachedImageEnvelope("credential-recovery-image");

  await page.route("**/api/player/installation", async (route) => {
    installationAuthorizations.push(
      route.request().headers()["authorization"]
    );
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        bound: true,
        installationCredential,
        ok: true
      })
    });
  });
  await page.route("**/api/player/pairing", async (route) => {
    pairingRequests += 1;
    await route.fulfill({ status: 429 });
  });
  await page.route(`**${legacyImagePath}`, async (route) => {
    await route.fulfill({
      contentType: "image/svg+xml",
      body: legacyImageSvg
    });
  });
  await page.route("**/api/player/manifest?legacy=*", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(envelope)
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
      body: JSON.stringify({
        commands: [],
        ok: true,
        serverTime: new Date().toISOString()
      })
    });
  });

  await page.goto(`${playerURL}/healthz`);
  await page.evaluate(
    async ({ credential, release, token }) => {
      localStorage.setItem(
        "veyocast.player.installationCredential",
        credential
      );
      localStorage.setItem(
        "veyocast.player.instanceId",
        "12345678-1234-4123-8123-123456789abc"
      );
      localStorage.removeItem("veyocast.player.deviceToken");
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
          envelope: release
        });
        transaction.onerror = () => reject(transaction.error);
        transaction.oncomplete = () => resolve();
      });
      database.close();
    },
    {
      credential: installationCredential,
      release: envelope,
      token: deviceToken
    }
  );

  await page.goto(`${playerURL}/lg/legacy`);

  await expect(page.locator("#media-root > img")).toBeVisible();
  await expect.poll(() => installationAuthorizations.at(-1)).toBe(
    `Bearer ${deviceToken}`
  );
  await expect
    .poll(() =>
      page.evaluate(() =>
        localStorage.getItem("veyocast.player.deviceToken")
      )
    )
    .toBe(deviceToken);
  expect(pairingRequests).toBe(0);
});

test("LG Legacy Player voltooit remote recovery ondanks een twee uur voorlopende tv-klok", async ({
  page
}) => {
  const recoveredDeviceToken = "r".repeat(48);
  const phases: string[] = [];
  const serverNow = Date.now() - 2 * 60 * 60 * 1_000;
  const commandId = "33333333-3333-4333-8333-333333333333";
  const commandNonce = "44444444-4444-4444-8444-444444444444";
  let completed = false;

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
        device: {
          activeReleaseId: null,
          desiredReleaseId: null,
          id: "device-clock-skew",
          screenId: "screen-clock-skew",
          screenName: "LG kloktest"
        },
        state: "READY"
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
    if (route.request().method() === "GET") {
      const expiresAt = new Date(serverNow + 15 * 60 * 1_000)
        .toISOString()
        .replace(/(\.\d{3})Z$/, "$1000+00:00");
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          commands: completed
            ? []
            : [{
                commandType: "RECOVER_PAIRING",
                createdAt: new Date(serverNow).toISOString(),
                expiresAt,
                id: commandId,
                nonce: commandNonce,
                payload: {}
              }],
          ok: true,
          serverTime: new Date(serverNow).toISOString()
        })
      });
      return;
    }

    const requestBody = route.request().postDataJSON() as {
      phase?: string;
    };
    phases.push(requestBody.phase ?? "missing");
    if (requestBody.phase === "completed") completed = true;
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ...(requestBody.phase === "completed"
          ? {
              commandType: "RECOVER_PAIRING",
              deviceToken: recoveredDeviceToken
            }
          : {}),
        ok: true
      })
    });
  });
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

  await expect
    .poll(() => phases, { timeout: 15_000 })
    .toEqual(["acknowledged", "completed"]);
  await expect
    .poll(() =>
      page.evaluate(() =>
        localStorage.getItem("veyocast.player.deviceToken")
      )
    )
    .toBe(recoveredDeviceToken);
  await expect(page.getByRole("heading", { name: "Wachten op content" }))
    .toBeVisible();
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

test("LG Legacy Player roteert een geldige code niet door een voorlopende TV-klok", async ({
  page
}) => {
  let pairingRequests = 0;
  let heartbeatRequests = 0;
  const requestNonces: string[] = [];

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
    pairingRequests += 1;
    requestNonces.push(
      route.request().headers()["x-veyocast-pairing-request"] ?? ""
    );
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        deviceToken,
        expiresAt: new Date(Date.now() - 2 * 60 * 60 * 1_000).toISOString(),
        pairingCode: "CLK 748"
      })
    });
  });
  await page.route("**/api/player/heartbeat", async (route) => {
    heartbeatRequests += 1;
    await route.fulfill({
      status: 409,
      contentType: "application/json",
      body: JSON.stringify({
        error: {
          cause: "Koppelcode is nog niet geclaimd.",
          code: "PAIRING_PENDING"
        },
        ok: false
      })
    });
  });
  await page.route("**/api/player/commands", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        commands: [],
        ok: true,
        serverTime: new Date().toISOString()
      })
    });
  });

  await page.goto(`${playerURL}/lg/legacy`);

  await expect(page.locator("#pairing-code")).toHaveText("CLK 748");
  await expect
    .poll(() => heartbeatRequests, { timeout: 8_000 })
    .toBeGreaterThanOrEqual(2);
  await page.waitForTimeout(1_500);
  expect(pairingRequests).toBe(1);
  expect(requestNonces).toHaveLength(1);
  expect(requestNonces[0]).toMatch(/^[a-f0-9-]{20,80}$/);
  await expect(page.locator("#pairing-code")).toHaveText("CLK 748");
  await expect(page.getByText("PAIRING_RATE_LIMITED")).toHaveCount(0);
});

function cachedImageEnvelope(itemId: string) {
  return legacyEnvelope({
    bytes: legacyImageBytes,
    checksumSha256: legacyImageChecksum,
    id: itemId,
    kind: "image",
    mimeType: "image/svg+xml",
    title: "Legacy herstelbeeld",
    url: legacyImagePath
  });
}

function legacyEnvelope(item: {
  bytes: number;
  checksumSha256: string;
  id: string;
  kind: "image" | "video";
  mimeType: string;
  title: string;
  url: string;
}) {
  return {
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
      label: "Legacy herstelbewijs",
      manifestHash: "a".repeat(64),
      publishedAt: new Date().toISOString(),
      totalDurationSeconds: 5,
      totalBytes: item.bytes,
      items: [
        {
          id: item.id,
          kind: item.kind,
          title: item.title,
          durationSeconds: 5,
          fitMode: "contain",
          muted: true,
          source: {
            url: item.url,
            mimeType: item.mimeType,
            bytes: item.bytes,
            checksumSha256: item.checksumSha256
          }
        }
      ]
    },
    diagnostics: {
      syncStatus: "online",
      lastSuccessfulSyncAt: new Date().toISOString(),
      nextSyncReason: "test"
    }
  };
}

function imageReleaseEnvelope({
  activeReleaseId,
  bytes,
  checksumSha256,
  path,
  releaseId
}: {
  activeReleaseId: string;
  bytes: number;
  checksumSha256: string;
  path: string;
  releaseId: string;
}) {
  const envelope = legacyEnvelope({
    bytes,
    checksumSha256,
    id: `${releaseId}-image`,
    kind: "image",
    mimeType: "image/svg+xml",
    title: releaseId,
    url: path
  });
  envelope.device.activeReleaseId = activeReleaseId;
  envelope.device.desiredReleaseId = releaseId;
  envelope.manifest.releaseId = releaseId;
  envelope.manifest.manifestHash = checksumSha256;
  envelope.manifest.items[0]!.durationSeconds = 1;
  return envelope;
}

test("LG Legacy Player herstelt een reeds geverifieerde last-known-good release", async ({
  page
}) => {
  const checksum = legacyImageChecksum;
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
    async ({ cacheBytes, cacheChecksum, cachedImage, credential, token }) => {
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
          totalBytes: cacheBytes,
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
                bytes: cacheBytes,
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
          assets: [{
            bytes: cacheBytes,
            cacheKey: `/__veyocast-player-cache/${cacheChecksum}`,
            checksumSha256: cacheChecksum,
            itemId: "offline-image",
            kind: "media",
            url: "https://expired.invalid/offline.svg"
          }],
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
          cachedImage,
          {
            headers: {
              "Accept-Ranges": "bytes",
              "Content-Length": String(cacheBytes),
              "Content-Type": "image/svg+xml"
            }
          }
        )
      );
    },
    {
      cacheBytes: legacyImageBytes,
      cacheChecksum: checksum,
      cachedImage: legacyImageSvg,
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
