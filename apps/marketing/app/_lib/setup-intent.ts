import { createHmac, timingSafeEqual } from "node:crypto";

import {
  calculateMonthlyScreenPriceGrossCents,
  VEYOCAST_SCREEN_PRICE_GROSS_CENTS
} from "@veyocast/domain";

export const setupBranches = ["sportclub", "hospitality", "organization"] as const;
export const setupZoneIds = ["entrance", "clubhouse", "main", "boardroom"] as const;
export const setupGoals = ["welcome", "live-info", "menu", "sponsors", "internal"] as const;
export const setupModules = ["sportlink", "twelve", "rss", "own-media", "sponsors"] as const;

export type SetupBranch = (typeof setupBranches)[number];
export type SetupZoneId = (typeof setupZoneIds)[number];
export type SetupGoal = (typeof setupGoals)[number];
export type SetupModule = (typeof setupModules)[number];

export type SetupZone = Readonly<{
  count: number;
  goal: SetupGoal;
  id: SetupZoneId;
}>;

export type SetupIntentInput = Readonly<{
  branch: SetupBranch;
  modules: readonly SetupModule[];
  zones: readonly SetupZone[];
}>;

export type SetupIntentPayload = SetupIntentInput &
  Readonly<{
    expiresAt: number;
    grossMonthlyCents: number;
    issuedAt: number;
    pricePerScreenGrossCents: typeof VEYOCAST_SCREEN_PRICE_GROSS_CENTS;
    screenCount: number;
    version: 1;
  }>;

const intentLifetimeSeconds = 24 * 60 * 60;

function isIncluded<T extends string>(values: readonly T[], value: unknown): value is T {
  return typeof value === "string" && values.includes(value as T);
}

export function parseSetupIntentInput(value: unknown): SetupIntentInput | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = value as Record<string, unknown>;
  if (!isIncluded(setupBranches, candidate.branch)) return null;
  if (!Array.isArray(candidate.modules) || !Array.isArray(candidate.zones)) return null;

  const modules = [...new Set(candidate.modules)];
  if (
    modules.length > setupModules.length ||
    !modules.every((module) => isIncluded(setupModules, module))
  ) {
    return null;
  }

  const seenZones = new Set<string>();
  const zones: SetupZone[] = [];
  for (const zone of candidate.zones) {
    if (!zone || typeof zone !== "object" || Array.isArray(zone)) return null;
    const item = zone as Record<string, unknown>;
    if (
      !isIncluded(setupZoneIds, item.id) ||
      !isIncluded(setupGoals, item.goal) ||
      !Number.isSafeInteger(item.count) ||
      Number(item.count) < 0 ||
      Number(item.count) > 20 ||
      seenZones.has(item.id)
    ) {
      return null;
    }
    seenZones.add(item.id);
    zones.push({ count: Number(item.count), goal: item.goal, id: item.id });
  }

  if (zones.length !== setupZoneIds.length) return null;
  const screenCount = zones.reduce((total, zone) => total + zone.count, 0);
  if (screenCount < 1 || screenCount > 50) return null;

  return {
    branch: candidate.branch,
    modules: modules as SetupModule[],
    zones
  };
}

export function parseSetupIntentJson(value: string) {
  try {
    return parseSetupIntentInput(JSON.parse(value) as unknown);
  } catch {
    return null;
  }
}

function assertSigningSecret(secret: string) {
  if (Buffer.byteLength(secret, "utf8") < 32) {
    throw new Error("Setup intent signing secret must contain at least 32 bytes");
  }
}

function signatureFor(encodedPayload: string, secret: string) {
  return createHmac("sha256", secret)
    .update(`veyocast-setup-intent-v1.${encodedPayload}`)
    .digest("base64url");
}

export function createSetupIntentToken(
  input: SetupIntentInput,
  secret: string,
  now = Date.now()
) {
  assertSigningSecret(secret);
  const screenCount = input.zones.reduce((total, zone) => total + zone.count, 0);
  const issuedAt = Math.floor(now / 1_000);
  const payload: SetupIntentPayload = {
    ...input,
    expiresAt: issuedAt + intentLifetimeSeconds,
    grossMonthlyCents: calculateMonthlyScreenPriceGrossCents(screenCount),
    issuedAt,
    pricePerScreenGrossCents: VEYOCAST_SCREEN_PRICE_GROSS_CENTS,
    screenCount,
    version: 1
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${encodedPayload}.${signatureFor(encodedPayload, secret)}`;
}

export function verifySetupIntentToken(
  token: string,
  secret: string,
  now = Date.now()
): SetupIntentPayload | null {
  try {
    assertSigningSecret(secret);
    const [encodedPayload, encodedSignature, extra] = token.split(".");
    if (!encodedPayload || !encodedSignature || extra) return null;
    const expected = Buffer.from(signatureFor(encodedPayload, secret));
    const received = Buffer.from(encodedSignature);
    if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;

    const raw = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as unknown;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    const payload = raw as Record<string, unknown>;
    const input = parseSetupIntentInput(payload);
    if (!input || payload.version !== 1) return null;
    if (
      typeof payload.issuedAt !== "number" ||
      typeof payload.expiresAt !== "number" ||
      !Number.isSafeInteger(payload.issuedAt) ||
      !Number.isSafeInteger(payload.expiresAt)
    ) {
      return null;
    }
    const nowSeconds = Math.floor(now / 1_000);
    if (Number(payload.issuedAt) > nowSeconds + 60 || Number(payload.expiresAt) < nowSeconds) return null;
    const screenCount = input.zones.reduce((total, zone) => total + zone.count, 0);
    const grossMonthlyCents = calculateMonthlyScreenPriceGrossCents(screenCount);
    if (
      payload.screenCount !== screenCount ||
      payload.grossMonthlyCents !== grossMonthlyCents ||
      payload.pricePerScreenGrossCents !== VEYOCAST_SCREEN_PRICE_GROSS_CENTS
    ) {
      return null;
    }

    return {
      ...input,
      expiresAt: Number(payload.expiresAt),
      grossMonthlyCents,
      issuedAt: Number(payload.issuedAt),
      pricePerScreenGrossCents: VEYOCAST_SCREEN_PRICE_GROSS_CENTS,
      screenCount,
      version: 1
    };
  } catch {
    return null;
  }
}

export function setupIntentSigningSecret() {
  const value =
    process.env.VEYOCAST_SETUP_INTENT_SIGNING_SECRET ??
    process.env.NEXT_SERVER_ACTIONS_ENCRYPTION_KEY;
  return value && Buffer.byteLength(value, "utf8") >= 32 ? value : null;
}
