import { createHmac, randomUUID } from "node:crypto";

const cookieName = "vc_engage_visitor";

export function getEngageVisitorCookieName() { return cookieName; }

export function createEngageVisitorId() { return randomUUID(); }

export function deriveEngageVoterHashes({
  campaignId,
  forwardedFor,
  secret,
  userAgent,
  visitorId
}: {
  campaignId: string;
  forwardedFor: string | null;
  secret: string;
  userAgent: string | null;
  visitorId: string;
}) {
  if (secret.trim().length < 32) throw new Error("ENGAGE_ABUSE_SIGNING_SECRET ontbreekt of is te kort.");
  const address = normalizeForwardedAddress(forwardedFor);
  const agent = (userAgent ?? "unknown").slice(0, 240);
  return {
    identityHash: digest(secret, `identity:${campaignId}:${visitorId}`),
    networkHash: digest(secret, `network:${address}:${agent}`)
  };
}

function digest(secret: string, value: string) {
  return createHmac("sha256", secret).update(value).digest("hex");
}

function normalizeForwardedAddress(value: string | null) {
  const first = value?.split(",")[0]?.trim() || "unknown";
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(first)) return first.split(".").slice(0, 3).join(".");
  return first.replace(/:[0-9a-f]{0,4}$/i, ":0").slice(0, 120);
}
