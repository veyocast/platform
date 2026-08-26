import AxeBuilder from "@axe-core/playwright";
import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

const liveProductLogo = process.env.VEYOCAST_LIVE_PRODUCT_LOGO_E2E === "1";
const tenantId = "10000000-0000-4000-8000-000000000101";
let productId = "";
const validPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64"
);

test.describe("Twelve-productlogo's", () => {
  test.skip(!liveProductLogo, "requires a freshly reset isolated local Supabase stack");
  test.setTimeout(90_000);

  test.beforeAll(async () => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anonKey) {
      throw new Error("Productlogo E2E requires the local Supabase public configuration.");
    }
    const supabase = createClient(url, anonKey, {
      auth: { persistSession: false }
    });
    const auth = await supabase.auth.signInWithPassword({
      email: "pilot-admin@veyocast.test",
      password: "veyocast-local"
    });
    if (auth.error) throw auth.error;
    const staged = await supabase.rpc("stage_product_import_v1", {
      p_column_mapping: { Artikelnummer: "external_id", Naam: "name", Prijs: "price" },
      p_file_name: "product-logo-e2e.xlsx",
      p_file_sha256: "d".repeat(64),
      p_headers: ["Artikelnummer", "Naam", "Prijs"],
      p_rows: [{
        errors: [],
        included: true,
        normalized: {
          active: true,
          barcode: null,
          category: "Warme dranken",
          custom_fields: {},
          description: null,
          external_id: "logo-e2e",
          name: "Test cappuccino",
          price_cents: 275,
          slug: "test-cappuccino-logo",
          unit: "stuk",
          vat_rate: 9
        },
        source: { Artikelnummer: "logo-e2e", Naam: "Test cappuccino", Prijs: "2,75" }
      }],
      p_sheet_name: "Producten",
      p_source: "twelve_excel",
      p_tenant_id: tenantId
    });
    if (staged.error || typeof staged.data !== "string") {
      throw staged.error ?? new Error("Productimportfixture ontbreekt");
    }
    const applied = await supabase.rpc("apply_product_import_v1", {
      p_import_id: staged.data,
      p_mode: "merge"
    });
    if (applied.error) throw applied.error;
    const product = await supabase
      .from("tenant_products")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("slug", "test-cappuccino-logo")
      .single();
    if (product.error || !product.data) throw product.error ?? new Error("Productfixture ontbreekt");
    productId = product.data.id;
  });

  test("uploadt, toont en verwijdert een gevalideerd productlogo", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/login");
    await page.getByLabel("E-mailadres").fill("pilot-admin@veyocast.test");
    await page.getByLabel("Wachtwoord").fill("veyocast-local");
    await page.getByRole("button", { name: "Doorgaan" }).click();
    await page.waitForURL(/\/context/, { timeout: 15_000 });
    await page.getByRole("button", { name: "Open vereniging" }).click();
    await page.waitForURL(/\/dashboard$/);

    await page.goto("/dashboard/integrations/twelve-products");
    const product = page.locator(`#product-${productId}`);
    await expect(product.getByText("Test cappuccino", { exact: true }).first()).toBeVisible();
    await product.getByLabel("Nieuw logo kiezen").setInputFiles({
      buffer: validPng,
      mimeType: "image/png",
      name: "cappuccino-logo.png"
    });
    await product.getByRole("button", { name: /Uploaden|Vervangen/ }).click();
    await expect(product.getByAltText("Productlogo van Test cappuccino")).toBeVisible();
    await expect(product.getByText(/volgende render gebruikt het nieuwe logo/)).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.screenshot({
      fullPage: true,
      path: "docs/screenshots/product-logo/twelve-products-logo-1440x900.png"
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    const mobileProduct = page.locator(`#product-${productId}`);
    await expect(mobileProduct.getByAltText("Productlogo van Test cappuccino")).toBeVisible();
    expect(await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth
    )).toBe(true);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.screenshot({
      fullPage: true,
      path: "docs/screenshots/product-logo/twelve-products-logo-390x844.png"
    });

    await mobileProduct.getByRole("button", { name: "Verwijderen" }).click();
    await expect(mobileProduct.getByText("Geen logo", { exact: true })).toBeVisible();
    await expect(mobileProduct.getByText(/Bestaande publicaties blijven ongewijzigd/)).toBeVisible();
  });
});
