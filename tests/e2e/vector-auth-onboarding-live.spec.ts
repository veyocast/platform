import AxeBuilder from "@axe-core/playwright";
import { expect, test, type APIRequestContext } from "@playwright/test";

const liveOnboarding = process.env.VEYOCAST_LIVE_ONBOARDING_E2E === "1";
const mailpitUrl = process.env.VEYOCAST_MAILPIT_URL ?? "http://127.0.0.1:54324";

test.describe("Vector v2 live account and onboarding journey", () => {
  test.skip(!liveOnboarding, "requires the isolated local Supabase and Mailpit test stack");

  test("confirmed signup claims one tenant and reaches real source setup", async ({ page, request }) => {
    const unique = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
    const email = `vector-${unique}@veyocast.test`;
    const password = `VeyoCast-${unique}-safe`;

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/register");
    await expect(page.getByRole("heading", { name: "Maak je VeyoCast-account" })).toBeVisible();
    await expect(page.getByText("14 dagen gratis", { exact: false })).toBeVisible();
    await page.getByLabel("Jouw naam").fill("Vector Testbeheerder");
    await page.getByLabel("Zakelijk e-mailadres").fill(email);
    await page.getByLabel("Wachtwoord", { exact: true }).fill(password);
    await page.getByLabel("Herhaal wachtwoord").fill(password);
    await page.getByRole("checkbox").check();
    await expect(page.getByLabel("Wachtwoord", { exact: true })).toHaveValue(password);
    await expect(page.getByLabel("Herhaal wachtwoord")).toHaveValue(password);
    const invalidFields = await page.locator("form").evaluate((form) =>
      Array.from((form as HTMLFormElement).elements)
        .filter((element) => element instanceof HTMLInputElement && !element.checkValidity())
        .map((element) => {
          const input = element as HTMLInputElement;
          return `${input.name}:${input.validationMessage}`;
        })
    );
    expect(invalidFields).toEqual([]);
    await page.getByRole("button", { name: "Account aanmaken" }).click();
    await expect(page.getByText("Controleer je inbox", { exact: false })).toBeVisible();

    const confirmationUrl = new URL(await waitForConfirmationUrl(request, email));
    await page.goto(`${confirmationUrl.pathname}${confirmationUrl.search}`);
    await expect(page).toHaveURL(/\/onboarding/);
    await expect(page.getByRole("heading", { name: "Welkom bij VeyoCast" })).toBeVisible();
    await expect(page.getByText("Organisatie", { exact: true }).first()).toBeVisible();
    await page.getByLabel("Naam van je organisatie").fill("Sportvereniging De Horizon");
    await page.getByLabel("Sportvereniging").check();
    await page.getByLabel(/Ik accepteer namens deze organisatie/).check();
    await page.getByRole("button", { name: "Organisatie veilig aanmaken" }).click();

    await expect(page.getByRole("heading", { name: "Kies je eerste contentbronnen" })).toBeVisible();
    await expect(page.getByText("transactioneel aangemaakt", { exact: false })).toBeVisible();
    const accessibility = await new AxeBuilder({ page }).analyze();
    expect(accessibility.violations).toEqual([]);
    await page.screenshot({
      fullPage: true,
      path: "docs/screenshots/vector-v2/auth/onboarding-sources-1440x900.png"
    });
  });

  test("registration is an intentional mobile journey", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/register");
    await expect(page.getByRole("heading", { name: "Maak je VeyoCast-account" })).toBeVisible();
    const submit = page.getByRole("button", { name: "Account aanmaken" });
    await expect(submit).toBeVisible();
    const box = await submit.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(40);
    await page.screenshot({
      fullPage: true,
      path: "docs/screenshots/vector-v2/auth/register-390x844.png"
    });
  });
});

async function waitForConfirmationUrl(request: APIRequestContext, email: string) {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    const listResponse = await request.get(`${mailpitUrl}/api/v1/messages`);
    if (listResponse.ok()) {
      const list = await listResponse.json() as { messages?: Array<Record<string, unknown>> };
      const message = list.messages?.find((candidate) =>
        JSON.stringify(candidate).toLowerCase().includes(email.toLowerCase())
      );
      const id = message && typeof message.ID === "string" ? message.ID : null;
      if (id) {
        const detailResponse = await request.get(`${mailpitUrl}/api/v1/message/${id}`);
        if (detailResponse.ok()) {
          const strings = collectStrings(await detailResponse.json());
          for (const value of strings) {
            const match = value.replaceAll("&amp;", "&").match(
              /https?:\/\/[^\s"'<>]+(?:token_hash|auth\/v1\/verify)[^\s"'<>]*/
            );
            if (match) return match[0];
          }
        }
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`No confirmation email was captured for ${email}`);
}

function collectStrings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(collectStrings);
  if (value && typeof value === "object") {
    return Object.values(value as Record<string, unknown>).flatMap(collectStrings);
  }
  return [];
}
