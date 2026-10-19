import AxeBuilder from "@axe-core/playwright";
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


for (const width of [390, 1440]) {
  test("retained public pages share Source chrome, readable actions and real native controls at " + width + "px", async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 });
    const writes: string[] = [];
    await page.route("**/*", async route => {
      const method = route.request().method();
      if (!["GET", "HEAD"].includes(method)) {
        writes.push(method + " " + new URL(route.request().url()).pathname);
        return route.abort();
      }
      return route.continue();
    });
    await page.goto(marketingURL + "/");
    const sourceAction = await page.locator(".mk-hero-actions .mk-button").evaluate(element => getComputedStyle(element).backgroundColor);
    const sourceLogin = await page.locator(".mk-header .mk-login").getAttribute("href");
    for (const pathname of ["/product", "/functies/schermen", "/prijzen", "/privacy", "/contact"]) {
      await page.goto(marketingURL + pathname);
      await expect(page.locator(".mk-site.mk-retained-site"), pathname).toHaveCount(1);
      await expect(page.getByRole("banner"), pathname).toHaveCount(1);
      await expect(page.getByRole("main"), pathname).toHaveCount(1);
      await expect(page.getByRole("contentinfo"), pathname).toHaveCount(1);
      await expect(page.locator(".marketing-header, .marketing-footer"), pathname).toHaveCount(0);
      await expect(page.locator(".mk-header .brand"), pathname).toHaveAttribute("src", "/assets/full-dark.svg");
      await expect(page.locator(".mk-header .mk-login"), pathname).toHaveAttribute("href", sourceLogin!);
      await expect(page.locator(".mk-skip"), pathname).toHaveAttribute("href", "#main-content");
      const utilities = page.getByRole("navigation", { name: "Meer over VeyoCast", exact: true });
      await expect(utilities.getByRole("link", { name: "Prijzen", exact: true })).toHaveAttribute("href", "/prijzen");
      await expect(utilities.getByRole("link", { name: "Contact", exact: true })).toHaveAttribute("href", "/contact");
      await expect(utilities.getByRole("link", { name: "Privacy", exact: true })).toHaveAttribute("href", "/privacy");
      const sourceInk = await page.locator(".mk-retained-site").evaluate(element => getComputedStyle(element).color);
      const actions = page.locator("main .button--primary");
      if (pathname === "/privacy") await expect(actions).toHaveCount(0);
      else {
        expect(await actions.count(), pathname).toBeGreaterThan(0);
        for (const action of await actions.all()) {
          await expect(action, pathname).toHaveCSS("background-color", sourceAction);
          await expect(action, pathname).toHaveCSS("color", sourceInk);
        }
      }
      await expect(page.locator(".page-hero .product-screenshot__image"), pathname).toHaveCount(0);
      await expect(page.locator('.page-hero img[src*="publisher-"], .page-hero img[src*="s31b-"]'), pathname).toHaveCount(0);
      if (pathname === "/product" || pathname === "/functies/schermen" || pathname === "/prijzen") {
        const preview = page.getByRole("figure", { name: "Voorbeeld van de VeyoCast-werkplek", exact: true });
        await expect(preview).toBeVisible();
        await expect(preview.locator(".mk-window-status")).toHaveText("Demo");
        await expect(preview.getByRole("link", { name: "Open werkplek", exact: false })).toHaveAttribute("href", sourceLogin!);
        await expect(preview.getByRole("button", { name: pathname === "/product" ? "Studio" : "Schermen", exact: true })).toHaveClass("active");
        await preview.getByRole("button", { name: "Playlists", exact: true }).click();
        await expect(preview.locator(".mk-product-title h3")).toHaveText("Een verhaal in de juiste volgorde.");
        await preview.getByRole("button", { name: "Schermen", exact: true }).click();
        await expect(preview.locator(".mk-product-title h3")).toHaveText("Ieder scherm in beeld.");
        await expect(preview.getByRole("heading", { name: "Entree", exact: true })).toBeVisible();
        await preview.getByRole("button", { name: pathname === "/product" ? "Studio" : "Schermen", exact: true }).click();
      }
      if (pathname !== "/prijzen" && pathname !== "/privacy") {
        await expect(page.locator(".page-intro h2")).toHaveText(pathname === "/contact" ? "Onze contactgegevens." : "Wat dit voor je oplevert.");
        const summary = page.locator(".page-intro__summary");
        const summaries: Record<string, string> = {
          "/product": "VeyoCast combineert een beheeromgeving en een offline-first Player. Daardoor blijft de operatie begrijpelijk en de content op locatie betrouwbaar.",
          "/functies/schermen": "VeyoCast behandelt een Player als device, niet als gebruiker. Pairing, sessies en releases blijven daardoor gescheiden van persoonlijke accounts.",
          "/contact": "Publieke contactgegevens: DG Webservices, Markenseplein 1, 2583 KR Den Haag, KvK 88135713."
        };
        await expect(summary).toHaveText(summaries[pathname]);
        await expect(summary).toHaveCSS("font-size", "16px");
        await expect(summary).toHaveCSS("line-height", "28.8px");
        const sourceMuted = await page.locator(".page-hero__lead").evaluate(element => getComputedStyle(element).color);
        await expect(summary).toHaveCSS("color", sourceMuted);
      }
      if (pathname === "/contact") await expect(page.locator(".page-hero__brandmark")).toBeHidden();
      if (pathname === "/product") {
        const gaps = await page.locator(".benefit-card").evaluateAll(cards => cards.map(card => {
          const icon = card.querySelector(":scope > span")!.getBoundingClientRect();
          const title = card.querySelector("h3")!.getBoundingClientRect();
          return title.top - icon.bottom;
        }));
        expect(gaps.length).toBeGreaterThan(0);
        for (const gap of gaps) expect(gap).toBeLessThanOrEqual(24);
        const sourceMuted = await page.locator(".page-hero__lead").evaluate(element => getComputedStyle(element).color);
        await expect(page.locator(".workflow-list p").first()).toHaveCSS("color", sourceMuted);
      }
      if (pathname === "/prijzen") {
        await expect(page.getByRole("heading", { name: "Betaal voor de schermen die je gebruikt.", exact: true })).toBeVisible();
        await expect(page.getByRole("heading", { name: "Direct inzicht in je maandbedrag", exact: true })).toBeVisible();
        await expect(page.getByRole("heading", { name: "Van proefperiode naar dagelijks gebruik.", exact: true })).toBeVisible();
        await expect(page.locator("main")).not.toContainText(/billable|billing|entitlement|integer cents/i);
        const trial = page.getByRole("button", { name: "Wanneer begint de proefperiode?", exact: true });
        await trial.click();
        await expect(page.getByText("De proefperiode begint bij de eerste succesvolle schermactivatie nadat je de voorwaarden hebt geaccepteerd. Elk factuuraccount heeft één proefperiode.", { exact: true })).toBeVisible();
        await trial.click();
        const count = page.getByRole("spinbutton", { name: "Aantal actieve schermen", exact: true });
        await expect(count).toHaveValue("1");
        const amount = page.locator(".price-calculator__estimate > p strong");
        await expect(amount).toContainText("€ 5,95");
        await page.getByRole("button", { name: "Eén scherm meer", exact: true }).click();
        await expect(count).toHaveValue("2");
        await expect(amount).toContainText("€ 11,90");
        await page.getByRole("button", { name: "Eén scherm minder", exact: true }).click();
        await expect(count).toHaveValue("1");
        await expect(amount).toContainText("€ 5,95");
      }
      if (pathname === "/contact") {
        await expect(page.locator(".benefits-section, .workflow-section, .final-cta-section")).toHaveCount(0);
        await expect(page.locator(".page-hero").getByRole("link", { name: "Mail VeyoCast", exact: true })).toHaveAttribute("href", "mailto:support@veyocast.nl");
        await expect(page.locator(".page-hero").getByRole("link", { name: "Bekijk ondersteuning", exact: true })).toHaveAttribute("href", "/support");
        await expect(page.locator(".faq-section, .related-section")).toHaveCount(2);
        const receiptInfo = page.getByRole("button", { name: "Wat gebeurt er met mijn bericht?", exact: true });
        await receiptInfo.click();
        await expect(page.getByText("Na verzending bevestigt het formulier of je bericht is ontvangen. Automatische e-mailbevestigingen zijn nog niet beschikbaar.", { exact: true })).toBeVisible();
        await receiptInfo.click();
        const form = page.locator("form.lead-form");
        const previous = await form.evaluate(element => Object.fromEntries(new FormData(element as HTMLFormElement)));
        await page.getByRole("textbox", { name: "Naam", exact: true }).fill("QA lokale visuele controle");
        await form.locator('textarea[name="message"]').fill("QA voorbeeld. Dit formulier wordt niet verzonden.");
        const current = await form.evaluate(element => Object.fromEntries(new FormData(element as HTMLFormElement)));
        expect(current.requestId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
        expect(current.requestId).not.toBe(previous.requestId);
        expect(current).toEqual({ ...previous, name: "QA lokale visuele controle", message: "QA voorbeeld. Dit formulier wordt niet verzonden.", requestId: current.requestId });
        await expect(page.getByRole("button", { name: "Bericht verzenden", exact: true })).toHaveAttribute("type", "submit");
      }
      if (width === 390) {
        const toggle = page.getByRole("button", { name: "Menu openen", exact: true });
        await toggle.scrollIntoViewIfNeeded();
        await toggle.focus();
        await page.keyboard.press("Enter");
        await expect(page.getByRole("navigation", { name: "Publieke hoofdnavigatie", exact: true })).toBeVisible();
        const close = page.getByRole("button", { name: "Menu sluiten", exact: true });
        await expect(close).toHaveAttribute("aria-expanded", "true");
        await close.click();
        await expect(page.getByRole("navigation", { name: "Publieke hoofdnavigatie", exact: true })).toBeHidden();
      }
      const sizes = await page.locator(".mk-header a, .mk-header button, .mk-header summary, main .button, .mk-retained-links a").evaluateAll(elements => elements
        .filter(element => (element as HTMLElement).checkVisibility())
        .map(element => ({ label: element.textContent, height: element.getBoundingClientRect().height })));
      for (const size of sizes) expect(size.height, size.label ?? pathname).toBeGreaterThanOrEqual(44);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), pathname).toBe(true);
      await page.mouse.move(0, 0);
      await page.evaluate(async () => { window.scrollTo({ top: 0, left: 0, behavior: "instant" }); await document.fonts.ready; await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))); });
      const skipPaint = await page.locator(".mk-skip").evaluate(element => {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        const active = document.activeElement;
        return {
          rect: { top: rect.top, right: rect.right, bottom: rect.bottom, left: rect.left, width: rect.width, height: rect.height },
          computed: { top: style.top, bottom: style.bottom, height: style.height, position: style.position, transition: style.transition, transform: style.transform, opacity: style.opacity, visibility: style.visibility },
          focused: element === active,
          activeElement: active ? { tag: active.tagName, id: active.id, className: active.getAttribute("class") } : null,
          scroll: { x: scrollX, y: scrollY }, viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio },
          capturedAt: new Date().toISOString()
        };
      });
      await info.attach("skip-paint-" + pathname.slice(1) + "-" + width, { body: JSON.stringify(skipPaint), contentType: "application/json" });
      await info.attach("retained-" + pathname.slice(1) + "-" + width, { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
      expect((await new AxeBuilder({ page }).analyze()).violations, pathname).toEqual([]);
    }
    expect(writes).toEqual([]);
  });
}
