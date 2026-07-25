import { expect, test } from "@playwright/test";

const marketingURL = `http://127.0.0.1:${process.env.MARKETING_PORT ?? 3108}`;

test("publishes a crawlable privacy policy without external tracking requests", async ({
  page
}) => {
  const externalHosts = new Set<string>();
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.hostname !== "127.0.0.1") externalHosts.add(url.hostname);
  });

  const response = await page.goto(`${marketingURL}/privacy`);

  expect(response?.status()).toBe(200);
  await expect(page).toHaveTitle("Privacyverklaring | VeyoCast");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    "https://veyocast.nl/privacy"
  );
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    /noindex/
  );
  await expect(page.getByText("Laatst bijgewerkt: 24 juli 2026")).toBeVisible();
  await expect(page.getByRole("link", { name: "privacy@veyocast.nl" }).first())
    .toHaveAttribute("href", "mailto:privacy@veyocast.nl");
  await expect(page.getByRole("link", { name: "Data verwijderen" }).first())
    .toHaveAttribute("href", "/data-verwijderen");
  expect([...externalHosts]).toEqual([]);
});

test("explains deletion for account, tenant, player and local Android data", async ({
  page
}) => {
  const response = await page.goto(`${marketingURL}/data-verwijderen`);

  expect(response?.status()).toBe(200);
  await expect(page).toHaveTitle("Data verwijderen | VeyoCast");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    "https://veyocast.nl/data-verwijderen"
  );
  await expect(page.getByRole("heading", { name: "Persoonlijk account en tenantaccounts" }))
    .toBeVisible();
  await expect(page.getByRole("heading", { name: "Een Player ontkoppelen" }))
    .toBeVisible();
  await expect(page.getByRole("heading", { name: "Lokale Android-appdata verwijderen" }))
    .toBeVisible();
  await expect(page.getByText("in beginsel binnen één maand")).toBeVisible();
  await expect(page.getByRole("link", { name: "Verwijderverzoek e-mailen" }))
    .toHaveAttribute("href", /mailto:privacy@veyocast\.nl/);
});

test("keeps legal content inside a narrow mobile viewport and supports print", async ({
  page
}) => {
  await page.setViewportSize({ height: 760, width: 320 });
  await page.goto(`${marketingURL}/privacy`);

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth
  );
  expect(overflow).toBe(false);

  await page.emulateMedia({ media: "print" });
  await expect(page.getByRole("contentinfo")).toBeHidden();
  await expect(page.getByRole("heading", {
    exact: true,
    level: 1,
    name: "Privacyverklaring"
  })).toBeVisible();
});
