import { mkdirSync } from "node:fs";
import path from "node:path";

import { expect, test, type Page } from "@playwright/test";

const evidenceEnabled = process.env.FIELDFLOW_RELEASE_EVIDENCE === "1";
const shellOnly = process.env.FIELDFLOW_RELEASE_EVIDENCE_SHELL_ONLY === "1";
const studioOnly = process.env.FIELDFLOW_RELEASE_EVIDENCE_STUDIO_ONLY === "1";
const marketingOnly = process.env.FIELDFLOW_RELEASE_EVIDENCE_MARKETING_ONLY === "1";
const referenceOnly =
  process.env.FIELDFLOW_RELEASE_EVIDENCE_REFERENCE_ONLY === "1";
const controlPort = Number(process.env.CONTROL_PORT ?? 3103);
const marketingPort = Number(process.env.MARKETING_PORT ?? 3108);
const controlUrl = `http://127.0.0.1:${controlPort}`;
const marketingUrl = `http://127.0.0.1:${marketingPort}`;
const outputRoot = path.resolve(
  process.env.FIELDFLOW_RELEASE_EVIDENCE_ROOT ??
    path.join("docs", "screenshots", "fieldflow", "current")
);

const todayStates = [
  "empty-unconfigured",
  "loading",
  "partial-error",
  "full-error",
  "healthy"
] as const;
const todayViewports = [
  { height: 844, name: "390x844", width: 390 },
  { height: 1024, name: "768x1024", width: 768 },
  { height: 900, name: "1280x900", width: 1280 },
  { height: 900, name: "1440x900", width: 1440 },
  { height: 1080, name: "1920x1080", width: 1920 },
  { height: 1008, name: "2048x1008", width: 2048 }
] as const;
const studioStates = [
  "empty",
  "valid",
  "landscape",
  "portrait",
  "template",
  "long-copy"
] as const;
const studioViewports = [
  { height: 844, name: "390x844", width: 390 },
  { height: 1024, name: "768x1024", width: 768 },
  { height: 900, name: "1440x900", width: 1440 },
  { height: 1008, name: "2048x1008", width: 2048 }
] as const;
const marketingViewports = [
  { height: 844, name: "390x844", width: 390 },
  { height: 1024, name: "768x1024", width: 768 },
  { height: 900, name: "1440x900", width: 1440 },
  { height: 1080, name: "1920x1080", width: 1920 }
] as const;

async function preparePage(page: Page) {
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  await page.addInitScript(() => {
    window.localStorage.setItem("veyocast-control-theme", "light");
    window.localStorage.setItem("veyocast-control-density", "comfortable");
  });
}

async function settle(page: Page) {
  await page.waitForLoadState("domcontentloaded");
  await page.addStyleTag({
    content:
      "nextjs-portal{display:none!important}*,*::before,*::after{animation-duration:0s!important;animation-delay:0s!important;transition:none!important;caret-color:transparent!important}"
  });
  await page.evaluate(async () => {
    const viewportStep = Math.max(window.innerHeight, 640);
    for (
      let y = 0;
      y < document.documentElement.scrollHeight;
      y += viewportStep
    ) {
      window.scrollTo(0, y);
      await new Promise<void>((resolve) =>
        window.requestAnimationFrame(() => resolve())
      );
      await new Promise<void>((resolve) => window.setTimeout(resolve, 30));
    }
    window.scrollTo(0, 0);
    document.querySelector<HTMLElement>(".control-main")?.scrollTo(0, 0);
    await document.fonts.ready;
    await Promise.all(
      Array.from(document.images).map(async (image) => {
        await Promise.race([
          image.complete
            ? Promise.resolve()
            : new Promise<void>((resolve) => {
                const settleImage = () => resolve();
                image.addEventListener("load", settleImage, { once: true });
                image.addEventListener("error", settleImage, { once: true });
                window.setTimeout(settleImage, 3_000);
              }),
          new Promise<void>((resolve) => window.setTimeout(resolve, 3_000))
        ]);
        await Promise.race([
          image.decode().catch(() => undefined),
          new Promise<void>((resolve) => window.setTimeout(resolve, 3_000))
        ]);
      })
    );
    window.scrollTo(0, 0);
    document.querySelector<HTMLElement>(".control-main")?.scrollTo(0, 0);
  });
  await page.waitForTimeout(100);
}

async function assertNoHorizontalOverflow(page: Page, context: string) {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth
  }));
  expect.soft(
    dimensions.scrollWidth,
    `${context}: html blijft binnen de viewport`
  ).toBeLessThanOrEqual(dimensions.clientWidth);
}

async function assertMarketingImagesFailQuietly(page: Page, context: string) {
  const images = page.locator("img[data-marketing-image-state]");
  await expect.poll(
    () => images.evaluateAll((nodes) => (
      nodes.filter((node) => node.getAttribute("data-marketing-image-state") === "failed").length
    )),
    { message: `${context}: de foutfixture bereikt de marketing-imagefallback` }
  ).toBeGreaterThan(0);

  const exposedFailures = await images.evaluateAll((nodes) => (
    nodes
      .filter((node) => (
        node.getAttribute("data-marketing-image-state") !== "loaded" &&
        node.getClientRects().length > 0 &&
        Number.parseFloat(window.getComputedStyle(node).opacity) > 0
      ))
      .map((node) => ({
        alt: node.getAttribute("alt"),
        state: node.getAttribute("data-marketing-image-state")
      }))
  ));
  expect.soft(
    exposedFailures,
    `${context}: geen browser-eigen broken-image-glyph of alttekst zichtbaar`
  ).toEqual([]);
}

function trackRuntimeErrors(page: Page) {
  const errors: Array<{ message: string; type: "console" | "pageerror"; url: string }> = [];
  const failedImageUrls = new Set<string>();
  page.on("requestfailed", (request) => {
    if (request.resourceType() === "image") {
      failedImageUrls.add(request.url());
    }
  });
  page.on("pageerror", (error) => {
    errors.push({ message: error.message, type: "pageerror", url: page.url() });
  });
  page.on("console", (message) => {
    if (message.type() === "error") {
      errors.push({
        message: message.text(),
        type: "console",
        url: message.location().url
      });
    }
  });
  return { errors, failedImageUrls };
}

function assertNoRuntimeErrors(
  runtime: ReturnType<typeof trackRuntimeErrors>,
  context: string,
  allowExpectedImageFailures = false
) {
  const unexpected = runtime.errors.filter((error) => !(
    allowExpectedImageFailures &&
    error.type === "console" &&
    error.message === "Failed to load resource: net::ERR_FAILED" &&
    runtime.failedImageUrls.has(error.url)
  ));
  expect.soft(unexpected, `${context}: geen onverwachte browser- of consolefouten`).toEqual([]);
  if (allowExpectedImageFailures) {
    expect.soft(
      runtime.failedImageUrls.size,
      `${context}: de foutfixture heeft werkelijk afbeeldingsrequests afgebroken`
    ).toBeGreaterThan(0);
  }
}

async function assertShellContract(page: Page, context: string) {
  await expect(page.locator(".control-shell")).toHaveCount(1);
  await expect(page.locator(".control-sidebar")).toHaveCount(1);
  await expect(page.locator(".vector-context-rail, [data-vector-context]")).toHaveCount(0);
  const visibleGlobalRows = page.locator(
    "header.control-topbar:visible, nav.control-mobile-nav:visible"
  );
  expect.soft(
    await visibleGlobalRows.count(),
    `${context}: maximaal twee globale shellrijen`
  ).toBeLessThanOrEqual(2);

  const topbar = page.locator("header.control-topbar:visible");
  const content = page.locator("#control-content:visible");
  if ((await topbar.count()) > 0 && (await content.count()) > 0) {
    const [topbarBox, contentBox] = await Promise.all([
      topbar.first().boundingBox(),
      content.first().boundingBox()
    ]);
    expect.soft(
      contentBox?.y ?? 0,
      `${context}: de topbar overlapt de pagina-inhoud niet`
    ).toBeGreaterThanOrEqual(
      (topbarBox?.y ?? 0) + (topbarBox?.height ?? 0) - 1
    );
  }
}

function todayStateLocator(page: Page, state: (typeof todayStates)[number]) {
  if (state === "loading") {
    return page.locator(
      'section[aria-labelledby="operational-loading-title"][data-state="loading"]'
    );
  }
  return page.locator(`[data-visual-state="${state}"]`);
}

async function assertWizardControls(page: Page, context: string) {
  const controls = page
    .locator("form")
    .locator(
      "button:visible, input:not([type=radio]):not([type=checkbox]):not([type=hidden]):visible, select:visible"
    );
  for (let index = 0; index < await controls.count(); index += 1) {
    const box = await controls.nth(index).boundingBox();
    expect.soft(box?.height ?? 0, `${context}: control ${index + 1}`).toBeGreaterThanOrEqual(44);
  }

  const panel = page.locator("form section[aria-labelledby^=studio-]:visible");
  const footer = page.locator("form footer:visible");
  if ((await panel.count()) > 0 && (await footer.count()) > 0) {
    const [panelBox, footerBox] = await Promise.all([
      panel.first().boundingBox(),
      footer.first().boundingBox()
    ]);
    expect.soft(
      (footerBox?.y ?? 0) + 1,
      `${context}: sticky acties overlappen het actieve paneel niet`
    ).toBeGreaterThanOrEqual((panelBox?.y ?? 0) + (panelBox?.height ?? 0));
  }
}

async function openStudioState(
  page: Page,
  state: (typeof studioStates)[number]
) {
  await page.goto(`${controlUrl}/dashboard/studio/new?family=free`);
  await expect(
    page.getByRole("heading", { exact: true, level: 1, name: "Nieuw ontwerp" })
  ).toBeVisible();

  const nameInput = page.getByLabel("Ontwerpnaam");
  if (state === "empty") return;

  const name =
    state === "long-copy"
      ? "Voorjaarscampagne voor alle jeugdteams, vrijwilligers, bezoekers en sponsoren in het clubhuis"
      : state === "template"
        ? "Wedstrijddag vanuit template"
        : state === "portrait"
          ? "Staand welkomstscherm"
          : state === "landscape"
            ? "Liggend clubhuisscherm"
            : "Voorjaarscampagne";
  await nameInput.fill(name);
  await expect(page.getByText("Invoer compleet", { exact: true })).toBeVisible();

  if (state === "portrait") {
    await page.getByText("Staand HD", { exact: true }).click();
    await expect(page.getByRole("radio", { name: /Staand HD/ })).toBeChecked();
    return;
  }

  if (state === "valid" || state === "landscape") {
    await expect(page.getByRole("radio", { name: /Liggend HD/ })).toBeChecked();
    return;
  }

  await page.getByRole("button", { name: "Volgende" }).click();
  await expect(page.getByRole("region", { name: "Startpunt" })).toBeVisible();

  if (state === "template") {
    const templateChoice = page
      .getByRole("region", { name: "Startpunt" })
      .locator('input[type="radio"]')
      .first();
    await templateChoice.check();
    await expect(templateChoice).toBeChecked();
    return;
  }

  await page.getByRole("button", { name: "Volgende" }).click();
  await expect(page.getByRole("region", { name: "Uitvoer" })).toBeVisible();
  await page.getByRole("button", { name: "Volgende" }).click();
  await expect(page.getByRole("region", { name: "Controleren" })).toBeVisible();
}

test.describe("Fieldflow release visual evidence", () => {
  test.skip(!evidenceEnabled, "requires explicit Fieldflow evidence opt-in");
  test.setTimeout(900_000);

  test("captures the required state and viewport matrix", async ({ browser }) => {
    mkdirSync(outputRoot, { recursive: true });
    const context = await browser.newContext();

    for (const viewport of shellOnly || studioOnly || marketingOnly || referenceOnly ? [] : todayViewports) {
      for (const state of todayStates) {
        const page = await context.newPage();
        const runtimeErrors = trackRuntimeErrors(page);
        await preparePage(page);
        await page.setViewportSize(viewport);
        await page.goto(
          `${controlUrl}/dashboard?visualState=${encodeURIComponent(state)}`
        );
        await expect(todayStateLocator(page, state)).toBeVisible();
        await settle(page);
        await assertNoHorizontalOverflow(page, `Vandaag ${state} ${viewport.name}`);
        await assertShellContract(page, `Vandaag ${state} ${viewport.name}`);
        if (state === "partial-error" || state === "full-error") {
          await expect(
            todayStateLocator(page, state).getByText(
              "De omgeving is operationeel",
              { exact: true }
            )
          ).toHaveCount(0);
        }
        await page.screenshot({
          fullPage: true,
          path: path.join(
            outputRoot,
            `today-${state}-${viewport.name}.png`
          )
        });
        assertNoRuntimeErrors(runtimeErrors, `Vandaag ${state} ${viewport.name}`);
        await page.close();
      }
    }

    for (const viewport of shellOnly || marketingOnly || referenceOnly ? [] : studioViewports) {
      for (const state of studioStates) {
        const page = await context.newPage();
        const runtimeErrors = trackRuntimeErrors(page);
        await preparePage(page);
        await page.setViewportSize(viewport);
        await openStudioState(page, state);
        await settle(page);
        if (state === "long-copy") {
          await expect(page).toHaveURL(/\/dashboard\/studio\/new\?family=free$/);
          await expect(page.getByRole("region", { name: "Controleren" })).toBeVisible();
        }
        await assertNoHorizontalOverflow(page, `Studio Nieuw ${state} ${viewport.name}`);
        await assertShellContract(page, `Studio Nieuw ${state} ${viewport.name}`);
        await assertWizardControls(page, `Studio Nieuw ${state} ${viewport.name}`);
        await page.screenshot({
          fullPage: true,
          path: path.join(
            outputRoot,
            `studio-new-${state}-${viewport.name}.png`
          )
        });
        assertNoRuntimeErrors(runtimeErrors, `Studio Nieuw ${state} ${viewport.name}`);
        await page.close();
      }
    }

    for (const viewport of shellOnly || studioOnly || referenceOnly ? [] : marketingViewports) {
      for (const state of ["loaded", "image-failure"] as const) {
        const page = await context.newPage();
        const runtimeErrors = trackRuntimeErrors(page);
        await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
        await page.setViewportSize(viewport);
        if (state === "image-failure") {
          await page.route("**/*", async (route) => {
            if (route.request().resourceType() === "image") {
              await route.abort();
              return;
            }
            await route.continue();
          });
        }
        await page.goto(marketingUrl);
        await expect(
          page.getByRole("heading", {
            level: 1,
            name: "Van clubverhaal naar ieder scherm."
          })
        ).toBeVisible();
        await settle(page);
        await assertNoHorizontalOverflow(page, `Marketing ${state} ${viewport.name}`);
        if (state === "loaded") {
          const heroImage = page.locator(
            ".prototype-hero__media img[data-marketing-image-state]"
          );
          await expect(heroImage).toHaveAttribute(
            "data-marketing-image-state",
            "loaded"
          );
          await expect(heroImage).toHaveCSS("opacity", "1");
        } else {
          await assertMarketingImagesFailQuietly(
            page,
            `Marketing ${state} ${viewport.name}`
          );
        }
        await page.screenshot({
          fullPage: true,
          path: path.join(
            outputRoot,
            `marketing-home-${state}-${viewport.name}.png`
          )
        });
        assertNoRuntimeErrors(
          runtimeErrors,
          `Marketing ${state} ${viewport.name}`,
          state === "image-failure"
        );
        await page.close();
      }
    }

    if (!studioOnly && !marketingOnly) {
      for (const reference of [
        {
          name: "overview",
          ready: '[data-visual-state="healthy"]',
          url: `${controlUrl}/dashboard?visualState=healthy`
        },
        {
          name: "planning",
          ready: 'section[aria-labelledby="smart-planning-title"]',
          url: `${controlUrl}/dashboard/planning?view=week&date=2026-08-24&visual=reference`
        },
        {
          name: "screens",
          ready: 'nav[aria-label="Weergave van de schermvloot"]',
          url: `${controlUrl}/dashboard/screens?visual=reference`
        }
      ] as const) {
        const page = await context.newPage();
        const runtimeErrors = trackRuntimeErrors(page);
        await preparePage(page);
        await page.setViewportSize({ height: 945, width: 1920 });
        await page.goto(reference.url);
        await expect(page.locator(reference.ready)).toBeVisible();
        await settle(page);
        await assertNoHorizontalOverflow(page, `${reference.name} exact reference`);
        await assertShellContract(page, `${reference.name} exact reference`);
        await page.screenshot({
          path: path.join(outputRoot, `reference-${reference.name}-1920x945.png`)
        });
        assertNoRuntimeErrors(runtimeErrors, `${reference.name} exact reference`);
        await page.close();
      }
    }

    if (!shellOnly && !marketingOnly) {
      const studioReference = await context.newPage();
      const studioRuntimeErrors = trackRuntimeErrors(studioReference);
      await preparePage(studioReference);
      await studioReference.setViewportSize({ height: 945, width: 1920 });
      await studioReference.goto(
        `${controlUrl}/dashboard/studio/system-matchday-landscape-hd-v1?visual=reference`
      );
      await expect(
        studioReference.getByText("Clubhuis — Vandaag", { exact: true })
      ).toBeVisible();
      await settle(studioReference);
      await assertNoHorizontalOverflow(studioReference, "Studio exact reference");
      await assertShellContract(studioReference, "Studio exact reference");
      await studioReference.screenshot({
        path: path.join(outputRoot, "reference-studio-1920x945.png")
      });
      assertNoRuntimeErrors(studioRuntimeErrors, "Studio exact reference");
      await studioReference.close();
    }

    if (!shellOnly && !studioOnly) {
      const marketingReference = await context.newPage();
      const marketingRuntimeErrors = trackRuntimeErrors(marketingReference);
      await marketingReference.emulateMedia({
        colorScheme: "light",
        reducedMotion: "reduce"
      });
      await marketingReference.setViewportSize({ height: 945, width: 1905 });
      await marketingReference.goto(marketingUrl);
      await expect(
        marketingReference.getByRole("heading", {
          level: 1,
          name: "Van clubverhaal naar ieder scherm."
        })
      ).toBeVisible();
      await settle(marketingReference);
      await assertNoHorizontalOverflow(
        marketingReference,
        "Marketing exact reference"
      );
      await marketingReference.screenshot({
        fullPage: true,
        path: path.join(outputRoot, "reference-marketing-full-1905x945.png")
      });
      assertNoRuntimeErrors(marketingRuntimeErrors, "Marketing exact reference");
      await marketingReference.close();

      const setupDesktop = await context.newPage();
      const setupDesktopRuntimeErrors = trackRuntimeErrors(setupDesktop);
      await setupDesktop.emulateMedia({
        colorScheme: "light",
        reducedMotion: "reduce"
      });
      await setupDesktop.setViewportSize({ height: 900, width: 1440 });
      await setupDesktop.goto(`${marketingUrl}/#opstelling`);
      const desktopVenue = setupDesktop.getByRole("group", {
        name: "2. Plaats schermen in je locatie"
      });
      await expect(desktopVenue).toBeVisible();
      await settle(setupDesktop);
      await assertNoHorizontalOverflow(
        setupDesktop,
        "Marketing opstelling desktop"
      );
      const [venueMapBox, zoneListBox] = await Promise.all([
        desktopVenue.locator(".setup-builder__venue-map").boundingBox(),
        desktopVenue.locator(".setup-builder__zone-list").boundingBox()
      ]);
      expect.soft(
        (zoneListBox?.x ?? 0) -
          ((venueMapBox?.x ?? 0) + (venueMapBox?.width ?? 0)),
        "Marketing opstelling desktop: ruimte tussen plattegrond en zonecopy"
      ).toBeGreaterThanOrEqual(32);
      await desktopVenue.screenshot({
        path: path.join(
          outputRoot,
          "marketing-home-setup-desktop-1440x900.png"
        )
      });
      assertNoRuntimeErrors(
        setupDesktopRuntimeErrors,
        "Marketing opstelling desktop"
      );
      await setupDesktop.close();

      const setupMobile = await context.newPage();
      const setupMobileRuntimeErrors = trackRuntimeErrors(setupMobile);
      await setupMobile.emulateMedia({
        colorScheme: "light",
        reducedMotion: "reduce"
      });
      await setupMobile.setViewportSize({ height: 844, width: 390 });
      await setupMobile.goto(`${marketingUrl}/#opstelling`);
      const setupStepper = setupMobile.getByRole("navigation", {
        name: "Stappen van de setup builder"
      });
      await expect(setupStepper).toBeVisible();
      await setupStepper.getByRole("button", { name: "2 Schermen" }).click();
      const mobileVenue = setupMobile.getByRole("group", {
        name: "2. Plaats schermen in je locatie"
      });
      await expect(mobileVenue).toBeVisible();
      await settle(setupMobile);
      await assertNoHorizontalOverflow(
        setupMobile,
        "Marketing opstelling mobiel"
      );
      await mobileVenue.screenshot({
        path: path.join(
          outputRoot,
          "marketing-home-setup-mobile-390x844.png"
        )
      });
      assertNoRuntimeErrors(
        setupMobileRuntimeErrors,
        "Marketing opstelling mobiel"
      );
      await setupMobile.close();
    }

    if (referenceOnly) {
      await context.close();
      return;
    }

    if (studioOnly || marketingOnly) {
      await context.close();
      return;
    }

    // Chromium can retain raster resources after the 70 preceding full-page
    // captures. Start the shell proof in a fresh context so the collapsed
    // sidebar screenshot remains deterministic on bounded CI runners.
    await context.close();
    const shellContext = await browser.newContext();

    const expanded = await shellContext.newPage();
    const expandedRuntimeErrors = trackRuntimeErrors(expanded);
    await preparePage(expanded);
    await expanded.setViewportSize({ height: 900, width: 1440 });
    await expanded.goto(
      `${controlUrl}/dashboard?visualState=empty-unconfigured`
    );
    await expect(expanded.locator(".control-shell")).not.toHaveClass(/collapsed/);
    await expect(expanded.getByRole("link", { name: "Instellingen" })).toBeVisible();
    await expect(expanded.getByRole("link", { name: "Terug naar website" })).toBeVisible();
    await settle(expanded);
    await expanded.screenshot({
      path: path.join(outputRoot, "control-shell-expanded-1440x900.png")
    });

    await expanded.getByRole("button", { name: "Navigatie inklappen" }).click();
    await expect(expanded.locator(".control-shell")).toHaveClass(/collapsed/);
    await expect(expanded.locator(".control-nav__copy:visible")).toHaveCount(0);
    await expect(expanded.locator(".tenant-switcher__copy:visible")).toHaveCount(0);
    const [collapsedSidebarBox, collapsedTenantMarkBox] = await Promise.all([
      expanded.locator(".control-sidebar").boundingBox(),
      expanded.locator(".tenant-switcher__mark").boundingBox()
    ]);
    expect.soft(
      (collapsedTenantMarkBox?.x ?? 0) + (collapsedTenantMarkBox?.width ?? 0),
      "Ingeklapte tenantschakelaar blijft binnen de zijbalk"
    ).toBeLessThanOrEqual(
      (collapsedSidebarBox?.x ?? 0) + (collapsedSidebarBox?.width ?? 0)
    );
    await settle(expanded);
    await expanded.screenshot({
      path: path.join(outputRoot, "control-shell-collapsed-1440x900.png")
    });
    assertNoRuntimeErrors(expandedRuntimeErrors, "Control shell desktop");
    await expanded.close();

    const mobile = await shellContext.newPage();
    const mobileRuntimeErrors = trackRuntimeErrors(mobile);
    await preparePage(mobile);
    await mobile.setViewportSize({ height: 844, width: 390 });
    await mobile.goto(
      `${controlUrl}/dashboard?visualState=empty-unconfigured`
    );
    await expect(mobile.locator(".control-sidebar")).not.toHaveClass(/--open/);
    await settle(mobile);
    await mobile.screenshot({
      path: path.join(outputRoot, "control-shell-mobile-closed-390x844.png")
    });

    const openNavigation = mobile.getByRole("button", {
      exact: true,
      name: "Meer"
    });
    await expect(openNavigation).toBeEnabled({ timeout: 10_000 });
    await expect(openNavigation).toHaveAttribute("aria-expanded", "false");
    await openNavigation.click({ timeout: 10_000 });
    await expect(mobile.locator(".control-sidebar")).toHaveClass(/--open/);
    await expect(openNavigation).toHaveAttribute("aria-expanded", "true");
    await expect(mobile.locator(".control-organization-card")).toBeHidden();
    await assertShellContract(mobile, "Control shell mobile open");
    await mobile.screenshot({
      animations: "disabled",
      caret: "hide",
      path: path.join(outputRoot, "control-shell-mobile-open-390x844.png"),
      timeout: 10_000
    });
    assertNoRuntimeErrors(mobileRuntimeErrors, "Control shell mobile");
    await mobile.close();
    await shellContext.close();
  });
});
