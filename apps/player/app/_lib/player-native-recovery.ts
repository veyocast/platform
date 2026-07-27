export const nativeRecoveryCookieName = "veyocast_native_recovery";

const nativeRecoveryCredentialPattern = /^[a-f0-9]{64}$/;

export function readNativeRecoveryCredential(cookieHeader: string | null) {
  if (!cookieHeader) return null;

  for (const part of cookieHeader.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 1) continue;
    const name = part.slice(0, separator).trim();
    if (name !== nativeRecoveryCookieName) continue;
    const value = part.slice(separator + 1).trim().toLowerCase();
    return nativeRecoveryCredentialPattern.test(value) ? value : null;
  }

  return null;
}
