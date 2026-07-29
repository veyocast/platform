import { describe, expect, it } from "vitest";

import {
  createPinnedLookup,
  isPublicIp
} from "../src/safe-rss-fetch";

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

  it("levert het geverifieerde adres in Node 24 all-modus terug", () => {
    const lookup = createPinnedLookup("203.0.113.10", 4);

    lookup("feed.example", { all: true }, (error, addresses) => {
      expect(error).toBeNull();
      expect(addresses).toEqual([{ address: "203.0.113.10", family: 4 }]);
    });
  });

  it("blijft compatibel met de klassieke single-address callback", () => {
    const lookup = createPinnedLookup("203.0.113.10", 4);

    lookup("feed.example", { all: false }, (error, address, family) => {
      expect(error).toBeNull();
      expect(address).toBe("203.0.113.10");
      expect(family).toBe(4);
    });
  });
});
