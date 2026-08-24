import { afterEach, describe, expect, it } from "vitest";

import { GET } from "./route";

describe("Engage Player QR", () => {
  afterEach(() => {
    delete process.env.NEXT_PUBLIC_CONTROL_URL;
  });

  it("encodes the configured Control public journey in a local SVG", async () => {
    process.env.NEXT_PUBLIC_CONTROL_URL = "https://control.staging.veyocast.nl/";
    const response = await GET(new Request("https://player.test"), {
      params: Promise.resolve({
        publicId: "11111111-1111-4111-8111-111111111111"
      })
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("image/svg+xml");
    expect(await response.text()).toContain("<svg");
  });

  it("rejects malformed public campaign identifiers", async () => {
    const response = await GET(new Request("https://player.test"), {
      params: Promise.resolve({ publicId: "not-an-id" })
    });
    expect(response.status).toBe(404);
  });
});
