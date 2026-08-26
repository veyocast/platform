import { expect, test } from "@playwright/test";

import {
  menuDocumentV2Schema,
  playerDynamicTemplatePayloadSchema,
  type MenuDocumentV2,
  type MenuProductGroupPlacement,
  type MenuProductPlacement,
  type PlayerDynamicTemplatePayload
} from "@veyocast/contracts";
import { createDynamicTemplateView } from "@veyocast/content-templates/dynamic-template-view";

const playerURL = `http://127.0.0.1:${process.env.PLAYER_PORT ?? 3106}`;
const templateVersionId = "20000000-0000-4000-8000-000000000002";
const logoAssetId = "20000000-0000-4000-8000-000000000003";
const imageAssetId = "20000000-0000-4000-8000-000000000004";
const videoAssetId = "20000000-0000-4000-8000-000000000005";
const themeIds: MenuDocumentV2["theme"]["themeId"][] = [
  "editorial",
  "obsidian",
  "atelier",
  "velocity",
  "heritage",
  "halo",
  "swiss",
  "pavilion",
  "tactical",
  "terrace"
];

test.use({ serviceWorkers: "block" });

test("Menu Studio bewaakt 40 goldens voor thema, modus en oriëntatie", async ({ page }) => {
  test.setTimeout(240_000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  for (const themeId of themeIds) {
    for (const mode of ["light", "dark"] as const) {
      for (const orientation of ["landscape", "portrait"] as const) {
        await test.step(`${themeId} · ${mode} · ${orientation}`, async () => {
          const viewport = orientation === "landscape"
            ? { height: 1080, width: 1920 }
            : { height: 1920, width: 1080 };
          const payload = buildPayload(themeId, mode, orientation);
          expect(playerDynamicTemplatePayloadSchema.safeParse(payload).success).toBe(true);
          expect(createDynamicTemplateView(payload)).not.toBeNull();
          await page.setViewportSize(viewport);
          await page.goto("about:blank");
          await page.goto(`${playerURL}/thumbnail#payload=${encodePayload(payload)}`);
          await expect.poll(async () => page.evaluate(() => ({
            error: document.documentElement.dataset.thumbnailError ?? null,
            ready: document.documentElement.dataset.thumbnailReady === "true"
          })), { message: `Thumbnail werd niet gereed: ${pageErrors.join(" | ")}` })
            .toEqual({ error: null, ready: true });
          await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });

          const scene = page.locator("[data-theme-mode][data-theme-id]");
          await expect(scene).toBeVisible();
          await expect(scene).toHaveAttribute("data-orientation", orientation);
          await expect(scene).toHaveAttribute("data-theme-id", themeId);
          await expect(scene).toHaveAttribute("data-theme-mode", mode);
          await expect(scene).toHaveAttribute("data-menu-content-measured", "true");
          await expect(scene).toHaveAttribute("data-menu-content-overflow", "false");
          await expect(scene).toHaveAttribute("data-menu-content-fit-version", "dom-measured-2.0.0");
          const geometry = await scene.evaluate((element) => ({
            clientHeight: element.clientHeight,
            clientWidth: element.clientWidth,
            scrollHeight: element.scrollHeight,
            scrollWidth: element.scrollWidth
          }));
          expect(geometry.scrollWidth).toBe(geometry.clientWidth);
          expect(geometry.scrollHeight).toBe(geometry.clientHeight);
          const noteBox = await page.getByText("Vers bereid · lokaal ingekocht", { exact: true }).boundingBox();
          const imageBox = await page.getByAltText("Abstracte illustratie bij het dagmenu").boundingBox();
          const reducedMotionPoster = page.locator('[class*="reducedMotionPoster"]');
          await expect(reducedMotionPoster).toBeVisible();
          await expect(page.locator("video[data-has-poster='true']")).toBeHidden();
          expect(await reducedMotionPoster.evaluate((image: HTMLImageElement) => ({
            complete: image.complete,
            naturalWidth: image.naturalWidth
          }))).toMatchObject({ complete: true, naturalWidth: expect.any(Number) });
          expect(await reducedMotionPoster.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
          expect(noteBox?.x).toBeCloseTo(orientation === "landscape" ? 1080 : 620, 0);
          expect(noteBox?.y).toBeCloseTo(orientation === "landscape" ? 850 : 1620, 0);
          expect(Math.abs((imageBox?.x ?? 0) - (orientation === "landscape" ? 1430 : 660))).toBeLessThan(5);
          expect(Math.abs((imageBox?.y ?? 0) - (orientation === "landscape" ? 760 : 1370))).toBeLessThan(7);
          await expect(page).toHaveScreenshot(
            `menu-studio-${themeId}-${mode}-${orientation}.png`,
            { animations: "disabled", caret: "hide", maxDiffPixelRatio: 0.002 }
          );
        });
      }
    }
  }
});

test("portrait meet twintig echte DOM-productregels na font-ready zonder crop", async ({ page }) => {
  await page.setViewportSize({ height: 1920, width: 1080 });
  const payload = buildPayload("editorial", "light", "portrait");
  const menu = buildDocument("editorial", "light");
  const capacityCategory = category("capacity", "Lunch", 0, "left");
  capacityCategory.productNodes = Array.from({ length: 20 }, (_, index) =>
    product("capacity", "Lunchgerecht", index)
  );
  menu.assets = [];
  menu.theme.brand = { accent: "#FF5C20", support: "#0050FF" };
  menu.pages[0]!.blocks = [capacityCategory];
  payload.assets = {};
  payload.data = { menuDocument: menu };

  await page.goto(`${playerURL}/thumbnail#payload=${encodePayload(payload)}`);
  await expect.poll(async () => page.evaluate(
    () => document.documentElement.dataset.thumbnailReady === "true"
  )).toBe(true);
  const scene = page.locator("[data-theme-mode][data-theme-id]");
  await expect(scene).toHaveAttribute("data-menu-content-measured", "true");
  await expect(scene).toHaveAttribute("data-menu-content-overflow", "false");
  await expect(scene.locator("[data-menu-row]")).toHaveCount(21);

  const geometry = await scene.evaluate((element) => {
    const root = element.getBoundingClientRect();
    const rect = (selector: string) => {
      const value = element.querySelector(selector)?.getBoundingClientRect();
      if (!value) throw new Error(`Ontbrekende zone ${selector}`);
      return {
        h: value.height,
        w: value.width,
        x: value.x - root.x,
        y: value.y - root.y
      };
    };
    return {
      body: rect("main"),
      footer: rect("footer"),
      header: rect("header"),
      scrollHeight: element.scrollHeight,
      scrollWidth: element.scrollWidth
    };
  });
  expect(geometry).toMatchObject({
    body: { h: 1388, w: 936, x: 72, y: 348 },
    footer: { h: 64, w: 936, x: 72, y: 1760 },
    header: { h: 228, w: 936, x: 72, y: 96 },
    scrollHeight: 1920,
    scrollWidth: 1080
  });
});

test("portrait start een korte prijslijst altijd bovenaan", async ({ page }) => {
  await page.setViewportSize({ height: 1920, width: 1080 });
  const payload = buildPayload("editorial", "light", "portrait");
  const menu = buildDocument("editorial", "light");
  const shortCategory = category("short", "Snacks", 0, "left");
  shortCategory.productNodes = Array.from({ length: 3 }, (_, index) =>
    product("short", "Snack", index)
  );
  menu.assets = [];
  menu.pages[0]!.blocks = [shortCategory];
  payload.assets = {};
  payload.data = { menuDocument: menu };

  await page.goto(`${playerURL}/thumbnail#payload=${encodePayload(payload)}`);
  await expect.poll(async () => page.evaluate(
    () => document.documentElement.dataset.thumbnailReady === "true"
  )).toBe(true);
  const column = page.locator("[data-menu-column]");
  await expect(column).toHaveCSS("justify-content", "flex-start");
  const geometry = await column.evaluate((element) => {
    const column = element.getBoundingClientRect();
    const firstRow = element.querySelector<HTMLElement>("[data-menu-row]")?.getBoundingClientRect();
    return { columnTop: column.top, firstRowTop: firstRow?.top ?? Number.POSITIVE_INFINITY };
  });
  expect(geometry.firstRowTop - geometry.columnTop).toBeLessThan(30);
});

test("losse Twelve-producten vullen twee kolommen zonder categoriekoppen", async ({ page }) => {
  await page.setViewportSize({ height: 1920, width: 1080 });
  const payload = buildPayload("editorial", "dark", "portrait");
  const menu = buildDocument("editorial", "dark");
  const loose = category("loose", "Losse producten", 0, "left");
  loose.flowAcrossColumns = true;
  loose.headingVisible = false;
  loose.layout.landscape = { h: 704, rotation: 0, w: 1728, x: 96, y: 248 };
  loose.layout.portrait = { h: 1388, rotation: 0, w: 936, x: 72, y: 348 };
  loose.productNodes = Array.from({ length: 8 }, (_, index) => product("loose", "Product", index));
  menu.assets = [];
  menu.pages[0]!.blocks = [loose];
  payload.assets = {};
  payload.data = { menuDocument: menu };

  await page.goto(`${playerURL}/thumbnail#payload=${encodePayload(payload)}`);
  await expect.poll(async () => page.evaluate(
    () => document.documentElement.dataset.thumbnailReady === "true"
  )).toBe(true);
  const columns = page.locator("[data-menu-column]");
  await expect(columns).toHaveCount(2);
  await expect(page.locator("[data-menu-row]").filter({ has: page.locator("h2") })).toHaveCount(0);
  await expect(columns.nth(0).locator("[data-menu-row]")).toHaveCount(4);
  await expect(columns.nth(1).locator("[data-menu-row]")).toHaveCount(4);
  await page.screenshot({ path: "docs/screenshots/s125-menu-loose-portrait.png" });
});

test("productgroep en product delen dezelfde rijstijl en hoogte", async ({ page }) => {
  await page.setViewportSize({ height: 1080, width: 1920 });
  await page.goto(`${playerURL}/thumbnail#payload=${encodePayload(
    buildPayload("editorial", "light", "landscape")
  )}`);
  await expect.poll(async () => page.evaluate(
    () => document.documentElement.dataset.thumbnailReady === "true"
  )).toBe(true);
  const regular = page.locator("article").filter({ hasText: "Espresso" }).first();
  const group = page.locator("article").filter({ hasText: "Koffieproeverij" }).first();
  const style = async (locator: typeof regular) => locator.evaluate((element) => {
    const computed = getComputedStyle(element);
    const bounds = element.getBoundingClientRect();
    return {
      backgroundColor: computed.backgroundColor,
      borderBottom: computed.borderBottom,
      height: bounds.height,
      paddingBlockEnd: computed.paddingBlockEnd,
      paddingBlockStart: computed.paddingBlockStart
    };
  });
  expect(await style(group)).toEqual(await style(regular));
});

test("Menu Studio-video bewaakt poster, muted autoplay en het ingestelde fragment", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const payload = buildPayload("editorial", "light", "landscape");
  await page.goto(`${playerURL}/thumbnail#payload=${encodePayload(payload)}`);
  await expect.poll(async () => page.evaluate(
    () => document.documentElement.dataset.thumbnailReady === "true"
  )).toBe(true);
  const video = page.locator("video[data-has-poster='true']");
  await expect(video).toBeVisible();
  await expect(video).toHaveAttribute("poster", /veyocast-icon-512\.png/);
  await expect.poll(() => video.evaluate((element: HTMLVideoElement) => ({
    currentTime: element.currentTime,
    loop: element.loop,
    muted: element.muted,
    paused: element.paused
  }))).toMatchObject({ loop: true, muted: true, paused: false });
  await page.waitForTimeout(1_100);
  const currentTime = await video.evaluate((element: HTMLVideoElement) => element.currentTime);
  expect(currentTime).toBeGreaterThanOrEqual(0.2);
  expect(currentTime).toBeLessThan(0.85);
});

test("Menu Studio vult een gelijk georiënteerde viewport zonder letterboxing", async ({ page }) => {
  for (const candidate of [
    { orientation: "landscape" as const, viewport: { height: 1200, width: 1920 } },
    { orientation: "portrait" as const, viewport: { height: 1920, width: 1200 } }
  ]) {
    await page.setViewportSize(candidate.viewport);
    await page.goto("about:blank");
    await page.goto(`${playerURL}/thumbnail#payload=${encodePayload(
      buildPayload("editorial", "dark", candidate.orientation)
    )}`);
    await expect.poll(async () => page.evaluate(
      () => document.documentElement.dataset.thumbnailReady === "true"
    )).toBe(true);
    const scene = page.getByRole("region", { name: "Editorial Arena-thumbnail" });
    await expect(scene).toHaveAttribute("data-viewport-fit", "cover");
    const box = await scene.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeLessThanOrEqual(0.5);
    expect(box!.y).toBeLessThanOrEqual(0.5);
    expect(box!.x + box!.width).toBeGreaterThanOrEqual(candidate.viewport.width - 0.5);
    expect(box!.y + box!.height).toBeGreaterThanOrEqual(candidate.viewport.height - 0.5);
  }
});

function buildPayload(
  themeId: MenuDocumentV2["theme"]["themeId"],
  mode: MenuDocumentV2["theme"]["mode"],
  orientation: "landscape" | "portrait"
): PlayerDynamicTemplatePayload {
  const document = buildDocument(themeId, mode);
  const parsed = menuDocumentV2Schema.safeParse(document);
  if (!parsed.success) throw new Error(parsed.error.message);
  const variant = themeIds.indexOf(themeId) * 4 +
    (mode === "dark" ? 2 : 0) +
    (orientation === "portrait" ? 1 : 0) + 1;
  const immutableNibble = (variant % 15 + 1).toString(16);
  return {
    assets: {
      [imageAssetId]: {
        bytes: 481,
        checksumSha256: "d".repeat(64),
        mimeType: "image/svg+xml",
        url: `${playerURL}/editorial-arena-fixture.svg`
      },
      [logoAssetId]: {
        bytes: 481,
        checksumSha256: "c".repeat(64),
        mimeType: "image/svg+xml",
        url: `${playerURL}/editorial-arena-fixture.svg`
      },
      [videoAssetId]: {
        bytes: 2048,
        checksumSha256: "b".repeat(64),
        mimeType: "video/mp4",
        posterBytes: 1024,
        posterChecksumSha256: "a".repeat(64),
        posterMimeType: "image/png",
        posterUrl: `${playerURL}/brand/veyocast-icon-512.png`,
        url: `${playerURL}/lg-probe/h264-baseline-aac.mp4`
      }
    },
    data: { menuDocument: parsed.data },
    orientation,
    schemaVersion: 1,
    slideType: "price_list",
    snapshotHash: immutableNibble.repeat(64),
    snapshotId: `20000000-0000-4000-8001-${String(variant).padStart(12, "0")}`,
    templateSlug: `menu-studio-v2-${themeId}-${mode}-${orientation}`,
    templateVersionId
  };
}

function buildDocument(
  themeId: MenuDocumentV2["theme"]["themeId"],
  mode: MenuDocumentV2["theme"]["mode"]
): MenuDocumentV2 {
  return {
    assets: [
      {
        assetId: logoAssetId,
        assetVersion: "c".repeat(64),
        kind: "logo",
        sha256: "c".repeat(64),
        status: "ready"
      },
      {
        assetId: imageAssetId,
        assetVersion: "d".repeat(64),
        kind: "image",
        sha256: "d".repeat(64),
        status: "ready"
      },
      {
        assetId: videoAssetId,
        assetVersion: "b".repeat(64),
        kind: "video",
        posterAssetVersion: "a".repeat(64),
        sha256: "b".repeat(64),
        status: "ready"
      }
    ],
    createdAt: "2026-08-21T12:00:00.000Z",
    id: "golden-menu",
    pages: [{
      blocks: [
        category("dranken", "Dranken", 0, "left"),
        category("gerechten", "Gerechten", 1, "right"),
        {
          alt: "Abstracte illustratie bij het dagmenu",
          appearance: {
            fit: "cover",
            focalPoint: { x: 0.5, y: 0.5 },
            opacity: 0.88
          },
          assetId: imageAssetId,
          caption: "Special van vandaag",
          id: "image-special",
          layout: floatingLayout(),
          order: 2,
          orientationAppearance: {
            portrait: {
              fit: "contain",
              focalPoint: { x: 0.5, y: 0.5 },
              opacity: 0.94
            }
          },
          type: "image"
        },
        {
          id: "note-local",
          layout: {
            landscape: { h: 54, rotation: 0, w: 300, x: 1080, y: 850 },
            portrait: { h: 76, rotation: 0, w: 330, x: 620, y: 1620 }
          },
          order: 3,
          role: "note",
          text: "Vers bereid · lokaal ingekocht",
          type: "text"
        },
        {
          appearance: {
            fit: "contain",
            focalPoint: { x: 0.35, y: 0.5 },
            opacity: 1
          },
          assetId: videoAssetId,
          id: "video-sponsor",
          layout: {
            landscape: { h: 120, rotation: 0, w: 300, x: 1080, y: 700 },
            portrait: { h: 110, rotation: 0, w: 330, x: 620, y: 1230 }
          },
          order: 4,
          playback: {
            autoplay: true,
            endMs: 750,
            loop: true,
            muted: true,
            startMs: 250
          },
          type: "video"
        }
      ],
      id: "golden-page",
      order: 0
    }],
    revision: 7,
    schemaVersion: "menu-document.v2",
    tenantId: "golden-tenant",
    theme: {
      brand: { accent: "#FF5C20", logoAssetId, support: "#0050FF" },
      mode,
      themeId,
      themeVersion: "1.0.0"
    },
    title: "Brasserie Veyo",
    updatedAt: "2026-08-21T12:00:00.000Z"
  };
}

function category(
  id: string,
  name: string,
  order: number,
  column: "left" | "right"
): Extract<MenuDocumentV2["pages"][number]["blocks"][number], { type: "category" }> {
  return {
    id: `category-${id}`,
    layout: {
      landscape: { h: 704, rotation: 0, w: 846, x: column === "left" ? 96 : 978, y: 248 },
      portrait: { h: 1388, rotation: 0, w: 936, x: 72, y: 348 }
    },
    order,
    productNodes: id === "dranken"
      ? [
          product(id, name, 0),
          productGroup(id, 1),
          product(id, name, 3),
          product(id, name, 4)
        ]
      : Array.from({ length: 5 }, (_, index) => product(id, name, index)),
    source: { source: "manual", sourceCategoryId: id, sourceName: name },
    subtitle: column === "left" ? "Warm en koud" : "De hele dag",
    type: "category"
  };
}

function productGroup(categoryId: string, order: number): MenuProductGroupPlacement {
  const first = product(categoryId, "Dranken", 1);
  const second = product(categoryId, "Dranken", 2);
  return {
    availabilityPolicy: {
      groupUnavailableWhenNoLinkedProducts: true,
      hideUnavailableLinkedProducts: true,
      keepFreeTextWhenLinkedUnavailable: true
    },
    display: { maxLines: 2, separator: "dot" },
    id: `${categoryId}-group-${order}`,
    kind: "product-group",
    order,
    pricePolicy: "from",
    secondaryLineItems: [
      {
        id: `${categoryId}-group-line-1`,
        kind: "linked-product",
        order: 0,
        productRef: first.productRef,
        snapshotFallback: first.snapshotFallback
      },
      {
        id: `${categoryId}-group-line-2`,
        kind: "linked-product",
        order: 1,
        productRef: second.productRef,
        snapshotFallback: second.snapshotFallback
      },
      {
        id: `${categoryId}-group-line-3`,
        kind: "free-text",
        label: "Ook met havermelk",
        order: 2,
        presentationOnly: true
      }
    ],
    title: "Koffieproeverij"
  };
}

function product(categoryId: string, categoryName: string, index: number): MenuProductPlacement {
  const names = categoryId === "dranken"
    ? ["Espresso", "Cappuccino", "Verse muntthee", "Chai latte", "Limonade", "Appelsap"]
    : ["Soep van het seizoen", "Tosti oude kaas", "Clubsandwich", "Salade", "Pasta", "Dagdessert"];
  return {
    id: `${categoryId}-placement-${index}`,
    kind: "product",
    order: index,
    productRef: { productId: `${categoryId}-product-${index}`, source: "manual" },
    snapshotFallback: {
      available: true,
      name: names[index] ?? `${categoryName} ${index + 1}`,
      price: {
        amountMinor: (categoryId === "dranken" ? 285 : 875) + index * 65,
        currency: "EUR",
        taxMode: "inclusive"
      },
      variantLabel: index % 2 ? "huisgemaakt" : null
    }
  };
}

function floatingLayout() {
  return {
    landscape: { h: 170, rotation: -2, w: 330, x: 1430, y: 760 },
    portrait: { h: 210, rotation: -2, w: 320, x: 660, y: 1370 }
  };
}

function encodePayload(payload: PlayerDynamicTemplatePayload) {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}
