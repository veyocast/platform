import { describe, expect, it } from "vitest";

import {
  calculateMonthlyScreenPriceGrossCents,
  VEYOCAST_DEFAULT_VAT_BASIS_POINTS,
  VEYOCAST_SCREEN_PRICE_GROSS_CENTS,
  VEYOCAST_TRIAL_DURATION_HOURS
} from "../src/billing";

describe("VeyoCast billing launch constants", () => {
  it("keeps launch money and trial terms deterministic", () => {
    expect(VEYOCAST_SCREEN_PRICE_GROSS_CENTS).toBe(595);
    expect(VEYOCAST_DEFAULT_VAT_BASIS_POINTS).toBe(2_100);
    expect(VEYOCAST_TRIAL_DURATION_HOURS).toBe(336);
  });

  it("calculates monthly gross totals using integer cents", () => {
    expect(calculateMonthlyScreenPriceGrossCents(1)).toBe(595);
    expect(calculateMonthlyScreenPriceGrossCents(6)).toBe(3_570);
    expect(Number.isInteger(calculateMonthlyScreenPriceGrossCents(10))).toBe(true);
  });

  it("rejects fractional, empty and unreasonable screen counts", () => {
    expect(() => calculateMonthlyScreenPriceGrossCents(0)).toThrow(RangeError);
    expect(() => calculateMonthlyScreenPriceGrossCents(1.5)).toThrow(RangeError);
    expect(() => calculateMonthlyScreenPriceGrossCents(10_001)).toThrow(RangeError);
  });
});
