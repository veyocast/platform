import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

describe("billing provider boundaries", () => {
  it("treats the classic webhook as a wake-up hint and re-fetches Mollie", () => {
    const webhook = source("../../app/api/billing/mollie/webhook/route.ts");
    const verifier = source("./verify-mollie-payment.ts");
    expect(webhook).toContain('contentType !== "application/x-www-form-urlencoded"');
    expect(verifier).toContain("client.getPayment");
    expect(verifier).toContain("listPaymentChargebacks");
    expect(verifier).not.toMatch(/process\.env\.MOLLIE_API_KEY/);
  });

  it("binds return verification to the authenticated active tenant", () => {
    const page = source("../../app/(shell)/dashboard/settings/billing/return/page.tsx");
    expect(page).toContain('requireTenantControlSession("tenant.billing.read")');
    expect(page).toContain("tenantId: session.tenantId");
    expect(page).toContain('channel: "return"');
  });

  it("guards every billing worker with the server-side worker secret", () => {
    for (const route of ["cycle", "notifications", "outbox", "reconcile"]) {
      expect(source(`../../app/api/internal/billing/${route}/route.ts`)).toContain("requireBillingWorker(request)");
    }
  });
});
