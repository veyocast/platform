import path from "node:path";

import { createServerClient } from "@supabase/ssr";
import { expect, test, type Page } from "@playwright/test";

const visualEvidenceEnabled =
  process.env.VEYOCAST_AUTOMATION_VISUAL_EVIDENCE === "1";
const screenId = "40000000-0000-4000-8000-000000000101";

async function authenticateAgainstLocalSupabase(page: Page) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) {
    throw new Error("Automation evidence requires local Supabase configuration.");
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

async function openAutomation(page: Page) {
  const pathname = `/dashboard/screens/${screenId}?tab=automation`;
  await expect(async () => {
    try {
      await page.goto(pathname, { waitUntil: "domcontentloaded" });
    } catch (error) {
      if (!String(error).includes("ERR_ABORTED")) throw error;
    }
    await expect(
      page.getByRole("heading", { name: "Bedrijfstijden en startgedrag" })
    ).toBeVisible();
  }).toPass({ timeout: 30_000 });
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
}

test.describe("Screen automation visual evidence", () => {
  test.skip(
    !visualEvidenceEnabled,
    "requires local Supabase and explicit visual evidence opt-in"
  );
  test.setTimeout(120_000);

  test("captures desktop and mobile automation journeys", async ({ page }) => {
    await authenticateAgainstLocalSupabase(page);

    await page.setViewportSize({ height: 1000, width: 1440 });
    await openAutomation(page);
    await page.screenshot({
      animations: "disabled",
      fullPage: true,
      path: path.resolve("docs/screenshots/s47-screen-automation-desktop.png")
    });

    await page.setViewportSize({ height: 844, width: 390 });
    await openAutomation(page);
    await expect(
      page.getByRole("heading", { name: "Bedrijfstijden en startgedrag" })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Automatisering opslaan" })
    ).toBeVisible();
    await page.screenshot({
      animations: "disabled",
      fullPage: true,
      path: path.resolve("docs/screenshots/s47-screen-automation-mobile.png")
    });
  });
});
