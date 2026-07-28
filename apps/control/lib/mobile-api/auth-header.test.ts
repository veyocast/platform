import { describe, expect, it } from "vitest";

import { readBearerToken } from "./auth-header";

describe("mobile API bearer boundary", () => {
  it("accepts one opaque bearer token", () => {
    expect(
      readBearerToken(
        new Request("https://control.veyocast.nl/api/mobile/v1/session", {
          headers: { Authorization: "Bearer signed.access.token" }
        })
      )
    ).toBe("signed.access.token");
  });

  it("rejects missing, basic and whitespace-injected credentials", () => {
    expect(
      readBearerToken(
        new Request("https://control.veyocast.nl/api/mobile/v1/session")
      )
    ).toBeNull();
    expect(
      readBearerToken(
        new Request("https://control.veyocast.nl/api/mobile/v1/session", {
          headers: { Authorization: "Basic abc" }
        })
      )
    ).toBeNull();
    expect(
      readBearerToken(
        new Request("https://control.veyocast.nl/api/mobile/v1/session", {
          headers: { Authorization: "Bearer one two" }
        })
      )
    ).toBeNull();
  });
});
