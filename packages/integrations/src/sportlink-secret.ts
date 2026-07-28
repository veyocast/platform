import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const algorithm = "aes-256-gcm";

export function encryptSportlinkClientId(clientId: string, keyMaterial: string) {
  const key = deriveKey(keyMaterial);
  const iv = randomBytes(12);
  const cipher = createCipheriv(algorithm, key, iv);
  const ciphertext = Buffer.concat([cipher.update(clientId, "utf8"), cipher.final()]);
  return {
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64")
  };
}

export function decryptSportlinkClientId(
  encrypted: { ciphertext: string; iv: string; tag: string },
  keyMaterial: string
) {
  const decipher = createDecipheriv(
    algorithm,
    deriveKey(keyMaterial),
    Buffer.from(encrypted.iv, "base64")
  );
  decipher.setAuthTag(Buffer.from(encrypted.tag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(encrypted.ciphertext, "base64")),
    decipher.final()
  ]).toString("utf8");
}

function deriveKey(value: string) {
  if (value.length < 32) throw new Error("sportlink_encryption_key_invalid");
  return createHash("sha256").update(value).digest();
}
