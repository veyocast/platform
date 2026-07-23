import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const playerDemoPairingCode = "VYO 2VY";
export const playerDemoSessionLifetimeSeconds = 30 * 24 * 60 * 60;

export function isStagingPlayerDemoEnabled(
  environment: Readonly<Record<string, string | undefined>> = process.env
) {
  return environment.VEYOCAST_ENVIRONMENT?.trim() === "staging";
}

export function matchesPlayerDemoCode(candidate: unknown) {
  if (typeof candidate !== "string") return false;
  return normalizeDemoCode(candidate) === normalizeDemoCode(playerDemoPairingCode);
}

export function createPlayerDemoSession({
  now = Date.now(),
  secret
}: {
  now?: number;
  secret: string | null | undefined;
}) {
  const normalizedSecret = normalizeSecret(secret);
  if (!normalizedSecret) return null;

  const expiresAt =
    Math.floor(now / 1_000) + playerDemoSessionLifetimeSeconds;
  const nonce = randomBytes(16).toString("base64url");
  const payload = `demo.${expiresAt}.${nonce}`;
  return {
    maxAge: playerDemoSessionLifetimeSeconds,
    value: `${payload}.${sign(payload, normalizedSecret)}`
  };
}

export function isValidPlayerDemoSession({
  now = Date.now(),
  secret,
  value
}: {
  now?: number;
  secret: string | null | undefined;
  value: string | null | undefined;
}) {
  const normalizedSecret = normalizeSecret(secret);
  if (!normalizedSecret || !value) return false;

  const [namespace, expiresAtValue, nonce, signature, ...rest] =
    value.split(".");
  if (
    rest.length ||
    namespace !== "demo" ||
    !expiresAtValue ||
    !nonce ||
    !signature
  ) {
    return false;
  }

  const expiresAt = Number(expiresAtValue);
  if (
    !Number.isSafeInteger(expiresAt) ||
    expiresAt <= Math.floor(now / 1_000)
  ) {
    return false;
  }

  const payload = `${namespace}.${expiresAtValue}.${nonce}`;
  return safeEqual(signature, sign(payload, normalizedSecret));
}

function normalizeDemoCode(value: string) {
  return value.toLocaleUpperCase("nl-NL").replaceAll(/[\s-]+/g, "");
}

function normalizeSecret(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized && normalized.length >= 32 ? normalized : null;
}

function sign(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function safeEqual(left: string, right: string) {
  const leftBytes = Buffer.from(left);
  const rightBytes = Buffer.from(right);
  return (
    leftBytes.length === rightBytes.length &&
    timingSafeEqual(leftBytes, rightBytes)
  );
}

