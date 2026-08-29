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
              title: "Oos Kesbeke: een fijnproever ben ik niet, ik vind het lekker of niet"
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

async function mockEditorialStandingLegacyApis(page: Page) {
  const logoId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
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
      id: "editorial-standing",
      kind: "image",
      mimeType: "image/svg+xml",
      title: "Editorial Arena stand",
      url: legacyImagePath
    });
    Object.assign(envelope.manifest.items[0]!, {
      dynamicTemplate: {
        assets: {
          [logoId]: {
            bytes: legacyImageBytes,
            checksumSha256: legacyImageChecksum,
            mimeType: "image/svg+xml",
            url: legacyImagePath
          }
        },
        data: {
          brand: {
            clubName: "Duindorp sv",
            logoMediaAssetId: logoId,
            primaryColor: "#ff5a1f"
          },
          sport: {
            competition: { name: "Mannen KNVB beker amateurs" },
            items: ["CVC Reeuwijk 1", "Duindorp sv 1", "LSVV 70 1", "TAVV 1"]
              .map((teamName, index) => ({
                drawn: 0,
                form: [],
                goalDifference: 0,
                id: `standing-team-${index + 1}`,
                logoMediaAssetId: logoId,
                lost: 0,
                played: 0,
                points: 0,
                position: index + 1,
                selected: index === 1,
                teamName,
                won: 0
              })),
            pool: { name: "Poulefase 30" },
            season: "2026/2027",
            title: "Stand"
          },
          type: "sport_standing"
        },
        orientation: "portrait",
        schemaVersion: 1,
        slideType: "sport_standing",
        snapshotHash: "c".repeat(64),
        snapshotId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        templateSlug: "editorial-arena-competitiestand-dark-portrait",
        templateVersionId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
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

async function mockVisitorArrivalsLegacyApis(page: Page) {
  const awayLogoId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
  await page.route("**/api/player/installation", (route) => route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({ bound: true, installationCredential, ok: true })
  }));
  await page.route(`**${legacyImagePath}`, (route) => route.fulfill({
    contentType: "image/svg+xml",
    body: legacyImageSvg
  }));
  await page.route("**/api/player/manifest?legacy=*", (route) => {
    const envelope = legacyEnvelope({
      bytes: legacyImageBytes,
      checksumSha256: legacyImageChecksum,
      id: "visitor-arrivals",
      kind: "image",
      mimeType: "image/svg+xml",
      title: "Bezoekers welkom",
      url: legacyImagePath
    });
    Object.assign(envelope.manifest.items[0]!, {
      dynamicTemplate: {
        assets: {
          [awayLogoId]: {
            bytes: legacyImageBytes,
            checksumSha256: legacyImageChecksum,
            mimeType: "image/svg+xml",
            url: legacyImagePath
          }
        },
        data: {
          brand: { clubName: "Duindorp sv", primaryColor: "#ff5a1f" },
          sport: {
            arrivalConfig: { cardCount: 4, emptyBehavior: "skip", motionPreset: "auto" },
            items: [
              {
                homeMatch: true,
                id: "home-fixture",
                logoMediaAssetId: awayLogoId,
                meta: "Kleedkamer 2 · Veld 1",
                primary: "Bezoekers FC",
                secondary: "Aankomst 13:00 · Aanvang 14:30",
                status: "Welkom bij {{club}}"
              },
              {
                homeMatch: false,
                id: "away-fixture",
                logoMediaAssetId: awayLogoId,
                meta: "Uitwedstrijd",
                primary: "Duindorp sv 1",
                secondary: "Aanvang 15:00",
                status: "Welkom bij {{club}}"
              }
            ],
            pageDurationSeconds: 12,
            title: "Welkom op ons sportpark"
          },
          type: "sport_visitor_arrivals"
        },
        orientation: "landscape",
        schemaVersion: 1,
        slideType: "sport_visitor_arrivals",
        snapshotHash: "c".repeat(64),
        snapshotId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        templateSlug: "editorial-arena-bezoekers-aankomst-light-landscape",
        templateVersionId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
      }
    });
    return route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(envelope)
    });
  });
  await page.route("**/api/player/heartbeat", (route) => route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({ automation: null, ok: true })
  }));
  await page.route("**/api/player/commands", (route) => route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({ commands: [], ok: true, serverTime: new Date().toISOString() })
  }));
}

async function mockEditorialPriceListLegacyApis(page: Page) {
  const imageId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
  await page.route("**/api/player/installation", (route) => route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({ bound: true, installationCredential, ok: true })
  }));
  await page.route(`**${legacyImagePath}`, (route) => route.fulfill({
    contentType: "image/svg+xml",
    body: legacyImageSvg
  }));
  await page.route("**/api/player/manifest?legacy=*", (route) => {
    const envelope = legacyEnvelope({
      bytes: legacyImageBytes,
      checksumSha256: legacyImageChecksum,
      id: "editorial-price-list",
      kind: "image",
      mimeType: "image/svg+xml",
      title: "Editorial Arena prijslijst",
      url: legacyImagePath
    });
    Object.assign(envelope.manifest.items[0]!, {
      dynamicTemplate: {
        assets: {
          [imageId]: {
            bytes: legacyImageBytes,
            checksumSha256: legacyImageChecksum,
            mimeType: "image/svg+xml",
            url: legacyImagePath
          }
        },
        data: {
          brand: {
            clubName: "Duindorp sv",
            logoMediaAssetId: imageId,
            primaryColor: "#ff5a1f"
          },
          priceList: {
            sections: (["left", "right"] as const).map((column, columnIndex) => ({
              column,
              id: `legacy-${column}`,
              name: column === "left" ? "Dranken" : "Snacks",
              order: columnIndex,
              products: Array.from({ length: 8 }, (_, index) => ({
                description: "Clubprijs",
                formattedPrice: `€ ${index + 2},50`,
                id: `${column}-${index}`,
                imageMediaAssetId: index === 0 ? imageId : null,
                name: `${column === "left" ? "Drank" : "Snack"} ${index + 1}`,
                photoVisible: index !== 2
              }))
            })),
            title: "Prijslijst"
          },
          type: "price_list"
        },
        orientation: "portrait",
        schemaVersion: 1,
        slideType: "price_list",
        snapshotHash: "c".repeat(64),
        snapshotId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        templateSlug: "editorial-arena-prijslijst-dark-portrait",
        templateVersionId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
      }
    });
    return route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(envelope)
    });
  });
  await page.route("**/api/player/heartbeat", (route) => route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({ automation: null, ok: true })
  }));
  await page.route("**/api/player/commands", (route) => route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({ commands: [], ok: true, serverTime: new Date().toISOString() })
  }));
}

async function mockMenuStudioPortraitLegacyApis(page: Page, { loose = false } = {}) {
  await page.route("**/api/player/installation", (route) => route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({ bound: true, installationCredential, ok: true })
  }));
  await page.route(`**${legacyImagePath}`, (route) => route.fulfill({
    contentType: "image/svg+xml",
    body: legacyImageSvg
  }));
  await page.route("**/api/player/manifest?legacy=*", (route) => {
    const envelope = legacyEnvelope({
      bytes: legacyImageBytes,
      checksumSha256: legacyImageChecksum,
      id: "menu-studio-portrait",
      kind: "image",
      mimeType: "image/svg+xml",
      title: "Menu Studio portrait",
      url: legacyImagePath
    });
    Object.assign(envelope.manifest.items[0]!, {
      dynamicTemplate: {
        assets: {},
        data: {
          menuDocument: {
            schemaVersion: "menu-document.v2",
            title: "Nieuw menu",
            pages: [{
              id: "page-portrait",
              order: 0,
              blocks: [{
                ...(loose ? { flowAcrossColumns: true, headingVisible: false } : {}),
                id: "category-hardloper",
                layout: {
                  landscape: { h: 320, rotation: 0, w: 800, x: 1010, y: 248 },
                  portrait: { h: 420, rotation: 0, w: 936, x: 72, y: 348 }
                },
                labelOverride: "Hardloper, frisdrank",
                order: 0,
                productNodes: Array.from({ length: loose ? 8 : 3 }, (_, index) =>
                  loose && index === 1
                    ? {
                        display: { maxLines: 2 },
                        id: "product-group-cola",
                        kind: "product-group",
                        order: index,
                        pricePolicy: "shared",
                        secondaryLineItems: [
                          {
                            id: "group-line-regular",
                            kind: "linked-product",
                            snapshotFallback: {
                              available: true,
                              name: "Cola regular",
                              price: { amountMinor: 275, currency: "EUR" }
                            }
                          },
                          { id: "group-line-zero", kind: "free-text", label: "Cola zero" }
                        ],
                        sharedPrice: { amountMinor: 275, currency: "EUR" },
                        title: "Cola naar keuze"
                      }
                    : {
                        id: `product-aa-drink-${index}`,
                        kind: "product",
                        order: index,
                        snapshotFallback: {
                          available: true,
                          name: index === 0
                            ? "AA Drink"
                            : index === 1
                              ? "Chaudfontaine mineraalwater bruisend"
                              : index === 2
                                ? "Verse ambachtelijke vegetarische clubsandwich deluxe"
                                : `Product ${index + 1}`,
                          price: { amountMinor: 250 + index * 10, currency: "EUR" },
                          variantLabel: index === 0 ? "AA Drink · Naar keuze" : null
                        }
                      }
                ),
                source: { sourceName: "Hardloper, frisdrank" },
                type: "category"
              }]
            }]
          },
          themePresentation: {
            resolvedMode: { mode: "dark" },
            selection: {
              accent: "#30bced",
              ref: { catalog: "v2", id: "obsidian", version: "1.0.0" }
            }
          },
          type: "price_list"
        },
        orientation: "portrait",
        schemaVersion: 1,
        slideType: "price_list",
        snapshotHash: "d".repeat(64),
        snapshotId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
        templateSlug: "editorial-arena-prijslijst-dark-portrait",
        templateVersionId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
      }
    });
    return route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(envelope)
    });
  });
  await page.route("**/api/player/heartbeat", (route) => route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({ automation: null, ok: true })
  }));
  await page.route("**/api/player/commands", (route) => route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({ commands: [], ok: true, serverTime: new Date().toISOString() })
  }));
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
  await expect(page.getByText("Editorial Arena", { exact: true }))
    .toHaveCount(0);
  await expect(page.getByText("Actuele clubinformatie", { exact: true }))
    .toHaveCount(0);
  await expect(page.getByRole("heading", {
    name: "Oos Kesbeke: een fijnproever ben ik niet, ik vind het lekker of niet"
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
  await expect(slide).toHaveAttribute("data-viewport-fit", "contain");
  const slideBox = await slide.boundingBox();
  expect(slideBox).not.toBeNull();
  expect(slideBox!.x).toBeCloseTo(656.25, 1);
  expect(slideBox!.y).toBeCloseTo(0, 1);
  expect(slideBox!.width).toBeCloseTo(607.5, 1);
  expect(slideBox!.height).toBeCloseTo(1080, 1);
  const photoBox = await slide.locator(".editorial-news-art").boundingBox();
  expect(photoBox).not.toBeNull();
  expect(photoBox!.width / photoBox!.height).toBeCloseTo(16 / 9, 2);
  const story = slide.locator(".editorial-news-copy");
  await expect(story).toHaveCSS("justify-content", "flex-start");
  const headline = page.getByRole("heading", {
    name: "Oos Kesbeke: een fijnproever ben ik niet, ik vind het lekker of niet"
  });
  await expect(headline).toHaveClass("dense");
  const meta = slide.locator(".editorial-news-meta");
  const [storyBox, metaBox] = await Promise.all([
    story.boundingBox(),
    meta.boundingBox()
  ]);
  expect(storyBox).not.toBeNull();
  expect(metaBox).not.toBeNull();
  expect(storyBox!.y + storyBox!.height - (metaBox!.y + metaBox!.height))
    .toBeLessThan(45);

  await context.close();
});

test("LG Legacy toont de stand als één Editorial Arena-canvas met begrensde logo's", async ({
  browser
}) => {
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Web0S; Linux/SmartTV) AppleWebKit/537.36 Chrome/79.0.3945.79 Safari/537.36",
    viewport: { height: 1920, width: 1080 }
  });
  const page = await context.newPage();
  await mockEditorialStandingLegacyApis(page);
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
  await expect(slide).toHaveAttribute("data-viewport-fit", "cover");
  await expect(slide.getByRole("heading", { name: "Stand", exact: true }))
    .toHaveCount(1);
  await expect(slide.locator(".legacy-standing-card")).toHaveCount(1);
  await expect(slide.locator(".legacy-standing-header")).toHaveCount(0);
  await expect(slide.locator(".legacy-standing-row")).toHaveCount(4);

  const crestBox = await slide.locator(".editorial-crest img").boundingBox();
  expect(crestBox).not.toBeNull();
  expect(crestBox!.width).toBeLessThan(130);
  expect(crestBox!.height).toBeLessThan(130);
  const rowLogoBoxes = await slide.locator(".legacy-standing-team img")
    .evaluateAll((images) => images.map((image) => {
      const rect = image.getBoundingClientRect();
      return { height: rect.height, width: rect.width };
    }));
  expect(rowLogoBoxes).toHaveLength(4);
  expect(rowLogoBoxes.every(({ height, width }) => height <= 55 && width <= 55))
    .toBe(true);
  await expect(slide.getByText("Mannen KNVB beker amateurs", { exact: false }))
    .toHaveCount(1);

  if (process.env.CAPTURE_LG_STANDING === "1") {
    await page.screenshot({
      path: "docs/screenshots/s102-lg-standing-single-canvas.png"
    });
  }
  await context.close();
});

test("LG Legacy heet alleen bezoekers van thuiswedstrijden welkom en toont hun logo", async ({
  browser
}) => {
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Web0S; Linux/SmartTV) AppleWebKit/537.36 Chrome/79.0.3945.79 Safari/537.36",
    viewport: { height: 1080, width: 1920 }
  });
  const page = await context.newPage();
  await mockVisitorArrivalsLegacyApis(page);
  await page.addInitScript(
    ({ credential, token }) => {
      localStorage.setItem("veyocast.player.deviceToken", token);
      localStorage.setItem("veyocast.player.installationCredential", credential);
      localStorage.setItem(
        "veyocast.player.instanceId",
        "12345678-1234-4123-8123-123456789abc"
      );
    },
    { credential: installationCredential, token: deviceToken }
  );

  await page.goto(`${playerURL}/lg/legacy`);
  await expect.poll(() => page.evaluate(() =>
    localStorage.getItem("veyocast.player.lgLegacyDiagnostics.v1") ?? ""
  )).toContain("LEGACY_TEMPLATE_READY");
  const slide = page.locator(".dynamic-template.editorial-arena");
  await expect(slide).toBeVisible();
  await expect(slide.locator(".legacy-arrival-grid")).toHaveAttribute("data-cards", "1");
  await expect(slide.locator(".legacy-arrival-card")).toHaveCount(1);
  await expect(slide.getByText("Bezoekers FC", { exact: true })).toBeVisible();
  await expect(slide.getByText("Duindorp sv 1", { exact: true })).toHaveCount(0);
  await expect(slide.locator(".legacy-arrival-logo-mark img")).toHaveCount(1);
  await expect(slide.locator(".legacy-arrival-logo-backdrop")).toHaveCSS("opacity", "0.3");
  await context.close();
});

test("LG Legacy toont de prijslijst één-op-één in het portraitcanvas", async ({
  browser
}) => {
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Web0S; Linux/SmartTV) AppleWebKit/537.36 Chrome/79.0.3945.79 Safari/537.36",
    viewport: { height: 1920, width: 1080 }
  });
  const page = await context.newPage();
  await mockEditorialPriceListLegacyApis(page);
  await page.addInitScript(
    ({ credential, token }) => {
      localStorage.setItem("veyocast.player.deviceToken", token);
      localStorage.setItem("veyocast.player.installationCredential", credential);
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
  await expect(slide.getByRole("heading", { name: "Prijslijst", exact: true }))
    .toHaveCount(1);
  await expect(slide.locator(".legacy-price-grid")).toHaveCount(1);
  await expect(slide.locator(".legacy-price-column")).toHaveCount(2);
  await expect(slide.locator(".legacy-price-product")).toHaveCount(16);
  await expect(slide.locator(".legacy-price-media")).toHaveCount(16);
  expect(await slide.locator(".legacy-price-copy strong").first().evaluate(
    (element) => getComputedStyle(element).fontSize
  )).toBe("28px");
  const slideBox = await slide.boundingBox();
  expect(slideBox).toEqual(expect.objectContaining({ height: 1920, width: 1080 }));
  if (process.env.CAPTURE_EDITORIAL_ARENA === "1") {
    await page.screenshot({
      path: "docs/screenshots/s103-editorial-arena-price-list-lg-legacy.png"
    });
  }
  await context.close();
});

test("LG Legacy toont Menu Studio v2 portrait als één brede bovenuitgelijnde kolom", async ({
  browser
}) => {
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Web0S; Linux/SmartTV) AppleWebKit/537.36 Chrome/79.0.3945.79 Safari/537.36",
    viewport: { height: 1920, width: 1080 }
  });
  const page = await context.newPage();
  await mockMenuStudioPortraitLegacyApis(page);
  await page.addInitScript(
    ({ credential, token }) => {
      localStorage.setItem("veyocast.player.deviceToken", token);
      localStorage.setItem("veyocast.player.installationCredential", credential);
      localStorage.setItem(
        "veyocast.player.instanceId",
        "12345678-1234-4123-8123-123456789abc"
      );
    },
    { credential: installationCredential, token: deviceToken }
  );

  await page.goto(`${playerURL}/lg/legacy`);
  const slide = page.locator(".dynamic-template.menu-studio-v2.portrait");
  await expect(slide).toBeVisible();
  await expect(slide.locator(".editorial-heading p")).toHaveText("Menu");
  await expect(slide.getByRole("heading", { name: "Nieuw menu", exact: true }))
    .toHaveCount(1);
  await expect(slide.locator(".legacy-price-column")).toHaveCount(1);
  await expect(slide.locator(".legacy-price-category"))
    .toHaveText("Hardloper, frisdrank");
  await expect(slide.locator(".legacy-price-copy strong").first()).toHaveText("AA Drink");
  await expect(slide.locator(".legacy-price-product > b").first()).toHaveText("€ 2,50");
  await expect(slide.locator("footer > span").first()).toHaveText("Prijslijst");
  await expect(slide.locator(".dynamic-page-number")).toHaveText("1 / 1");

  const geometry = await slide.evaluate((element) => {
    const grid = element.querySelector<HTMLElement>(".legacy-price-grid")!;
    const column = element.querySelector<HTMLElement>(".legacy-price-column")!;
    const category = element.querySelector<HTMLElement>(".legacy-price-category")!;
    const footer = element.querySelector<HTMLElement>("footer")!;
    const header = element.querySelector<HTMLElement>("header")!;
    const product = element.querySelector<HTMLElement>(".legacy-price-product")!;
    const title = element.querySelector<HTMLElement>(".editorial-heading h1")!;
    const productName = element.querySelector<HTMLElement>(".legacy-price-copy strong")!;
    return {
      categoryBottom: category.getBoundingClientRect().bottom,
      categoryFontSize: getComputedStyle(category).fontSize,
      column: column.getBoundingClientRect().toJSON(),
      gridColumns: getComputedStyle(grid).gridTemplateColumns,
      footerFontSize: getComputedStyle(footer).fontSize,
      headerBorderColor: getComputedStyle(header).borderBottomColor,
      productFontSize: getComputedStyle(productName).fontSize,
      productTop: product.getBoundingClientRect().top,
      titleFontSize: getComputedStyle(title).fontSize
    };
  });
  expect(geometry.gridColumns).toBe("936px");
  expect(geometry.column).toEqual(expect.objectContaining({ height: 1388, width: 936, x: 72 }));
  expect(geometry.productTop).toBe(geometry.categoryBottom + 10);
  expect(geometry.categoryFontSize).toBe("34px");
  expect(geometry.footerFontSize).toBe("20px");
  expect(geometry.headerBorderColor).toBe("rgb(48, 188, 237)");
  expect(geometry.productFontSize).toBe("32px");
  expect(geometry.titleFontSize).toBe("72px");

  const productNames = slide.locator(".legacy-price-copy strong");
  await expect(productNames.nth(1)).toHaveClass(/legacy-price-title-compact/);
  await expect(productNames.nth(2)).toHaveClass(/legacy-price-title-dense/);
  expect(await productNames.evaluateAll((elements) => elements.slice(0, 3).map(
    (element) => getComputedStyle(element).fontSize
  ))).toEqual(["32px", "28px", "24px"]);

  if (process.env.CAPTURE_MENU_STUDIO_LG === "1") {
    await page.screenshot({
      path: "docs/screenshots/s118-menu-studio-lg-legacy-portrait.png"
    });
  }
  await context.close();
});

test("LG Legacy verdeelt losse Menu Studio-producten zonder categoriekop over twee gelijke kolommen", async ({
  browser
}) => {
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Web0S; Linux/SmartTV) AppleWebKit/537.36 Chrome/79.0.3945.79 Safari/537.36",
    viewport: { height: 1920, width: 1080 }
  });
  const page = await context.newPage();
  await mockMenuStudioPortraitLegacyApis(page, { loose: true });
  await page.addInitScript(
    ({ credential, token }) => {
      localStorage.setItem("veyocast.player.deviceToken", token);
      localStorage.setItem("veyocast.player.installationCredential", credential);
      localStorage.setItem(
        "veyocast.player.instanceId",
        "12345678-1234-4123-8123-123456789abc"
      );
    },
    { credential: installationCredential, token: deviceToken }
  );

  await page.goto(`${playerURL}/lg/legacy`);
  const slide = page.locator(".dynamic-template.menu-studio-v2.portrait");
  await expect(slide).toBeVisible();
  await expect(slide.locator(".legacy-price-grid")).toHaveClass(/legacy-price-grid-two/);
  await expect(slide.locator(".legacy-price-column")).toHaveCount(2);
  await expect(slide.locator(".legacy-price-category")).toHaveCount(0);
  await expect(slide.locator(".legacy-price-column").nth(0).locator(".legacy-price-product")).toHaveCount(4);
  await expect(slide.locator(".legacy-price-column").nth(1).locator(".legacy-price-product")).toHaveCount(4);
  const styles = await slide.locator(".legacy-price-product").evaluateAll((rows) => rows.slice(0, 2).map((row) => {
    const computed = getComputedStyle(row);
    return {
      backgroundColor: computed.backgroundColor,
      height: row.getBoundingClientRect().height,
      paddingBlockEnd: computed.paddingBlockEnd,
      paddingBlockStart: computed.paddingBlockStart
    };
  }));
  expect(styles).toHaveLength(2);
  expect(styles[1]).toEqual(styles[0]);
  await page.screenshot({ path: "docs/screenshots/s125-lg-menu-loose-portrait.png" });
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

  await expect(
    page.locator("#media-root > img.visible:not(.retiring)")
  ).toBeVisible();
  await expect(page.locator("#offline")).toHaveClass("visible");
  await expect(page.locator("#status")).toBeHidden();
  await expect(page.locator("#media-root > *")).toHaveCount(1);
});
