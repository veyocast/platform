import { createDecipheriv } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  encryptPushToken,
  readPushTokenEncryptionKey
} from "./push-token";

describe("mobile push-token protection", () => {
  it("requires an exact 256-bit base64 key", () => {
    expect(readPushTokenEncryptionKey({})).toBeNull();
    expect(
      readPushTokenEncryptionKey({
        MOBILE_PUSH_TOKEN_ENCRYPTION_KEY: Buffer.alloc(31).toString("base64")
      })
    ).toBeNull();
    expect(
      readPushTokenEncryptionKey({
        MOBILE_PUSH_TOKEN_ENCRYPTION_KEY: Buffer.alloc(32).toString("base64")
      })
    ).toHaveLength(32);
  });

  it("stores nonce, tag and ciphertext without plaintext", () => {
    const key = Buffer.alloc(32, 7);
    const token = "sensitive-fcm-registration-token";
    const encrypted = encryptPushToken(token, key);
    expect(encrypted.toString("utf8")).not.toContain(token);

    const decipher = createDecipheriv(
      "aes-256-gcm",
      key,
      encrypted.subarray(0, 12)
    );
    decipher.setAuthTag(encrypted.subarray(12, 28));
    const decrypted = Buffer.concat([
      decipher.update(encrypted.subarray(28)),
      decipher.final()
    ]).toString("utf8");
    expect(decrypted).toBe(token);
  });
});
