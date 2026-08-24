import "server-only";

import { createPrivateKey, createPublicKey, sign } from "node:crypto";
import { playerEntitlementPayloadSchema, type PlayerEntitlementPayload, type SignedPlayerEntitlement } from "@veyocast/contracts";

export function signPlayerEntitlement(payloadInput: PlayerEntitlementPayload): SignedPlayerEntitlement {
  const payload = playerEntitlementPayloadSchema.parse(payloadInput);
  const privatePem = process.env.PLAYER_ENTITLEMENT_PRIVATE_KEY_PEM?.replace(/\\n/g, "\n").trim();
  const expectedPublicKey = process.env.NEXT_PUBLIC_PLAYER_ENTITLEMENT_PUBLIC_KEY?.trim();
  const keyId = process.env.PLAYER_ENTITLEMENT_KEY_ID?.trim();
  if (!privatePem || !expectedPublicKey || !keyId) throw new Error("Player entitlement signing configuration missing");
  const privateKey = createPrivateKey(privatePem);
  const derivedPublicKey = createPublicKey(privateKey).export({ format: "der", type: "spki" }).toString("base64");
  if (derivedPublicKey !== expectedPublicKey) throw new Error("Player entitlement key pair mismatch");
  const serialized = JSON.stringify(payload);
  return { algorithm: "Ed25519", keyId, payload, publicKey: expectedPublicKey, signature: sign(null, Buffer.from(serialized), privateKey).toString("base64") };
}
