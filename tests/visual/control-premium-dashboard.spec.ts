import path from "node:path";

import { createServerClient } from "@supabase/ssr";
import { expect, test, type Page } from "@playwright/test";

const visualEvidenceEnabled = process.env.VEYOCAST_VISUAL_EVIDENCE === "1";

async function authenticateAgainstLocalSupabase(page: Page) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) {
    throw new Error("Visual evidence requires the local Supabase public configuration.");
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

  await page.context().addCookies([
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
      sameSite: "Lax",
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
    await expect(page).toHaveURL(new RegExp(`${pathname.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`));
    await expect(page.locator("#control-content")).toBeVisible();
  }).toPass({ timeout: 30_000 });
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
}

async function capture(
  page: Page,
  pathname: string,
  fileName: string,
  viewport: { height: number; width: number }
) {
  await page.setViewportSize(viewport);
  await navigate(page, pathname);
  await expect(page.locator("h1")).toBeVisible();
  await page.waitForTimeout(350);
  expect(await page.evaluate(
    () => document.documentElement.scrollWidth <= document.documentElement.clientWidth
  )).toBe(true);
  await page.screenshot({
    fullPage: true,
    path: path.resolve(`docs/screenshots/${fileName}`)
  });
}

test.describe("S49 premium Control evidence", () => {
  test.skip(!visualEvidenceEnabled, "requires local Supabase and explicit visual evidence opt-in");
  test.setTimeout(240_000);

  test("captures the prioritized workspaces across themes and viewports", async ({ page }) => {
    await authenticateAgainstLocalSupabase(page);

    await capture(page, "/dashboard", "s49-dashboard-desktop.png", { height: 900, width: 1440 });
    await capture(page, "/dashboard", "s49-dashboard-mobile.png", { height: 844, width: 390 });
    await capture(page, "/dashboard/media", "s49-media-desktop.png", { height: 900, width: 1440 });
    await capture(page, "/dashboard/media", "s49-media-mobile.png", { height: 844, width: 390 });
    await capture(page, "/dashboard/screens", "s49-screens-desktop.png", { height: 900, width: 1440 });
    await capture(page, "/dashboard/screens", "s49-screens-mobile.png", { height: 844, width: 390 });
    await capture(page, "/dashboard/settings", "s49-settings-desktop.png", { height: 900, width: 1440 });
    await capture(page, "/dashboard/team", "s49-team-mobile.png", { height: 844, width: 390 });
    await capture(page, "/dashboard/support", "s49-support-desktop.png", { height: 900, width: 1440 });
    await capture(page, "/dashboard/support", "s49-support-mobile.png", { height: 844, width: 390 });

    const darkPage = await page.context().newPage();
    await darkPage.addInitScript(() => {
      window.localStorage.setItem("veyocast-control-theme", "dark");
      window.localStorage.setItem("veyocast-control-density", "compact");
    });
    await capture(darkPage, "/dashboard", "s49-dashboard-dark-compact.png", { height: 900, width: 1440 });
    await darkPage.close();
  });

  test("keeps priority routes inside every canonical viewport", async ({ page }) => {
    await authenticateAgainstLocalSupabase(page);
    for (const width of [320, 390, 768, 1024, 1280, 1440, 1920]) {
      await page.setViewportSize({ height: 900, width });
      for (const pathname of [
        "/dashboard",
        "/dashboard/media",
        "/dashboard/screens",
        "/dashboard/settings",
        "/dashboard/team",
        "/dashboard/support"
      ]) {
        await navigate(page, pathname);
        expect.soft(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= document.documentElement.clientWidth
          ),
          `${pathname} blijft binnen ${width}px`
        ).toBe(true);
      }
    }
  });
});
