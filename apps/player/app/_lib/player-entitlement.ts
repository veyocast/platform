import { signedPlayerEntitlementSchema, type BillingPlaybackMode, type SignedPlayerEntitlement } from "@veyocast/contracts";

function bytes(value: string) { return Uint8Array.from(atob(value), (character) => character.charCodeAt(0)); }

export async function verifyPlayerEntitlement(envelope: SignedPlayerEntitlement) {
  const parsed = signedPlayerEntitlementSchema.safeParse(envelope);
  const pinned = process.env.NEXT_PUBLIC_PLAYER_ENTITLEMENT_PUBLIC_KEY?.trim();
  if (!parsed.success || !pinned || parsed.data.publicKey !== pinned) return false;
  try {
    const key = await crypto.subtle.importKey("spki", bytes(parsed.data.publicKey), { name: "Ed25519" }, false, ["verify"]);
    return await crypto.subtle.verify({ name: "Ed25519" }, key, bytes(parsed.data.signature), new TextEncoder().encode(JSON.stringify(parsed.data.payload)));
  } catch { return false; }
}

export function resolvePlayerEntitlementMode(envelope: SignedPlayerEntitlement | undefined, now = Date.now()): BillingPlaybackMode {
  if (!envelope) return "tenant_content";
  const payload = envelope.payload;
  if (now + 300_000 < Date.parse(payload.issuedAt)) return "veyocast_verification_splash";
  if (Date.parse(payload.validUntil) < now && payload.playbackMode === "tenant_content") return "veyocast_verification_splash";
  if (payload.playbackMode === "tenant_content_with_warning" && payload.hardStopAt && Date.parse(payload.hardStopAt) <= now) return "veyocast_billing_splash";
  return payload.playbackMode;
}

export function resolveMonotonicPlayerEntitlement(cached: SignedPlayerEntitlement | undefined, fresh: SignedPlayerEntitlement | undefined) {
  if (!cached) return fresh;
  if (!fresh || fresh.payload.revision < cached.payload.revision) return cached;
  return fresh;
}

export function entitlementRemainingDays(envelope: SignedPlayerEntitlement, now = Date.now()) {
  const hardStop = envelope.payload.hardStopAt ? Date.parse(envelope.payload.hardStopAt) : now;
  return Math.max(0, Math.ceil((hardStop - now) / 86_400_000));
}
