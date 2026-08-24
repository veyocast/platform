export const VEYOCAST_TRIAL_DURATION_HOURS = 14 * 24;
export const VEYOCAST_SCREEN_PRICE_GROSS_CENTS = 595;
export const VEYOCAST_DEFAULT_VAT_BASIS_POINTS = 2_100;
export const VEYOCAST_GRACE_DURATION_HOURS = 7 * 24;
export const VEYOCAST_ENTITLEMENT_LEASE_HOURS = 7 * 24;

export function calculateMonthlyScreenPriceGrossCents(screenCount: number) {
  if (!Number.isSafeInteger(screenCount) || screenCount < 1 || screenCount > 10_000) {
    throw new RangeError("screenCount must be an integer between 1 and 10,000");
  }

  return screenCount * VEYOCAST_SCREEN_PRICE_GROSS_CENTS;
}

export function roundHalfUp(numerator: bigint, denominator: bigint) {
  if (denominator <= 0n || numerator < 0n) {
    throw new RangeError("roundHalfUp requires a non-negative numerator and positive denominator");
  }
  return Number((numerator * 2n + denominator) / (denominator * 2n));
}

export function calculateInclusiveVat(grossCents: number, vatBasisPoints = VEYOCAST_DEFAULT_VAT_BASIS_POINTS) {
  if (!Number.isSafeInteger(grossCents) || grossCents < 0) throw new RangeError("grossCents must be a non-negative safe integer");
  if (!Number.isSafeInteger(vatBasisPoints) || vatBasisPoints < 0 || vatBasisPoints > 10_000) throw new RangeError("vatBasisPoints must be between 0 and 10,000");
  const denominator = 10_000n + BigInt(vatBasisPoints);
  const netCents = roundHalfUp(BigInt(grossCents) * 10_000n, denominator);
  return { grossCents, netCents, vatCents: grossCents - netCents };
}

export function calculateProratedGrossCents({ activeSeconds, periodSeconds, unitGrossCents = VEYOCAST_SCREEN_PRICE_GROSS_CENTS }: {
  activeSeconds: number;
  periodSeconds: number;
  unitGrossCents?: number;
}) {
  for (const [name, value] of Object.entries({ activeSeconds, periodSeconds, unitGrossCents })) {
    if (!Number.isSafeInteger(value) || value < 0) throw new RangeError(`${name} must be a non-negative safe integer`);
  }
  if (periodSeconds === 0 || activeSeconds > periodSeconds) throw new RangeError("activeSeconds must fit within a positive period");
  return roundHalfUp(BigInt(unitGrossCents) * BigInt(activeSeconds), BigInt(periodSeconds));
}

export function addUtcBillingMonth(anchor: Date) {
  if (!Number.isFinite(anchor.getTime())) throw new RangeError("anchor must be a valid date");
  const year = anchor.getUTCFullYear();
  const month = anchor.getUTCMonth();
  const day = anchor.getUTCDate();
  const lastDay = new Date(Date.UTC(year, month + 2, 0)).getUTCDate();
  return new Date(Date.UTC(
    year,
    month + 1,
    Math.min(day, lastDay),
    anchor.getUTCHours(),
    anchor.getUTCMinutes(),
    anchor.getUTCSeconds(),
    anchor.getUTCMilliseconds()
  ));
}

export type BillingState = "draft" | "trialing" | "active" | "grace" | "restricted" | "suspended" | "ended";
export type BillingPlaybackMode = "tenant_content" | "tenant_content_with_warning" | "veyocast_billing_splash" | "veyocast_verification_splash" | "system_suspended";

export function evaluateBillingEntitlement({ state, now, graceEndsAt, leaseValidUntil, enforcementEnabled = true }: {
  state: BillingState;
  now: Date;
  graceEndsAt?: Date | null;
  leaseValidUntil?: Date | null;
  enforcementEnabled?: boolean;
}): BillingPlaybackMode {
  if (!enforcementEnabled) return "tenant_content";
  if (state === "suspended") return "system_suspended";
  if (state === "restricted" || state === "ended") return "veyocast_billing_splash";
  if (state === "grace") {
    return graceEndsAt && now.getTime() >= graceEndsAt.getTime()
      ? "veyocast_billing_splash"
      : "tenant_content_with_warning";
  }
  if (leaseValidUntil && now.getTime() > leaseValidUntil.getTime()) return "veyocast_verification_splash";
  return "tenant_content";
}

export function remainingGraceDays(graceEndsAt: Date, now: Date) {
  return Math.max(0, Math.ceil((graceEndsAt.getTime() - now.getTime()) / 86_400_000));
}
