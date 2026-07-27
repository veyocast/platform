import { mkdirSync } from "node:fs";
import path from "node:path";

import { createServerClient } from "@supabase/ssr";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";

const evidenceEnabled = process.env.ATELIER_IVORY_EVIDENCE === "1";
const evidenceStage = process.env.ATELIER_IVORY_STAGE ?? "baseline";

const routes = [
  { name: "overview", pathname: "/dashboard" },
  { name: "screens", pathname: "/dashboard/screens" },
  { name: "playlists", pathname: "/dashboard/playlists" },
  { name: "media", pathname: "/dashboard/media" },
  { name: "planning", pathname: "/dashboard/planning" },
  { name: "studio", pathname: "/dashboard/studio" }
] as const;

const viewports = [
  { height: 844, name: "390x844", width: 390 },
  { height: 1024, name: "768x1024", width: 768 },
  { height: 900, name: "1440x900", width: 1440 },
  { height: 1080, name: "1920x1080", width: 1920 }
] as const;

const themes = ["light", "dark"] as const;

async function authenticateAgainstLocalSupabase(context: BrowserContext) {
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

test.describe("Atelier Ivory visual evidence", () => {
  test.skip(!evidenceEnabled, "requires local Supabase and explicit evidence opt-in");
  test.setTimeout(900_000);

  test("captures every primary workspace in the canonical viewport and theme matrix", async ({
    browser
  }) => {
    const evidenceDirectory = path.resolve(
      "docs",
      "screenshots",
      "atelier-ivory",
      evidenceStage
    );
    mkdirSync(evidenceDirectory, { recursive: true });

    const context = await browser.newContext();
    await authenticateAgainstLocalSupabase(context);

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

        for (const route of routes) {
          await navigate(page, route.pathname);
          await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
          await page.waitForTimeout(250);

          expect.soft(
            await page.evaluate(
              () =>
                document.documentElement.scrollWidth <=
                document.documentElement.clientWidth
            ),
            `${route.pathname} blijft binnen ${viewport.name} in ${theme}`
          ).toBe(true);

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
