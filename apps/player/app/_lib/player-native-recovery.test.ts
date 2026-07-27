import { describe, expect, it } from "vitest";

import {
  nativeRecoveryCookieName,
  readNativeRecoveryCredential
} from "./player-native-recovery";

describe("Android native reinstall recovery", () => {
  it("reads only the exact opaque recovery cookie", () => {
    const credential = "a".repeat(64);

    expect(
      readNativeRecoveryCredential(
        `session=ignored; ${nativeRecoveryCookieName}=${credential}; theme=dark`
      )
    ).toBe(credential);
  });

  it("rejects missing, malformed and similarly named cookies", () => {
    expect(readNativeRecoveryCredential(null)).toBeNull();
    expect(
      readNativeRecoveryCredential(
        `${nativeRecoveryCookieName}_copy=${"b".repeat(64)}`
      )
    ).toBeNull();
    expect(
      readNativeRecoveryCredential(`${nativeRecoveryCookieName}=not-a-secret`)
    ).toBeNull();
  });
});
