import { describe, expect, it } from "vitest";
import type { SignedPlayerEntitlement } from "@veyocast/contracts";
import { entitlementRemainingDays, resolveMonotonicPlayerEntitlement, resolvePlayerEntitlementMode } from "./player-entitlement";

const base: SignedPlayerEntitlement = { algorithm:"Ed25519",keyId:"test",publicKey:"a".repeat(32),signature:"b".repeat(32),payload:{billingState:"active",canActivateNetNewScreen:true,canManageBilling:true,canPairReplacement:true,canPublish:true,canRecoverPlayer:true,deviceId:"30000000-0000-4000-8000-000000000001",hardStopAt:null,issuedAt:"2026-08-24T00:00:00.000Z",playbackMode:"tenant_content",reason:"active",revision:1,screenId:"20000000-0000-4000-8000-000000000001",tenantId:"10000000-0000-4000-8000-000000000001",validUntil:"2026-08-31T00:00:00.000Z"}};
describe("Player entitlement lease",()=>{
  it("uses a neutral verification splash after an active lease expires",()=>expect(resolvePlayerEntitlementMode(base,Date.parse("2026-09-01T00:00:00Z"))).toBe("veyocast_verification_splash"));
  it("hard-stops grace without deleting content",()=>{const grace={...base,payload:{...base.payload,billingState:"grace" as const,playbackMode:"tenant_content_with_warning" as const,hardStopAt:"2026-08-25T00:00:00.000Z"}};expect(resolvePlayerEntitlementMode(grace,Date.parse("2026-08-25T00:00:00Z"))).toBe("veyocast_billing_splash");expect(entitlementRemainingDays(grace,Date.parse("2026-08-24T12:00:00Z"))).toBe(1)});
  it("fails closed on material clock rollback",()=>expect(resolvePlayerEntitlementMode(base,Date.parse("2026-08-23T23:00:00Z"))).toBe("veyocast_verification_splash"));
  it("never replaces a cached entitlement with an older signed revision",()=>{const newer={...base,payload:{...base.payload,revision:2}};expect(resolveMonotonicPlayerEntitlement(newer,base)).toBe(newer);expect(resolveMonotonicPlayerEntitlement(base,newer)).toBe(newer)});
});
