import { generateKeyPairSync, verify } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { signPlayerEntitlement } from "./player-entitlement-server";

const previous = {
  keyId: process.env.PLAYER_ENTITLEMENT_KEY_ID,
  privateKey: process.env.PLAYER_ENTITLEMENT_PRIVATE_KEY_PEM,
  publicKey: process.env.NEXT_PUBLIC_PLAYER_ENTITLEMENT_PUBLIC_KEY
};

afterEach(() => {
  restore("PLAYER_ENTITLEMENT_KEY_ID", previous.keyId);
  restore("PLAYER_ENTITLEMENT_PRIVATE_KEY_PEM", previous.privateKey);
  restore("NEXT_PUBLIC_PLAYER_ENTITLEMENT_PUBLIC_KEY", previous.publicKey);
});

describe("Player entitlement signing", () => {
  it("signs the exact device-scoped monotonic payload with the pinned key", () => {
    const { privateKey, publicKey } = generateKeyPairSync("ed25519");
    process.env.PLAYER_ENTITLEMENT_PRIVATE_KEY_PEM = privateKey.export({ format: "pem", type: "pkcs8" }).toString();
    process.env.NEXT_PUBLIC_PLAYER_ENTITLEMENT_PUBLIC_KEY = publicKey.export({ format: "der", type: "spki" }).toString("base64");
    process.env.PLAYER_ENTITLEMENT_KEY_ID = "test-2026-08";
    const signed = signPlayerEntitlement({ billingState: "active", canActivateNetNewScreen: true, canManageBilling: true, canPairReplacement: true, canPublish: true, canRecoverPlayer: true, deviceId: "30000000-0000-4000-8000-000000000001", hardStopAt: null, issuedAt: "2026-08-24T00:00:00.000Z", playbackMode: "tenant_content", reason: "paid", revision: 8, screenId: "20000000-0000-4000-8000-000000000001", tenantId: "10000000-0000-4000-8000-000000000001", validUntil: "2026-08-31T00:00:00.000Z" });
    expect(signed.keyId).toBe("test-2026-08");
    expect(verify(null, Buffer.from(JSON.stringify(signed.payload)), publicKey, Buffer.from(signed.signature, "base64"))).toBe(true);
  });

  it("refuses a private key that does not match the public pin", () => {
    const first = generateKeyPairSync("ed25519");
    const second = generateKeyPairSync("ed25519");
    process.env.PLAYER_ENTITLEMENT_PRIVATE_KEY_PEM = first.privateKey.export({ format: "pem", type: "pkcs8" }).toString();
    process.env.NEXT_PUBLIC_PLAYER_ENTITLEMENT_PUBLIC_KEY = second.publicKey.export({ format: "der", type: "spki" }).toString("base64");
    process.env.PLAYER_ENTITLEMENT_KEY_ID = "mismatch";
    expect(() => signPlayerEntitlement({ billingState: "active", canActivateNetNewScreen: true, canManageBilling: true, canPairReplacement: true, canPublish: true, canRecoverPlayer: true, deviceId: "30000000-0000-4000-8000-000000000001", hardStopAt: null, issuedAt: "2026-08-24T00:00:00.000Z", playbackMode: "tenant_content", reason: "paid", revision: 1, screenId: "20000000-0000-4000-8000-000000000001", tenantId: "10000000-0000-4000-8000-000000000001", validUntil: "2026-08-31T00:00:00.000Z" })).toThrow("key pair mismatch");
  });
});

function restore(name: string, value: string | undefined) { if (value === undefined) delete process.env[name]; else process.env[name] = value; }
