import { describe, expect, it } from "vitest";

import {
  addUtcBillingMonth,
  calculateInclusiveVat,
  calculateProratedGrossCents,
  evaluateBillingEntitlement,
  remainingGraceDays
} from "../src/billing";

describe("billing core", () => {
  it("calculates inclusive VAT from aggregate gross amounts", () => {
    expect(calculateInclusiveVat(595)).toEqual({ grossCents: 595, netCents: 492, vatCents: 103 });
    expect(calculateInclusiveVat(5_950)).toEqual({ grossCents: 5_950, netCents: 4_917, vatCents: 1_033 });
  });

  it("preserves aggregate-cent invariants across realistic invoice totals", () => {
    for (let grossCents = 0; grossCents <= 59_500; grossCents += 17) {
      const result = calculateInclusiveVat(grossCents);
      expect(result.netCents + result.vatCents).toBe(grossCents);
      expect(result.netCents).toBeGreaterThanOrEqual(0);
      expect(result.vatCents).toBeGreaterThanOrEqual(0);
    }
  });

  it.each([28, 29, 30, 31])("prorates exact UTC seconds in a %s-day month", (days) => {
    const period = days * 86_400;
    expect(calculateProratedGrossCents({ activeSeconds: period, periodSeconds: period })).toBe(595);
    expect(calculateProratedGrossCents({ activeSeconds: period / 2, periodSeconds: period })).toBe(298);
  });

  it("clamps month-end anchors without local timezone or DST input", () => {
    expect(addUtcBillingMonth(new Date("2028-01-31T23:30:00.000Z")).toISOString()).toBe("2028-02-29T23:30:00.000Z");
    expect(addUtcBillingMonth(new Date("2027-01-31T23:30:00.000Z")).toISOString()).toBe("2027-02-28T23:30:00.000Z");
  });

  it("keeps proration monotonic and bounded for every hour in a leap-month", () => {
    const periodSeconds = 29 * 86_400;
    let previous = 0;
    for (let activeSeconds = 0; activeSeconds <= periodSeconds; activeSeconds += 3_600) {
      const current = calculateProratedGrossCents({ activeSeconds, periodSeconds });
      expect(current).toBeGreaterThanOrEqual(previous);
      expect(current).toBeLessThanOrEqual(595);
      previous = current;
    }
  });

  it("keeps grace non-destructive and separates stale verification", () => {
    const now = new Date("2026-08-24T12:00:00.000Z");
    expect(evaluateBillingEntitlement({ state: "grace", now, graceEndsAt: new Date("2026-08-31T12:00:00.000Z") })).toBe("tenant_content_with_warning");
    expect(evaluateBillingEntitlement({ state: "grace", now: new Date("2026-09-01T00:00:00.000Z"), graceEndsAt: new Date("2026-08-31T12:00:00.000Z") })).toBe("veyocast_billing_splash");
    expect(evaluateBillingEntitlement({ state: "active", now, leaseValidUntil: new Date("2026-08-24T11:59:59.000Z") })).toBe("veyocast_verification_splash");
    expect(evaluateBillingEntitlement({ state: "restricted", now, enforcementEnabled: false })).toBe("tenant_content");
  });

  it("rounds the grace countdown upward", () => {
    const end = new Date("2026-08-25T12:00:01.000Z");
    expect(remainingGraceDays(end, new Date("2026-08-24T12:00:00.000Z"))).toBe(2);
    expect(remainingGraceDays(end, end)).toBe(0);
  });
});
