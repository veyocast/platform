export const VEYOCAST_TRIAL_DURATION_HOURS = 14 * 24;
export const VEYOCAST_SCREEN_PRICE_GROSS_CENTS = 595;
export const VEYOCAST_DEFAULT_VAT_BASIS_POINTS = 2_100;

export function calculateMonthlyScreenPriceGrossCents(screenCount: number) {
  if (!Number.isSafeInteger(screenCount) || screenCount < 1 || screenCount > 10_000) {
    throw new RangeError("screenCount must be an integer between 1 and 10,000");
  }

  return screenCount * VEYOCAST_SCREEN_PRICE_GROSS_CENTS;
}
