import { describe, expect, it } from "vitest";

import { createRangeResponse, parseByteRangeHeader } from "./media-range";

describe("cached media byte ranges", () => {
  it("parses bounded, open-ended and suffix byte ranges", () => {
    expect(parseByteRangeHeader("bytes=2-5", 10)).toEqual({
      ok: true,
      range: { end: 5, start: 2 }
    });
    expect(parseByteRangeHeader("bytes=7-", 10)).toEqual({
      ok: true,
      range: { end: 9, start: 7 }
    });
    expect(parseByteRangeHeader("bytes=-3", 10)).toEqual({
      ok: true,
      range: { end: 9, start: 7 }
    });
  });

  it("rejects multiple and unsatisfiable ranges", () => {
    expect(parseByteRangeHeader("bytes=0-1,4-5", 10)).toEqual({
      ok: false,
      reason: "multiple"
    });
    expect(parseByteRangeHeader("bytes=10-", 10)).toEqual({
      ok: false,
      reason: "unsatisfiable"
    });
  });

  it("streams a partial 206 response with correct headers", async () => {
    const source = new TextEncoder().encode("0123456789");
    const response = await createRangeResponse(
      new Response(source, {
        headers: {
          "Content-Length": String(source.byteLength),
          "Content-Type": "video/mp4"
        }
      }),
      "bytes=3-6"
    );

    expect(response.status).toBe(206);
    expect(response.headers.get("Content-Range")).toBe("bytes 3-6/10");
    expect(response.headers.get("Content-Length")).toBe("4");
    expect(await response.text()).toBe("3456");
  });

  it("returns 416 with the full size for invalid requests", async () => {
    const response = await createRangeResponse(
      new Response("0123456789", { headers: { "Content-Length": "10" } }),
      "bytes=20-"
    );

    expect(response.status).toBe(416);
    expect(response.headers.get("Content-Range")).toBe("bytes */10");
  });
});
