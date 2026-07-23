import path from "node:path";

import { createServerClient } from "@supabase/ssr";
import { expect, test } from "@playwright/test";

const visualEvidenceEnabled = process.env.VEYOCAST_VISUAL_EVIDENCE === "1";

async function authenticateAgainstLocalSupabase(page: import("@playwright/test").Page) {
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

  if (error) {
    throw error;
  }

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

test.describe("Control enterprise roles evidence", () => {
  test.skip(!visualEvidenceEnabled, "requires local Supabase and explicit visual evidence opt-in");
  test.setTimeout(90_000);

  test("captures the tenant role workspace on desktop and mobile", async ({ page }) => {
    await page.setViewportSize({ height: 1000, width: 1440 });
    await authenticateAgainstLocalSupabase(page);
    await page.goto("/dashboard", { waitUntil: "commit" });
    await expect(page).toHaveURL(/\/dashboard$/);

    await page.goto("/dashboard/team", { waitUntil: "commit" });
    await expect(page.getByRole("heading", { level: 2, name: "Custom rollen" })).toBeVisible();
    await page.waitForLoadState("networkidle");
    if (await page.getByText("Contentcoördinator", { exact: true }).count() === 0) {
      await page.getByRole("button", { name: "Nieuwe custom rol" }).click();
      const dialog = page.getByRole("dialog", { name: "Custom rol maken" });
      await dialog.getByLabel("Rolnaam").fill("Contentcoördinator");
      await dialog.getByLabel("Beschrijving").fill("Beheert content en publicaties");
      await dialog.getByLabel(/Content bewerken/).check();
      await dialog.getByLabel(/Publiceren/).check();
      await dialog.getByRole("button", { name: "Rol maken" }).click();
      await expect(page.getByText("De custom rol en effectieve werkrechten zijn opgeslagen.")).toBeVisible();
    }

    await expect(page.getByRole("heading", { level: 2, name: "Custom rollen" })).toBeVisible();
    await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
    await page.screenshot({
      fullPage: true,
      path: path.resolve("docs/screenshots/s31b-team-roles-desktop.png")
    });

    await page.setViewportSize({ height: 844, width: 390 });
    await page.reload();
    await expect(page.getByRole("heading", { level: 2, name: "Custom rollen" })).toBeVisible();
    await page.screenshot({
      fullPage: true,
      path: path.resolve("docs/screenshots/s31b-team-roles-mobile.png")
    });
  });
});
