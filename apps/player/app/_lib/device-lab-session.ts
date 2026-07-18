import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const sessionLifetimeSeconds = 4 * 60 * 60;

export function createDeviceLabSession(now = Date.now()) {
  const secret = readSessionSecret();
  if (!secret) return null;

  const expiresAt = Math.floor(now / 1000) + sessionLifetimeSeconds;
  const nonce = randomBytes(16).toString("base64url");
  const payload = `${expiresAt}.${nonce}`;
  return {
    maxAge: sessionLifetimeSeconds,
    value: `${payload}.${sign(payload, secret)}`
  };
}

export function isValidDeviceLabSession(value: string | undefined, now = Date.now()) {
  if (!value) return false;
  const [expiresAtValue, nonce, signature, ...rest] = value.split(".");
  if (rest.length > 0 || !expiresAtValue || !nonce || !signature) return false;

  const expiresAt = Number(expiresAtValue);
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= Math.floor(now / 1000)) return false;

  const payload = `${expiresAtValue}.${nonce}`;
  const secret = readSessionSecret();
  return Boolean(secret && safeEqual(signature, sign(payload, secret)));
}

function readSessionSecret() {
  const secret = process.env.DEVICE_LAB_SESSION_SECRET?.trim();
  return secret && secret.length >= 32 ? secret : null;
}

function sign(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function safeEqual(left: string, right: string) {
  const leftBytes = Buffer.from(left);
  const rightBytes = Buffer.from(right);
  return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes);
}
