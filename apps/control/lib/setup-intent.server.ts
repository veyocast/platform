import "server-only";

export function setupIntentSigningSecret() {
  const value =
    process.env.VEYOCAST_SETUP_INTENT_SIGNING_SECRET ??
    process.env.NEXT_SERVER_ACTIONS_ENCRYPTION_KEY;
  return value && new TextEncoder().encode(value).byteLength >= 32 ? value : null;
}
