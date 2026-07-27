import path from "node:path";

import { createServerClient } from "@supabase/ssr";
import { expect, test, type Page } from "@playwright/test";

const visualEvidenceEnabled = process.env.VEYOCAST_VISUAL_EVIDENCE === "1";

async function navigate(
  page: Page,
  pathname: string
) {
  await expect(async () => {
    try {
      await page.goto(pathname, { waitUntil: "domcontentloaded" });
    } catch (error) {
      if (!String(error).includes("ERR_ABORTED")) throw error;
    }
    await expect(page).toHaveURL(new RegExp(`${pathname.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`));
  }).toPass({ timeout: 20_000 });
}

async function hideDevelopmentOverlays(page: Page) {
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
}

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

  return supabase;
}

async function ensureEditableTemplateEvidence(
  supabase: Awaited<ReturnType<typeof authenticateAgainstLocalSupabase>>
) {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) throw userError ?? new Error("Visual evidence user ontbreekt.");

  const { data: membership, error: membershipError } = await supabase
    .from("tenant_memberships")
    .select("tenant_id")
    .eq("user_id", userData.user.id)
    .limit(1)
    .single();
  if (membershipError || !membership) {
    throw membershipError ?? new Error("Visual evidence tenantmembership ontbreekt.");
  }

  const playlistResult = await supabase
    .from("playlists")
    .select("id")
    .eq("tenant_id", membership.tenant_id)
    .eq("name", "Visuele basisplaylist")
    .maybeSingle();
  let playlist = playlistResult.data;
  if (playlistResult.error) throw playlistResult.error;
  if (!playlist) {
    const created = await supabase
      .from("playlists")
      .insert({
        created_by: userData.user.id,
        description: "Herbruikbare basis voor clubpublicaties",
        name: "Visuele basisplaylist",
        status: "draft",
        tenant_id: membership.tenant_id,
        updated_by: userData.user.id
      })
      .select("id")
      .single();
    if (created.error || !created.data) {
      throw created.error ?? new Error("Visual evidence playlist kon niet worden gemaakt.");
    }
    playlist = created.data;
  }

  const { data: existingTemplate, error: templateReadError } = await supabase
    .from("tenant_playlist_templates")
    .select("id")
    .eq("tenant_id", membership.tenant_id)
    .eq("name", "Clubpublicatie")
    .maybeSingle();
  if (templateReadError) throw templateReadError;
  if (!existingTemplate) {
    const { error: templateCreateError } = await supabase.rpc(
      "create_tenant_playlist_template_v1",
      {
        p_description: "Bewerkbare basis voor terugkerende publicaties",
        p_idempotency_key: crypto.randomUUID(),
        p_name: "Clubpublicatie",
        p_playlist_id: playlist.id
      }
    );
    if (templateCreateError) throw templateCreateError;
  }
}

async function expectFormGridAlignment(
  page: Page,
  selector: string
) {
  const geometry = await page.locator(selector).first().evaluate((grid) => {
    const fields = Array.from(grid.querySelectorAll<HTMLElement>(":scope > .field"));
    return fields.map((field) => {
      const label = field.querySelector<HTMLElement>(":scope > label");
      const control = field.querySelector<HTMLElement>(
        ":scope > input:not([type='hidden']):not([type='checkbox']):not([type='radio']), :scope > select, :scope > textarea"
      );
      const fieldRect = field.getBoundingClientRect();
      const labelRect = label?.getBoundingClientRect();
      const controlRect = control?.getBoundingClientRect();

      return {
        controlHeight: controlRect?.height ?? 0,
        controlTop: controlRect?.top ?? 0,
        controlWidth: controlRect?.width ?? 0,
        fieldTop: fieldRect.top,
        fieldWidth: fieldRect.width,
        labelTop: labelRect?.top ?? 0
      };
    });
  });

  expect(geometry.length).toBeGreaterThan(1);
  const firstRowTop = Math.min(...geometry.map(({ fieldTop }) => fieldTop));
  const firstRow = geometry.filter(({ fieldTop }) => Math.abs(fieldTop - firstRowTop) <= 1);
  expect(firstRow.length).toBeGreaterThan(1);
  expect(Math.max(...firstRow.map(({ labelTop }) => labelTop)) - Math.min(...firstRow.map(({ labelTop }) => labelTop))).toBeLessThanOrEqual(1);
  expect(Math.max(...firstRow.map(({ controlTop }) => controlTop)) - Math.min(...firstRow.map(({ controlTop }) => controlTop))).toBeLessThanOrEqual(1);
  for (const field of firstRow) {
    expect(Math.abs(field.controlWidth - field.fieldWidth)).toBeLessThanOrEqual(1);
    expect(field.controlHeight).toBe(44);
  }
}

test.describe("Control enterprise roles evidence", () => {
  test.skip(!visualEvidenceEnabled, "requires local Supabase and explicit visual evidence opt-in");
  test.setTimeout(180_000);

  test("captures the tenant role workspace on desktop and mobile", async ({ page }) => {
    await page.setViewportSize({ height: 1000, width: 1440 });
    const supabase = await authenticateAgainstLocalSupabase(page);
    await navigate(page, "/dashboard");
    await expect(page).toHaveURL(/\/dashboard$/);

    await navigate(page, "/dashboard/team");
    await page.getByRole("tab", { name: "Rollen" }).click();
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
      await page.getByRole("tab", { name: "Rollen" }).click();
    }

    await expect(page.getByRole("heading", { level: 2, name: "Custom rollen" })).toBeVisible();
    await hideDevelopmentOverlays(page);
    await page.screenshot({
      fullPage: true,
      path: path.resolve("docs/screenshots/s31b-team-roles-desktop.png")
    });

    await page.setViewportSize({ height: 844, width: 390 });
    await navigate(page, "/dashboard/team");
    await page.getByRole("tab", { name: "Rollen" }).click();
    await expect(page.getByRole("heading", { level: 2, name: "Custom rollen" })).toBeVisible();
    await hideDevelopmentOverlays(page);
    await page.screenshot({
      fullPage: true,
      path: path.resolve("docs/screenshots/s31b-team-roles-mobile.png")
    });

    await page.getByRole("button", { name: "Teamlid uitnodigen" }).click();
    await page.getByRole("dialog", { name: "Teamlid uitnodigen" }).screenshot({
      path: path.resolve("docs/screenshots/s31b-team-invite-mobile.png")
    });
    await page.getByRole("button", { name: "Sluiten" }).click();

    await ensureEditableTemplateEvidence(supabase);
    await page.setViewportSize({ height: 1000, width: 1440 });
    await navigate(page, "/dashboard/templates");
    await expect(page.getByRole("heading", { level: 1, name: "Templates" })).toBeVisible();
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("Clubpublicatie", { exact: true })).toBeVisible();
    await hideDevelopmentOverlays(page);
    await page.screenshot({
      fullPage: true,
      path: path.resolve("docs/screenshots/s31b-templates-desktop.png")
    });

    await page.setViewportSize({ height: 844, width: 390 });
    await navigate(page, "/dashboard/templates");
    await expect(page.getByRole("heading", { level: 1, name: "Templates" })).toBeVisible();
    await hideDevelopmentOverlays(page);
    await page.screenshot({
      fullPage: true,
      path: path.resolve("docs/screenshots/s31b-templates-mobile.png")
    });

    await page.setViewportSize({ height: 1000, width: 1440 });
    await navigate(page, "/dashboard/settings");
    await expect(page.getByRole("heading", { level: 1, name: "Instellingen" })).toBeVisible();
    await page.getByRole("button", { name: "Afspelen", exact: true }).click();
    await expectFormGridAlignment(page, "#afspelen .form-grid");
    await page.getByRole("button", { name: "Schermen", exact: true }).click();
    await expectFormGridAlignment(page, "#schermen .form-grid");
    await hideDevelopmentOverlays(page);
    await page.screenshot({
      fullPage: true,
      path: path.resolve("docs/screenshots/s31b-settings-desktop.png")
    });

    await page.setViewportSize({ height: 844, width: 390 });
    await navigate(page, "/dashboard/settings");
    await expect(page.getByRole("heading", { level: 1, name: "Instellingen" })).toBeVisible();
    await hideDevelopmentOverlays(page);
    await page.screenshot({
      fullPage: true,
      path: path.resolve("docs/screenshots/s31b-settings-mobile.png")
    });

    await page.setViewportSize({ height: 1000, width: 1440 });
    await navigate(page, "/dashboard/screens/new");
    await expect(page.getByRole("heading", { level: 1, name: "Scherm toevoegen" })).toBeVisible();
    await expectFormGridAlignment(page, ".onboarding-workspace .form-grid");
    await hideDevelopmentOverlays(page);
    await page.screenshot({
      fullPage: true,
      path: path.resolve("docs/screenshots/s31b-screen-onboarding-desktop.png")
    });

    await page.setViewportSize({ height: 844, width: 390 });
    await navigate(page, "/dashboard/screens/new");
    await expect(page.getByRole("heading", { level: 1, name: "Scherm toevoegen" })).toBeVisible();
    await hideDevelopmentOverlays(page);
    await page.screenshot({
      fullPage: true,
      path: path.resolve("docs/screenshots/s31b-screen-onboarding-mobile.png")
    });
  });
});
