import { expect, test } from "@playwright/test";

const marketingURL = `http://127.0.0.1:${process.env.MARKETING_PORT ?? 3108}`;

const representativeRoutes = [
  "/",
  "/narrowcasting",
  "/functies",
  "/koppelingen",
  "/players",
  "/oplossingen/horeca",
  "/oplossingen/bedrijven",
  "/product",
  "/functies/playlists",
  "/oplossingen/sportverenigingen",
  "/integraties",
  "/integraties/sportlink",
  "/integraties/twelve-xlsx",
  "/integraties/rss-nieuws",
  "/integraties/youtube",
  "/sponsor-hub",
  "/engage",
  "/prijzen",
  "/demo",
  "/contact",
  "/kennisbank/wat-is-narrowcasting",
  "/veelgestelde-vragen",
  "/cookies",
  "/toegankelijkheid"
] as const;

test("publishes complete metadata and one H1 across every page template", async ({
  page
}) => {
  test.slow();
  for (const pathname of representativeRoutes) {
    const response = await page.goto(`${marketingURL}${pathname}`);

    expect(response?.status(), pathname).toBe(200);
    await expect(page.locator("h1"), pathname).toHaveCount(1);
    await expect(page.locator('meta[name="description"]'), pathname).toHaveAttribute(
      "content",
      /.{70,}/
    );
    await expect(page.locator('meta[property="og:title"]'), pathname).toHaveAttribute(
      "content",
      /VeyoCast/
    );
    await expect(page.locator('link[rel="canonical"]'), pathname).toHaveAttribute(
      "href",
      `https://veyocast.nl${pathname === "/" ? "" : pathname}`
    );
    await expect(page.locator('meta[name="robots"]'), pathname).toHaveAttribute(
      "content",
      /noindex/
    );
    expect(
      await page.locator('main a[href^="/"]').count(),
      `${pathname} needs contextual links`
    ).toBeGreaterThanOrEqual(3);
  }
});

test("Sync mobile navigation opens and resolves the platform route", async ({ page }) => {
  await page.setViewportSize({ height: 844, width: 390 });
  await page.goto(marketingURL);
  const button = page.getByRole("button", { name: "Menu openen" });
  await button.click();
  const nav = page.getByRole("navigation", { name: "Publieke hoofdnavigatie" });
  await expect(nav).toBeVisible();
  await expect(page.getByRole("button", { name: "Menu sluiten" })).toHaveAttribute("aria-expanded", "true");
  await nav.getByRole("link", { name: "Platform", exact: true }).click();
  await expect(page).toHaveURL(/\/functies\/?$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Alles voor je schermen.");
});

test("FAQ accordion works with keyboard input", async ({ page }) => {
  await page.goto(`${marketingURL}/product`);
  const trigger = page.getByRole("button", {
    name: "Wat heb ik nodig om te starten?"
  });

  await trigger.focus();
  await page.keyboard.press("Enter");

  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  await expect(
    page.getByText(
      "Een VeyoCast-organisatie, minimaal één ondersteund afspeelapparaat en een scherm met internet voor registratie en synchronisatie."
    )
  ).toBeVisible();
});

test("demo form validates server-side and reports no false delivery", async ({
  page
}) => {
  await page.goto(`${marketingURL}/demo`);
  await page.locator("form").evaluate(form => { (form as HTMLFormElement).noValidate = true; });
  await page.getByRole("button", { name: "Demo aanvragen", exact: true }).click();

  await expect(page.locator(".mk-form-error[role='alert']")).toContainText("Controleer de gemarkeerde velden");
  await expect(page.getByText("Vul een geldig e-mailadres in.")).toBeVisible();
});

test("homepage and product templates have no horizontal overflow", async ({
  page
}) => {
  test.slow();
  for (const width of [1440, 1024, 768, 430, 390, 360]) {
    await page.setViewportSize({ height: 844, width });
    for (const pathname of ["/", "/product", "/demo"]) {
      await page.goto(`${marketingURL}${pathname}`);
      const overflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth >
          document.documentElement.clientWidth
      );
      expect(overflow, `${pathname} at ${width}px`).toBe(false);
    }
  }
});

test("unpublished blog posts and cases resolve to the branded 404", async ({
  page
}) => {
  for (const pathname of ["/blog/niet-gepubliceerd", "/cases/niet-gepubliceerd"]) {
    const response = await page.goto(`${marketingURL}${pathname}`);

    expect(response?.status(), pathname).toBe(404);
    await expect(
      page.getByRole("heading", { level: 1, name: "Dit scherm staat niet in de playlist." })
    ).toBeVisible();
  }
});
