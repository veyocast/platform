import { afterEach, describe, expect, it } from "vitest";

import { GET } from "./route";

describe("Player pairing QR", () => {
  afterEach(() => delete process.env.NEXT_PUBLIC_CONTROL_URL);

  it("contains only the temporary public code in the Control deeplink", async () => {
    process.env.NEXT_PUBLIC_CONTROL_URL = "https://control.veyocast.nl";
    const response = await GET(
      new Request("https://player.veyocast.nl/api/player/pairing/qr?code=ABC%20482")
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.text()).toContain("<svg");
  });

  it("rejects malformed codes", async () => {
    expect((await GET(new Request("https://player.test/api/player/pairing/qr?code=secret-token"))).status).toBe(400);
  });
});
