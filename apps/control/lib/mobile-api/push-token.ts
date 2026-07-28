import { createCipheriv, randomBytes } from "node:crypto";

export function readPushTokenEncryptionKey(
  environment: Readonly<Record<string, string | undefined>> = process.env
) {
  const encoded = environment.MOBILE_PUSH_TOKEN_ENCRYPTION_KEY?.trim();
  if (!encoded) return null;
  const key = Buffer.from(encoded, "base64");
  return key.byteLength === 32 ? key : null;
}

export function encryptPushToken(token: string, key: Buffer) {
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, nonce);
  const ciphertext = Buffer.concat([
    cipher.update(token, "utf8"),
    cipher.final()
  ]);
  return Buffer.concat([nonce, cipher.getAuthTag(), ciphertext]);
}
