import { mkdirSync } from "node:fs";
import path from "node:path";

import { createServerClient } from "@supabase/ssr";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";

const evidenceEnabled = process.env.ATELIER_IVORY_EVIDENCE === "1";
const evidenceStage = process.env.ATELIER_IVORY_STAGE ?? "baseline";
const demoEvidence = process.env.ATELIER_IVORY_DEMO === "1";

const allRoutes = [
  { name: "overview", pathname: "/dashboard" },
  { name: "screens", pathname: "/dashboard/screens" },
  { name: "playlists", pathname: "/dashboard/playlists" },
  {
    liveOnly: true,
    name: "playlist-editor",
    pathname: "/dashboard/playlists"
  },
  { name: "media", pathname: "/dashboard/media" },
  { name: "planning", pathname: "/dashboard/planning" },
  { name: "studio", pathname: "/dashboard/studio" },
  { name: "studio-new", pathname: "/dashboard/studio/new" },
  {
    demoOnly: true,
    name: "studio-editor",
    pathname: "/dashboard/studio/system-matchday-landscape-hd-v1"
  }
] as const;

const allViewports = [
  { height: 844, name: "390x844", width: 390 },
  { height: 1024, name: "768x1024", width: 768 },
  { height: 900, name: "1440x900", width: 1440 },
  { height: 1080, name: "1920x1080", width: 1920 }
] as const;

const themes = ["light", "dark"] as const;
const requestedRoutes = new Set(
  (process.env.ATELIER_IVORY_ROUTES ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
);
const requestedViewports = new Set(
  (process.env.ATELIER_IVORY_VIEWPORTS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
);
const routes = (
  requestedRoutes.size
    ? allRoutes.filter((route) => requestedRoutes.has(route.name))
    : allRoutes
).filter((route) => !("demoOnly" in route) || demoEvidence);
const activeRoutes = routes.filter(
  (route) => !("liveOnly" in route) || !demoEvidence
);
const viewports = requestedViewports.size
  ? allViewports.filter((viewport) => requestedViewports.has(viewport.name))
  : allViewports;

async function authenticateAgainstLocalSupabase(context: BrowserContext) {
  if (demoEvidence) return;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) {
    throw new Error("Atelier Ivory evidence requires local Supabase public configuration.");
  }

  let authCookies: Array<{ name: string; value: string }> = [];
  const supabase = createServerClient(supabaseUrl, anonKey, {
    cookies: {
      getAll: () => authCookies,
      setAll: (cookies) => {
        authCookies = cookies.map(({ name, value }) => ({ name, value }));
      }
    }
  });
  const { error } = await supabase.auth.signInWithPassword({
    email: "pilot-admin@veyocast.test",
    password: "veyocast-local"
  });
  if (error) throw error;

  await context.addCookies([
    ...authCookies.map(({ name, value }) => ({
      domain: "127.0.0.1",
      name,
      path: "/",
      value
    })),
    {
      domain: "127.0.0.1",
      httpOnly: true,
      name: "veyocast-tenant-context",
      path: "/",
      sameSite: "Lax" as const,
      value: "veyocast-pilot"
    }
  ]);
}

async function navigate(page: Page, pathname: string) {
  await expect(async () => {
    try {
      await page.goto(pathname, { waitUntil: "domcontentloaded" });
    } catch (error) {
      if (!String(error).includes("ERR_ABORTED")) throw error;
    }
    await expect(page).toHaveURL(
      new RegExp(`${pathname.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`)
    );
    await expect(page.locator("#control-content")).toBeVisible();
    await expect(page.locator("h1")).toBeVisible();
  }).toPass({ timeout: 30_000 });
  await page.addStyleTag({
    content: "nextjs-portal { display: none !important; }"
  });
}

async function resolveRoute(
  page: Page,
  route: (typeof allRoutes)[number],
  resolvedPaths: Map<string, string>
) {
  if (route.name !== "playlist-editor") return route.pathname;

  const cached = resolvedPaths.get(route.name);
  if (cached) return cached;

  await navigate(page, route.pathname);
  const editorLink = page.locator(
    'a[href^="/dashboard/playlists/"]:not([href$="/new"])'
  ).first();
  if (await editorLink.count()) {
    const href = await editorLink.getAttribute("href");
    if (href) {
      const pathname = new URL(href, "http://127.0.0.1").pathname;
      resolvedPaths.set(route.name, pathname);
      return pathname;
    }
  }

  await page.getByRole("button", { name: "Nieuwe playlist" }).click();
  const dialog = page.getByRole("dialog", { name: "Nieuwe playlist" });
  await dialog.getByLabel("Playlistnaam").fill("Atelier Ivory visuele review");
  await dialog.getByRole("button", { name: "Concept maken" }).click();
  await expect(dialog).not.toBeVisible();
  let pathname = new URL(page.url()).pathname;
  if (!/\/dashboard\/playlists\/[^/]+$/.test(pathname)) {
    const createdLink = page.getByRole("link", {
      exact: true,
      name: "Atelier Ivory visuele review"
    }).first();
    await expect(createdLink).toBeVisible();
    const href = await createdLink.getAttribute("href");
    if (!href) throw new Error("De lokale playlistfixture heeft geen editorlink.");
    pathname = new URL(href, "http://127.0.0.1").pathname;
  }
  resolvedPaths.set(route.name, pathname);
  return pathname;
}

async function assertSummaryStripsFit(page: Page, context: string) {
  const summaries = page.locator(".vc-summary-strip");
  for (let index = 0; index < await summaries.count(); index += 1) {
    const metrics = await summaries.nth(index).evaluate((element) => {
      const bounds = element.getBoundingClientRect();
      const elementStyle = getComputedStyle(element);
      const items = Array.from(element.children).map((child) => {
        const itemBounds = child.getBoundingClientRect();
        const itemStyle = getComputedStyle(child);
        return {
          bottom: Math.round(itemBounds.bottom),
          display: itemStyle.display,
          height: Math.round(itemBounds.height),
          left: Math.round(itemBounds.left),
          right: Math.round(itemBounds.right),
          position: itemStyle.position,
          top: Math.round(itemBounds.top),
          width: Math.round(itemBounds.width)
        };
      });
      return {
        bounds: {
          bottom: Math.round(bounds.bottom),
          left: Math.round(bounds.left),
          right: Math.round(bounds.right),
          top: Math.round(bounds.top)
        },
        clientWidth: element.clientWidth,
        display: elementStyle.display,
        height: elementStyle.height,
        items,
        position: elementStyle.position,
        scrollWidth: element.scrollWidth
      };
    });
    const fits =
      metrics.scrollWidth <= metrics.clientWidth &&
      metrics.items.every(
        (item) =>
          item.display !== "none" &&
          item.height > 0 &&
          item.width > 0 &&
          item.top >= metrics.bounds.top - 1 &&
          item.bottom <= metrics.bounds.bottom + 1 &&
          item.left >= metrics.bounds.left - 1 &&
          item.right <= metrics.bounds.right + 1
      );
    expect.soft(fits, `${context}: ${JSON.stringify(metrics)}`).toBe(true);
  }
}

test.describe("Atelier Ivory visual evidence", () => {
  test.skip(!evidenceEnabled, "requires local Supabase and explicit evidence opt-in");
  test.setTimeout(900_000);

  test("captures every primary workspace in the canonical viewport and theme matrix", async ({
    browser
  }) => {
    const evidenceDirectory = process.env.ATELIER_IVORY_OUTPUT_ROOT
      ? path.resolve(process.env.ATELIER_IVORY_OUTPUT_ROOT, evidenceStage)
      : path.resolve(
          "docs",
          "screenshots",
          "atelier-ivory",
          evidenceStage
        );
    mkdirSync(evidenceDirectory, { recursive: true });

    const context = await browser.newContext();
    await authenticateAgainstLocalSupabase(context);
    const resolvedPaths = new Map<string, string>();

    for (const theme of themes) {
      const page = await context.newPage();
      await page.addInitScript((selectedTheme) => {
        window.localStorage.setItem("veyocast-control-theme", selectedTheme);
        window.localStorage.setItem("veyocast-control-density", "comfortable");
      }, theme);

      for (const viewport of viewports) {
        await page.setViewportSize({
          height: viewport.height,
          width: viewport.width
        });

        for (const route of activeRoutes) {
          const pathname = await resolveRoute(page, route, resolvedPaths);
          await navigate(page, pathname);
          await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
          if (route.name === "planning") {
            await expect(
              page.locator(".vc-summary-strip > .vc-summary-strip__item")
            ).toHaveCount(3);
          }
          await page.waitForTimeout(250);

          expect.soft(
            await page.evaluate(
              () =>
                document.documentElement.scrollWidth <=
                document.documentElement.clientWidth
            ),
            `${pathname} blijft binnen ${viewport.name} in ${theme}`
          ).toBe(true);
          await assertSummaryStripsFit(
            page,
            `${pathname} ${viewport.name} ${theme}`
          );

          await page.screenshot({
            fullPage: true,
            path: path.join(
              evidenceDirectory,
              `${route.name}-${viewport.name}-${theme}.png`
            )
          });
        }
      }

      await page.close();
    }

    await context.close();
  });
});
