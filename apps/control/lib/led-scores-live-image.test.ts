import { createHash } from "node:crypto";

import sharp from "sharp";
import { describe, expect, it } from "vitest";

import {
  createLedScoresLiveImage,
  createLedScoresLiveImageHandler,
  createLedScoresRateLimiter,
  ledScoresImageContentType,
  ledScoresImageHeight,
  ledScoresImageWidth,
  ledScoresNoCacheHeaders,
  tokenMatchesDigest
} from "./led-scores-live-image";

const testToken = "unit_test_" + "a".repeat(76);
const testTokenDigest = createHash("sha256").update(testToken).digest("hex");

describe("LED Scores live image", () => {
  it("renders an exact 480 × 270 PNG with Dutch date, seconds and requestcode", async () => {
    const first = await createLedScoresLiveImage({
      now: new Date("2026-08-29T14:04:05.000Z"),
      requestCode: "A1B2C3"
    });
    const second = await createLedScoresLiveImage({
      now: new Date("2026-08-29T14:04:06.000Z"),
      requestCode: "D4E5F6"
    });

    expect(first).toMatchObject({
      displayDate: "ZATERDAG 29 AUGUSTUS 2026",
      displayTime: "16:04:05",
      requestCode: "A1B2C3"
    });
    expect(second.displayTime).toBe("16:04:06");
    expect(await sharp(first.bytes).metadata()).toMatchObject({
      format: "png",
      height: ledScoresImageHeight,
      width: ledScoresImageWidth
    });
    expect(sha256(first.bytes)).not.toBe(sha256(second.bytes));
  });

  it("returns fresh image bytes and all required no-cache headers per request", async () => {
    const times = [
      new Date("2026-08-29T14:04:05.000Z"),
      new Date("2026-08-29T14:04:06.000Z"),
      new Date("2026-08-29T14:04:07.000Z")
    ];
    const codes = ["A1B2C3", "D4E5F6", "1A2B3C"];
    const logs: object[] = [];
    const handler = createLedScoresLiveImageHandler({
      clock: () => times.shift()!,
      expectedTokenDigest: testTokenDigest,
      log: (fields) => logs.push(fields),
      requestCode: () => codes.shift()!
    });
    const request = new Request("https://control.veyocast.nl/hidden-test-token", {
      headers: {
        "user-agent": "must-not-be-logged",
        "x-forwarded-for": "203.0.113.10"
      }
    });

    const responses = [
      await handler(request, testToken),
      await handler(request, testToken),
      await handler(request, testToken)
    ];
    const hashes: string[] = [];
    for (const response of responses) {
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toBe(ledScoresImageContentType);
      expect(response.headers.get("cache-control")).toBe(ledScoresNoCacheHeaders["Cache-Control"]);
      expect(response.headers.get("pragma")).toBe(ledScoresNoCacheHeaders.Pragma);
      expect(response.headers.get("expires")).toBe(ledScoresNoCacheHeaders.Expires);
      expect(response.headers.get("surrogate-control")).toBe("no-store");
      hashes.push(sha256(Buffer.from(await response.arrayBuffer())));
    }
    expect(new Set(hashes).size).toBe(3);
    expect(logs).toEqual([
      { outcome: "served", requestCode: "A1B2C3", servedAt: "2026-08-29T14:04:05.000Z", status: 200 },
      { outcome: "served", requestCode: "D4E5F6", servedAt: "2026-08-29T14:04:06.000Z", status: 200 },
      { outcome: "served", requestCode: "1A2B3C", servedAt: "2026-08-29T14:04:07.000Z", status: 200 }
    ]);
    expect(JSON.stringify(logs)).not.toMatch(/203\.0\.113\.10|hidden-test-token|must-not-be-logged/);
  });

  it("fails closed for an invalid token and rate-limits a valid client", async () => {
    const logs: object[] = [];
    const handler = createLedScoresLiveImageHandler({
      clock: () => new Date("2026-08-29T14:04:05.000Z"),
      expectedTokenDigest: testTokenDigest,
      limiter: createLedScoresRateLimiter({ clientLimit: 2, globalLimit: 10 }),
      log: (fields) => logs.push(fields),
      requestCode: () => "A1B2C3"
    });
    const request = new Request("https://control.veyocast.nl/test", {
      headers: { "x-forwarded-for": "203.0.113.10" }
    });

    expect((await handler(request, "invalid")).status).toBe(404);
    expect((await handler(request, testToken)).status).toBe(200);
    expect((await handler(request, testToken)).status).toBe(200);
    const limited = await handler(request, testToken);
    expect(limited.status).toBe(429);
    expect(limited.headers.get("retry-after")).toBe("60");
    expect(logs.at(-1)).toEqual({ outcome: "rate_limited", status: 429 });
  });

  it("compares only long opaque tokens against a SHA-256 digest", () => {
    expect(tokenMatchesDigest(testToken, testTokenDigest)).toBe(true);
    expect(tokenMatchesDigest(`${testToken}x`, testTokenDigest)).toBe(false);
    expect(tokenMatchesDigest("short", testTokenDigest)).toBe(false);
    expect(tokenMatchesDigest(testToken, "invalid")).toBe(false);
  });
});

function sha256(bytes: Uint8Array) {
  return createHash("sha256").update(bytes).digest("hex");
}
