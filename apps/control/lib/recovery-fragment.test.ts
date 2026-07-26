import { describe, expect, it } from "vitest";

import { parseRecoveryFragment } from "./recovery-fragment";

describe("password recovery fragment", () => {
  it("extracts only the session fields needed for a recovery session", () => {
    expect(
      parseRecoveryFragment(
        "#access_token=access-secret&refresh_token=refresh-secret&type=recovery&expires_in=3600"
      )
    ).toEqual({
      accessToken: "access-secret",
      refreshToken: "refresh-secret"
    });
  });

  it.each([
    "",
    "#type=invite&access_token=a&refresh_token=b",
    "#type=recovery&access_token=a",
    "#type=recovery&refresh_token=b"
  ])("rejects an incomplete or non-recovery fragment: %s", (fragment) => {
    expect(parseRecoveryFragment(fragment)).toBeNull();
  });
});
