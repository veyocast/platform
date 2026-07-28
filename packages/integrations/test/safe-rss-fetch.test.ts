import { describe, expect, it } from "vitest";

import { isPublicIp } from "../src/safe-rss-fetch";

describe("RSS SSRF-grens", () => {
  it.each([
    "127.0.0.1",
    "10.0.0.1",
    "172.16.1.1",
    "192.168.1.2",
    "169.254.169.254",
    "100.64.0.1",
    "::1",
    "fd00::1",
    "fe80::1",
    "2001:db8::1"
  ])("blokkeert intern of gereserveerd adres %s", (address) => {
    expect(isPublicIp(address)).toBe(false);
  });

  it.each(["1.1.1.1", "8.8.8.8", "2606:4700:4700::1111"])(
    "accepteert publiek adres %s",
    (address) => {
      expect(isPublicIp(address)).toBe(true);
    }
  );
});
