import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";

import { readEngageAbuseSigningSecret } from "./engage-server-secret";
import { deriveEngageVoterHashes } from "./engage-voter-identity";

const root = "local-test-runtime-root-key-with-32-characters";
describe("Engage deployment secret policy", () => {
  it("preserves the original dedicated key and voter identity independently of root rotation", () => {
    const dedicated = ` ${"dedicated-test-key".repeat(3)} `;
    const one = readEngageAbuseSigningSecret({ ENGAGE_ABUSE_SIGNING_SECRET: dedicated, NEXT_SERVER_ACTIONS_ENCRYPTION_KEY: root });
    const two = readEngageAbuseSigningSecret({ ENGAGE_ABUSE_SIGNING_SECRET: dedicated, NEXT_SERVER_ACTIONS_ENCRYPTION_KEY: `${root}-rotated` });
    expect(one).toBe(dedicated); expect(two).toBe(one);
  });
  it("rejects explicit invalid overrides rather than silently changing voter identities", () => {
    for (const invalid of ["", "short", " ".repeat(40)]) expect(() => readEngageAbuseSigningSecret({ ENGAGE_ABUSE_SIGNING_SECRET: invalid, NEXT_SERVER_ACTIONS_ENCRYPTION_KEY: root })).toThrow(/ongeldig/);
  });
  it("fails closed when no explicit persistent runtime root is configured", () => {
    for (const invalid of [undefined, "", "short", " ".repeat(40)]) expect(() => readEngageAbuseSigningSecret({ NEXT_SERVER_ACTIONS_ENCRYPTION_KEY: invalid })).toThrow(/ontbreekt/);
  });
  it("keeps deployment-derived identity stable and separates it from the root and other domains", () => {
    const one = readEngageAbuseSigningSecret({ NEXT_SERVER_ACTIONS_ENCRYPTION_KEY: root });
    expect(one).toMatch(/^[0-9a-f]{64}$/);
    expect(one).toBe(readEngageAbuseSigningSecret({ NEXT_SERVER_ACTIONS_ENCRYPTION_KEY: root }));
    expect(one).not.toBe(root);
    expect(one).not.toBe(createHmac("sha256", root).update("veyocast:another-purpose:v1").digest("hex"));
    const changed = readEngageAbuseSigningSecret({ NEXT_SERVER_ACTIONS_ENCRYPTION_KEY: `${root}-rotated` });
    const identity = (secret: string) => deriveEngageVoterHashes({ campaignId: "campaign", visitorId: "visitor", userAgent: "browser", forwardedFor: null, secret }).identityHash;
    expect(identity(one)).not.toBe(identity(changed));
  });
});
