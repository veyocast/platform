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
  if (new TextEncoder().encode(secret).byteLength < 32) {
    throw new Error("Setup intent signing secret must contain at least 32 bytes");
  }
}

function encodeBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

function decodeBase64Url(value: string) {
  const padding = "=".repeat((4 - value.length % 4) % 4);
  const binary = atob(value.replaceAll("-", "+").replaceAll("_", "/") + padding);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function signingKey(secret: string, usage: "sign" | "verify") {
  return globalThis.crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { hash: "SHA-256", name: "HMAC" },
    false,
    [usage]
  );
}

function signedMessage(encodedPayload: string) {
  return new TextEncoder().encode(`veyocast-setup-intent-v1.${encodedPayload}`);
}

export async function createSetupIntentToken(
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
  const encodedPayload = encodeBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const signature = await globalThis.crypto.subtle.sign(
    "HMAC",
    await signingKey(secret, "sign"),
    signedMessage(encodedPayload)
  );
  return `${encodedPayload}.${encodeBase64Url(new Uint8Array(signature))}`;
}

export async function verifySetupIntentToken(
  token: string,
  secret: string,
  now = Date.now()
): Promise<SetupIntentPayload | null> {
  try {
    assertSigningSecret(secret);
    const [encodedPayload, encodedSignature, extra] = token.split(".");
    if (!encodedPayload || !encodedSignature || extra) return null;
    const validSignature = await globalThis.crypto.subtle.verify(
      "HMAC",
      await signingKey(secret, "verify"),
      decodeBase64Url(encodedSignature),
      signedMessage(encodedPayload)
    );
    if (!validSignature) return null;

    const raw = JSON.parse(new TextDecoder().decode(decodeBase64Url(encodedPayload))) as unknown;
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
    if (payload.issuedAt > nowSeconds + 60 || payload.expiresAt < nowSeconds) return null;
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
      expiresAt: payload.expiresAt,
      grossMonthlyCents,
      issuedAt: payload.issuedAt,
      pricePerScreenGrossCents: VEYOCAST_SCREEN_PRICE_GROSS_CENTS,
      screenCount,
      version: 1
    };
  } catch {
    return null;
  }
}
